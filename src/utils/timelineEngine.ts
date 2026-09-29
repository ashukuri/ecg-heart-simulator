import {
  ActiveTimelineAnnotation,
  AtrialPropagationDirection,
  BeatScheduleItem,
  BeatSourceRegion,
  CardiacPhaseType,
  Disease,
  HeartRegionId,
  VentricularPropagationDirection,
} from '../types';
import {
  deriveTorsadesPropagationFromAxis,
  ECG_WINDOW_SEC,
} from './ecgGenerator';

export type ConductionPathId =
  | 'sa_node'
  | 'internodal_ra'
  | 'internodal_la'
  | 'av_node'
  | 'his_bundle'
  | 'right_bundle'
  | 'left_bundle_stem'
  | 'left_bundle_ant'
  | 'left_bundle_post'
  | 'purkinje_rv'
  | 'purkinje_lv'
  | 'accessory_pathway'
  | 'transseptal_lv_to_rv'
  | 'transseptal_rv_to_lv';

export interface ConductionPathRenderState {
  id: ConductionPathId;
  nameEn: string;
  nameJa: string;
  status: 'waiting' | 'normal' | 'delayed' | 'blocked';
  progress: number;
  showTip: boolean;
  visible: boolean;
}

export type MyocardialWallId =
  | 'ra_wall'
  | 'la_wall'
  | 'rv_wall'
  | 'iv_septum'
  | 'lv_anterior'
  | 'lv_lateral'
  | 'lv_inferior';

export interface WallRegionRenderState {
  id: MyocardialWallId;
  electricalState: 'resting' | 'depolarizing' | 'repolarizing' | 'infarcted';
  intensity: number;
  contraction: number;
  isInfarcted: boolean;
}

/**
 * 2.5D四腔断面表示用の14心筋サブセグメントID
 * - 心房 (3): ra_superior, ra_inferior, la_body
 * - 心室 (11): rv_basal, rv_lateral, rv_apical, septal_superior, septal_middle, septal_apical,
 *             lv_apical, lv_inferior, lv_anterior, lv_lateral, lv_basal
 */
export type MyocardialSubSegmentId =
  | 'ra_superior'
  | 'ra_inferior'
  | 'la_body'
  | 'rv_basal'
  | 'rv_lateral'
  | 'rv_apical'
  | 'septal_superior'
  | 'septal_middle'
  | 'septal_apical'
  | 'lv_apical'
  | 'lv_inferior'
  | 'lv_anterior'
  | 'lv_lateral'
  | 'lv_basal';

export const ALL_ATRIAL_SUB_SEGMENT_IDS: MyocardialSubSegmentId[] = [
  'ra_superior',
  'ra_inferior',
  'la_body',
];

export const ALL_VENTRICULAR_SUB_SEGMENT_IDS: MyocardialSubSegmentId[] = [
  'rv_basal',
  'rv_lateral',
  'rv_apical',
  'septal_superior',
  'septal_middle',
  'septal_apical',
  'lv_apical',
  'lv_inferior',
  'lv_anterior',
  'lv_lateral',
  'lv_basal',
];

export type MyocardialPropagationMode =
  | 'purkinje_fast'
  | 'transmyocardial_slow'
  | 'ectopic'
  | 'retrograde'
  | 'reentrant'
  | 'chaotic';

export type MyocardialSubSegmentPhase =
  | 'resting'
  | 'front_active'
  | 'depolarized'
  | 'repolarizing'
  | 'infarcted';

export interface MyocardialSubSegmentState {
  id: MyocardialSubSegmentId;
  nameJa: string;
  parentWall: MyocardialWallId;
  chamber: 'atria' | 'ventricles';
  activationStartSec: number;
  activationEndSec: number;
  propagationMode: MyocardialPropagationMode;
  phase: MyocardialSubSegmentPhase;
  /** 0..1: activationStartSec から activationEndSec にかけて移動する興奮前面 (activation front) の進行度 */
  frontProgress: number;
  intensity: number;
  contraction: number;
  isInfarcted: boolean;
  /** 四腔断面上の単位解剖ベクトル (resultant vector 合成用) */
  vectorDir: [number, number];
}

export interface VentricularSubSegmentScheduleItem {
  activationStartSec: number;
  activationEndSec: number;
  propagationMode: MyocardialPropagationMode;
}

export interface VentricularBeatActivationSchedule {
  qrsStartSec: number;
  qrsEndSec: number;
  earliestActivationStartSec: number;
  latestActivationEndSec: number;
  ventricularMode: NonNullable<BeatScheduleItem['ventricularMode']>;
  segments: Record<MyocardialSubSegmentId, VentricularSubSegmentScheduleItem>;
}

export interface MasterTimelineSnapshot {
  masterTimeSec: number;
  normalizedTime: number;   // 0..1 against ECG_WINDOW_SEC (3.20s)
  scenarioProgress: number; // 0..1 against disease.scenarioDurationSec
  currentEvent: ActiveTimelineAnnotation;
  phaseColor: string;
  phaseLabelJa: string;
  paths: Record<ConductionPathId, ConductionPathRenderState>;
  walls: Record<MyocardialWallId, WallRegionRenderState>;
  /** 14心筋サブセグメントの activation front 状態 */
  subSegments: Record<MyocardialSubSegmentId, MyocardialSubSegmentState>;
  /** 現在進行中（または直近）の心室拍における QRS 窓と sub-segment 興奮タイミング対応 */
  activeVentricularSchedule?: VentricularBeatActivationSchedule;
  electricVector: {
    active: boolean;
    dx: number;
    dy: number;
    angleDeg: number;
    magnitude: number;
  };
  atrialWaveMode: 'none' | 'afib_wavelets' | 'aflutter_loop';
  ventricularWaveMode: 'none' | 'vfib_chaos';
  ectopicFocus?: 'atria_ectopic' | 'av_junction' | 'rv_outflow' | 'lv_apex_scar' | 'multi_ventricular';
  ectopicFiring: boolean;
  isDextrocardia: boolean;
  /** 現在の拍の発火源領域 */
  sourceRegion: BeatSourceRegion;
  /** 洞房結節(SA node)が発火しているか */
  saNodeFiring: boolean;
  /** 心房伝導方向 */
  atrialPropagation: AtrialPropagationDirection;
  /** 心室伝導方向 */
  ventricularPropagation: VentricularPropagationDirection;
  /** 現在アクティブな心拍の主脱分極領域 (TdP等で拍ごとに変化) */
  primaryActivationRegion?: MyocardialWallId;
  /** 現在アクティブな心拍の二次伝播領域 (TdP等でaxisから導出) */
  secondaryActivationRegion?: MyocardialWallId;
  /** 現在アクティブな心拍の伝播方向ラベル */
  propagationDirection?: string;
  /** 現在アクティブな心拍の心臓側電気軸角度 (degree) */
  activeAxisAngleDeg?: number;
}

const PATH_METADATA: Record<ConductionPathId, { nameEn: string; nameJa: string }> = {
  sa_node:              { nameEn: 'SA node',                 nameJa: '洞房結節' },
  internodal_ra:        { nameEn: 'Internodal pathways',     nameJa: '結節間路（右房）' },
  internodal_la:        { nameEn: 'Bachmann bundle',         nameJa: '心房伝導路（左房枝）' },
  av_node:              { nameEn: 'AV node',                 nameJa: '房室結節' },
  his_bundle:           { nameEn: 'His bundle',              nameJa: 'His束' },
  right_bundle:         { nameEn: 'Right bundle branch',     nameJa: '右脚' },
  left_bundle_stem:     { nameEn: 'Left bundle branch',      nameJa: '左脚本幹' },
  left_bundle_ant:      { nameEn: 'Left anterior fascicle',  nameJa: '左脚前枝' },
  left_bundle_post:     { nameEn: 'Left posterior fascicle', nameJa: '左脚後枝' },
  purkinje_rv:          { nameEn: 'Right Purkinje network',  nameJa: '右室Purkinje線維網' },
  purkinje_lv:          { nameEn: 'Left Purkinje network',   nameJa: '左室Purkinje線維網' },
  accessory_pathway:    { nameEn: 'Kent bundle',             nameJa: '副伝導路（Kent束）' },
  transseptal_lv_to_rv: { nameEn: 'Transseptal conduction',  nameJa: '中隔経由遅延伝導（左室→右室）' },
  transseptal_rv_to_lv: { nameEn: 'Transseptal conduction',  nameJa: '中隔経由遅延伝導（右室→左室）' },
};

const SUB_SEGMENT_METADATA: Record<
  MyocardialSubSegmentId,
  {
    nameJa: string;
    parentWall: MyocardialWallId;
    chamber: 'atria' | 'ventricles';
    vectorDir: [number, number];
  }
> = {
  ra_superior:     { nameJa: '右房上部',       parentWall: 'ra_wall',     chamber: 'atria',      vectorDir: [0.15, 0.55] },
  ra_inferior:     { nameJa: '右房下部',       parentWall: 'ra_wall',     chamber: 'atria',      vectorDir: [0.22, 0.62] },
  la_body:         { nameJa: '左房自由壁',     parentWall: 'la_wall',     chamber: 'atria',      vectorDir: [0.68, 0.42] },
  rv_basal:        { nameJa: '右室基部・流出路', parentWall: 'rv_wall',     chamber: 'ventricles', vectorDir: [-0.78, -0.24] },
  rv_lateral:      { nameJa: '右室自由壁中部', parentWall: 'rv_wall',     chamber: 'ventricles', vectorDir: [-0.72, 0.25] },
  rv_apical:       { nameJa: '右室心尖部',     parentWall: 'rv_wall',     chamber: 'ventricles', vectorDir: [-0.35, 0.72] },
  septal_superior: { nameJa: '心室中隔上部',   parentWall: 'iv_septum',   chamber: 'ventricles', vectorDir: [-0.48, 0.22] },
  septal_middle:   { nameJa: '心室中隔中部',   parentWall: 'iv_septum',   chamber: 'ventricles', vectorDir: [-0.55, 0.35] },
  septal_apical:   { nameJa: '心室中隔下部',   parentWall: 'iv_septum',   chamber: 'ventricles', vectorDir: [0.12, 0.82] },
  lv_apical:       { nameJa: '左室心尖部',     parentWall: 'lv_anterior', chamber: 'ventricles', vectorDir: [0.58, 0.80] },
  lv_inferior:     { nameJa: '左室下壁',       parentWall: 'lv_inferior', chamber: 'ventricles', vectorDir: [0.32, 0.94] },
  lv_anterior:     { nameJa: '左室前側壁',     parentWall: 'lv_anterior', chamber: 'ventricles', vectorDir: [0.76, 0.42] },
  lv_lateral:      { nameJa: '左室側壁中部',   parentWall: 'lv_lateral',  chamber: 'ventricles', vectorDir: [0.90, -0.10] },
  lv_basal:        { nameJa: '左室側壁基部',   parentWall: 'lv_lateral',  chamber: 'ventricles', vectorDir: [0.82, -0.52] },
};

