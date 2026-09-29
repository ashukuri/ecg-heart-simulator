import { BeatScheduleItem, ECGLeadId, ECGPoint } from '../types';

/**
 * 25 mm/s で表示するECGカードの横軸の時間幅（秒）
 * 大マス1個 = 0.20秒 × 16マス = 3.20秒。
 * ※ 疾患の scenarioDurationSec とは分離し、ECGカードの表示窓幅としてのみ使用する。
 */
export const ECG_WINDOW_SEC = 3.2;

/**
 * 内部ECG生成サンプリングレート (Hz)
 * QRSの10ms前後の鋭い立ち上がり・ノッチを正確に保持するため 500 Hz (dt = 2ms, 3.2秒で1601点) で生成。
 */
export const ECG_SAMPLE_RATE_HZ = 500;

/**
 * 教育用スロー再生倍率（0.25倍速固定：実時間4.0秒 = 生理学的タイムライン1.0秒）
 */
export const EDUCATION_TIME_SCALE = 0.25;

/**
 * 実時間経過 realDeltaSec (秒) から EDUCATION_TIME_SCALE (0.25×) を適用して masterTimeSec を進める純粋関数
 */
export function advanceMasterTimeSec(
  currentMasterTimeSec: number,
  realDeltaSec: number,
  scenarioDurationSec?: number
): number {
  const deltaPhysiologicalSec = Math.max(0, realDeltaSec) * EDUCATION_TIME_SCALE;
  const next = currentMasterTimeSec + deltaPhysiologicalSec;
  if (scenarioDurationSec !== undefined && scenarioDurationSec > 0 && next >= scenarioDurationSec) {
    return next % scenarioDurationSec;
  }
  return next;
}

/**
 * ECGLeadPanel 標準心電図比率の固定定数 (25 mm/s・10 mm/mV 完全1:1正方グリッド)
 * - 1小マス (1mm = 0.04s × 0.1mV) = 1.8px × 1.8px
 * - 1大マス (5mm = 0.20s × 0.5mV) = 9.0px × 9.0px
 * - 横軸: ECG_WINDOW_SEC = 3.20秒 = 16大マス = 80mm = 144px (25 mm/s)
 * - 縦軸: ±2.25 mV (合計 4.50 mV) = 9大マス = 45mm = 81px (10 mm/mV, 1mV = 18px)
 */
export const ECG_SMALL_GRID_PX = 1.8;
export const ECG_LARGE_GRID_PX = 9.0;
export const ECG_PLOT_W = 144;
export const ECG_PLOT_H = 81;
export const ECG_MV_SCALE = 18;
export const ECG_VERTICAL_RANGE_MV = ECG_PLOT_H / (2 * ECG_MV_SCALE); // 2.25 mV
export const ECG_PADDING_X = 6;
export const ECG_PADDING_Y = 2;
export const ECG_CARD_WIDTH = ECG_PLOT_W + ECG_PADDING_X * 2; // 156px

// 中央ステージ基準サイズ (左4誘導 156px + 中央心臓&下壁3誘導 480px + 右5誘導 156px + gap 16px = 808px × 544px)
export const STAGE_BASE_WIDTH = 808;
export const STAGE_BASE_HEIGHT = 544;

export interface WaveComponent {
  center: number;
  width: number;
  amp: number;
  skew?: number;
}

export function generateGaussianWave(
  t: number,
  components: WaveComponent[],
  baseline: number = 0
): number {
  let v = baseline;
  for (const c of components) {
    const dt = t - c.center;
    const factor = c.skew ? Math.max(0.35, 1 + c.skew * dt) : 1;
    const g = c.amp * Math.exp(-Math.pow(dt / (c.width * factor), 2));
    v += g;
  }
  return Number.isFinite(v) ? v : 0;
}

/**
 * BeatScheduleItem 配列の最終イベント終了時刻（秒）を算出する
 */
