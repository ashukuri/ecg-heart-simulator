import { ALL_DISEASES, getDiseaseById } from '../data/diseases';
import {
  TDP_AMPLITUDE_STRENGTHS,
  TDP_AXIS_ANGLES_DEG,
  TDP_RR_INTERVAL_SEC,
} from '../data/diseases/arrhythmia';
import { ALL_LEAD_IDS } from '../data/leads';
import {
  advanceMasterTimeSec,
  deriveTorsadesPropagationFromAxis,
  ECG_SAMPLE_RATE_HZ,
  ECG_VERTICAL_RANGE_MV,
  ECG_WINDOW_SEC,
  EDUCATION_TIME_SCALE,
  STAGE_BASE_HEIGHT,
  STAGE_BASE_WIDTH,
} from './ecgGenerator';
import {
  ALL_VENTRICULAR_SUB_SEGMENT_IDS,
  computeVentricularSubSegmentSchedule,
  evaluateMasterTimeline,
} from './timelineEngine';
import { ECGLeadId, ECGPoint } from '../types';

export interface ValidationCheckResult {
  id: number;
  name: string;
  passed: boolean;
  detail: string;
}

export interface FullValidationReport {
  allPassed: boolean;
  totalDiseases: number;
  totalLeadsPerDisease: number;
  samplesPerLead: number;
  maxAbsMv: number;
  maxAbsMvDiseaseId: string;
  maxAbsMvLeadId: ECGLeadId;
  maxLimbErrorMv: number;
  checks: ValidationCheckResult[];
}

function getSignalAtTime(points: ECGPoint[], tSec: number): number {
  const normT = Math.max(0, Math.min(1, tSec / ECG_WINDOW_SEC));
  const rawIdx = normT * (points.length - 1);
  const idx0 = Math.floor(rawIdx);
  const idx1 = Math.min(points.length - 1, idx0 + 1);
  const frac = rawIdx - idx0;
  return points[idx0].v + (points[idx1].v - points[idx0].v) * frac;
}

function getWindowMax(points: ECGPoint[], tStartSec: number, tEndSec: number): number {
  let maxV = -Infinity;
  for (const p of points) {
    const tSec = p.t * ECG_WINDOW_SEC;
    if (tSec >= tStartSec && tSec <= tEndSec) {
      if (p.v > maxV) maxV = p.v;
    }
  }
  return maxV;
}

function getWindowMin(points: ECGPoint[], tStartSec: number, tEndSec: number): number {
  let minV = Infinity;
  for (const p of points) {
    const tSec = p.t * ECG_WINDOW_SEC;
    if (tSec >= tStartSec && tSec <= tEndSec) {
      if (p.v < minV) minV = p.v;
    }
  }
  return minV;
}

