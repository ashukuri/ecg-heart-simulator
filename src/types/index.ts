export type DiseaseCategory = 'normal' | 'arrhythmia' | 'conduction' | 'infarction' | 'electrolyte';

export type HeartRegionId =
  | 'sa_node'
  | 'internodal'
  | 'atria'
  | 'av_node'
  | 'his_bundle'
  | 'right_bundle'
  | 'left_bundle_ant'
  | 'left_bundle_post'
  | 'left_bundle_sept'
  | 'iv_septum'
  | 'lv_anterior'
  | 'lv_lateral'
  | 'lv_inferior'
  | 'rv_wall'
  | 'accessory_pathway';

export type ECGLeadId =
  | 'I'
  | 'II'
  | 'III'
  | 'aVR'
  | 'aVL'
  | 'aVF'
  | 'V1'
  | 'V2'
  | 'V3'
  | 'V4'
  | 'V5'
  | 'V6';

export interface ECGLeadInfo {
  id: ECGLeadId;
  name: string;
  category: 'limb' | 'augmented' | 'chest';
  viewAngleDeg?: number;
  horizontalAngleDeg?: number;
  viewDescription: string;
  targetRegion: string;
  defaultPos:
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'bottom-center'
    | 'left-mid'
    | 'right-mid'
    | 'center-bottom';
}

export interface ECGPoint {
  t: number; // 0.0 to 1.0 (ECG_WINDOW_SEC に対する正規化時間 t = sec / ECG_WINDOW_SEC)
  v: number; // mV単位（IEEE-754 倍精度、四肢誘導のEinthoven/Goldberger恒等式を厳密成立させる）
}

export type CardiacPhaseType = 'P' | 'PR' | 'QRS' | 'ST' | 'T' | 'U' | 'baseline' | 'abnormal';

/**
 * masterTimeSec と BeatScheduleItem からリアルタイム導出される現象解説データ
 */
export interface ActiveTimelineAnnotation {
  phase: CardiacPhaseType;
  beatIndex?: number;
  totalBeats?: number;
  titleJa: string;
  descriptionJa: string;
}

export type BeatSourceRegion =
  | 'sa_node'
  | 'av_junction'
  | 'atria_ectopic'
  | 'ventricle_ectopic';

export type AtrialPropagationDirection = 'antegrade' | 'retrograde' | 'ectopic' | 'none';
export type VentricularPropagationDirection =
  | 'antegrade'
  | 'ectopic'
  | 'torsades_rotor'
  | 'none';

/**
 * 1ループ内の個別心拍・興奮イベント（master timeline 駆動の Single Source of Truth）
 */
export interface BeatScheduleItem {
  /** 共通発火源イベントの開始時刻（秒）。junctional_rhythm等ではここから心房逆行と心室順行の双方向を派生させる */
  sourceStartSec?: number;
  /** 発火源の解剖学的領域（'sa_node' | 'av_junction' | 'atria_ectopic' | 'ventricle_ectopic'） */
  sourceRegion?: BeatSourceRegion;
  /** 洞房結節(SA node)がこの拍で発火するか（junctional_rhythm 等では false） */
  saNodeFiring?: boolean;
  /** 心房への伝播方向（'antegrade' | 'retrograde' | 'ectopic' | 'none'） */
  atrialPropagation?: AtrialPropagationDirection;
  /** 心室への伝播方向（'antegrade' | 'ectopic' | 'torsades_rotor' | 'none'） */
  ventricularPropagation?: VentricularPropagationDirection;

  atrialStartSec?: number;
  atrialDurationSec?: number;
  atrialMode?: 'normal' | 'retrograde' | 'ectopic' | 'none';
  avStartSec?: number;
  avDurationSec?: number;
  avBlocked?: boolean;
  avSlowed?: boolean;
  hisBlocked?: boolean;
  ventricularStartSec?: number;
  ventricularDurationSec?: number;
  repolarizationStartSec?: number;
  repolarizationDurationSec?: number;
  uWaveStartSec?: number;
  uWaveDurationSec?: number;
  ventricularMode?:
    | 'normal'
    | 'rbbb'
    | 'lbbb'
    | 'lafb'
    | 'lpfb'
    | 'wpw'
    | 'ectopic_rv'
    | 'ectopic_lv'
    | 'torsades';
  axisAngleDeg?: number;
  /** 心筋興奮強度（0..1、TdP等では振幅包絡線と連動） */
  activationStrength?: number;
  /** 壁収縮強度（0..1、TdP等では振幅包絡線と連動） */
  contractionStrength?: number;
  /** 電気軸(axisAngleDeg)等から導出された主脱分極領域 */
  primaryActivationRegion?: HeartRegionId;
  /** 電気軸(axisAngleDeg)等から導出された二次伝播領域 */
  secondaryActivationRegion?: HeartRegionId;
  /** 興奮伝播方向ラベル */
  propagationDirection?: string;
  /** この拍に固有のリアルタイム解説オーバーライド（任意） */
  beatLabelJa?: string;
}

export interface ConductionProfile {
  blockedPaths?: HeartRegionId[];
  delayedPaths?: HeartRegionId[];
  infarctedRegions?: HeartRegionId[];
  showAccessoryPathway?: boolean;
  isDextrocardia?: boolean;
  atrialContinuousMode?: 'none' | 'afib_wavelets' | 'aflutter_loop';
  ventricularContinuousMode?: 'none' | 'vfib_chaos';
  ectopicFocus?: 'atria_ectopic' | 'av_junction' | 'rv_outflow' | 'lv_apex_scar' | 'multi_ventricular';
  beats: BeatScheduleItem[];
}

export interface Disease {
  id: string;
  nameJa: string;
  nameEn: string;
  category: DiseaseCategory;
  categoryNameJa: string;
  subtitle: string;
  shortDescription: string;

  heartOrigin: string;
  conductionSequence: string;
  mechanismDetail: string;
  ecgFeaturesDetail: string;
  whyLeadChanges: string;
  teachingPoints: string[];
  clinicalRelevance?: string;

  // 生理学的HR表示
  hrDisplay: string;
  atrialHrBpm?: number;
  ventricularHrBpm?: number;

  // Master Timeline 制御（旧cycleDurationMs / regions / 正規化eventsは廃止し一本化）
  scenarioDurationSec: number; // BeatScheduleItemとloopPauseSecから独立決定される疾患シナリオ長(秒)
  loopPauseSec?: number;       // イベント型病態の終端休止時間(秒)
  conductionProfile: ConductionProfile;

  // 標準12誘導の500Hz波形データ
  leads: Record<ECGLeadId, ECGPoint[]>;
  leadNotes?: Partial<Record<ECGLeadId, string>>;
}