export function getLastBeatEventEndSec(beats: BeatScheduleItem[]): number {
  let maxEnd = 0;
  for (const b of beats) {
    if (b.atrialStartSec !== undefined) {
      maxEnd = Math.max(maxEnd, b.atrialStartSec + (b.atrialDurationSec ?? 0.09));
    }
    if (b.avStartSec !== undefined) {
      maxEnd = Math.max(maxEnd, b.avStartSec + (b.avDurationSec ?? 0.09));
    }
    if (b.ventricularStartSec !== undefined && !b.avBlocked && !b.hisBlocked) {
      const vEnd = b.ventricularStartSec + (b.ventricularDurationSec ?? 0.085);
      const repolStart = b.repolarizationStartSec ?? b.ventricularStartSec + 0.16;
      const repolEnd = repolStart + (b.repolarizationDurationSec ?? 0.16);
      const contractionEnd =
        b.ventricularStartSec + (b.ventricularMode === 'torsades' ? 0.20 : 0.255);
      const uEnd =
        b.uWaveStartSec !== undefined
          ? b.uWaveStartSec + (b.uWaveDurationSec ?? 0.10)
          : repolEnd;
      maxEnd = Math.max(maxEnd, vEnd, repolEnd, contractionEnd, uEnd);
    }
  }
  return maxEnd;
}

/**
 * 疾患ごとの scenarioDurationSec を BeatScheduleItem と loopPauseSec (または周期長) から決定する
 */
export function computeScenarioDurationSec(
  beats: BeatScheduleItem[],
  options?: {
    loopPauseSec?: number;
    periodicCycleSec?: number;
  }
): number {
  if (options?.periodicCycleSec !== undefined) {
    return Number(options.periodicCycleSec.toFixed(3));
  }
  const lastEnd = getLastBeatEventEndSec(beats);
  const pause = options?.loopPauseSec ?? 0;
  return Number((lastEnd + pause).toFixed(3));
}

/**
 * 房室接合部調律 (junctional_rhythm) 用ファクトリ:
 * 単一の AV junction source event (sourceStartSec) から、
 * 1) 心房への逆行性伝播 (retrograde atrial propagation -> 逆行性陰性P波)
 * 2) His-Purkinjeへの順行性伝播 (antegrade His-Purkinje propagation -> 正常Narrow QRS)
 * の双方向を一元的に派生させる（SA node発火は false）。
 */
export function createJunctionalEscapeBeat(
  sourceStartSec: number,
  options?: {
    retrogradeAtrialDelaySec?: number;
    antegradeHisDelaySec?: number;
    atrialDurationSec?: number;
    ventricularDurationSec?: number;
  }
): BeatScheduleItem {
  const retroDelay = options?.retrogradeAtrialDelaySec ?? 0.01;
  const anteDelay = options?.antegradeHisDelaySec ?? 0.06;
  const atrialDur = options?.atrialDurationSec ?? 0.08;
  const ventDur = options?.ventricularDurationSec ?? 0.085;
  const atrialStart = Number((sourceStartSec + retroDelay).toFixed(4));
  const ventStart = Number((sourceStartSec + anteDelay).toFixed(4));

  return {
    sourceStartSec,
    sourceRegion: 'av_junction',
    saNodeFiring: false,
    atrialPropagation: 'retrograde',
    ventricularPropagation: 'antegrade',
    atrialStartSec: atrialStart,
    atrialDurationSec: atrialDur,
    atrialMode: 'retrograde',
    avStartSec: sourceStartSec,
    avDurationSec: anteDelay,
    ventricularStartSec: ventStart,
    ventricularDurationSec: ventDur,
    repolarizationStartSec: Number((ventStart + 0.16).toFixed(4)),
    repolarizationDurationSec: 0.16,
    ventricularMode: 'normal',
  };
}

export interface TorsadesPropagationSpec {
  primaryActivationRegion: 'rv_wall' | 'iv_septum' | 'lv_anterior' | 'lv_lateral' | 'lv_inferior';
  secondaryActivationRegion: 'rv_wall' | 'iv_septum' | 'lv_anterior' | 'lv_lateral' | 'lv_inferior';
  propagationDirection: string;
}

/**
 * TdP の電気軸角度 (axisAngleDeg: -180°〜+180°) から、
 * 心臓断面における主脱分極領域 (primaryActivationRegion)、二次伝播領域 (secondaryActivationRegion)、
 * および伝播方向 (propagationDirection) を数学的・解剖学的に一意導出する。
 */