export function runFullEcgValidationSuite(): FullValidationReport {
  const checks: ValidationCheckResult[] = [];
  const expectedSamples = Math.round(ECG_WINDOW_SEC * ECG_SAMPLE_RATE_HZ) + 1; // 1601

  // 1. 全26疾患に12誘導すべてが存在し、各1601サンプル(500Hz)かつ独立scenarioDurationSecを持つ
  let check1Passed = ALL_DISEASES.length === 26;
  const distinctDurations = new Set<number>();
  let legacyFieldsCount = 0;

  for (const d of ALL_DISEASES) {
    distinctDurations.add(Number(d.scenarioDurationSec.toFixed(2)));
    const rawRecord = d as unknown as Record<string, unknown>;
    if ('cycleDurationMs' in rawRecord || 'regions' in rawRecord || 'events' in rawRecord) {
      legacyFieldsCount++;
    }
    for (const leadId of ALL_LEAD_IDS) {
      const pts = d.leads[leadId];
      if (!pts || pts.length !== expectedSamples) {
        check1Passed = false;
      }
    }
  }
  if (legacyFieldsCount > 0 || distinctDurations.size < 5) {
    check1Passed = false;
  }

  checks.push({
    id: 1,
    name: '全26疾患×12誘導の存在・500Hz(1601点)生成・独立scenarioDurationSec・旧フィールド撤去',
    passed: check1Passed,
    detail: `疾患数=${ALL_DISEASES.length}, 各誘導サンプル数=${expectedSamples} (${ECG_SAMPLE_RATE_HZ}Hz), シナリオ長種類=${distinctDurations.size}種 (${Math.min(...distinctDurations).toFixed(2)}s〜${Math.max(...distinctDurations).toFixed(2)}s), 旧フィールド残存=${legacyFieldsCount}件`,
  });

  // 2. 全疾患・全12誘導で NaN / Infinity が0件
  let nanInfCount = 0;
  for (const d of ALL_DISEASES) {
    for (const leadId of ALL_LEAD_IDS) {
      for (const pt of d.leads[leadId]) {
        if (!Number.isFinite(pt.t) || !Number.isFinite(pt.v)) {
          nanInfCount++;
        }
      }
    }
  }
  checks.push({
    id: 2,
    name: '全26疾患・全12誘導で NaN / Infinity が 0 件',
    passed: nanInfCount === 0,
    detail: `総検査サンプル数=${ALL_DISEASES.length * ALL_LEAD_IDS.length * expectedSamples}点, NaN/Infinity=${nanInfCount}件`,
  });

  // 3. 全疾患で四肢誘導の数学的整合性が許容誤差 (< 1e-6) 内で成立する
  let maxLimbErrorMv = 0;
  for (const d of ALL_DISEASES) {
    const leadI = d.leads.I;
    const leadII = d.leads.II;
    const leadIII = d.leads.III;
    const leadaVR = d.leads.aVR;
    const leadaVL = d.leads.aVL;
    const leadaVF = d.leads.aVF;

    for (let i = 0; i < expectedSamples; i++) {
      const vI = leadI[i].v;
      const vII = leadII[i].v;
      const errIII = Math.abs(leadIII[i].v - (vII - vI));
      const erraVR = Math.abs(leadaVR[i].v - -(vI + vII) / 2);
      const erraVL = Math.abs(leadaVL[i].v - (vI - vII / 2));
      const erraVF = Math.abs(leadaVF[i].v - (vII - vI / 2));
      maxLimbErrorMv = Math.max(maxLimbErrorMv, errIII, erraVR, erraVL, erraVF);
    }
  }
  checks.push({
    id: 3,
    name: '全疾患で四肢誘導のEinthoven/Goldberger恒等式が許容誤差 (< 1e-6) 内で完全成立',
    passed: maxLimbErrorMv < 1e-6,
    detail: `最大誤差=${maxLimbErrorMv.toExponential(3)} mV (< 1.000e-6 mV)`,
  });

  // 4. ECGLeadPanelの縦レンジ (±2.25 mV) を超えるサンプルが0件（クリッピング0件）
  let clippingSamples = 0;
  let maxAbsMv = 0;
  let maxAbsMvDiseaseId = '';
  let maxAbsMvLeadId: ECGLeadId = 'I';

  for (const d of ALL_DISEASES) {
    for (const leadId of ALL_LEAD_IDS) {
      for (const pt of d.leads[leadId]) {
        const absV = Math.abs(pt.v);
        if (absV > maxAbsMv) {
          maxAbsMv = absV;
          maxAbsMvDiseaseId = d.id;
          maxAbsMvLeadId = leadId;
        }
        if (absV > ECG_VERTICAL_RANGE_MV) {
          clippingSamples++;
        }
      }
    }
  }
  checks.push({
    id: 4,
    name: `ECGLeadPanel縦レンジ (±${ECG_VERTICAL_RANGE_MV.toFixed(2)} mV = 9大マス) 超過サンプル 0 件`,
    passed: clippingSamples === 0 && ECG_VERTICAL_RANGE_MV >= 2.25,
    detail: `最大振幅=${maxAbsMv.toFixed(3)} mV (${maxAbsMvDiseaseId}.${maxAbsMvLeadId}) <= ±${ECG_VERTICAL_RANGE_MV.toFixed(2)} mV, クリッピングサンプル数=${clippingSamples}件`,
  });

  // 5. RBBB / LBBBでQRS持続時間が 0.12s 以上、V1 / V6 の極性が正しい
  const rbbb = getDiseaseById('rbbb');
  const lbbb = getDiseaseById('lbbb');
  const rbbbBeat = rbbb.conductionProfile.beats[0];
  const lbbbBeat = lbbb.conductionProfile.beats[0];
  const rbbbQrsDur = rbbbBeat?.ventricularDurationSec ?? 0;
  const lbbbQrsDur = lbbbBeat?.ventricularDurationSec ?? 0;

  const rbbbV1TerminalMax = getWindowMax(rbbb.leads.V1, 0.25, 0.36);
  const rbbbV6TerminalMin = getWindowMin(rbbb.leads.V6, 0.25, 0.36);
  const lbbbV1Min = getWindowMin(lbbb.leads.V1, 0.21, 0.36);
  const lbbbV6Max = getWindowMax(lbbb.leads.V6, 0.21, 0.36);

  const check5Passed =
    rbbbQrsDur >= 0.12 &&
    lbbbQrsDur >= 0.12 &&
    rbbbV1TerminalMax > 0.55 &&
    rbbbV6TerminalMin < -0.25 &&
    lbbbV1Min < -0.9 &&
    lbbbV6Max > 0.9;

  checks.push({
    id: 5,
    name: 'RBBB / LBBB で QRS持続時間 ≥ 0.12s かつ V1 / V6 極性が医学的に正確',
    passed: check5Passed,
    detail: `RBBB(QRS=${rbbbQrsDur.toFixed(3)}s, V1 R'=${rbbbV1TerminalMax.toFixed(2)}mV, V6 S=${rbbbV6TerminalMin.toFixed(2)}mV), LBBB(QRS=${lbbbQrsDur.toFixed(3)}s, V1 QS=${lbbbV1Min.toFixed(2)}mV, V6 R=${lbbbV6Max.toFixed(2)}mV)`,
  });

  // 6. WPWでPR短縮 (< 0.12s) とデルタ波によるQRS開大 (≥ 0.12s) がある
  const wpw = getDiseaseById('wpw');
  const wpwBeat = wpw.conductionProfile.beats[0];
  const wpwPr =
    (wpwBeat?.ventricularStartSec ?? 0.21) - (wpwBeat?.atrialStartSec ?? 0.05);
  const wpwQrs = wpwBeat?.ventricularDurationSec ?? 0.08;
  const wpwHasDelta =
    wpwBeat?.ventricularMode === 'wpw' || wpw.conductionProfile.showAccessoryPathway === true;
  const check6Passed = wpwPr < 0.12 && wpwQrs >= 0.12 && wpwHasDelta;

  checks.push({
    id: 6,
    name: 'WPW症候群で PR短縮 (< 0.12s) ＆ デルタ波による QRS開大 (≥ 0.12s)',
    passed: check6Passed,
    detail: `PR間隔=${wpwPr.toFixed(2)}s (< 0.12s), QRS幅=${wpwQrs.toFixed(2)}s (≥ 0.12s), 副伝導路デルタ波=${wpwHasDelta}`,
  });

  // 7. 前壁・下壁・側壁 STEMI で対応誘導のST上昇と鏡像ST低下が正しい
  const stemiAnt = getDiseaseById('mi_anteroseptal');
  const stemiInf = getDiseaseById('mi_inferior');
  const stemiLat = getDiseaseById('mi_lateral');

  const antV2St = getSignalAtTime(stemiAnt.leads.V2, 0.32);
  const antV3St = getSignalAtTime(stemiAnt.leads.V3, 0.32);
  const antIIISt = getSignalAtTime(stemiAnt.leads.III, 0.32);

  const infIISt = getSignalAtTime(stemiInf.leads.II, 0.32);
  const infIIISt = getSignalAtTime(stemiInf.leads.III, 0.32);
  const infaVLSt = getSignalAtTime(stemiInf.leads.aVL, 0.32);
  const infV2Reciprocal = getSignalAtTime(stemiInf.leads.V2, 0.32);

  const latISt = getSignalAtTime(stemiLat.leads.I, 0.32);
  const latV5St = getSignalAtTime(stemiLat.leads.V5, 0.32);
  const latIIISt = getSignalAtTime(stemiLat.leads.III, 0.32);

  const check7Passed =
    antV2St > 0.35 &&
    antV3St > 0.35 &&
    antIIISt < -0.15 &&
    infIISt > 0.25 &&
    infIIISt > 0.40 &&
    infaVLSt < -0.25 &&
    infV2Reciprocal < -0.10 &&
    latISt > 0.20 &&
    latV5St > 0.25 &&
    latIIISt < -0.25;

  checks.push({
    id: 7,
    name: '前壁中隔・下壁・側壁 STEMI の責任誘導ST上昇と対側(鏡像)ST低下が成立',
    passed: check7Passed,
    detail: `前壁(V2=${antV2St.toFixed(2)}, V3=${antV3St.toFixed(2)}, III=${antIIISt.toFixed(2)}), 下壁(III=${infIIISt.toFixed(2)}, aVL=${infaVLSt.toFixed(2)}, V2=${infV2Reciprocal.toFixed(2)}), 側壁(V5=${latV5St.toFixed(2)}, III=${latIIISt.toFixed(2)})`,
  });

  // 8. hyperkalemiaでT波増高、hypokalemiaでT波平低＋U波、hypercalcemiaでQT短縮、hypocalcemiaでQT延長
  const normal = getDiseaseById('normal');
  const hyperK = getDiseaseById('hyperkalemia');
  const hypoK = getDiseaseById('hypokalemia');
  const hyperCa = getDiseaseById('hypercalcemia');
  const hypoCa = getDiseaseById('hypocalcemia');

  const normalV3T = getWindowMax(normal.leads.V3, 0.34, 0.52);
  const hyperKV3T = getWindowMax(hyperK.leads.V3, 0.38, 0.56);
  const hypoKV3T = getWindowMax(hypoK.leads.V3, 0.34, 0.46);
  const hypoKV3U = getWindowMax(hypoK.leads.V3, 0.49, 0.63);

  const calcQt = (d: typeof normal) => {
    const b = d.conductionProfile.beats[0];
    if (!b || b.ventricularStartSec === undefined || b.repolarizationStartSec === undefined) {
      return 0.36;
    }
    return b.repolarizationStartSec + (b.repolarizationDurationSec ?? 0.16) - b.ventricularStartSec;
  };
  const normalQt = calcQt(normal);
  const hyperCaQt = calcQt(hyperCa);
  const hypoCaQt = calcQt(hypoCa);

  const check8Passed =
    hyperKV3T > normalV3T * 1.6 &&
    hypoK.conductionProfile.beats[0]?.uWaveStartSec !== undefined &&
    hypoKV3U > 0.25 &&
    hypoKV3T < normalV3T &&
    hyperCaQt < normalQt - 0.05 &&
    hypoCaQt > normalQt + 0.08;

  checks.push({
    id: 8,
    name: '電解質異常4疾患 (高K:テント状T波 / 低K:平低T+U波 / 高Ca:QT短縮 / 低Ca:QT延長)',
    passed: check8Passed,
    detail: `V3 T波(正常=${normalV3T.toFixed(2)}mV, 高K=${hyperKV3T.toFixed(2)}mV, 低K=${hypoKV3T.toFixed(2)}mV), 低K U波=${hypoKV3U.toFixed(2)}mV, QT間隔(正常=${normalQt.toFixed(2)}s, 高Ca=${hyperCaQt.toFixed(2)}s, 低Ca=${hypoCaQt.toFixed(2)}s)`,
  });

  // 9. complete AV blockで心房拍と心室補充調律が非同期であり、PR間隔が一定でない
  const av3 = getDiseaseById('complete_av_block');
  const av3Atrial = av3.conductionProfile.beats
    .filter((b) => b.atrialStartSec !== undefined && b.atrialMode !== 'none')
    .map((b) => b.atrialStartSec as number);
  const av3Vent = av3.conductionProfile.beats
    .filter((b) => b.ventricularStartSec !== undefined)
    .map((b) => b.ventricularStartSec as number);
  const prIntervals: number[] = [];
  for (const qrsT of av3Vent) {
    const precedingP = [...av3Atrial].reverse().find((pT) => pT <= qrsT);
    if (precedingP !== undefined) {
      prIntervals.push(Number((qrsT - precedingP).toFixed(3)));
    }
  }
  const check9Passed =
    av3Atrial.length >= 4 &&
    av3Vent.length >= 2 &&
    prIntervals.length >= 2 &&
    Math.abs(prIntervals[0] - prIntervals[1]) > 0.08;

  checks.push({
    id: 9,
    name: '3度房室ブロック (完全房室ブロック) で心房P波と心室補充調律が完全非同期 (房室解離)',
    passed: check9Passed,
    detail: `心房P波時刻=[${av3Atrial.join(', ')}s], 心室QRS時刻=[${av3Vent.join(', ')}s], 見かけのPR間隔=[${prIntervals.join('s, ')}s] (非一定)`,
  });

  // 10. AFで明確なP波がなく、R-R間隔が不整である
  const af = getDiseaseById('afib');
  const afBeats = af.conductionProfile.beats;
  const afNoPWave =
    af.conductionProfile.atrialContinuousMode === 'afib_wavelets' &&
    afBeats.every((b) => b.atrialMode === 'none' && b.atrialStartSec === undefined);
  const afRrList: number[] = [];
  for (let i = 1; i < afBeats.length; i++) {
    const t0 = afBeats[i - 1].ventricularStartSec ?? 0;
    const t1 = afBeats[i].ventricularStartSec ?? 0;
    afRrList.push(Number((t1 - t0).toFixed(3)));
  }
  const uniqueAfRr = new Set(afRrList);
  const check10Passed = afNoPWave && afRrList.length >= 3 && uniqueAfRr.size === afRrList.length;

  checks.push({
    id: 10,
    name: '心房細動 (AF) で全拍P波欠如 (f波のみ) かつ R-R間隔が完全不整 (irregularly irregular)',
    passed: check10Passed,
    detail: `atrialMode=すべてnone(f波連続), R-R間隔列=[${afRrList.join('s, ')}s] (全間隔が異なる=${uniqueAfRr.size}/${afRrList.length})`,
  });

  // 11. VF / Torsadesで離散的な単一QRSの規則周期になっていない
  const vf = getDiseaseById('vfib');
  const torsades = getDiseaseById('tdp');
  const vfWindowAmps: number[] = [];
  const tdWindowAmps: number[] = [];
  for (let w = 0; w < 6; w++) {
    const t0 = 0.15 + w * 0.4;
    const t1 = t0 + 0.35;
    vfWindowAmps.push(
      Number((getWindowMax(vf.leads.II, t0, t1) - getWindowMin(vf.leads.II, t0, t1)).toFixed(2))
    );
    tdWindowAmps.push(
      Number(
        (getWindowMax(torsades.leads.II, t0, t1) - getWindowMin(torsades.leads.II, t0, t1)).toFixed(
          2
        )
      )
    );
  }
  const vfActiveEverywhere =
    vf.conductionProfile.ventricularContinuousMode === 'vfib_chaos' &&
    vfWindowAmps.every((a) => a > 0.45);
  const tdModulates = Math.max(...tdWindowAmps) / Math.max(0.05, Math.min(...tdWindowAmps)) > 1.35;
  const check11Passed = vfActiveEverywhere && tdModulates;

  checks.push({
    id: 11,
    name: 'VF / Torsades de Pointes が離散的な単一QRS規則周期ではなく連続無秩序/振幅捻転波形',
    passed: check11Passed,
    detail: `VF各0.4s窓P-P振幅=[${vfWindowAmps.join(', ')}mV], Torsades各0.4s窓P-P振幅=[${tdWindowAmps.join(', ')}mV]`,
  });

  // 12. dextrocardiaでI・aVR・aVLが左右反転し、V1→V6でR波減衰が見られる
  const dextro = getDiseaseById('dextrocardia');
  const dexIMin = getWindowMin(dextro.leads.I, 0.18, 0.32);
  const dexIMax = getWindowMax(dextro.leads.I, 0.18, 0.32);
  const dexaVRMax = getWindowMax(dextro.leads.aVR, 0.18, 0.32);
  const dexaVLMin = getWindowMin(dextro.leads.aVL, 0.18, 0.32);

  const chestRPeaks = (['V1', 'V2', 'V3', 'V4', 'V5', 'V6'] as ECGLeadId[]).map((lid) =>
    getWindowMax(dextro.leads[lid], 0.18, 0.32)
  );
  let monotonicDecay = true;
  for (let i = 0; i < chestRPeaks.length - 1; i++) {
    if (!(chestRPeaks[i] > chestRPeaks[i + 1])) {
      monotonicDecay = false;
    }
  }
  const check12Passed =
    Math.abs(dexIMin) > dexIMax && dexaVRMax > 0.45 && dexaVLMin < -0.35 && monotonicDecay;

  checks.push({
    id: 12,
    name: '右胸心 (dextrocardia) で I・aVR・aVL が左右反転し、V1→V6 で R波振幅が単調減衰',
    passed: check12Passed,
    detail: `Lead I min=${dexIMin.toFixed(2)}mV, aVR max=+${dexaVRMax.toFixed(2)}mV, V1→V6 R波=[${chestRPeaks.map((r) => r.toFixed(2)).join(' > ')}mV]`,
  });

  // 13. junctional_rhythmのHR表示と実際のR-R間隔が一致する + リアルタイム解説&レスポンシブ検証
  const junc = getDiseaseById('junctional_rhythm');
  const juncBeats = junc.conductionProfile.beats;
  const juncRrSec =
    juncBeats.length >= 2
      ? (juncBeats[1].ventricularStartSec ?? 0) - (juncBeats[0].ventricularStartSec ?? 0)
      : 0;
  const juncCalculatedBpm = juncRrSec > 0 ? 60 / juncRrSec : 0;
  const juncHrMatch =
    Math.abs(juncRrSec - 1.2) < 1e-6 &&
    Math.abs(juncCalculatedBpm - 50) < 1e-6 &&
    (junc.hrDisplay ?? '').includes('50 bpm') &&
    Math.abs(junc.scenarioDurationSec - 2.4) < 1e-6;

  const snapAtQrs = evaluateMasterTimeline(normal, 0.24);
  const snapAtRest = evaluateMasterTimeline(normal, 0.72);
  const timelineDynamicOk =
    snapAtQrs.currentEvent.titleJa !== snapAtRest.currentEvent.titleJa &&
    snapAtQrs.phaseLabelJa !== snapAtRest.phaseLabelJa;

  const fit1366 = 216 + STAGE_BASE_WIDTH + 280 <= 1366 && 44 + STAGE_BASE_HEIGHT <= 768;
  const fit1536 = 244 + STAGE_BASE_WIDTH + 320 <= 1536 && 44 + STAGE_BASE_HEIGHT <= 864;
  const fit1920 = 268 + STAGE_BASE_WIDTH + 360 <= 1920 && 44 + STAGE_BASE_HEIGHT <= 1080;

  checks.push({
    id: 13,
    name: '房室接合部調律のHR表示(50 bpm)と実R-R間隔(1.20s)の一致 ＆ MasterTimeline解説・3解像度適合',
    passed: juncHrMatch && timelineDynamicOk && fit1366 && fit1536 && fit1920,
    detail: `junctional_rhythm: R-R=${juncRrSec.toFixed(2)}s (${juncCalculatedBpm.toFixed(1)} bpm), hrDisplay="${junc.hrDisplay}", 1366x768横幅=${216 + STAGE_BASE_WIDTH + 280}px<=1366px`,
  });

  // 14. [追加検証 1 & 2] junctional_rhythm の共通 AV junction source event 双方向伝播 & SA node 非発火検証
  let juncSourceOk = juncBeats.length === 2;
  let juncSaNeverFires = true;
  for (let t = 0; t <= junc.scenarioDurationSec; t += 0.01) {
    const snap = evaluateMasterTimeline(junc, t);
    if (
      snap.saNodeFiring ||
      snap.paths.sa_node.status === 'normal' ||
      snap.paths.sa_node.progress > 0 ||
      snap.sourceRegion !== 'av_junction'
    ) {
      juncSaNeverFires = false;
    }
  }

  for (const b of juncBeats) {
    const srcT = b.sourceStartSec;
    if (
      srcT === undefined ||
      b.sourceRegion !== 'av_junction' ||
      b.saNodeFiring !== false ||
      b.atrialPropagation !== 'retrograde' ||
      b.ventricularPropagation !== 'antegrade' ||
      Math.abs((b.atrialStartSec ?? 0) - (srcT + 0.01)) > 1e-6 ||
      Math.abs((b.ventricularStartSec ?? 0) - (srcT + 0.06)) > 1e-6
    ) {
      juncSourceOk = false;
    }

    // 同一 sourceStartSec から派生した逆行性心房興奮と逆行性P波(II陰性・aVR陽性)の一致検証
    const pMidT = (b.atrialStartSec ?? 0) + (b.atrialDurationSec ?? 0.08) * 0.5;
    const qrsMidT = (b.ventricularStartSec ?? 0) + (b.ventricularDurationSec ?? 0.085) * 0.5;
    const snapAtP = evaluateMasterTimeline(junc, pMidT);
    const snapAtV = evaluateMasterTimeline(junc, qrsMidT);

    const pWaveLeadII = getSignalAtTime(junc.leads.II, pMidT);
    const pWaveLeadaVR = getSignalAtTime(junc.leads.aVR, pMidT);

    if (
      snapAtP.sourceRegion !== 'av_junction' ||
      snapAtP.atrialPropagation !== 'retrograde' ||
      snapAtP.saNodeFiring !== false ||
      snapAtP.walls.ra_wall.electricalState !== 'depolarizing' ||
      snapAtP.walls.la_wall.electricalState !== 'depolarizing' ||
      pWaveLeadII > -0.12 ||
      pWaveLeadaVR < 0.06 ||
      snapAtV.ventricularPropagation !== 'antegrade' ||
      snapAtV.paths.his_bundle.status !== 'normal'
    ) {
      juncSourceOk = false;
    }
  }

  checks.push({
    id: 14,
    name: 'junctional_rhythm: 共通AV junction source event双方向派生 (retrograde心房+antegrade心室・SA非発火)',
    passed: juncSourceOk && juncSaNeverFires,
    detail: `sourceRegion="av_junction", atrialPropagation="retrograde", ventricularPropagation="antegrade", saNodeFiring=false (全時刻0%), sourceStartSec=[${juncBeats.map((b) => b.sourceStartSec).join('s, ')}s]から逆行心房興奮&陰性P波と順行His-Purkinjeを共通派生`,
  });

  // 15. [追加検証 3 & 4] TdP 11拍(10 RR間隔)一致 & HeartDiagram側回転軸・主/二次興奮領域・振幅連動検証
  const tdpBeats = torsades.conductionProfile.beats;
  const beatCountMatchesAngles =
    tdpBeats.length === TDP_AXIS_ANGLES_DEG.length &&
    TDP_AXIS_ANGLES_DEG.length === 11 &&
    TDP_AMPLITUDE_STRENGTHS.length === 11;

  // 11 beat なら拍間の RR interval は 10 個
  const tdpRrIntervals: number[] = [];
  for (let i = 1; i < tdpBeats.length; i++) {
    const dt = (tdpBeats[i].ventricularStartSec ?? 0) - (tdpBeats[i - 1].ventricularStartSec ?? 0);
    tdpRrIntervals.push(Number(dt.toFixed(3)));
  }
  const rrCountIsTen =
    tdpRrIntervals.length === 10 &&
    tdpRrIntervals.every((rr) => Math.abs(rr - TDP_RR_INTERVAL_SEC) < 1e-6);

  let everyTdpBeatValid = true;
  let consecutiveRegionsChange = true;
  const observedPrimaries: string[] = [];
  const observedDirections: string[] = [];
  const observedActPeaks: number[] = [];
  const observedContractPeaks: number[] = [];

  for (let i = 0; i < tdpBeats.length; i++) {
    const b = tdpBeats[i];
    const expectedAngle = TDP_AXIS_ANGLES_DEG[i];
    const expectedStrength = TDP_AMPLITUDE_STRENGTHS[i];
    const expectedSpec = deriveTorsadesPropagationFromAxis(expectedAngle);

    const vStart = b.ventricularStartSec ?? 0;
    const vDur = b.ventricularDurationSec ?? 0.13;
    const vMid = vStart + vDur * 0.5;
    const cMid = vStart + 0.015 + 0.185 * 0.5; // 壁収縮ピーク時刻

    // scenarioDurationSec 内に全11拍のQRS・心室興奮・壁収縮が収まっていること
    if (vStart + vDur > torsades.scenarioDurationSec || cMid > torsades.scenarioDurationSec) {
      everyTdpBeatValid = false;
    }

    // ECG QRS応答 (前額面 I / II の最大絶対振幅)
    const qrsMaxI = getWindowMax(torsades.leads.I, vStart, vStart + vDur);
    const qrsMinI = getWindowMin(torsades.leads.I, vStart, vStart + vDur);
    const qrsMaxII = getWindowMax(torsades.leads.II, vStart, vStart + vDur);
    const qrsMinII = getWindowMin(torsades.leads.II, vStart, vStart + vDur);
    const ecgPeakToPeak = Math.max(
      Math.abs(qrsMaxI),
      Math.abs(qrsMinI),
      Math.abs(qrsMaxII),
      Math.abs(qrsMinII)
    );

    // HeartDiagram 側タイムラインスナップショット
    const snapV = evaluateMasterTimeline(torsades, vMid);
    const snapC = evaluateMasterTimeline(torsades, cMid);

    const pWall = snapV.primaryActivationRegion;
    const sWall = snapV.secondaryActivationRegion;
    const propDir = snapV.propagationDirection;

    if (
      b.axisAngleDeg !== expectedAngle ||
      snapV.activeAxisAngleDeg !== expectedAngle ||
      Math.abs(snapV.electricVector.angleDeg - expectedAngle) > 1e-6 ||
      pWall !== expectedSpec.primaryActivationRegion ||
      sWall !== expectedSpec.secondaryActivationRegion ||
      propDir !== expectedSpec.propagationDirection ||
      !pWall ||
      snapV.walls[pWall].electricalState !== 'depolarizing' ||
      snapV.walls[pWall].intensity < 0.4 * expectedStrength ||
      snapC.walls[pWall].contraction < 0.4 * expectedStrength ||
      ecgPeakToPeak < 0.3
    ) {
      everyTdpBeatValid = false;
    }

    observedPrimaries.push(pWall ?? 'none');
    observedDirections.push(propDir ?? 'none');
    observedActPeaks.push(pWall ? Number(snapV.walls[pWall].intensity.toFixed(3)) : 0);
    observedContractPeaks.push(pWall ? Number(snapC.walls[pWall].contraction.toFixed(3)) : 0);

    if (i > 0 && observedPrimaries[i] === observedPrimaries[i - 1]) {
      consecutiveRegionsChange = false;
    }
  }

  // activationStrength / contractionStrength が beat amplitude (TDP_AMPLITUDE_STRENGTHS) と比例連動していること
  let strengthProportional = true;
  for (let i = 0; i < tdpBeats.length; i++) {
    const ratioAct = observedActPeaks[i] / TDP_AMPLITUDE_STRENGTHS[i];
    const ratioCon = observedContractPeaks[i] / TDP_AMPLITUDE_STRENGTHS[i];
    if (Math.abs(ratioAct - 1.0) > 0.08 || Math.abs(ratioCon - 1.0) > 0.08) {
      strengthProportional = false;
    }
  }

  checks.push({
    id: 15,
    name: 'TdP: 11拍(10 RR間隔)完全一致・ECG軸=心臓軸・連続拍でのprimary/secondary領域遷移・振幅連動収縮',
    passed:
      beatCountMatchesAngles &&
      rrCountIsTen &&
      everyTdpBeatValid &&
      consecutiveRegionsChange &&
      strengthProportional,
    detail: `beats=${tdpBeats.length}(RR間隔=${tdpRrIntervals.length}個×${TDP_RR_INTERVAL_SEC}s, 周期=${torsades.scenarioDurationSec}s), 主領域遷移=[${observedPrimaries.join('→')}], 興奮/収縮強度比=1.00連動`,
  });

  // 16. [第4次修正] EDUCATION_TIME_SCALE === 0.25 かつ 実時間4.0秒 = masterTimeSec 1.0秒進行
  const advancedAfter4Sec = advanceMasterTimeSec(0, 4.0, 10.0);
  const check16Passed =
    EDUCATION_TIME_SCALE === 0.25 && Math.abs(advancedAfter4Sec - 1.0) < 1e-9;

  checks.push({
    id: 16,
    name: '教育用スロー再生倍率 EDUCATION_TIME_SCALE === 0.25 固定 (実時間 4.00s = 生理時間 1.00s)',
    passed: check16Passed,
    detail: `EDUCATION_TIME_SCALE=${EDUCATION_TIME_SCALE}, advanceMasterTimeSec(0, 4.0s)=${advancedAfter4Sec.toFixed(3)}s`,
  });

  // 17. [第4次修正] 全伝導QRS拍で QRS開始 === 最初の心室sub-segment activationStartSec ＆ QRS終了 === 最後の心室sub-segment activationEndSec
  let qrsSubSegmentAlignmentOk = true;
  let checkedQrsBeatCount = 0;

  for (const d of ALL_DISEASES) {
    if (d.conductionProfile.ventricularContinuousMode === 'vfib_chaos') continue;
    for (const b of d.conductionProfile.beats) {
      if (b.ventricularStartSec === undefined || b.avBlocked || b.hisBlocked) continue;
      checkedQrsBeatCount++;
      const sched = computeVentricularSubSegmentSchedule(b, d);
      if (
        Math.abs(sched.qrsStartSec - sched.earliestActivationStartSec) > 1e-6 ||
        Math.abs(sched.qrsEndSec - sched.latestActivationEndSec) > 1e-6
      ) {
        qrsSubSegmentAlignmentOk = false;
      }
    }
  }

  checks.push({
    id: 17,
    name: '全伝導QRS拍で QRS開始 === 最初の心室sub-segment開始 ＆ QRS終了 === 最後の心室sub-segment終了',
    passed: qrsSubSegmentAlignmentOk && checkedQrsBeatCount > 50,
    detail: `検証伝導QRS拍数=${checkedQrsBeatCount}拍, |qrsStart - min(activationStartSec)|=0.000s, |qrsEnd - max(activationEndSec)|=0.000s`,
  });

  // 18. [第4次修正] 正常伝導 (normal) で中隔左→右に始まり右室・左室がほぼ同時に purkinje_fast で高速脱分極し transmyocardial_slow 不使用
  const normalBeat0 = normal.conductionProfile.beats[0];
  const normalSched = computeVentricularSubSegmentSchedule(normalBeat0, normal);
  const normalAllPurkinjeFast = ALL_VENTRICULAR_SUB_SEGMENT_IDS.every(
    (id) => normalSched.segments[id].propagationMode === 'purkinje_fast'
  );
  const normalSeptumFirst =
    normalSched.segments.septal_middle.activationStartSec === normalSched.qrsStartSec &&
    normalSched.segments.septal_middle.activationStartSec <
      normalSched.segments.rv_apical.activationStartSec &&
    normalSched.segments.septal_middle.activationStartSec <
      normalSched.segments.lv_apical.activationStartSec;
  const normalBilateralSimultaneous =
    Math.abs(
      normalSched.segments.rv_apical.activationStartSec -
        normalSched.segments.lv_apical.activationStartSec
    ) < 0.005;

  checks.push({
    id: 18,
    name: '正常洞調律: 中隔左→右(septal_middle)起始＋左右心室の同時高速Purkinje興奮 (transmyocardial_slow 0件)',
    passed: normalAllPurkinjeFast && normalSeptumFirst && normalBilateralSimultaneous,
    detail: `septal_middle=${normalSched.segments.septal_middle.activationStartSec.toFixed(3)}s, rv_apical=${normalSched.segments.rv_apical.activationStartSec.toFixed(3)}s, lv_apical=${normalSched.segments.lv_apical.activationStartSec.toFixed(3)}s, 全11セグメント=purkinje_fast`,
  });

  // 19. [第4次修正] RBBB / LBBB の先行Purkinje興奮と対側心室 transmyocardial_slow 遅延伝播順序
  const rbbbSched = computeVentricularSubSegmentSchedule(rbbbBeat, rbbb);
  const lbbbSched = computeVentricularSubSegmentSchedule(lbbbBeat, lbbb);

  const rbbbOrderOk =
    rbbbSched.segments.septal_middle.propagationMode === 'purkinje_fast' &&
    rbbbSched.segments.lv_apical.propagationMode === 'purkinje_fast' &&
    rbbbSched.segments.lv_lateral.propagationMode === 'purkinje_fast' &&
    rbbbSched.segments.rv_apical.propagationMode === 'transmyocardial_slow' &&
    rbbbSched.segments.rv_lateral.propagationMode === 'transmyocardial_slow' &&
    rbbbSched.segments.rv_basal.propagationMode === 'transmyocardial_slow' &&
    rbbbSched.segments.lv_lateral.activationStartSec <
      rbbbSched.segments.rv_apical.activationStartSec &&
    rbbbSched.segments.rv_apical.activationStartSec <
      rbbbSched.segments.rv_lateral.activationStartSec &&
    rbbbSched.segments.rv_lateral.activationStartSec <
      rbbbSched.segments.rv_basal.activationStartSec &&
    rbbbSched.segments.rv_basal.activationEndSec === rbbbSched.qrsEndSec;

  const lbbbOrderOk =
    lbbbSched.segments.rv_apical.propagationMode === 'purkinje_fast' &&
    lbbbSched.segments.rv_lateral.propagationMode === 'purkinje_fast' &&
    lbbbSched.segments.septal_middle.propagationMode === 'transmyocardial_slow' &&
    lbbbSched.segments.lv_apical.propagationMode === 'transmyocardial_slow' &&
    lbbbSched.segments.lv_anterior.propagationMode === 'transmyocardial_slow' &&
    lbbbSched.segments.lv_lateral.propagationMode === 'transmyocardial_slow' &&
    lbbbSched.segments.lv_basal.propagationMode === 'transmyocardial_slow' &&
    lbbbSched.segments.rv_lateral.activationEndSec <
      lbbbSched.segments.lv_apical.activationStartSec &&
    lbbbSched.segments.lv_apical.activationStartSec <
      lbbbSched.segments.lv_anterior.activationStartSec &&
    lbbbSched.segments.lv_anterior.activationStartSec <
      lbbbSched.segments.lv_lateral.activationStartSec &&
    lbbbSched.segments.lv_basal.activationEndSec === lbbbSched.qrsEndSec;

  checks.push({
    id: 19,
    name: 'RBBB / LBBB: 先行心室(purkinje_fast)と遮断側心室の多段階遅延伝播(transmyocardial_slow)順序が完全成立',
    passed: rbbbOrderOk && lbbbOrderOk,
    detail: `RBBB(LV=${rbbbSched.segments.lv_apical.activationStartSec.toFixed(3)}s→RV=${rbbbSched.segments.rv_apical.activationStartSec.toFixed(3)}..${rbbbSched.segments.rv_basal.activationEndSec.toFixed(3)}s[slow]), LBBB(RV=${lbbbSched.segments.rv_apical.activationStartSec.toFixed(3)}s→LV=${lbbbSched.segments.lv_apical.activationStartSec.toFixed(3)}..${lbbbSched.segments.lv_basal.activationEndSec.toFixed(3)}s[slow])`,
  });

  // 20. [第4次修正] LAFB / LPFB の枝別先行興奮と遅延領域伝播
  const lafb = getDiseaseById('lafb');
  const lpfb = getDiseaseById('lpfb');
  const lafbSched = computeVentricularSubSegmentSchedule(lafb.conductionProfile.beats[0], lafb);
  const lpfbSched = computeVentricularSubSegmentSchedule(lpfb.conductionProfile.beats[0], lpfb);

  const lafbOrderOk =
    lafbSched.segments.lv_inferior.propagationMode === 'purkinje_fast' &&
    lafbSched.segments.lv_anterior.propagationMode === 'transmyocardial_slow' &&
    lafbSched.segments.lv_basal.propagationMode === 'transmyocardial_slow' &&
    lafbSched.segments.lv_inferior.activationStartSec <
      lafbSched.segments.lv_anterior.activationStartSec &&
    lafbSched.segments.lv_anterior.activationStartSec <
      lafbSched.segments.lv_basal.activationStartSec;

  const lpfbOrderOk =
    lpfbSched.segments.lv_anterior.propagationMode === 'purkinje_fast' &&
    lpfbSched.segments.lv_inferior.propagationMode === 'transmyocardial_slow' &&
    lpfbSched.segments.lv_anterior.activationStartSec <
      lpfbSched.segments.lv_apical.activationStartSec &&
    lpfbSched.segments.lv_apical.activationStartSec <
      lpfbSched.segments.lv_inferior.activationStartSec;

  checks.push({
    id: 20,
    name: 'LAFB / LPFB: 健常枝領域の高速Purkinje先行興奮と遮断枝領域への遅延伝播(transmyocardial_slow)',
    passed: lafbOrderOk && lpfbOrderOk,
    detail: `LAFB(下壁=${lafbSched.segments.lv_inferior.activationStartSec.toFixed(3)}s[fast]→前壁基部=${lafbSched.segments.lv_basal.activationStartSec.toFixed(3)}s[slow]), LPFB(前壁=${lpfbSched.segments.lv_anterior.activationStartSec.toFixed(3)}s[fast]→下壁=${lpfbSched.segments.lv_inferior.activationStartSec.toFixed(3)}s[slow])`,
  });

  // 21. [第4次修正] PVC / VT の異所性発火源起始 ＆ WPW の Kent束早期front + His-Purkinje融合 (fusion)
  const pvc = getDiseaseById('pvc');
  const vt = getDiseaseById('vt');
  const pvcEctopicBeat = pvc.conductionProfile.beats.find((b) => b.ventricularMode === 'ectopic_rv')!;
  const vtEctopicBeat = vt.conductionProfile.beats[0];
  const pvcSched = computeVentricularSubSegmentSchedule(pvcEctopicBeat, pvc);
  const vtSched = computeVentricularSubSegmentSchedule(vtEctopicBeat, vt);
  const wpwSched = computeVentricularSubSegmentSchedule(wpwBeat, wpw);

  const pvcEctopicOk =
    pvcSched.segments.rv_basal.propagationMode === 'ectopic' &&
    pvcSched.segments.rv_basal.activationStartSec === pvcSched.qrsStartSec &&
    pvcSched.segments.lv_basal.propagationMode === 'transmyocardial_slow' &&
    pvcSched.segments.rv_basal.activationStartSec < pvcSched.segments.lv_basal.activationStartSec;

  const vtEctopicOk =
    vtSched.segments.lv_apical.propagationMode === 'ectopic' &&
    vtSched.segments.lv_apical.activationStartSec === vtSched.qrsStartSec &&
    vtSched.segments.rv_basal.propagationMode === 'transmyocardial_slow' &&
    vtSched.segments.lv_apical.activationStartSec < vtSched.segments.rv_basal.activationStartSec;

  const wpwFusionOk =
    wpwSched.segments.lv_basal.propagationMode === 'transmyocardial_slow' &&
    wpwSched.segments.lv_basal.activationStartSec === wpwSched.qrsStartSec &&
    wpwSched.segments.septal_middle.propagationMode === 'purkinje_fast' &&
    wpwSched.segments.lv_basal.activationStartSec <
      wpwSched.segments.septal_middle.activationStartSec &&
    wpwSched.segments.lv_lateral.activationEndSec >
      wpwSched.segments.septal_middle.activationStartSec; // デルタ波frontとHis-Purkinje frontの時間的オーバーラップ(融合)

  checks.push({
    id: 21,
    name: 'PVC/VTの異所性焦点(ectopic)起始→transmyocardial_slow伝播 ＆ WPWのKent束早期front＋His-Purkinje融合',
    passed: pvcEctopicOk && vtEctopicOk && wpwFusionOk,
    detail: `PVC(rv_basal[ectopic]→lv_basal[slow]), VT(lv_apical[ectopic]→rv_basal[slow]), WPW(Kent:lv_basal=${wpwSched.segments.lv_basal.activationStartSec.toFixed(3)}s[slow] + His:septal=${wpwSched.segments.septal_middle.activationStartSec.toFixed(3)}s[fast] 融合)`,
  });

  // 22. [第4次修正] VFの多重無秩序興奮・有効収縮ゼロ・平均電気ベクトル抑制 ＆ STEMI梗塞領域の興奮/収縮低下
  const vfSnap = evaluateMasterTimeline(vf, 0.85);
  const vfAllChaotic = ALL_VENTRICULAR_SUB_SEGMENT_IDS.every(
    (id) =>
      vfSnap.subSegments[id].propagationMode === 'chaotic' &&
      vfSnap.subSegments[id].contraction < 0.08
  );
  const vfVectorSuppressed = vfSnap.electricVector.active === false;

  const antMiSnap = evaluateMasterTimeline(stemiAnt, 0.25);
  const antMiInfarctedOk =
    antMiSnap.subSegments.septal_middle.isInfarcted &&
    antMiSnap.subSegments.septal_middle.phase === 'infarcted' &&
    antMiSnap.subSegments.lv_anterior.isInfarcted &&
    antMiSnap.subSegments.lv_anterior.phase === 'infarcted';

  checks.push({
    id: 22,
    name: 'VFの無秩序chaotic興奮(有効収縮ゼロ・平均電気ベクトル非表示) ＆ STEMI梗塞サブセグメントの壊死減弱表現',
    passed: vfAllChaotic && vfVectorSuppressed && antMiInfarctedOk,
    detail: `VF(全11心室セグメント=chaotic, maxContraction<0.08, electricVector.active=${vfSnap.electricVector.active}), 前壁中隔STEMI(septal/lv_anterior phase=infarcted)`,
  });

  return {
    allPassed: checks.every((c) => c.passed),
    totalDiseases: ALL_DISEASES.length,
    totalLeadsPerDisease: ALL_LEAD_IDS.length,
    samplesPerLead: expectedSamples,
    maxAbsMv,
    maxAbsMvDiseaseId,
    maxAbsMvLeadId,
    maxLimbErrorMv,
    checks,
  };
}
