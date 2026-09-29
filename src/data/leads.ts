import { ECGLeadId, ECGLeadInfo } from '../types';

export const ALL_LEAD_IDS: ECGLeadId[] = [
  'I',
  'II',
  'III',
  'aVR',
  'aVL',
  'aVF',
  'V1',
  'V2',
  'V3',
  'V4',
  'V5',
  'V6'
];

export const LEFT_COLUMN_LEADS: ECGLeadId[] = ['aVR', 'V1', 'V2', 'V3'];
export const BOTTOM_ROW_LEADS: ECGLeadId[] = ['II', 'aVF', 'III'];
export const RIGHT_COLUMN_LEADS: ECGLeadId[] = ['aVL', 'I', 'V4', 'V5', 'V6'];

export const ECG_LEADS: Record<ECGLeadId, ECGLeadInfo> = {
  I: {
    id: 'I',
    name: '第I誘導',
    category: 'limb',
    viewAngleDeg: 0,
    viewDescription: '右手(-)から左手(+)への水平方向。心臓高位側壁を真横から観察。',
    targetRegion: '左室側壁・高位側壁',
    defaultPos: 'top-left'
  },
  II: {
    id: 'II',
    name: '第II誘導',
    category: 'limb',
    viewAngleDeg: 60,
    viewDescription: '右手(-)から左足(+)への斜め下方向。心臓の主電気軸（右房→心尖部）に最も平行で波形が明瞭。',
    targetRegion: '心尖部・下壁',
    defaultPos: 'bottom-center'
  },
  III: {
    id: 'III',
    name: '第III誘導',
    category: 'limb',
    viewAngleDeg: 120,
    viewDescription: '左手(-)から左足(+)への右下方向。下壁（右冠動脈領域）を斜め下から観察。',
    targetRegion: '左室下壁・右室下壁',
    defaultPos: 'bottom-right'
  },
  aVR: {
    id: 'aVR',
    name: 'aVR誘導',
    category: 'augmented',
    viewAngleDeg: -150,
    viewDescription: '中心から右肩方向。心室の興奮ベクトルからほぼ真後ろ・逆方向を見るため全波形が陰性になる。',
    targetRegion: '心腔内・右房・心底部見下ろし',
    defaultPos: 'top-right'
  },
  aVL: {
    id: 'aVL',
    name: 'aVL誘導',
    category: 'augmented',
    viewAngleDeg: -30,
    viewDescription: '中心から左肩方向。心臓高位側壁（回旋枝・対角枝領域）を斜め上から観察。',
    targetRegion: '左室高位側壁',
    defaultPos: 'top-left'
  },
  aVF: {
    id: 'aVF',
    name: 'aVF誘導',
    category: 'augmented',
    viewAngleDeg: 90,
    viewDescription: '中心から足元真下方向。心臓下壁（横隔膜面）を真下から直接見上げる。',
    targetRegion: '左室下壁（横隔膜面）',
    defaultPos: 'bottom-center'
  },
  V1: {
    id: 'V1',
    name: 'V1誘導',
    category: 'chest',
    horizontalAngleDeg: 115,
    viewDescription: '胸骨右縁第4肋間。右室自由壁と心室中隔を右斜め前方から観察。中隔脱分極で初期小r波、左室興奮で深いS波。',
    targetRegion: '右室・心室中隔右側',
    defaultPos: 'left-mid'
  },
  V2: {
    id: 'V2',
    name: 'V2誘導',
    category: 'chest',
    horizontalAngleDeg: 90,
    viewDescription: '胸骨左縁第4肋間。心室中隔の直前に位置し、中隔の電気現象（前壁中隔梗塞、脚ブロック）を鋭敏に反映。',
    targetRegion: '心室中隔・前壁',
    defaultPos: 'left-mid'
  },
  V3: {
    id: 'V3',
    name: 'V3誘導',
    category: 'chest',
    horizontalAngleDeg: 65,
    viewDescription: 'V2とV4の中間点。心室中隔から左室前壁への移行帯（R/S比がほぼ1:1になる領域）を直視。前壁中隔梗塞で強いST上昇。',
    targetRegion: '左室前壁・中隔移行帯',
    defaultPos: 'left-mid'
  },
  V4: {
    id: 'V4',
    name: 'V4誘導',
    category: 'chest',
    horizontalAngleDeg: 45,
    viewDescription: '左鎖骨中線第5肋間。心尖部および左室前壁を直視し、R波がS波より高くなる。広範前壁梗塞や心尖部虚血の評価に不可欠。',
    targetRegion: '心尖部・左室前壁',
    defaultPos: 'right-mid'
  },
  V5: {
    id: 'V5',
    name: 'V5誘導',
    category: 'chest',
    horizontalAngleDeg: 22,
    viewDescription: '左前腋窩線第5肋間。左室前側壁の心外膜側を観察。強い陽性R波が特徴。',
    targetRegion: '左室前側壁',
    defaultPos: 'right-mid'
  },
  V6: {
    id: 'V6',
    name: 'V6誘導',
    category: 'chest',
    horizontalAngleDeg: 0,
    viewDescription: '左中腋窩線第5肋間。左室側壁を真横から観察。第I誘導と並んで側壁虚血・肥大を捉える。',
    targetRegion: '左室側壁',
    defaultPos: 'right-mid'
  }
};