export function deriveTorsadesPropagationFromAxis(axisAngleDeg: number): TorsadesPropagationSpec {
  // -180 <= deg <= 180 に正規化
  const deg = ((((axisAngleDeg + 180) % 360) + 360) % 360) - 180;

  if (deg < -125) {
    return {
      primaryActivationRegion: 'lv_lateral',
      secondaryActivationRegion: 'rv_wall',
      propagationDirection: 'lv_lateral_to_rv_superior',
    };
  }
  if (deg < -80) {
    return {
      primaryActivationRegion: 'lv_inferior',
      secondaryActivationRegion: 'iv_septum',
      propagationDirection: 'inferior_to_septal_superior',
    };
  }
  if (deg < -25) {
    return {
      primaryActivationRegion: 'iv_septum',
      secondaryActivationRegion: 'lv_lateral',
      propagationDirection: 'septum_to_high_lateral',
    };
  }
  if (deg < 35) {
    return {
      primaryActivationRegion: 'rv_wall',
      secondaryActivationRegion: 'lv_anterior',
      propagationDirection: 'rv_to_lv_anterior_leftward',
    };
  }
  if (deg < 95) {
    return {
      primaryActivationRegion: 'lv_anterior',
      secondaryActivationRegion: 'lv_inferior',
      propagationDirection: 'anterior_to_inferior_apex',
    };
  }
  if (deg < 120) {
    return {
      primaryActivationRegion: 'lv_lateral',
      secondaryActivationRegion: 'lv_inferior',
      propagationDirection: 'high_lateral_to_inferior_right',
    };
  }
  if (deg < 145) {
    return {
      primaryActivationRegion: 'iv_septum',
      secondaryActivationRegion: 'rv_wall',
      propagationDirection: 'septum_to_rv_inferior',
    };
  }
  return {
    primaryActivationRegion: 'lv_inferior',
    secondaryActivationRegion: 'rv_wall',
    propagationDirection: 'apical_inferior_to_rv_basal',
  };
}

/**
 * TdP の各拍 BeatScheduleItem を生成するファクトリ:
 * axisAngleDeg と amplitudeStrength から ECG波形・心筋脱分極・壁収縮を完全連動させる
 */
export function createTorsadesBeat(
  startSec: number,
  axisAngleDeg: number,
  amplitudeStrength: number
): BeatScheduleItem {
  const prop = deriveTorsadesPropagationFromAxis(axisAngleDeg);
  const vStart = Number(startSec.toFixed(3));
  return {
    sourceStartSec: vStart,
    sourceRegion: 'ventricle_ectopic',
    saNodeFiring: false,
    atrialPropagation: 'none',
    ventricularPropagation: 'torsades_rotor',
    atrialMode: 'none',
    ventricularStartSec: vStart,
    ventricularDurationSec: 0.13,
    repolarizationStartSec: Number((vStart + 0.08).toFixed(3)),
    repolarizationDurationSec: 0.09,
    ventricularMode: 'torsades',
    axisAngleDeg,
    activationStrength: amplitudeStrength,
    contractionStrength: amplitudeStrength,
    primaryActivationRegion: prop.primaryActivationRegion,
    secondaryActivationRegion: prop.secondaryActivationRegion,
    propagationDirection: prop.propagationDirection,
  };
}

export interface LeadMorphologyTemplate {
  pAmp: number;
  qAmp: number;
  rAmp: number;
  sAmp: number;
  tAmp: number;
  rPrimeAmp?: number;
  stOffset?: number;
}

/**
 * 基準テンプレート（I と II は前額面ソース、V1〜V6 は水平面胸部誘導）
 * III, aVR, aVL, aVF は必ず I と II から Einthoven / Goldberger 恒等式で数学的に導出する。
 */