const WALL_TO_SUB_SEGMENTS: Record<MyocardialWallId, MyocardialSubSegmentId[]> = {
  ra_wall:     ['ra_superior', 'ra_inferior'],
  la_wall:     ['la_body'],
  rv_wall:     ['rv_apical', 'rv_lateral', 'rv_basal'],
  iv_septum:   ['septal_middle', 'septal_superior', 'septal_apical'],
  lv_anterior: ['lv_apical', 'lv_anterior'],
  lv_lateral:  ['lv_lateral', 'lv_basal'],
  lv_inferior: ['lv_inferior'],
};

function clamp01(val: number): number {
  return Math.max(0, Math.min(1, val));
}

function smoothPulse(t: number, start: number, duration: number): number {
  if (t < start || t > start + duration || duration <= 0) return 0;
  const p = (t - start) / duration;
  return Math.sin(p * Math.PI);
}

export function getEffectiveBeats(disease: Disease): BeatScheduleItem[] {
  return disease.conductionProfile.beats;
}

/**
 * 1拍の心室興奮 (QRS区間 [vStart, vStart + vDur]) における11心室サブセグメントの
 * activationStartSec / activationEndSec / propagationMode を決定する純粋関数。
 *
 * 不変条件:
 * - QRS開始 (qrsStartSec) === min(activationStartSec) (最初の心室sub-segmentのactivationStartSec)
 * - QRS終了 (qrsEndSec)   === max(activationEndSec)   (最後の心室sub-segmentのactivationEndSec)
 */