export const BASE_LIMB_AND_CHEST_TEMPLATE: Record<'I' | 'II' | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6', LeadMorphologyTemplate> = {
  I:  { pAmp: 0.12, qAmp: -0.05, rAmp: 0.90, sAmp: -0.12, tAmp: 0.26 },
  II: { pAmp: 0.21, qAmp: -0.06, rAmp: 1.38, sAmp: -0.15, tAmp: 0.38 },
  V1: { pAmp: 0.09, qAmp: 0.00,  rAmp: 0.28, sAmp: -1.15, tAmp: 0.12 },
  V2: { pAmp: 0.11, qAmp: 0.00,  rAmp: 0.48, sAmp: -1.35, tAmp: 0.32 },
  V3: { pAmp: 0.12, qAmp: -0.02, rAmp: 0.85, sAmp: -0.85, tAmp: 0.38 },
  V4: { pAmp: 0.13, qAmp: -0.05, rAmp: 1.35, sAmp: -0.45, tAmp: 0.42 },
  V5: { pAmp: 0.13, qAmp: -0.08, rAmp: 1.50, sAmp: -0.20, tAmp: 0.40 },
  V6: { pAmp: 0.12, qAmp: -0.07, rAmp: 1.22, sAmp: -0.12, tAmp: 0.34 },
};

export type PrimarySourceLeadId = 'I' | 'II' | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6';

/**
 * 1拍の波形を一次ソース誘導 (I, II, V1〜V6) 上で秒単位 (tSec) にて評価する
 */
export function evaluateBeatOnPrimaryLead(
  lead: PrimarySourceLeadId,
  tSec: number,
  beat: BeatScheduleItem,
  customTemplate?: Partial<Record<PrimarySourceLeadId, Partial<LeadMorphologyTemplate>>>,
  options?: {
    qtFactor?: number;
    tWidthSec?: number;
    tAmpFactor?: number;
    uWaveAmp?: Partial<Record<PrimarySourceLeadId, number>> | number;
    pAmpFactor?: number;
    qrsWidthFactor?: number;
  }
): number {
  const base = {
    ...BASE_LIMB_AND_CHEST_TEMPLATE[lead],
    ...(customTemplate?.[lead] || {}),
  };

  let v = 0;
  const pAmpFactor = options?.pAmpFactor ?? 1.0;
  const qrsWidthFactor = options?.qrsWidthFactor ?? 1.0;

  // 1. 心房興奮 (P波)
  if (beat.atrialStartSec !== undefined && beat.atrialMode !== 'none') {
    const pCenter = beat.atrialStartSec + (beat.atrialDurationSec ?? 0.09) * 0.5;
    const pWidth = (beat.atrialDurationSec ?? 0.09) * 0.38;
    let pAmp = base.pAmp * pAmpFactor;

    if (beat.atrialMode === 'retrograde') {
      // 逆行性P波: IIで陰性 (-0.19mV)、Iはほぼ平坦 (-0.02mV) → III, aVFも陰性、aVRは陽性 (+0.105mV) に導出される
      if (lead === 'II') pAmp = -0.19;
      else if (lead === 'I') pAmp = -0.02;
      else pAmp = base.pAmp * -0.4;
    } else if (beat.atrialMode === 'ectopic') {
      if (lead === 'II') pAmp = base.pAmp * 0.55;
      else if (lead === 'V1') pAmp = -0.12;
      else pAmp = base.pAmp * 0.65;
    }

    if (lead === 'V1' && beat.atrialMode === 'normal') {
      v += 0.10 * pAmpFactor * Math.exp(-Math.pow((tSec - (pCenter - 0.012)) / (pWidth * 0.75), 2));
      v += -0.06 * pAmpFactor * Math.exp(-Math.pow((tSec - (pCenter + 0.015)) / (pWidth * 0.75), 2));
    } else {
      v += pAmp * Math.exp(-Math.pow((tSec - pCenter) / pWidth, 2));
    }
  }

  // 2. 心室興奮 (QRS-ST-T) — 脱落拍 (avBlocked / hisBlocked) の場合はQRSを発生させない
  if (
    beat.ventricularStartSec !== undefined &&
    !beat.avBlocked &&
    !beat.hisBlocked
  ) {
    const qrsStart = beat.ventricularStartSec;
    const mode = beat.ventricularMode ?? 'normal';

    if (mode === 'rbbb') {
      const qCenter = qrsStart + 0.018;
      const rCenter = qrsStart + 0.038;
      const sCenter = qrsStart + 0.062;
      const rPrimeCenter = qrsStart + 0.098;
      const tCenter =
        beat.repolarizationStartSec !== undefined
          ? beat.repolarizationStartSec + (beat.repolarizationDurationSec ?? 0.18) * 0.5
          : qrsStart + 0.27;

      if (lead === 'V1' || lead === 'V2') {
        const r1 = lead === 'V1' ? 0.32 : 0.45;
        const s1 = lead === 'V1' ? -0.38 : -0.50;
        const r2 = lead === 'V1' ? 1.25 : 1.05;
        v += r1 * Math.exp(-Math.pow((tSec - (qrsStart + 0.022)) / 0.011, 2));
        v += s1 * Math.exp(-Math.pow((tSec - (qrsStart + 0.048)) / 0.012, 2));
        v += r2 * Math.exp(-Math.pow((tSec - rPrimeCenter) / 0.024, 2));
        v += -0.32 * Math.exp(-Math.pow((tSec - tCenter) / 0.055, 2));
      } else if (lead === 'V3') {
        v += 0.65 * Math.exp(-Math.pow((tSec - rCenter) / 0.014, 2));
        v += -0.55 * Math.exp(-Math.pow((tSec - sCenter) / 0.015, 2));
        v += 0.55 * Math.exp(-Math.pow((tSec - rPrimeCenter) / 0.022, 2));
        v += -0.15 * Math.exp(-Math.pow((tSec - tCenter) / 0.055, 2));
      } else if (lead === 'I' || lead === 'V4' || lead === 'V5' || lead === 'V6') {
        v += base.qAmp * Math.exp(-Math.pow((tSec - qCenter) / 0.009, 2));
        v += base.rAmp * 0.92 * Math.exp(-Math.pow((tSec - rCenter) / 0.014, 2));
        const sDepth = lead === 'V4' ? -0.62 : lead === 'V5' ? -0.56 : -0.52;
        v += sDepth * Math.exp(-Math.pow((tSec - (qrsStart + 0.092)) / 0.028, 2));
        v += base.tAmp * Math.exp(-Math.pow((tSec - tCenter) / 0.055, 2));
      } else {
        // II (ここから III, aVR, aVL, aVF が導出され、aVRの終末R'波やaVLの深いslurred Sが完全整合で生まれる)
        v += base.qAmp * Math.exp(-Math.pow((tSec - qCenter) / 0.009, 2));
        v += base.rAmp * 0.85 * Math.exp(-Math.pow((tSec - rCenter) / 0.015, 2));
        v += -0.32 * Math.exp(-Math.pow((tSec - (qrsStart + 0.092)) / 0.026, 2));
        v += base.tAmp * Math.exp(-Math.pow((tSec - tCenter) / 0.055, 2));
      }
    } else if (mode === 'lbbb') {
      const r1Center = qrsStart + 0.036;
      const r2Center = qrsStart + 0.088;
      const qsCenter = qrsStart + 0.062;
      const stCenter = qrsStart + 0.16;
      const tCenter = qrsStart + 0.27;

      if (lead === 'I' || lead === 'V5' || lead === 'V6') {
        const peak = lead === 'V5' ? 1.25 : lead === 'V6' ? 1.15 : 1.05;
        v += peak * 0.82 * Math.exp(-Math.pow((tSec - r1Center) / 0.024, 2));
        v += peak * 1.00 * Math.exp(-Math.pow((tSec - r2Center) / 0.026, 2));
        v += -0.22 * Math.exp(-Math.pow((tSec - stCenter) / 0.055, 2));
        v += -0.38 * Math.exp(-Math.pow((tSec - tCenter) / 0.060, 2));
      } else if (lead === 'V1' || lead === 'V2' || lead === 'V3') {
        const depth = lead === 'V2' ? -1.65 : lead === 'V1' ? -1.45 : -1.20;
        if (lead === 'V3') {
          v += 0.18 * Math.exp(-Math.pow((tSec - (qrsStart + 0.016)) / 0.009, 2));
        }
        v += depth * Math.exp(-Math.pow((tSec - qsCenter) / 0.038, 2));
        v += 0.28 * Math.exp(-Math.pow((tSec - stCenter) / 0.055, 2));
        v += 0.42 * Math.exp(-Math.pow((tSec - tCenter) / 0.060, 2));
      } else if (lead === 'V4') {
        v += 0.25 * Math.exp(-Math.pow((tSec - (qrsStart + 0.020)) / 0.012, 2));
        v += -0.75 * Math.exp(-Math.pow((tSec - (qrsStart + 0.055)) / 0.024, 2));
        v += 0.65 * Math.exp(-Math.pow((tSec - (qrsStart + 0.092)) / 0.024, 2));
        v += -0.18 * Math.exp(-Math.pow((tSec - tCenter) / 0.058, 2));
      } else {
        // II (Iが高ノッチR波、IIが中等度陽性〜二相性 → aVL = I - II/2 で高ノッチR波、III = II - I で陰性QS波が自動導出)
        v += 0.55 * Math.exp(-Math.pow((tSec - r1Center) / 0.024, 2));
        v += 0.45 * Math.exp(-Math.pow((tSec - r2Center) / 0.026, 2));
        v += -0.12 * Math.exp(-Math.pow((tSec - stCenter) / 0.055, 2));
        v += -0.20 * Math.exp(-Math.pow((tSec - tCenter) / 0.060, 2));
      }
    } else if (mode === 'wpw') {
      const deltaStart = qrsStart;
      const mainPeak = qrsStart + 0.075;
      const tCenter = qrsStart + 0.25;

      const wpwPrimaryMap: Record<PrimarySourceLeadId, { delta: number; r: number; s: number; t: number }> = {
        I:  { delta: 0.44, r: 1.00, s: -0.05, t: -0.16 },
        II: { delta: 0.52, r: 1.32, s: -0.08, t: 0.24 },
        V1: { delta: 0.42, r: 0.95, s: -0.25, t: -0.28 },
        V2: { delta: 0.50, r: 1.15, s: -0.30, t: -0.25 },
        V3: { delta: 0.55, r: 1.30, s: -0.20, t: -0.15 },
        V4: { delta: 0.60, r: 1.48, s: -0.12, t: 0.22 },
        V5: { delta: 0.58, r: 1.55, s: -0.08, t: 0.28 },
        V6: { delta: 0.48, r: 1.30, s: -0.05, t: 0.25 },
      };
      const cfg = wpwPrimaryMap[lead];
      v += cfg.delta * Math.exp(-Math.pow((tSec - (deltaStart + 0.038)) / 0.032, 2));
      v += cfg.r * Math.exp(-Math.pow((tSec - mainPeak) / 0.018, 2));
      if (cfg.s !== 0) {
        v += cfg.s * Math.exp(-Math.pow((tSec - (mainPeak + 0.025)) / 0.014, 2));
      }
      v += cfg.t * Math.exp(-Math.pow((tSec - tCenter) / 0.058, 2));
    } else if (mode === 'ectopic_rv' || mode === 'ectopic_lv') {
      const center = qrsStart + 0.065;
      const tCenter = qrsStart + 0.22;
      const ectopicPrimaryMap: Record<PrimarySourceLeadId, number> =
        mode === 'ectopic_rv'
          ? {
              // RVOT起源: I=+0.35, II=+1.45 → III=+1.10, aVF=+1.275, aVL=-0.375, aVR=-0.90
              I: 0.35, II: 1.45,
              V1: -1.35, V2: -1.45, V3: -0.95, V4: 0.75, V5: 1.35, V6: 1.25,
            }
          : {
              // 左室心尖部瘢痕起源 (VT): I=-0.55, II=-1.40 → III=-0.85, aVF=-1.125, aVR=+0.975, aVL=+0.15
              I: -0.55, II: -1.40,
              V1: 1.35, V2: 1.20, V3: 0.95, V4: -0.85, V5: -1.25, V6: -1.15,
            };
      const amp = ectopicPrimaryMap[lead];
      v += amp * 0.75 * Math.exp(-Math.pow((tSec - (center - 0.020)) / 0.026, 2));
      v += amp * 0.95 * Math.exp(-Math.pow((tSec - (center + 0.018)) / 0.028, 2));
      v += -amp * 0.34 * Math.exp(-Math.pow((tSec - tCenter) / 0.058, 2));
    } else if (mode === 'torsades') {
      // TdP: 前額面双極子 (Ex=cos(theta), Ey=sin(theta)) から I = Ex, II = 0.5*Ex + (sqrt(3)/2)*Ey で投影
      // これにより III, aVR, aVL, aVF の角度投影も Einthoven/Goldberger と数学的に完全一致する
      const angleRad = ((beat.axisAngleDeg ?? 45) * Math.PI) / 180;
      const ex = Math.cos(angleRad);
      const ey = Math.sin(angleRad);

      let proj: number;
      if (lead === 'I') {
        proj = ex;
      } else if (lead === 'II') {
        proj = 0.5 * ex + (Math.sqrt(3) / 2) * ey;
      } else {
        const chestAngles: Record<'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6', number> = {
          V1: 115, V2: 90, V3: 65, V4: 45, V5: 22, V6: 0,
        };
        proj = Math.cos(angleRad - (chestAngles[lead] * Math.PI) / 180);
      }
      const center = qrsStart + 0.055;
      const amp = 1.38 * proj * (beat.contractionStrength ?? 1.0);
      v += amp * Math.exp(-Math.pow((tSec - center) / 0.036, 2));
      v += -amp * 0.28 * Math.exp(-Math.pow((tSec - (center + 0.075)) / 0.042, 2));
    } else {
      // normal / lafb / lpfb / MI / electrolyte
      const qCenter = qrsStart + 0.014 * qrsWidthFactor;
      const rCenter = qrsStart + 0.036 * qrsWidthFactor;
      const sCenter = qrsStart + 0.058 * qrsWidthFactor;

      let qAmp = base.qAmp;
      let rAmp = base.rAmp;
      let sAmp = base.sAmp;

      if (mode === 'lafb') {
        // 左脚前枝ブロック: 前額面ソース I と II に軸偏位を与え、III, aVL, aVF, aVR を自動導出
        // I: q=-0.12, R=+0.98 | II: r=+0.24, S=-0.72
        // → III = II - I: r=+0.36, S=-1.70 (S in III > S in II)
        // → aVL = I - II/2: q=-0.24, R=+1.34 (高いqR)
        // → aVF = II - I/2: r=+0.30, S=-1.21 (深いrS)
        if (lead === 'I') {
          qAmp = -0.12; rAmp = 0.98; sAmp = 0;
        } else if (lead === 'II') {
          qAmp = 0.24; rAmp = -0.72; sAmp = 0; // qCenterで初期小r(+0.24)、rCenterで深い主S波(-0.72)
        } else if (lead === 'V5' || lead === 'V6') {
          sAmp = -0.45;
        }
      } else if (mode === 'lpfb') {
        // 左脚後枝ブロック: 前額面ソース I と II に右軸偏位を与え、III, aVL, aVF, aVR を自動導出
        // I: r=+0.22, S=-0.88 | II: q=-0.10, R=+0.88
        // → III = II - I: q=-0.32, R=+1.76 (R in III > R in II)
        // → aVL = I - II/2: r=+0.27, S=-1.32 (深いrS)
        // → aVF = II - I/2: q=-0.21, R=+1.32 (高いqR)
        if (lead === 'I') {
          qAmp = 0.22; rAmp = -0.88; sAmp = 0;
        } else if (lead === 'II') {
          qAmp = -0.10; rAmp = 0.88; sAmp = 0;
        }
      }

      if (qAmp !== 0) {
        v += qAmp * Math.exp(-Math.pow((tSec - qCenter) / (0.009 * qrsWidthFactor), 2));
      }
      if (rAmp !== 0) {
        v += rAmp * Math.exp(-Math.pow((tSec - rCenter) / (0.014 * qrsWidthFactor), 2));
      }
      if (sAmp !== 0) {
        v += sAmp * Math.exp(-Math.pow((tSec - sCenter) / (0.013 * qrsWidthFactor), 2));
      }
      if (base.rPrimeAmp) {
        v += base.rPrimeAmp * Math.exp(-Math.pow((tSec - (sCenter + 0.028)) / 0.018, 2));
      }

      if (base.stOffset && base.stOffset !== 0) {
        const stCenter = qrsStart + 0.135;
        v += base.stOffset * Math.exp(-Math.pow((tSec - stCenter) / 0.075, 2));
      }

      const qtScale = options?.qtFactor ?? 1.0;
      const defaultTStart = qrsStart + 0.16 * qtScale;
      const tStart = beat.repolarizationStartSec ?? defaultTStart;
      const tDur = beat.repolarizationDurationSec ?? 0.16;
      const tCenter = tStart + tDur * 0.5;
      const tWidth = options?.tWidthSec ?? tDur * 0.36;
      const tAmp = base.tAmp * (options?.tAmpFactor ?? 1.0);

      v += tAmp * Math.exp(-Math.pow((tSec - tCenter) / tWidth, 2));

      if (options?.uWaveAmp !== undefined) {
        const uAmp =
          typeof options.uWaveAmp === 'number'
            ? options.uWaveAmp
            : (options.uWaveAmp[lead] ?? 0);
        const uCenter =
          beat.uWaveStartSec !== undefined
            ? beat.uWaveStartSec + (beat.uWaveDurationSec ?? 0.10) * 0.5
            : tCenter + tWidth * 2.2;
        v += uAmp * Math.exp(-Math.pow((tSec - uCenter) / 0.045, 2));
      }
    }
  }

  return Number.isFinite(v) ? v : 0;
}