export function computeVentricularSubSegmentSchedule(
  beat: BeatScheduleItem,
  disease: Disease
): VentricularBeatActivationSchedule {
  const profile = disease.conductionProfile;
  const isAvJunctionSource =
    beat.sourceRegion === 'av_junction' ||
    profile.ectopicFocus === 'av_junction' ||
    beat.atrialMode === 'retrograde';

  const vStart =
    isAvJunctionSource && beat.sourceStartSec !== undefined
      ? beat.ventricularStartSec ??
        Number((beat.sourceStartSec + (beat.avDurationSec ?? 0.06)).toFixed(4))
      : (beat.ventricularStartSec ?? 0.20);
  const vDur = beat.ventricularDurationSec ?? 0.085;
  const qrsStartSec = Number(vStart.toFixed(6));
  const qrsEndSec = Number((vStart + vDur).toFixed(6));
  const mode = beat.ventricularMode ?? 'normal';

  // 各サブセグメントの正規化区間 [fStart, fEnd] (0.00 〜 1.00) と伝播モード
  let fracSpec: Record<
    MyocardialSubSegmentId,
    { fStart: number; fEnd: number; mode: MyocardialPropagationMode }
  >;

  if (mode === 'rbbb') {
    // RBBB: 左脚から中隔左→右および左室が高速Purkinje脱分極し、右室自由壁が中隔経由の心筋内遅延伝導(transmyocardial_slow)で遅れて脱分極
    fracSpec = {
      ra_superior:     { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      ra_inferior:     { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      la_body:         { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      septal_middle:   { fStart: 0.00, fEnd: 0.22, mode: 'purkinje_fast' },
      septal_superior: { fStart: 0.04, fEnd: 0.25, mode: 'purkinje_fast' },
      septal_apical:   { fStart: 0.08, fEnd: 0.30, mode: 'purkinje_fast' },
      lv_apical:       { fStart: 0.12, fEnd: 0.36, mode: 'purkinje_fast' },
      lv_inferior:     { fStart: 0.15, fEnd: 0.40, mode: 'purkinje_fast' },
      lv_anterior:     { fStart: 0.16, fEnd: 0.42, mode: 'purkinje_fast' },
      lv_lateral:      { fStart: 0.20, fEnd: 0.46, mode: 'purkinje_fast' },
      lv_basal:        { fStart: 0.24, fEnd: 0.50, mode: 'purkinje_fast' },
      rv_apical:       { fStart: 0.44, fEnd: 0.72, mode: 'transmyocardial_slow' },
      rv_lateral:      { fStart: 0.60, fEnd: 0.88, mode: 'transmyocardial_slow' },
      rv_basal:        { fStart: 0.74, fEnd: 1.00, mode: 'transmyocardial_slow' },
    };
  } else if (mode === 'lbbb') {
    // LBBB: 右脚から右室が先行Purkinje興奮し、中隔を右→左へ横断して左室自由壁が多段階の心筋内遅延伝導(transmyocardial_slow)で脱分極
    fracSpec = {
      ra_superior:     { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      ra_inferior:     { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      la_body:         { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      rv_apical:       { fStart: 0.00, fEnd: 0.24, mode: 'purkinje_fast' },
      septal_apical:   { fStart: 0.04, fEnd: 0.28, mode: 'purkinje_fast' },
      rv_lateral:      { fStart: 0.08, fEnd: 0.32, mode: 'purkinje_fast' },
      rv_basal:        { fStart: 0.14, fEnd: 0.38, mode: 'purkinje_fast' },
      septal_middle:   { fStart: 0.24, fEnd: 0.50, mode: 'transmyocardial_slow' },
      septal_superior: { fStart: 0.32, fEnd: 0.56, mode: 'transmyocardial_slow' },
      lv_apical:       { fStart: 0.42, fEnd: 0.68, mode: 'transmyocardial_slow' },
      lv_inferior:     { fStart: 0.48, fEnd: 0.74, mode: 'transmyocardial_slow' },
      lv_anterior:     { fStart: 0.58, fEnd: 0.84, mode: 'transmyocardial_slow' },
      lv_lateral:      { fStart: 0.68, fEnd: 0.94, mode: 'transmyocardial_slow' },
      lv_basal:        { fStart: 0.76, fEnd: 1.00, mode: 'transmyocardial_slow' },
    };
  } else if (mode === 'lafb') {
    // LAFB: 左脚後枝から下壁・心尖部が先行Purkinje興奮し、前側壁・基部へ下→上へ遅延伝播(transmyocardial_slow)
    fracSpec = {
      ra_superior:     { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      ra_inferior:     { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      la_body:         { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      septal_middle:   { fStart: 0.00, fEnd: 0.26, mode: 'purkinje_fast' },
      septal_apical:   { fStart: 0.06, fEnd: 0.32, mode: 'purkinje_fast' },
      septal_superior: { fStart: 0.08, fEnd: 0.34, mode: 'purkinje_fast' },
      lv_inferior:     { fStart: 0.10, fEnd: 0.42, mode: 'purkinje_fast' },
      lv_apical:       { fStart: 0.14, fEnd: 0.45, mode: 'purkinje_fast' },
      rv_apical:       { fStart: 0.16, fEnd: 0.48, mode: 'purkinje_fast' },
      rv_lateral:      { fStart: 0.24, fEnd: 0.60, mode: 'purkinje_fast' },
      rv_basal:        { fStart: 0.34, fEnd: 0.70, mode: 'purkinje_fast' },
      lv_anterior:     { fStart: 0.44, fEnd: 0.80, mode: 'transmyocardial_slow' },
      lv_lateral:      { fStart: 0.56, fEnd: 0.92, mode: 'transmyocardial_slow' },
      lv_basal:        { fStart: 0.66, fEnd: 1.00, mode: 'transmyocardial_slow' },
    };
  } else if (mode === 'lpfb') {
    // LPFB: 左脚前枝から前側壁・基部が先行Purkinje興奮し、心尖部・下壁へ上→下へ遅延伝播(transmyocardial_slow)
    fracSpec = {
      ra_superior:     { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      ra_inferior:     { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      la_body:         { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      septal_middle:   { fStart: 0.00, fEnd: 0.26, mode: 'purkinje_fast' },
      septal_superior: { fStart: 0.06, fEnd: 0.32, mode: 'purkinje_fast' },
      lv_anterior:     { fStart: 0.10, fEnd: 0.42, mode: 'purkinje_fast' },
      lv_lateral:      { fStart: 0.14, fEnd: 0.46, mode: 'purkinje_fast' },
      lv_basal:        { fStart: 0.18, fEnd: 0.50, mode: 'purkinje_fast' },
      rv_apical:       { fStart: 0.16, fEnd: 0.48, mode: 'purkinje_fast' },
      rv_lateral:      { fStart: 0.24, fEnd: 0.60, mode: 'purkinje_fast' },
      rv_basal:        { fStart: 0.34, fEnd: 0.70, mode: 'purkinje_fast' },
      septal_apical:   { fStart: 0.44, fEnd: 0.78, mode: 'transmyocardial_slow' },
      lv_apical:       { fStart: 0.54, fEnd: 0.90, mode: 'transmyocardial_slow' },
      lv_inferior:     { fStart: 0.64, fEnd: 1.00, mode: 'transmyocardial_slow' },
    };
  } else if (mode === 'wpw') {
    // WPW: Kent束による左室基部・側壁の早期心筋内伝導(デルタ波: transmyocardial_slow) ＋ His-Purkinje高速伝導の融合
    fracSpec = {
      ra_superior:     { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      ra_inferior:     { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      la_body:         { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      lv_basal:        { fStart: 0.00, fEnd: 0.38, mode: 'transmyocardial_slow' },
      lv_lateral:      { fStart: 0.12, fEnd: 0.48, mode: 'transmyocardial_slow' },
      septal_middle:   { fStart: 0.30, fEnd: 0.58, mode: 'purkinje_fast' },
      septal_superior: { fStart: 0.34, fEnd: 0.62, mode: 'purkinje_fast' },
      septal_apical:   { fStart: 0.38, fEnd: 0.68, mode: 'purkinje_fast' },
      rv_apical:       { fStart: 0.42, fEnd: 0.76, mode: 'purkinje_fast' },
      lv_apical:       { fStart: 0.44, fEnd: 0.78, mode: 'purkinje_fast' },
      lv_anterior:     { fStart: 0.48, fEnd: 0.84, mode: 'purkinje_fast' },
      rv_lateral:      { fStart: 0.52, fEnd: 0.88, mode: 'purkinje_fast' },
      lv_inferior:     { fStart: 0.58, fEnd: 0.94, mode: 'purkinje_fast' },
      rv_basal:        { fStart: 0.66, fEnd: 1.00, mode: 'purkinje_fast' },
    };
  } else if (mode === 'ectopic_rv') {
    // PVC (右室流出路起源): 右室基部の異所性焦点(ectopic)から始まり、Purkinjeを使わず作業心筋内をゆっくり左室へ広がる
    fracSpec = {
      ra_superior:     { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      ra_inferior:     { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      la_body:         { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      rv_basal:        { fStart: 0.00, fEnd: 0.28, mode: 'ectopic' },
      rv_lateral:      { fStart: 0.16, fEnd: 0.46, mode: 'transmyocardial_slow' },
      rv_apical:       { fStart: 0.26, fEnd: 0.56, mode: 'transmyocardial_slow' },
      septal_superior: { fStart: 0.30, fEnd: 0.60, mode: 'transmyocardial_slow' },
      septal_middle:   { fStart: 0.38, fEnd: 0.68, mode: 'transmyocardial_slow' },
      septal_apical:   { fStart: 0.46, fEnd: 0.74, mode: 'transmyocardial_slow' },
      lv_apical:       { fStart: 0.54, fEnd: 0.82, mode: 'transmyocardial_slow' },
      lv_inferior:     { fStart: 0.60, fEnd: 0.88, mode: 'transmyocardial_slow' },
      lv_anterior:     { fStart: 0.66, fEnd: 0.94, mode: 'transmyocardial_slow' },
      lv_lateral:      { fStart: 0.72, fEnd: 0.98, mode: 'transmyocardial_slow' },
      lv_basal:        { fStart: 0.76, fEnd: 1.00, mode: 'transmyocardial_slow' },
    };
  } else if (mode === 'ectopic_lv') {
    // VT (左室心尖部瘢痕起源): 左室心尖部の異所性焦点(ectopic)から始まり、作業心筋内をゆっくり右室基部へ広がる
    fracSpec = {
      ra_superior:     { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      ra_inferior:     { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      la_body:         { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      lv_apical:       { fStart: 0.00, fEnd: 0.26, mode: 'ectopic' },
      lv_inferior:     { fStart: 0.12, fEnd: 0.42, mode: 'transmyocardial_slow' },
      lv_anterior:     { fStart: 0.20, fEnd: 0.50, mode: 'transmyocardial_slow' },
      septal_apical:   { fStart: 0.26, fEnd: 0.56, mode: 'transmyocardial_slow' },
      lv_lateral:      { fStart: 0.34, fEnd: 0.64, mode: 'transmyocardial_slow' },
      septal_middle:   { fStart: 0.42, fEnd: 0.72, mode: 'transmyocardial_slow' },
      lv_basal:        { fStart: 0.50, fEnd: 0.80, mode: 'transmyocardial_slow' },
      septal_superior: { fStart: 0.56, fEnd: 0.84, mode: 'transmyocardial_slow' },
      rv_apical:       { fStart: 0.62, fEnd: 0.90, mode: 'transmyocardial_slow' },
      rv_lateral:      { fStart: 0.70, fEnd: 0.96, mode: 'transmyocardial_slow' },
      rv_basal:        { fStart: 0.76, fEnd: 1.00, mode: 'transmyocardial_slow' },
    };
  } else if (mode === 'torsades') {
    // TdP: 拍ごとの axisAngleDeg から導出された primaryWall -> secondaryWall -> 残余心室壁の順に旋回伝播
    const tdAxisDeg = beat.axisAngleDeg ?? 45;
    const tdSpec = deriveTorsadesPropagationFromAxis(tdAxisDeg);
    const pWall = (beat.primaryActivationRegion as MyocardialWallId) ?? tdSpec.primaryActivationRegion;
    const sWall = (beat.secondaryActivationRegion as MyocardialWallId) ?? tdSpec.secondaryActivationRegion;
    const pSubs = new Set<MyocardialSubSegmentId>(WALL_TO_SUB_SEGMENTS[pWall] ?? ['lv_anterior']);
    const sSubs = new Set<MyocardialSubSegmentId>(WALL_TO_SUB_SEGMENTS[sWall] ?? ['lv_lateral']);

    fracSpec = {
      ra_superior:     { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      ra_inferior:     { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      la_body:         { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      rv_basal:        { fStart: 0.45, fEnd: 1.00, mode: 'transmyocardial_slow' },
      rv_lateral:      { fStart: 0.45, fEnd: 1.00, mode: 'transmyocardial_slow' },
      rv_apical:       { fStart: 0.45, fEnd: 1.00, mode: 'transmyocardial_slow' },
      septal_superior: { fStart: 0.45, fEnd: 1.00, mode: 'transmyocardial_slow' },
      septal_middle:   { fStart: 0.45, fEnd: 1.00, mode: 'transmyocardial_slow' },
      septal_apical:   { fStart: 0.45, fEnd: 1.00, mode: 'transmyocardial_slow' },
      lv_apical:       { fStart: 0.45, fEnd: 1.00, mode: 'transmyocardial_slow' },
      lv_inferior:     { fStart: 0.45, fEnd: 1.00, mode: 'transmyocardial_slow' },
      lv_anterior:     { fStart: 0.45, fEnd: 1.00, mode: 'transmyocardial_slow' },
      lv_lateral:      { fStart: 0.45, fEnd: 1.00, mode: 'transmyocardial_slow' },
      lv_basal:        { fStart: 0.45, fEnd: 1.00, mode: 'transmyocardial_slow' },
    };

    for (const subId of ALL_VENTRICULAR_SUB_SEGMENT_IDS) {
      if (pSubs.has(subId)) {
        fracSpec[subId] = { fStart: 0.00, fEnd: 0.45, mode: 'reentrant' };
      } else if (sSubs.has(subId)) {
        fracSpec[subId] = { fStart: 0.20, fEnd: 0.72, mode: 'reentrant' };
      }
    }
  } else {
    // Normal His-Purkinje 伝導: 中隔左→右が最初に脱分極し、左右脚・Purkinje網から右室・左室がほぼ同時に高速脱分極(purkinje_fast)
    fracSpec = {
      ra_superior:     { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      ra_inferior:     { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      la_body:         { fStart: 0, fEnd: 0, mode: 'purkinje_fast' },
      septal_middle:   { fStart: 0.00, fEnd: 0.28, mode: 'purkinje_fast' },
      septal_superior: { fStart: 0.05, fEnd: 0.32, mode: 'purkinje_fast' },
      septal_apical:   { fStart: 0.12, fEnd: 0.42, mode: 'purkinje_fast' },
      rv_apical:       { fStart: 0.18, fEnd: 0.56, mode: 'purkinje_fast' },
      lv_apical:       { fStart: 0.18, fEnd: 0.58, mode: 'purkinje_fast' },
      lv_inferior:     { fStart: 0.24, fEnd: 0.68, mode: 'purkinje_fast' },
      lv_anterior:     { fStart: 0.26, fEnd: 0.72, mode: 'purkinje_fast' },
      rv_lateral:      { fStart: 0.28, fEnd: 0.76, mode: 'purkinje_fast' },
      lv_lateral:      { fStart: 0.34, fEnd: 0.88, mode: 'purkinje_fast' },
      rv_basal:        { fStart: 0.42, fEnd: 0.94, mode: 'purkinje_fast' },
      lv_basal:        { fStart: 0.46, fEnd: 1.00, mode: 'purkinje_fast' },
    };
  }

  const segments = {} as Record<MyocardialSubSegmentId, VentricularSubSegmentScheduleItem>;
  let earliestActivationStartSec = Infinity;
  let latestActivationEndSec = -Infinity;

  for (const subId of ALL_VENTRICULAR_SUB_SEGMENT_IDS) {
    const spec = fracSpec[subId];
    const startSec = Number((vStart + spec.fStart * vDur).toFixed(6));
    const endSec = Number((vStart + spec.fEnd * vDur).toFixed(6));
    segments[subId] = {
      activationStartSec: startSec,
      activationEndSec: endSec,
      propagationMode: spec.mode,
    };
    if (startSec < earliestActivationStartSec) earliestActivationStartSec = startSec;
    if (endSec > latestActivationEndSec) latestActivationEndSec = endSec;
  }

  for (const subId of ALL_ATRIAL_SUB_SEGMENT_IDS) {
    segments[subId] = {
      activationStartSec: 0,
      activationEndSec: 0,
      propagationMode: 'purkinje_fast',
    };
  }

  return {
    qrsStartSec,
    qrsEndSec,
    earliestActivationStartSec,
    latestActivationEndSec,
    ventricularMode: mode,
    segments,
  };
}

/**
 * BeatScheduleItem と masterTimeSec (絶対秒) から、現在起きている心臓内現象とECGフェーズを同一基準で導出する
 */
function deriveRealtimeAnnotation(
  disease: Disease,
  masterTimeSec: number,
  beats: BeatScheduleItem[]
): ActiveTimelineAnnotation {
  const profile = disease.conductionProfile;

  if (profile.ventricularContinuousMode === 'vfib_chaos') {
    return {
      phase: 'abnormal',
      titleJa: '心室無秩序細動（スパイラルウェーブ乱舞・有効収縮ゼロ）',
      descriptionJa:
        '心室内で複数の渦巻型リエントリーが無秩序に旋回し、各心室サブセグメントが非同期に細かく痙攣。統一されたQRS波や有効拍出は完全に消失しています。',
    };
  }

  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    const beatPrefix = beats.length > 1 ? `第${i + 1}拍：` : '';

    // 1. 心房脱分極 (P波)
    if (b.atrialStartSec !== undefined && b.atrialMode !== 'none') {
      const aStart = b.atrialStartSec;
      const aEnd = aStart + (b.atrialDurationSec ?? 0.09);
      if (masterTimeSec >= aStart && masterTimeSec <= aEnd) {
        if (b.atrialMode === 'ectopic') {
          return {
            phase: 'P',
            beatIndex: i + 1,
            totalBeats: beats.length,
            titleJa: `${beatPrefix}心房異所性早期発火（変形P'波 / PAC）`,
            descriptionJa:
              '洞結節の予定周期より早く心房内の異所性フォーカスが発火し、通常と異なる向きへ心房筋activation frontが伝播・収縮しています。',
          };
        }
        if (b.atrialMode === 'retrograde') {
          return {
            phase: 'P',
            beatIndex: i + 1,
            totalBeats: beats.length,
            titleJa: `${beatPrefix}房室接合部発火と逆行性心房脱分極（陰性P波）`,
            descriptionJa:
              '房室接合部から下から上へ向かって心房activation frontが逆行性に伝播し、下壁誘導（II, III, aVF）で陰性P波、aVRで陽性P波を形成しています。',
          };
        }
        return {
          phase: 'P',
          beatIndex: i + 1,
          totalBeats: beats.length,
          titleJa: `${beatPrefix}洞房結節発振と心房activation front伝播（P波）`,
          descriptionJa:
            disease.id === 'hyperkalemia'
              ? '静止膜電位の浅化により心房筋の興奮性が低下し、振幅の低い平低化P波を形成しています。'
              : '洞房結節から右房上部→右房下部・左房へ心房筋activation frontが広がり、P波と心房収縮を形成しています。',
        };
      }
    }

    // 2. 房室結節遮断 / His束下遮断（脱落拍）
    if (b.avStartSec !== undefined) {
      const avStart = b.avStartSec;
      const avDur = b.avDurationSec ?? 0.09;
      if (b.avBlocked && masterTimeSec >= avStart && masterTimeSec <= avStart + avDur + 0.14) {
        return {
          phase: 'abnormal',
          beatIndex: i + 1,
          totalBeats: beats.length,
          titleJa: `${beatPrefix}房室結節で伝導完全遮断（QRS波・心室収縮の脱落！）`,
          descriptionJa:
            '心房からの刺激が房室結節（赤×印）で完全に遮断され、His束以下へ伝導しないため心室activation frontとQRS波が脱落しています。',
        };
      }
      if (b.hisBlocked && masterTimeSec >= avStart && masterTimeSec <= avStart + avDur + 0.15) {
        return {
          phase: 'abnormal',
          beatIndex: i + 1,
          totalBeats: beats.length,
          titleJa: `${beatPrefix}His束下で突然伝導遮断（Mobitz II QRS突然脱落！）`,
          descriptionJa:
            '房室結節は正常通過したものの、His束レベル（赤×印）で事前のPR延長なく突然遮断され、心室activation frontとQRS波が脱落しています。',
        };
      }

      // 正常または遅延のPR区間
      const prStart =
        b.atrialStartSec !== undefined
          ? b.atrialStartSec + (b.atrialDurationSec ?? 0.09)
          : avStart;
      const prEnd = b.ventricularStartSec ?? avStart + avDur;
      if (!b.avBlocked && !b.hisBlocked && masterTimeSec > prStart && masterTimeSec < prEnd) {
        return {
          phase: 'PR',
          beatIndex: i + 1,
          totalBeats: beats.length,
          titleJa: b.avSlowed
            ? `${beatPrefix}房室結節の伝導遅延（延長したPRセグメント）`
            : `${beatPrefix}房室結節伝導遅延（PRセグメント）`,
          descriptionJa: b.avSlowed
            ? '房室結節内での伝導速度が著しく低下（オレンジ発光）し、心室脱分極開始までのPR間隔が延長しています。'
            : '房室結節（AV node）を緩徐に通過し、心房収縮による心室への血液充満時間を確保しています。',
        };
      }
    }

    // 3. 心室脱分極 (QRS波)
    if (b.ventricularStartSec !== undefined && !b.avBlocked && !b.hisBlocked) {
      const vStart = b.ventricularStartSec;
      const vDur = b.ventricularDurationSec ?? 0.085;
      const vEnd = vStart + vDur;
      const repolStart = b.repolarizationStartSec ?? vStart + 0.16;
      const repolEnd = repolStart + (b.repolarizationDurationSec ?? 0.16);

      if (masterTimeSec >= vStart && masterTimeSec <= vEnd) {
        const mode = b.ventricularMode ?? 'normal';
        if (mode === 'rbbb') {
          return {
            phase: 'QRS',
            beatIndex: i + 1,
            totalBeats: beats.length,
            titleJa: `${beatPrefix}左室Purkinje先行興奮と右室への心筋内遅延伝播（rsR'波 / CRBBB）`,
            descriptionJa:
              '右脚が遮断（赤×）されているため中隔左→右と左室がPurkinje網で先行脱分極し、その後右室心尖→自由壁→基部へ心筋内遅延activation front（オレンジ）が伝播してV1にR\'波を形成しています。',
          };
        }
        if (mode === 'lbbb') {
          return {
            phase: 'QRS',
            beatIndex: i + 1,
            totalBeats: beats.length,
            titleJa: `${beatPrefix}右室先行興奮と中隔右→左・左室への多段階遅延伝播（CLBBB）`,
            descriptionJa:
              '左脚が完全遮断（赤×）されているため右室が先行脱分極し、中隔を右→左へ横断して左室心尖→前壁→側壁基部へ心筋内遅延activation front（オレンジ）が伝播しています。',
          };
        }
        if (mode === 'lafb') {
          return {
            phase: 'QRS',
            beatIndex: i + 1,
            totalBeats: beats.length,
            titleJa: `${beatPrefix}左脚前枝遮断・後枝から前側壁基部への上方遅延伝播（左軸偏位）`,
            descriptionJa:
              '左脚前枝（赤×）が遮断され、後枝から下壁・心尖部が先行興奮した後に前側壁・基部へ下から左上へ心筋内遅延activation frontが広がっています。',
          };
        }
        if (mode === 'lpfb') {
          return {
            phase: 'QRS',
            beatIndex: i + 1,
            totalBeats: beats.length,
            titleJa: `${beatPrefix}左脚後枝遮断・前枝から下壁への下方遅延伝播（右軸偏位）`,
            descriptionJa:
              '左脚後枝（赤×）が遮断され、前枝から前側壁・基部が先行興奮した後に心尖部・下壁へ上から右下へ心筋内遅延activation frontが広がっています。',
          };
        }
        if (mode === 'wpw') {
          return {
            phase: 'QRS',
            beatIndex: i + 1,
            totalBeats: beats.length,
            titleJa: `${beatPrefix}Kent束早期興奮front（デルタ波）とHis-Purkinje高速frontの融合`,
            descriptionJa:
              'Kent束から左室側壁基部へ早期activation front（デルタ波：オレンジ）が広がり、直後にHis-Purkinje系からの高速activation front（水色）が合流・融合しています。',
          };
        }
        if (mode === 'ectopic_rv' || mode === 'ectopic_lv') {
          return {
            phase: 'QRS',
            beatIndex: i + 1,
            totalBeats: beats.length,
            titleJa: `${beatPrefix}心室異所性発火と心筋内遅延activation front伝播（Wide QRS）`,
            descriptionJa:
              '正常His-Purkinje系を経由せず、心室内の異所性焦点から作業心筋をゆっくりactivation front（オレンジ）が伝播してWide QRSを形成しています。',
          };
        }
        if (mode === 'torsades') {
          return {
            phase: 'QRS',
            beatIndex: i + 1,
            totalBeats: beats.length,
            titleJa: `${beatPrefix}回転する心室activation front（${b.axisAngleDeg}°）による多形性QRS興奮`,
            descriptionJa:
              '1拍ごとに心室activation frontの主脱分極領域・伝播方向が回転し、12誘導それぞれの視線角度に応じたスピンドル状の振幅変化・極性反転を生じています。',
          };
        }
        return {
          phase: 'QRS',
          beatIndex: i + 1,
          totalBeats: beats.length,
          titleJa: `${beatPrefix}中隔左→右から左右心室への高速Purkinje activation front伝播（QRS波）`,
          descriptionJa:
            (profile.infarctedRegions?.length ?? 0) > 0
              ? '梗塞領域（暗紫灰色）の起電力と壁収縮が脱落し、直視誘導に異常Q波（QS波）と電気的窓効果を生じています。'
              : '中隔中部（左→右）から始まり、左右脚・Purkinje網を経て右室・左室へ一斉に高速activation front（淡黄〜水色）が伝播しています。',
        };
      }

      // 4. STセグメント（プラトー相・心室収縮ピーク）
      if (masterTimeSec > vEnd && masterTimeSec < repolStart) {
        return {
          phase: 'ST',
          beatIndex: i + 1,
          totalBeats: beats.length,
          titleJa:
            disease.category === 'infarction'
              ? `${beatPrefix}貫壁性虚血傷害電流によるST上昇と対側性ST低下（ST区間）`
              : disease.id === 'hypocalcemia'
                ? `${beatPrefix}Ca2+低下による活動電位プラトー相の著明延長（長い平坦ST区間）`
                : `${beatPrefix}心室全体脱分極完了（STプラトー相）と機械的収縮ピーク`,
          descriptionJa:
            disease.category === 'infarction'
              ? '梗塞領域と健常心筋の間の傷害電流により直視誘導で著明なST上昇、対側誘導で鏡像的ST低下が記録されています。'
              : disease.id === 'hypocalcemia'
                ? 'L型Caチャネル不活化遅延により心室全体が脱分極プラトー相に長く留まり、水平に伸びたSTセグメントを形成しています。'
                : '心室全サブセグメントが興奮済み状態（プラトー相：水色）に到達し、電位差が消えてST基線に戻りつつ心室収縮がピークに達しています。',
        };
      }

      // 5. 心室再分極 (T波)
      if (masterTimeSec >= repolStart && masterTimeSec <= repolEnd) {
        return {
          phase: 'T',
          beatIndex: i + 1,
          totalBeats: beats.length,
          titleJa:
            disease.id === 'hyperkalemia'
              ? `${beatPrefix}IKr活性化による急速一斉再分極（そびえ立つテント状T波！）`
              : disease.id === 'hypercalcemia'
                ? `${beatPrefix}プラトー相消失に伴う超早期再分極（著明なQT短縮！）`
                : `${beatPrefix}心室再分極の進行と心室弛緩（T波）`,
          descriptionJa:
            disease.id === 'hyperkalemia'
              ? '細胞外K+上昇により第3相再分極が極めて急速に完了し、底が狭く鋭い左右対称のテント状T波を形成しています。'
              : disease.id === 'hypercalcemia'
                ? 'STセグメントを経ずにQRS直後から直ちにT波が立ち上がり、QT間隔が著しく短縮しています。'
                : '心外膜側から心内膜側へ向かって再分極（青灰色）が進行し、心室壁が拡張期へ向けて弛緩しています。',
        };
      }

      // 6. 遅延再分極 (U波)
      if (b.uWaveStartSec !== undefined) {
        const uStart = b.uWaveStartSec;
        const uEnd = uStart + (b.uWaveDurationSec ?? 0.12);
        if (masterTimeSec >= uStart && masterTimeSec <= uEnd) {
          return {
            phase: 'U',
            beatIndex: i + 1,
            totalBeats: beats.length,
            titleJa: `${beatPrefix}Purkinje・M細胞の超遅延再分極（巨大U波！）`,
            descriptionJa:
              '低K血症により再分極第3相が著明に遅延し、平低T波の直後に背の高い陽性U波（特にV2〜V4）が出現してQU延長を呈しています。',
          };
        }
      }
    }
  }

  // 7. 連続心房興奮モードまたは休止期・拡張期基線
  if (profile.atrialContinuousMode === 'afib_wavelets') {
    return {
      phase: 'baseline',
      titleJa: '心房内多重マイクロリエントリー（細動波：f波）と不規則伝導待ち',
      descriptionJa:
        '心房サブセグメント内で複数の非同期な小興奮frontが持続して基線にf波を刻み、房室結節を不規則なタイミングで通過しています。',
    };
  }
  if (profile.atrialContinuousMode === 'aflutter_loop') {
    return {
      phase: 'baseline',
      titleJa: '右房三尖弁輪マクロリエントリー旋回（300 bpm 鋸歯状F波）',
      descriptionJa:
        '右房内を0.20秒周期（300 bpm）で旋回するマクロリエントリーfrontが連続し、3回に1回の割合で房室結節を通過（100 bpm）しています。',
    };
  }
  if (disease.loopPauseSec && masterTimeSec >= disease.scenarioDurationSec - disease.loopPauseSec) {
    return {
      phase: 'baseline',
      titleJa: 'イベント完了後の代償休止期・生理的静止区間',
      descriptionJa:
        '一連の不整脈・伝導ブロックイベントが完了し、次のループ先頭へ戻る前の生理学的静止区間（0mV基線）です。',
    };
  }

  return {
    phase: 'baseline',
    titleJa: '心室拡張期・等電位基線（次拍発火待機中）',
    descriptionJa:
      '心筋の再分極と弛緩が完了し、次の心周期の発火を待機している拡張期（0mV等電位基線）です。',
  };
}

/**
 * Master Timeline から現在の心臓全状態（伝導路・14心筋サブセグメントactivation front・壁運動・合成ベクトル・解説）を単一算出
 */
export function evaluateMasterTimeline(
  disease: Disease,
  masterTimeSec: number
): MasterTimelineSnapshot {
  const scenarioDurationSec = disease.scenarioDurationSec;
  const scenarioProgress = clamp01(masterTimeSec / scenarioDurationSec);
  const normalizedTime = clamp01(masterTimeSec / ECG_WINDOW_SEC);

  const profile = disease.conductionProfile;
  const blockedSet = new Set<HeartRegionId>(profile.blockedPaths ?? []);
  const delayedSet = new Set<HeartRegionId>(profile.delayedPaths ?? []);
  const infarctedSet = new Set<HeartRegionId>(profile.infarctedRegions ?? []);

  // 1. 伝導路の初期化（中隔経由の単一点ドット経路は廃止し、心筋activation frontで表現する）
  const paths = {} as Record<ConductionPathId, ConductionPathRenderState>;
  (Object.keys(PATH_METADATA) as ConductionPathId[]).forEach((id) => {
    let isBlocked = false;
    if (id === 'sa_node' && blockedSet.has('sa_node')) isBlocked = true;
    if (id === 'av_node' && blockedSet.has('av_node')) isBlocked = true;
    if (id === 'his_bundle' && blockedSet.has('his_bundle')) isBlocked = true;
    if (id === 'right_bundle' && blockedSet.has('right_bundle')) isBlocked = true;
    if (
      id === 'left_bundle_stem' &&
      blockedSet.has('left_bundle_ant') &&
      blockedSet.has('left_bundle_post')
    ) {
      isBlocked = true;
    }
    if (id === 'left_bundle_ant' && blockedSet.has('left_bundle_ant')) isBlocked = true;
    if (id === 'left_bundle_post' && blockedSet.has('left_bundle_post')) isBlocked = true;

    const visible =
      id === 'accessory_pathway'
        ? Boolean(profile.showAccessoryPathway)
        : id === 'transseptal_lv_to_rv' || id === 'transseptal_rv_to_lv'
          ? false
          : true;

    paths[id] = {
      id,
      nameEn: PATH_METADATA[id].nameEn,
      nameJa: PATH_METADATA[id].nameJa,
      status: isBlocked ? 'blocked' : 'waiting',
      progress: 0,
      showTip: false,
      visible,
    };
  });

  // 2. 心筋壁領域 (7親領域) の初期化
  const walls: Record<MyocardialWallId, WallRegionRenderState> = {
    ra_wall:     { id: 'ra_wall',     electricalState: 'resting', intensity: 0, contraction: 0, isInfarcted: false },
    la_wall:     { id: 'la_wall',     electricalState: 'resting', intensity: 0, contraction: 0, isInfarcted: false },
    rv_wall:     { id: 'rv_wall',     electricalState: 'resting', intensity: 0, contraction: 0, isInfarcted: infarctedSet.has('rv_wall') },
    iv_septum:   { id: 'iv_septum',   electricalState: 'resting', intensity: 0, contraction: 0, isInfarcted: infarctedSet.has('iv_septum') },
    lv_anterior: { id: 'lv_anterior', electricalState: 'resting', intensity: 0, contraction: 0, isInfarcted: infarctedSet.has('lv_anterior') },
    lv_lateral:  { id: 'lv_lateral',  electricalState: 'resting', intensity: 0, contraction: 0, isInfarcted: infarctedSet.has('lv_lateral') },
    lv_inferior: { id: 'lv_inferior', electricalState: 'resting', intensity: 0, contraction: 0, isInfarcted: infarctedSet.has('lv_inferior') },
  };

  for (const wKey of Object.keys(walls) as MyocardialWallId[]) {
    if (walls[wKey].isInfarcted) {
      walls[wKey].electricalState = 'infarcted';
      walls[wKey].intensity = 0.85;
    }
  }

  // 2b. 14心筋サブセグメントの初期化
  const subSegments = {} as Record<MyocardialSubSegmentId, MyocardialSubSegmentState>;
  (Object.keys(SUB_SEGMENT_METADATA) as MyocardialSubSegmentId[]).forEach((subId) => {
    const meta = SUB_SEGMENT_METADATA[subId];
    const isInfarcted = walls[meta.parentWall].isInfarcted;
    subSegments[subId] = {
      id: subId,
      nameJa: meta.nameJa,
      parentWall: meta.parentWall,
      chamber: meta.chamber,
      activationStartSec: 0,
      activationEndSec: 0,
      propagationMode: 'purkinje_fast',
      phase: isInfarcted ? 'infarcted' : 'resting',
      frontProgress: 0,
      intensity: isInfarcted ? 0.22 : 0,
      contraction: 0,
      isInfarcted,
      vectorDir: meta.vectorDir,
    };
  });

  let vecDx = 0;
  let vecDy = 0;
  let ectopicFiring = false;
  let activeVentricularSchedule: VentricularBeatActivationSchedule | undefined;

  const beats = getEffectiveBeats(disease);
  const firstBeat = beats[0];

  let sourceRegion: BeatSourceRegion =
    firstBeat?.sourceRegion ??
    (profile.ectopicFocus === 'av_junction'
      ? 'av_junction'
      : profile.ectopicFocus === 'atria_ectopic'
        ? 'atria_ectopic'
        : profile.ectopicFocus
          ? 'ventricle_ectopic'
          : 'sa_node');

  let saNodeFiring = false;
  let atrialPropagation: AtrialPropagationDirection =
    firstBeat?.atrialPropagation ??
    (firstBeat?.atrialMode === 'retrograde'
      ? 'retrograde'
      : firstBeat?.atrialMode === 'ectopic'
        ? 'ectopic'
        : firstBeat?.atrialMode === 'none'
          ? 'none'
          : 'antegrade');

  let ventricularPropagation: VentricularPropagationDirection =
    firstBeat?.ventricularPropagation ??
    (firstBeat?.ventricularMode === 'torsades'
      ? 'torsades_rotor'
      : firstBeat?.ventricularMode === 'ectopic_rv' || firstBeat?.ventricularMode === 'ectopic_lv'
        ? 'ectopic'
        : 'antegrade');

  let primaryActivationRegion: MyocardialWallId | undefined;
  let secondaryActivationRegion: MyocardialWallId | undefined;
  let propagationDirection: string | undefined;
  let activeAxisAngleDeg: number | undefined;

  // 3. 各心拍イベント(BeatScheduleItem)を評価して伝導・心筋activation front・再分極・壁収縮を合成
  for (const beat of beats) {
    const isAvJunctionSource =
      beat.sourceRegion === 'av_junction' ||
      profile.ectopicFocus === 'av_junction' ||
      beat.atrialMode === 'retrograde';

    const effectiveAtrialStartSec =
      isAvJunctionSource && beat.sourceStartSec !== undefined
        ? beat.atrialStartSec ?? Number((beat.sourceStartSec + 0.01).toFixed(4))
        : beat.atrialStartSec;

    const effectiveAvStartSec =
      isAvJunctionSource && beat.sourceStartSec !== undefined
        ? beat.sourceStartSec
        : beat.avStartSec;

    const effectiveVentricularStartSec =
      isAvJunctionSource && beat.sourceStartSec !== undefined
        ? beat.ventricularStartSec ??
          Number((beat.sourceStartSec + (beat.avDurationSec ?? 0.06)).toFixed(4))
        : beat.ventricularStartSec;

    // --- A. 心房興奮 (P波) & 心房サブセグメント activation front ---
    if (effectiveAtrialStartSec !== undefined && beat.atrialMode !== 'none') {
      const aStart = effectiveAtrialStartSec;
      const aDur = beat.atrialDurationSec ?? 0.09;

      // 心房3サブセグメントのスケジュール設定
      const isRetrograde = beat.atrialMode === 'retrograde' || isAvJunctionSource;
      const isEctopicAtria = beat.atrialMode === 'ectopic';
      const atrialSchedule: Record<
        'ra_superior' | 'ra_inferior' | 'la_body',
        { start: number; end: number; mode: MyocardialPropagationMode }
      > = isRetrograde
        ? {
            // 逆行性: 右房下部(AV接合部側) → 右房上部 ＆ 左房へ下から上へ広がる
            ra_inferior: { start: aStart,               end: aStart + aDur * 0.55, mode: 'retrograde' },
            ra_superior: { start: aStart + aDur * 0.28, end: aStart + aDur * 0.92, mode: 'retrograde' },
            la_body:     { start: aStart + aDur * 0.22, end: aStart + aDur * 1.00, mode: 'retrograde' },
          }
        : isEctopicAtria
          ? {
              // 異所性心房(PAC): 左房〜右房へ非通常順序で伝播
              la_body:     { start: aStart,               end: aStart + aDur * 0.65, mode: 'ectopic' },
              ra_superior: { start: aStart + aDur * 0.20, end: aStart + aDur * 0.85, mode: 'transmyocardial_slow' },
              ra_inferior: { start: aStart + aDur * 0.32, end: aStart + aDur * 1.00, mode: 'transmyocardial_slow' },
            }
          : {
              // 正常洞調律: 右房上部(SA結節近傍) → 右房下部 → 左房(Bachmann束経由)
              ra_superior: { start: aStart,               end: aStart + aDur * 0.55, mode: 'purkinje_fast' },
              ra_inferior: { start: aStart + aDur * 0.18, end: aStart + aDur * 0.80, mode: 'purkinje_fast' },
              la_body:     { start: aStart + aDur * 0.25, end: aStart + aDur * 1.00, mode: 'purkinje_fast' },
            };

      if (masterTimeSec >= aStart && masterTimeSec <= aStart + aDur + 0.14) {
        const pProg = clamp01((masterTimeSec - aStart) / aDur);

        (['ra_superior', 'ra_inferior', 'la_body'] as const).forEach((subId) => {
          const s = atrialSchedule[subId];
          subSegments[subId].activationStartSec = s.start;
          subSegments[subId].activationEndSec = s.end;
          subSegments[subId].propagationMode = s.mode;
          if (masterTimeSec >= s.start && masterTimeSec <= s.end) {
            const fp = clamp01((masterTimeSec - s.start) / Math.max(0.001, s.end - s.start));
            subSegments[subId].phase = 'front_active';
            subSegments[subId].frontProgress = fp;
            subSegments[subId].intensity = 0.6 + 0.4 * Math.sin(fp * Math.PI);
          } else if (masterTimeSec > s.end && masterTimeSec <= aStart + aDur + 0.03) {
            subSegments[subId].phase = 'depolarized';
            subSegments[subId].frontProgress = 1;
            subSegments[subId].intensity = 0.65;
          } else if (masterTimeSec > aStart + aDur + 0.03 && masterTimeSec <= aStart + aDur + 0.12) {
            subSegments[subId].phase = 'repolarizing';
            subSegments[subId].frontProgress = 1;
            subSegments[subId].intensity = 0.35;
          }
        });

        if (pProg > 0 && pProg < 1) {
          if (beat.atrialMode === 'normal' && !isAvJunctionSource && !blockedSet.has('sa_node')) {
            saNodeFiring = true;
            sourceRegion = 'sa_node';
            atrialPropagation = 'antegrade';
            paths.sa_node.status = 'normal';
            paths.sa_node.progress = 1;
            paths.sa_node.showTip = pProg < 0.25;
            paths.internodal_ra.status = 'normal';
            paths.internodal_ra.progress = pProg;
            paths.internodal_ra.showTip = true;
            paths.internodal_la.status = 'normal';
            paths.internodal_la.progress = clamp01((pProg - 0.1) / 0.9);
            paths.internodal_la.showTip = pProg > 0.1;
            vecDx += 0.35 * Math.sin(pProg * Math.PI);
            vecDy += 0.45 * Math.sin(pProg * Math.PI);
          } else if (isRetrograde) {
            ectopicFiring = true;
            saNodeFiring = false;
            sourceRegion = 'av_junction';
            atrialPropagation = 'retrograde';
            ventricularPropagation = 'antegrade';
            paths.sa_node.status = 'blocked';
            paths.sa_node.progress = 0;
            paths.sa_node.showTip = false;
            paths.av_node.status = 'normal';
            paths.av_node.progress = 1;
            paths.internodal_ra.status = 'delayed';
            paths.internodal_ra.progress = pProg;
            paths.internodal_ra.showTip = true;
            paths.internodal_la.status = 'delayed';
            paths.internodal_la.progress = pProg;
            paths.internodal_la.showTip = true;
            vecDx += -0.2 * Math.sin(pProg * Math.PI);
            vecDy += -0.45 * Math.sin(pProg * Math.PI);
          } else if (isEctopicAtria) {
            ectopicFiring = true;
            saNodeFiring = false;
            sourceRegion = 'atria_ectopic';
            atrialPropagation = 'ectopic';
            paths.internodal_ra.status = 'delayed';
            paths.internodal_ra.progress = pProg;
            paths.internodal_ra.showTip = true;
            paths.internodal_la.status = 'delayed';
            paths.internodal_la.progress = pProg;
            paths.internodal_la.showTip = true;
            vecDx += 0.25 * Math.sin(pProg * Math.PI);
            vecDy += 0.35 * Math.sin(pProg * Math.PI);
          }

          const depol = Math.sin(pProg * Math.PI);
          walls.ra_wall.electricalState = 'depolarizing';
          walls.ra_wall.intensity = Math.max(walls.ra_wall.intensity, depol);
          walls.la_wall.electricalState = 'depolarizing';
          walls.la_wall.intensity = Math.max(walls.la_wall.intensity, clamp01(depol * 0.95));
        }

        const aContract = smoothPulse(masterTimeSec, aStart + 0.025, aDur + 0.08);
        walls.ra_wall.contraction = Math.max(walls.ra_wall.contraction, aContract * 0.85);
        walls.la_wall.contraction = Math.max(walls.la_wall.contraction, aContract * 0.85);
        subSegments.ra_superior.contraction = Math.max(subSegments.ra_superior.contraction, aContract * 0.85);
        subSegments.ra_inferior.contraction = Math.max(subSegments.ra_inferior.contraction, aContract * 0.85);
        subSegments.la_body.contraction = Math.max(subSegments.la_body.contraction, aContract * 0.85);
      }
    }

    // --- B. 房室結節伝導 (PRセグメント / AV junction source event) ---
    if (effectiveAvStartSec !== undefined) {
      const avStart = effectiveAvStartSec;
      const avDur = beat.avDurationSec ?? 0.09;
      if (masterTimeSec >= avStart && masterTimeSec <= avStart + avDur) {
        const avProg = clamp01((masterTimeSec - avStart) / avDur);
        if (beat.avBlocked) {
          paths.av_node.status = 'blocked';
          paths.av_node.progress = Math.min(0.55, avProg);
          paths.av_node.showTip = avProg < 0.6;
        } else {
          if (isAvJunctionSource) {
            ectopicFiring = true;
            saNodeFiring = false;
            sourceRegion = 'av_junction';
            atrialPropagation = 'retrograde';
            ventricularPropagation = 'antegrade';
          }
          const isSlow = Boolean(beat.avSlowed || delayedSet.has('av_node') || avDur > 0.13);
          paths.av_node.status = isSlow ? 'delayed' : 'normal';
          paths.av_node.progress = avProg;
          paths.av_node.showTip = true;
        }
      }
    }

    // --- C. His束以下での遮断 (Mobitz II脱落拍など) ---
    if (beat.hisBlocked && effectiveAvStartSec !== undefined) {
      const hStart = effectiveAvStartSec + (beat.avDurationSec ?? 0.09);
      if (masterTimeSec >= hStart && masterTimeSec <= hStart + 0.12) {
        paths.his_bundle.status = 'blocked';
        paths.his_bundle.progress = 0.4;
        paths.his_bundle.showTip = true;
      }
    }

    // --- D. 心室脱分極 (QRS: 11心室サブセグメント activation front) ＆ 心室収縮 ＆ 再分極 ---
    if (
      effectiveVentricularStartSec !== undefined &&
      !beat.avBlocked &&
      !beat.hisBlocked
    ) {
      const vSchedule = computeVentricularSubSegmentSchedule(beat, disease);
      const vStart = vSchedule.qrsStartSec;
      const vEnd = vSchedule.qrsEndSec;
      const vDur = vEnd - vStart;
      const repolStart = beat.repolarizationStartSec ?? vStart + 0.16;
      const repolDur = beat.repolarizationDurationSec ?? 0.16;
      const mode = beat.ventricularMode ?? 'normal';
      const strength = beat.contractionStrength ?? beat.activationStrength ?? 1.0;
      const actStrength = beat.activationStrength ?? beat.contractionStrength ?? 1.0;

      if (
        !activeVentricularSchedule ||
        (masterTimeSec >= vStart - 0.05 && masterTimeSec <= repolStart + repolDur + 0.08)
      ) {
        activeVentricularSchedule = vSchedule;
        for (const subId of ALL_VENTRICULAR_SUB_SEGMENT_IDS) {
          subSegments[subId].activationStartSec = vSchedule.segments[subId].activationStartSec;
          subSegments[subId].activationEndSec = vSchedule.segments[subId].activationEndSec;
          subSegments[subId].propagationMode = vSchedule.segments[subId].propagationMode;
        }
      }

      // 11心室サブセグメントのリアルタイム位相 (front_active -> depolarized -> repolarizing) と局所収縮の更新
      if (masterTimeSec >= vStart && masterTimeSec <= repolStart + repolDur + 0.05) {
        for (const subId of ALL_VENTRICULAR_SUB_SEGMENT_IDS) {
          const segSpec = vSchedule.segments[subId];
          const subState = subSegments[subId];
          subState.activationStartSec = segSpec.activationStartSec;
          subState.activationEndSec = segSpec.activationEndSec;
          subState.propagationMode = segSpec.propagationMode;

          if (subState.isInfarcted) {
            subState.phase = 'infarcted';
            subState.frontProgress = 0;
            subState.intensity = 0.22;
            const cPulse = smoothPulse(masterTimeSec, segSpec.activationStartSec + 0.025, 0.21);
            subState.contraction = Math.max(subState.contraction, cPulse * strength * 0.15);
            continue;
          }

          if (
            masterTimeSec >= segSpec.activationStartSec &&
            masterTimeSec <= segSpec.activationEndSec
          ) {
            const fp = clamp01(
              (masterTimeSec - segSpec.activationStartSec) /
                Math.max(0.001, segSpec.activationEndSec - segSpec.activationStartSec)
            );
            subState.phase = 'front_active';
            subState.frontProgress = fp;
            subState.intensity = Math.max(
              subState.intensity,
              (0.58 + 0.42 * Math.sin(fp * Math.PI)) * actStrength
            );
          } else if (masterTimeSec > segSpec.activationEndSec && masterTimeSec < repolStart) {
            subState.phase = 'depolarized';
            subState.frontProgress = 1;
            subState.intensity = Math.max(subState.intensity, 0.78 * actStrength);
          } else if (
            masterTimeSec >= repolStart &&
            masterTimeSec <= repolStart + repolDur
          ) {
            const rProg = clamp01((masterTimeSec - repolStart) / repolDur);
            if (subState.phase === 'resting' || subState.phase === 'repolarizing') {
              subState.phase = 'repolarizing';
              subState.frontProgress = rProg;
              subState.intensity = Math.max(
                subState.intensity,
                Math.sin(rProg * Math.PI) * 0.85 * actStrength
              );
            }
          }

          // 各サブセグメントの機械的収縮は自身の activationStartSec の直後から開始
          const subContractDur = mode === 'torsades' ? 0.185 : 0.215;
          const cPulse = smoothPulse(
            masterTimeSec,
            segSpec.activationStartSec + 0.022,
            subContractDur
          );
          subState.contraction = Math.max(subState.contraction, cPulse * strength);
        }
      }

      // TdP の場合は axisAngleDeg から primary / secondary 領域と伝播方向を導出
      const tdAxisDeg = beat.axisAngleDeg ?? 45;
      const tdSpec =
        mode === 'torsades' ? deriveTorsadesPropagationFromAxis(tdAxisDeg) : undefined;
      const beatPrimaryWall: MyocardialWallId | undefined =
        mode === 'torsades'
          ? ((beat.primaryActivationRegion as MyocardialWallId) ?? tdSpec?.primaryActivationRegion)
          : undefined;
      const beatSecondaryWall: MyocardialWallId | undefined =
        mode === 'torsades'
          ? ((beat.secondaryActivationRegion as MyocardialWallId) ??
            tdSpec?.secondaryActivationRegion)
          : undefined;
      const beatPropagationDir =
        mode === 'torsades' ? (beat.propagationDirection ?? tdSpec?.propagationDirection) : undefined;

      if (masterTimeSec >= vStart && masterTimeSec <= vStart + vDur) {
        const vProg = clamp01((masterTimeSec - vStart) / vDur);

        if (isAvJunctionSource) {
          saNodeFiring = false;
          sourceRegion = 'av_junction';
          atrialPropagation = 'retrograde';
          ventricularPropagation = 'antegrade';
        }

        if (mode === 'rbbb') {
          paths.his_bundle.status = 'normal';
          paths.his_bundle.progress = clamp01(vProg * 3.5);
          paths.his_bundle.showTip = vProg < 0.28;

          paths.right_bundle.status = 'blocked';
          paths.right_bundle.progress = 0.25;

          const lvProg = clamp01(vProg * 1.85);
          paths.left_bundle_stem.status = 'normal';
          paths.left_bundle_stem.progress = lvProg;
          paths.left_bundle_ant.status = 'normal';
          paths.left_bundle_ant.progress = lvProg;
          paths.left_bundle_post.status = 'normal';
          paths.left_bundle_post.progress = lvProg;
          paths.purkinje_lv.status = 'normal';
          paths.purkinje_lv.progress = clamp01((vProg - 0.15) * 1.8);
          paths.purkinje_lv.showTip = vProg >= 0.15 && vProg <= 0.65;

          const lvInt = Math.sin(clamp01(vProg * 1.6) * Math.PI);
          (['iv_septum', 'lv_anterior', 'lv_lateral', 'lv_inferior'] as MyocardialWallId[]).forEach((w) => {
            if (!walls[w].isInfarcted) {
              walls[w].electricalState = 'depolarizing';
              walls[w].intensity = Math.max(walls[w].intensity, lvInt);
            }
          });

          if (vProg >= 0.42) {
            const rvDelayProg = clamp01((vProg - 0.42) / 0.58);
            walls.rv_wall.electricalState = 'depolarizing';
            walls.rv_wall.intensity = Math.max(walls.rv_wall.intensity, Math.sin(rvDelayProg * Math.PI));
            vecDx += -0.75 * Math.sin(rvDelayProg * Math.PI);
            vecDy += 0.25 * Math.sin(rvDelayProg * Math.PI);
          } else {
            vecDx += 0.75 * Math.sin(lvProg * Math.PI);
            vecDy += 0.65 * Math.sin(lvProg * Math.PI);
          }
        } else if (mode === 'lbbb') {
          paths.his_bundle.status = 'normal';
          paths.his_bundle.progress = clamp01(vProg * 3.5);
          paths.his_bundle.showTip = vProg < 0.28;

          paths.left_bundle_stem.status = 'blocked';
          paths.left_bundle_ant.status = 'blocked';
          paths.left_bundle_post.status = 'blocked';

          const rvProg = clamp01(vProg * 1.85);
          paths.right_bundle.status = 'normal';
          paths.right_bundle.progress = rvProg;
          paths.right_bundle.showTip = vProg < 0.45;
          paths.purkinje_rv.status = 'normal';
          paths.purkinje_rv.progress = clamp01((vProg - 0.15) * 1.8);
          paths.purkinje_rv.showTip = vProg >= 0.15 && vProg <= 0.65;

          walls.rv_wall.electricalState = 'depolarizing';
          walls.rv_wall.intensity = Math.max(walls.rv_wall.intensity, Math.sin(clamp01(vProg * 1.7) * Math.PI));

          if (vProg >= 0.32) {
            const lvDelayProg = clamp01((vProg - 0.32) / 0.68);
            (['iv_septum', 'lv_anterior', 'lv_lateral', 'lv_inferior'] as MyocardialWallId[]).forEach((w) => {
              if (!walls[w].isInfarcted) {
                walls[w].electricalState = 'depolarizing';
                walls[w].intensity = Math.max(walls[w].intensity, Math.sin(lvDelayProg * Math.PI));
              }
            });
          }
          vecDx += 0.95 * Math.sin(vProg * Math.PI);
          vecDy += 0.45 * Math.sin(vProg * Math.PI);
        } else if (mode === 'wpw') {
          paths.accessory_pathway.visible = true;
          paths.accessory_pathway.status = 'delayed';
          paths.accessory_pathway.progress = clamp01(vProg * 2.0);
          paths.accessory_pathway.showTip = vProg < 0.55;

          walls.lv_lateral.electricalState = 'depolarizing';
          walls.lv_lateral.intensity = Math.max(walls.lv_lateral.intensity, Math.sin(clamp01(vProg * 1.5) * Math.PI));

          if (vProg >= 0.30) {
            const nProg = clamp01((vProg - 0.30) / 0.70);
            paths.his_bundle.status = 'normal';
            paths.his_bundle.progress = clamp01(nProg * 2.5);
            paths.right_bundle.status = 'normal';
            paths.right_bundle.progress = nProg;
            paths.left_bundle_stem.status = 'normal';
            paths.left_bundle_stem.progress = nProg;
            paths.left_bundle_ant.status = 'normal';
            paths.left_bundle_ant.progress = nProg;
            paths.left_bundle_post.status = 'normal';
            paths.left_bundle_post.progress = nProg;
            paths.purkinje_rv.status = 'normal';
            paths.purkinje_rv.progress = nProg;
            paths.purkinje_lv.status = 'normal';
            paths.purkinje_lv.progress = nProg;
            paths.purkinje_lv.showTip = true;

            (['rv_wall', 'iv_septum', 'lv_anterior', 'lv_inferior'] as MyocardialWallId[]).forEach((w) => {
              walls[w].electricalState = 'depolarizing';
              walls[w].intensity = Math.max(walls[w].intensity, Math.sin(nProg * Math.PI));
            });
          }
          vecDx += 0.75 * Math.sin(vProg * Math.PI);
          vecDy += 0.60 * Math.sin(vProg * Math.PI);
        } else if (mode === 'torsades' && beatPrimaryWall && beatSecondaryWall) {
          ectopicFiring = true;
          saNodeFiring = false;
          sourceRegion = 'ventricle_ectopic';
          ventricularPropagation = 'torsades_rotor';
          primaryActivationRegion = beatPrimaryWall;
          secondaryActivationRegion = beatSecondaryWall;
          propagationDirection = beatPropagationDir;
          activeAxisAngleDeg = tdAxisDeg;

          walls[beatPrimaryWall].electricalState = 'depolarizing';
          walls[beatPrimaryWall].intensity = Math.max(
            walls[beatPrimaryWall].intensity,
            Math.sin(vProg * Math.PI) * actStrength
          );

          if (vProg >= 0.20) {
            const sProg = clamp01((vProg - 0.20) / 0.80);
            walls[beatSecondaryWall].electricalState = 'depolarizing';
            walls[beatSecondaryWall].intensity = Math.max(
              walls[beatSecondaryWall].intensity,
              Math.sin(sProg * Math.PI) * actStrength * 0.88
            );
          }

          if (vProg >= 0.42) {
            const rProg = clamp01((vProg - 0.42) / 0.58);
            (['rv_wall', 'iv_septum', 'lv_anterior', 'lv_lateral', 'lv_inferior'] as MyocardialWallId[]).forEach(
              (w) => {
                if (w !== beatPrimaryWall && w !== beatSecondaryWall) {
                  walls[w].electricalState = 'depolarizing';
                  walls[w].intensity = Math.max(
                    walls[w].intensity,
                    Math.sin(rProg * Math.PI) * actStrength * 0.62
                  );
                }
              }
            );
          }

          const rad = (tdAxisDeg * Math.PI) / 180;
          vecDx = Math.cos(rad) * actStrength * Math.sin(vProg * Math.PI);
          vecDy = Math.sin(rad) * actStrength * Math.sin(vProg * Math.PI);
        } else if (mode === 'ectopic_rv' || mode === 'ectopic_lv') {
          ectopicFiring = true;
          saNodeFiring = false;
          sourceRegion = 'ventricle_ectopic';
          ventricularPropagation = 'ectopic';
          const firstWalls: MyocardialWallId[] =
            mode === 'ectopic_rv' ? ['rv_wall', 'iv_septum'] : ['lv_lateral', 'lv_inferior', 'iv_septum'];
          const secondWalls: MyocardialWallId[] =
            mode === 'ectopic_rv' ? ['lv_anterior', 'lv_lateral', 'lv_inferior'] : ['lv_anterior', 'rv_wall'];

          firstWalls.forEach((w) => {
            walls[w].electricalState = 'depolarizing';
            walls[w].intensity = Math.max(walls[w].intensity, Math.sin(clamp01(vProg * 1.5) * Math.PI) * actStrength);
          });
          if (vProg >= 0.28) {
            const sProg = clamp01((vProg - 0.28) / 0.72);
            secondWalls.forEach((w) => {
              walls[w].electricalState = 'depolarizing';
              walls[w].intensity = Math.max(walls[w].intensity, Math.sin(sProg * Math.PI) * actStrength);
            });
          }

          if (mode === 'ectopic_rv') {
            vecDx += 0.55 * Math.sin(vProg * Math.PI);
            vecDy += 0.85 * Math.sin(vProg * Math.PI);
          } else {
            vecDx += -0.65 * Math.sin(vProg * Math.PI);
            vecDy += -0.75 * Math.sin(vProg * Math.PI);
          }
        } else {
          const isSlowCond = delayedSet.has('iv_septum') || delayedSet.has('his_bundle');
          const pathStatus = isSlowCond ? 'delayed' : 'normal';

          paths.his_bundle.status = pathStatus;
          paths.his_bundle.progress = clamp01(vProg * 3.0);
          paths.his_bundle.showTip = vProg < 0.34;

          paths.right_bundle.status = blockedSet.has('right_bundle') ? 'blocked' : pathStatus;
          paths.right_bundle.progress = blockedSet.has('right_bundle') ? 0.2 : clamp01((vProg - 0.12) * 2.0);
          paths.right_bundle.showTip = !blockedSet.has('right_bundle') && vProg >= 0.12 && vProg < 0.62;

          paths.left_bundle_stem.status = pathStatus;
          paths.left_bundle_stem.progress = clamp01((vProg - 0.10) * 2.2);

          paths.left_bundle_ant.status = blockedSet.has('left_bundle_ant') ? 'blocked' : pathStatus;
          paths.left_bundle_ant.progress = blockedSet.has('left_bundle_ant') ? 0.25 : clamp01((vProg - 0.15) * 2.0);
          paths.left_bundle_ant.showTip = !blockedSet.has('left_bundle_ant') && vProg >= 0.15 && vProg < 0.65;

          paths.left_bundle_post.status = blockedSet.has('left_bundle_post') ? 'blocked' : pathStatus;
          paths.left_bundle_post.progress = blockedSet.has('left_bundle_post') ? 0.25 : clamp01((vProg - 0.15) * 2.0);
          paths.left_bundle_post.showTip = !blockedSet.has('left_bundle_post') && vProg >= 0.15 && vProg < 0.65;

          paths.purkinje_rv.status = pathStatus;
          paths.purkinje_rv.progress = clamp01((vProg - 0.35) * 1.6);
          paths.purkinje_rv.showTip = vProg >= 0.35;

          paths.purkinje_lv.status = pathStatus;
          paths.purkinje_lv.progress = clamp01((vProg - 0.35) * 1.6);
          paths.purkinje_lv.showTip = vProg >= 0.35;

          const depolInt = Math.sin(vProg * Math.PI);
          (['rv_wall', 'iv_septum', 'lv_anterior', 'lv_lateral', 'lv_inferior'] as MyocardialWallId[]).forEach((w) => {
            if (!walls[w].isInfarcted) {
              walls[w].electricalState = 'depolarizing';
              walls[w].intensity = Math.max(walls[w].intensity, depolInt);
            }
          });

          if (mode === 'lafb') {
            vecDx += 0.85 * Math.sin(vProg * Math.PI);
            vecDy += -0.65 * Math.sin(vProg * Math.PI);
          } else if (mode === 'lpfb') {
            vecDx += -0.45 * Math.sin(vProg * Math.PI);
            vecDy += 0.90 * Math.sin(vProg * Math.PI);
          } else if (profile.isDextrocardia) {
            vecDx += -0.75 * Math.sin(vProg * Math.PI);
            vecDy += 0.75 * Math.sin(vProg * Math.PI);
          } else {
            vecDx += 0.70 * Math.sin(vProg * Math.PI);
            vecDy += 0.75 * Math.sin(vProg * Math.PI);
          }
        }
      }

      // 心室壁収縮 (TdPでは primaryActivationRegion / secondaryActivationRegion と contractionStrength に完全連動)
      if (mode === 'torsades' && beatPrimaryWall && beatSecondaryWall) {
        const tdContract = smoothPulse(masterTimeSec, vStart + 0.015, 0.185) * strength;
        if (tdContract > 0) {
          primaryActivationRegion = primaryActivationRegion ?? beatPrimaryWall;
          secondaryActivationRegion = secondaryActivationRegion ?? beatSecondaryWall;
          propagationDirection = propagationDirection ?? beatPropagationDir;
          activeAxisAngleDeg = activeAxisAngleDeg ?? tdAxisDeg;

          walls[beatPrimaryWall].contraction = Math.max(
            walls[beatPrimaryWall].contraction,
            tdContract * 1.0
          );
          walls[beatSecondaryWall].contraction = Math.max(
            walls[beatSecondaryWall].contraction,
            tdContract * 0.86
          );
          (['rv_wall', 'iv_septum', 'lv_anterior', 'lv_lateral', 'lv_inferior'] as MyocardialWallId[]).forEach(
            (w) => {
              if (w !== beatPrimaryWall && w !== beatSecondaryWall) {
                walls[w].contraction = Math.max(walls[w].contraction, tdContract * 0.68);
              }
            }
          );
        }
      } else {
        const rvDelay = mode === 'rbbb' ? 0.065 : 0.035;
        const lvDelay = mode === 'lbbb' ? 0.065 : 0.035;
        const systoleDur = 0.22;

        const rvContract = smoothPulse(masterTimeSec, vStart + rvDelay, systoleDur) * strength;
        const lvContract = smoothPulse(masterTimeSec, vStart + lvDelay, systoleDur) * strength;

        walls.rv_wall.contraction = Math.max(
          walls.rv_wall.contraction,
          walls.rv_wall.isInfarcted ? rvContract * 0.18 : rvContract
        );
        (['iv_septum', 'lv_anterior', 'lv_lateral', 'lv_inferior'] as MyocardialWallId[]).forEach((w) => {
          const cVal = walls[w].isInfarcted ? lvContract * 0.15 : lvContract;
          walls[w].contraction = Math.max(walls[w].contraction, cVal);
        });
      }

      // 心室再分極 (T波)
      if (masterTimeSec >= repolStart && masterTimeSec <= repolStart + repolDur) {
        const rProg = clamp01((masterTimeSec - repolStart) / repolDur);
        const repolInt = Math.sin(rProg * Math.PI);
        (['rv_wall', 'iv_septum', 'lv_anterior', 'lv_lateral', 'lv_inferior'] as MyocardialWallId[]).forEach((w) => {
          if (!walls[w].isInfarcted && walls[w].electricalState === 'resting') {
            walls[w].electricalState = 'repolarizing';
            walls[w].intensity = Math.max(walls[w].intensity, repolInt * 0.85);
          }
        });
        vecDx += (profile.isDextrocardia ? -0.45 : 0.45) * repolInt;
        vecDy += 0.45 * repolInt;
      }
    }
  }

  // 4. AF / AFL / VF の連続波処理 (sub-segments も非同期細動front / マクロ旋回front へ更新)
  const atrialWaveMode = profile.atrialContinuousMode ?? 'none';
  const ventricularWaveMode = profile.ventricularContinuousMode ?? 'none';

  if (atrialWaveMode === 'afib_wavelets') {
    walls.ra_wall.electricalState = 'depolarizing';
    walls.ra_wall.intensity = 0.35 + 0.25 * Math.sin(masterTimeSec * 28);
    walls.la_wall.electricalState = 'depolarizing';
    walls.la_wall.intensity = 0.35 + 0.25 * Math.cos(masterTimeSec * 34 + 1.1);
    walls.ra_wall.contraction = 0.04 * Math.abs(Math.sin(masterTimeSec * 32));
    walls.la_wall.contraction = 0.04 * Math.abs(Math.cos(masterTimeSec * 36));

    ALL_ATRIAL_SUB_SEGMENT_IDS.forEach((subId, idx) => {
      const wave = 0.5 + 0.5 * Math.sin(masterTimeSec * (26 + idx * 7) + idx * 1.9);
      subSegments[subId].propagationMode = 'chaotic';
      subSegments[subId].phase = wave > 0.35 ? 'front_active' : 'depolarized';
      subSegments[subId].frontProgress = (masterTimeSec * (3.8 + idx * 0.9) + idx * 0.3) % 1;
      subSegments[subId].intensity = 0.35 + 0.35 * wave;
      subSegments[subId].contraction = 0.03 * wave; // 有効な一斉心房収縮なし
    });
  } else if (atrialWaveMode === 'aflutter_loop') {
    const flutterPhase = (masterTimeSec % 0.20) / 0.20;
    walls.ra_wall.electricalState = 'depolarizing';
    walls.ra_wall.intensity = 0.45 + 0.35 * Math.sin(flutterPhase * Math.PI * 2);
    walls.la_wall.electricalState = 'depolarizing';
    walls.la_wall.intensity = 0.35 + 0.30 * Math.cos(flutterPhase * Math.PI * 2);
    walls.ra_wall.contraction = 0.14 * Math.sin(flutterPhase * Math.PI);
    walls.la_wall.contraction = 0.12 * Math.sin(flutterPhase * Math.PI);

    // 右房マクロリエントリー旋回: ra_inferior (0..0.45) -> ra_superior (0.30..0.75) -> la_body (0.55..1.00)
    const aflWindows: Record<'ra_inferior' | 'ra_superior' | 'la_body', [number, number]> = {
      ra_inferior: [0.00, 0.45],
      ra_superior: [0.30, 0.75],
      la_body:     [0.55, 1.00],
    };
    (['ra_inferior', 'ra_superior', 'la_body'] as const).forEach((subId) => {
      const [w0, w1] = aflWindows[subId];
      subSegments[subId].propagationMode = 'reentrant';
      if (flutterPhase >= w0 && flutterPhase <= w1) {
        const fp = (flutterPhase - w0) / (w1 - w0);
        subSegments[subId].phase = 'front_active';
        subSegments[subId].frontProgress = fp;
        subSegments[subId].intensity = 0.65 + 0.3 * Math.sin(fp * Math.PI);
      } else {
        subSegments[subId].phase = 'repolarizing';
        subSegments[subId].frontProgress = 1;
        subSegments[subId].intensity = 0.35;
      }
      subSegments[subId].contraction = 0.12 * Math.sin(flutterPhase * Math.PI);
    });
  }

  if (ventricularWaveMode === 'vfib_chaos') {
    (['rv_wall', 'iv_septum', 'lv_anterior', 'lv_lateral', 'lv_inferior'] as MyocardialWallId[]).forEach((w, idx) => {
      walls[w].electricalState = 'depolarizing';
      walls[w].intensity = 0.4 + 0.4 * Math.sin(masterTimeSec * (19 + idx * 5) + idx * 1.7);
      walls[w].contraction = 0.04 * Math.abs(Math.sin(masterTimeSec * (23 + idx * 4) + idx));
    });

    ALL_VENTRICULAR_SUB_SEGMENT_IDS.forEach((subId, idx) => {
      const chaosWave = 0.5 + 0.5 * Math.sin(masterTimeSec * (21 + idx * 3.7) + idx * 1.3);
      subSegments[subId].propagationMode = 'chaotic';
      subSegments[subId].phase = chaosWave > 0.32 ? 'front_active' : 'repolarizing';
      subSegments[subId].frontProgress = (masterTimeSec * (4.2 + idx * 0.6) + idx * 0.21) % 1;
      subSegments[subId].intensity = 0.38 + 0.45 * chaosWave;
      subSegments[subId].contraction = 0.03 * chaosWave; // 有効な心室収縮はゼロ
    });

    // VFでは統一された電気ベクトルが存在しないため抑制
    vecDx = 0;
    vecDy = 0;
  }

  // 5. Master Timeline からリアルタイム解説とフェーズを単一導出
  const currentEvent = deriveRealtimeAnnotation(disease, masterTimeSec, beats);

  const phaseStyleMap: Record<CardiacPhaseType, { color: string; label: string }> = {
    P:        { color: '#eab308', label: 'P波 (心房脱分極)' },
    PR:       { color: '#f97316', label: 'PR区間 (房室伝導)' },
    QRS:      { color: '#0ea5e9', label: 'QRS波 (心室脱分極)' },
    ST:       { color: '#64748b', label: 'ST区間 (プラトー相)' },
    T:        { color: '#64748b', label: 'T波 (心室再分極)' },
    U:        { color: '#8b5cf6', label: 'U波 (遅延再分極)' },
    abnormal: { color: '#ef4444', label: '異常興奮・遮断イベント' },
    baseline: { color: '#94a3b8', label: '拡張期・静止期 (基線)' },
  };

  const mag = Math.hypot(vecDx, vecDy);
  const angleDeg =
    activeAxisAngleDeg !== undefined
      ? activeAxisAngleDeg
      : mag > 0.02
        ? (Math.atan2(vecDy, vecDx) * 180) / Math.PI
        : 60;

  // VF の無秩序興奮時や AF の非QRS細動波単独時には平均電気ベクトル矢印を非表示化
  const isVectorMeaningful =
    ventricularWaveMode !== 'vfib_chaos' && mag > 0.05;

  return {
    masterTimeSec,
    normalizedTime,
    scenarioProgress,
    currentEvent,
    phaseColor: phaseStyleMap[currentEvent.phase].color,
    phaseLabelJa: phaseStyleMap[currentEvent.phase].label,
    paths,
    walls,
    subSegments,
    activeVentricularSchedule,
    electricVector: {
      active: isVectorMeaningful,
      dx: vecDx,
      dy: vecDy,
      angleDeg,
      magnitude: clamp01(mag),
    },
    atrialWaveMode,
    ventricularWaveMode,
    ectopicFocus: profile.ectopicFocus,
    ectopicFiring,
    isDextrocardia: Boolean(profile.isDextrocardia),
    sourceRegion,
    saNodeFiring,
    atrialPropagation,
    ventricularPropagation,
    primaryActivationRegion,
    secondaryActivationRegion,
    propagationDirection,
    activeAxisAngleDeg,
  };
}