/**
 * 500 Hz サンプリング & Einthoven / Goldberger 数学的導出による標準12誘導波形生成エンジン
 *
 * - 四肢誘導はまず I と II を生成し、全サンプルについて以下を厳密に算出する:
 *   III = II - I
 *   aVR = -(I + II) / 2
 *   aVL = I - II / 2
 *   aVF = II - I / 2
 * - V1〜V6 は胸部誘導テンプレートから生成する。
 * - tSec > scenarioDurationSec の区間は自動的に等電位基線 (0 mV) となる。
 */
export function build12LeadsFromSchedule(
  beats: BeatScheduleItem[],
  scenarioDurationSec: number,
  options?: {
    customTemplate?: Partial<Record<PrimarySourceLeadId, Partial<LeadMorphologyTemplate>>>;
    qtFactor?: number;
    tWidthSec?: number;
    tAmpFactor?: number;
    uWaveAmp?: Partial<Record<PrimarySourceLeadId, number>> | number;
    pAmpFactor?: number;
    qrsWidthFactor?: number;
    continuousWaveFunc?: (lead: PrimarySourceLeadId, tSec: number) => number;
  }
): Record<ECGLeadId, ECGPoint[]> {
  const sampleCount = Math.round(ECG_WINDOW_SEC * ECG_SAMPLE_RATE_HZ); // 3.2s * 500Hz = 1600区間 (1601点)

  const result: Record<ECGLeadId, ECGPoint[]> = {
    I: [], II: [], III: [], aVR: [], aVL: [], aVF: [],
    V1: [], V2: [], V3: [], V4: [], V5: [], V6: [],
  };

  const chestLeads: ('V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6')[] = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

  const evalPrimary = (lead: PrimarySourceLeadId, tSec: number): number => {
    if (tSec > scenarioDurationSec + 1e-9) return 0;
    let val = options?.continuousWaveFunc ? options.continuousWaveFunc(lead, tSec) : 0;
    for (const beat of beats) {
      val += evaluateBeatOnPrimaryLead(lead, tSec, beat, options?.customTemplate, options);
    }
    return Number.isFinite(val) ? val : 0;
  };

  for (let i = 0; i <= sampleCount; i++) {
    const tNorm = i / sampleCount;
    const tSec = tNorm * ECG_WINDOW_SEC;

    // 1. 前額面一次ソース I と II を評価
    const vI = evalPrimary('I', tSec);
    const vII = evalPrimary('II', tSec);

    // 2. Einthoven の法則 & Goldberger の増高単極肢誘導方程式から III, aVR, aVL, aVF を厳密導出
    const vIII = vII - vI;
    const vaVR = -(vI + vII) / 2;
    const vaVL = vI - vII / 2;
    const vaVF = vII - vI / 2;

    result.I.push({ t: tNorm, v: vI });
    result.II.push({ t: tNorm, v: vII });
    result.III.push({ t: tNorm, v: vIII });
    result.aVR.push({ t: tNorm, v: vaVR });
    result.aVL.push({ t: tNorm, v: vaVL });
    result.aVF.push({ t: tNorm, v: vaVF });

    // 3. 水平面胸部誘導 V1〜V6 を評価
    for (const cLead of chestLeads) {
      result[cLead].push({ t: tNorm, v: evalPrimary(cLead, tSec) });
    }
  }

  return result;
}
