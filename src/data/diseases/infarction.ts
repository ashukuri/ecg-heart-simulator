import { BeatScheduleItem, Disease } from '../../types';
import {
  build12LeadsFromSchedule,
  computeScenarioDurationSec,
  LeadMorphologyTemplate,
  PrimarySourceLeadId,
} from '../../utils/ecgGenerator';

const THREE_BEAT_OFFSETS = [0.0, 0.8, 1.6];

const miBeats: BeatScheduleItem[] = THREE_BEAT_OFFSETS.map((base) => ({
  atrialStartSec: base + 0.05,
  atrialDurationSec: 0.09,
  atrialMode: 'normal',
  avStartSec: base + 0.12,
  avDurationSec: 0.09,
  ventricularStartSec: base + 0.21,
  ventricularDurationSec: 0.09,
  repolarizationStartSec: base + 0.37,
  repolarizationDurationSec: 0.17,
  ventricularMode: 'normal',
}));

const miScenarioSec = computeScenarioDurationSec(miBeats, {
  periodicCycleSec: 2.4, // 0.80s (75 bpm) × 3拍 = 2.40秒周期
});

/**
 * 1. 急性前壁中隔心筋梗塞 (LAD閉塞):
 * V1〜V4でQS/異常Q波と著明な墓石様ST上昇 (+0.58〜+0.82mV)
 * 前額面ソース I (+0.12mV ST) と II (-0.24mV ST) から、III (-0.36mV ST) と aVF (-0.30mV ST) の対側性ST低下が厳密導出される。
 */
const ANTEROSEPTAL_MI_PRIMARY_TEMPLATE: Partial<Record<PrimarySourceLeadId, Partial<LeadMorphologyTemplate>>> = {
  I:  { qAmp: -0.10, rAmp: 0.85, stOffset: 0.12, tAmp: 0.18 },
  II: { stOffset: -0.24, tAmp: 0.15 },
  V1: { rAmp: 0.00, sAmp: -1.35, stOffset: 0.58, tAmp: 0.48 },
  V2: { rAmp: 0.00, sAmp: -1.55, stOffset: 0.78, tAmp: 0.62 },
  V3: { qAmp: -0.95, rAmp: 0.12, sAmp: -0.95, stOffset: 0.82, tAmp: 0.65 },
  V4: { qAmp: -0.75, rAmp: 0.42, sAmp: -0.35, stOffset: 0.64, tAmp: 0.52 },
  V5: { qAmp: -0.22, rAmp: 1.15, sAmp: -0.15, stOffset: 0.22, tAmp: 0.25 },
};

/**
 * 2. 急性側壁心筋梗塞 (LCX / 対角枝閉塞):
 * 前額面ソース I (+0.46mV ST, 異常Q波) と II (-0.14mV ST) から、
 * aVL (+0.53mV ST, 異常Q波) および対側誘導 III (-0.60mV ST) / aVF (-0.37mV ST) が厳密導出される。
 */
const LATERAL_MI_PRIMARY_TEMPLATE: Partial<Record<PrimarySourceLeadId, Partial<LeadMorphologyTemplate>>> = {
  I:  { qAmp: -0.42, rAmp: 0.72, sAmp: 0, stOffset: 0.46, tAmp: -0.20 },
  II: { stOffset: -0.14, tAmp: 0.18 },
  V1: { rAmp: 0.42, sAmp: -0.95, stOffset: -0.18 },
  V4: { qAmp: -0.22, rAmp: 1.05, stOffset: 0.24, tAmp: 0.12 },
  V5: { qAmp: -0.52, rAmp: 0.88, sAmp: 0, stOffset: 0.56, tAmp: -0.25 },
  V6: { qAmp: -0.48, rAmp: 0.78, sAmp: 0, stOffset: 0.50, tAmp: -0.22 },
};

/**
 * 3. 急性下壁心筋梗塞 (RCA閉塞):
 * 前額面ソース I (-0.34mV ST) と II (+0.56mV ST, 異常Q波) から、
 * III = II - I (+0.90mV ST > II)、aVF = II - I/2 (+0.73mV ST)、aVL = I - II/2 (-0.62mV 対側性ST低下) が厳密導出される。
 */
const INFERIOR_MI_PRIMARY_TEMPLATE: Partial<Record<PrimarySourceLeadId, Partial<LeadMorphologyTemplate>>> = {
  I:  { rAmp: 0.88, stOffset: -0.34, tAmp: 0.12 },
  II: { qAmp: -0.48, rAmp: 0.85, sAmp: 0, stOffset: 0.56, tAmp: -0.22 },
  V1: { stOffset: -0.20 },
  V2: { stOffset: -0.24 },
  V3: { stOffset: -0.15 },
};

export const infarctionDiseases: Disease[] = [
  // 1. 前壁中隔梗塞 (Anteroseptal MI)
  {
    id: 'mi_anteroseptal',
    nameJa: '急性前壁中隔心筋梗塞',
    nameEn: 'Acute Anteroseptal Myocardial Infarction',
    category: 'infarction',
    categoryNameJa: '心筋梗塞',
    subtitle: '左前下行枝（LAD）閉塞による心室中隔および左室前壁の虚血壊死（V1〜V4 ST上昇）',
    shortDescription: 'LAD閉塞により心室中隔と左室前壁が壊死・脱落。V1〜V4で著明なST上昇（墓石様）と初期r波消失（QS波/異常Q波）を生じ、壁運動が低下する。',
    heartOrigin: '洞房結節（SA node）',
    conductionSequence: '洞結節 → AV結節 → His束 → 【中隔・前壁壊死】中隔・前壁の起電力と壁収縮が消失、健全な後下壁・側壁へ電気が迂回',
    mechanismDetail: '左冠動脈前下行枝（LAD）の急性閉塞により、心室中隔から左室前壁にかけての心筋が貫壁性虚血・壊死に陥ります。①中隔初期脱分極の起電力が失われるため、直前のV1〜V3で初期小r波が消失して深い「QS波（異常Q波）」となります（電気的窓効果）。②虚血心筋と周囲の間に持続的な傷害電流が流れ、直視誘導であるV1〜V4で著明なドーム状・墓石様ST上昇が記録されます。③対側の下壁誘導（II, III, aVF）では鏡像的ST低下（reciprocal change）がみられます。心臓模式図では中隔と前壁が暗紫灰色となり収縮が低下します。',
    ecgFeaturesDetail: '① V1、V2、V3、V4誘導での著明なST上昇（墓石様：tombstone appearance）。② V1〜V3での初期r波消失（QSパターン）およびV4での異常Q波。③ 対側の下壁誘導（II, III, aVF）での鏡像的ST低下。',
    whyLeadChanges: 'V1〜V4誘導は心室中隔と左室前壁の直上に電極が位置しています。電極の真下で貫壁性虚血が生じるため、直視誘導として強烈なST上昇とQS/異常Q波を捉えます。真逆の下壁方向から見ているII, III, aVFでは鏡像としてST低下が記録されます。',
    teachingPoints: [
      '「胸部誘導V1〜V4の連続するST上昇」＝LAD（左前下行枝）閉塞による急性前壁中隔STEMI',
      'V1〜V4で初期r波が失われQS/QR波となる「電気的窓効果」と、下壁誘導（II, III, aVF）の対側性ST低下を同時に確認する',
      '心臓模式図上で心室中隔と左室前壁が暗紫灰色（梗塞）となり、他壁に比べて壁運動が著しく低下している点に注目'
    ],
    hrDisplay: 'HR 75 bpm',
    atrialHrBpm: 75,
    ventricularHrBpm: 75,
    scenarioDurationSec: miScenarioSec,
    conductionProfile: {
      infarctedRegions: ['iv_septum', 'lv_anterior'],
      blockedPaths: ['left_bundle_sept'],
      beats: miBeats,
    },
    leads: build12LeadsFromSchedule(miBeats, miScenarioSec, {
      customTemplate: ANTEROSEPTAL_MI_PRIMARY_TEMPLATE,
    }),
    leadNotes: {
      V1: '【直視誘導】初期r波が消失して深いQS波となり、著明な墓石様ST上昇が出現。',
      V2: '【最重要所見】巨大なドーム状ST上昇（+0.78mV）と深いQS波。前壁中隔梗塞の中心誘導。',
      V3: '【最重要所見】V2に並び最大級の墓石様ST上昇（+0.82mV）と深い異常Q波（QS/QR型）を呈する。',
      V4: '【直視誘導】前壁・心尖部に及ぶ著明なST上昇と異常Q波。V1〜V4の連続ST上昇で前壁中隔STEMIと確定。',
      II: '【対側性変化】前壁中隔のST上昇と表裏一体の関係で、下壁誘導に鏡像的ST低下がみられる。',
      III: '明確な対側性ST低下（reciprocal ST depression）。',
      aVF: 'II・IIIと同様に対側性ST低下を示す。'
    }
  },

  // 2. 側壁梗塞 (Lateral MI)
  {
    id: 'mi_lateral',
    nameJa: '急性側壁心筋梗塞',
    nameEn: 'Acute Lateral Myocardial Infarction',
    category: 'infarction',
    categoryNameJa: '心筋梗塞',
    subtitle: '左回旋枝（LCX）または対角枝閉塞による左室側壁の虚血壊死（I, aVL, V5, V6 ST上昇）',
    shortDescription: 'LCXまたはLAD対角枝の閉塞により左室高位側壁・側壁が壊死。第I、aVL、V5、V6でST上昇と異常Q波を認め、側壁の収縮が低下する。',
    heartOrigin: '洞房結節（SA node）',
    conductionSequence: '洞結節 → AV結節 → His束 → 【側壁壊死】中隔・前壁・下壁は正常脱分極するが、側壁起電力と壁収縮が脱落',
    mechanismDetail: '左回旋枝（LCX）または対角枝が閉塞すると、左室自由壁の側方が貫壁性梗塞を起こします。側壁心筋の起電力が失われるため、I, aVL, V5, V6で深い「異常Q波」と著明なST上昇が記録され、対側の下壁誘導（III, aVF）で鏡像的ST低下がみられます。',
    ecgFeaturesDetail: '① 第I、aVL、V5、V6誘導でのST上昇と異常Q波。② 第III、aVF誘導での対側性ST低下（reciprocal depression）。③ 冠性T波（陰性T波）。',
    whyLeadChanges: '第I誘導・aVL誘導は左肩から高位側壁を、V5・V6は左腋窩部から側壁を直視しています。病変直上のこれらの誘導でSTが上昇し、正反対の下壁（III, aVF）でSTが低下します。',
    teachingPoints: [
      '「I、aVL、V5、V6のST上昇と異常Q波」＝左室側壁（LCX / 対角枝領域）の虚血',
      '心臓模式図で左室側壁（右側外壁）が暗紫灰色の梗塞領域となり、収縮が弱まっていることを確認',
      '下壁誘導（III, aVF）の対側性ST低下を伴う'
    ],
    hrDisplay: 'HR 75 bpm',
    atrialHrBpm: 75,
    ventricularHrBpm: 75,
    scenarioDurationSec: miScenarioSec,
    conductionProfile: {
      infarctedRegions: ['lv_lateral'],
      beats: miBeats,
    },
    leads: build12LeadsFromSchedule(miBeats, miScenarioSec, {
      customTemplate: LATERAL_MI_PRIMARY_TEMPLATE,
    }),
    leadNotes: {
      I: '【直視誘導】深い異常Q波と明瞭なST上昇（+0.46mV）。高位側壁の急性虚血壊死を鋭敏に反映。',
      aVL: 'Iと同様に著明な異常Q波とST上昇（+0.53mV）。',
      V4: '前側壁境界として軽度のST上昇を示す。',
      V5: '【直視誘導】左室前側壁を観察。深い異常Q波と著明なST上昇。',
      V6: '【直視誘導】左室側壁を観察。異常Q波とST上昇。',
      III: '【対側性変化】側壁と正反対の下壁誘導で鏡像的ST低下（-0.60mV）が確認できる。'
    }
  },

  // 3. 下壁梗塞 (Inferior MI)
  {
    id: 'mi_inferior',
    nameJa: '急性下壁心筋梗塞',
    nameEn: 'Acute Inferior Myocardial Infarction',
    category: 'infarction',
    categoryNameJa: '心筋梗塞',
    subtitle: '右冠動脈（RCA）閉塞による心室下壁の虚血壊死（II, III, aVF ST上昇）',
    shortDescription: '右冠動脈閉塞により左室下壁が壊死。第II、III、aVFで顕著なST上昇と異常Q波を認め、第I、aVLで対側性ST低下を呈する。',
    heartOrigin: '洞房結節（SA node）',
    conductionSequence: '洞結節 → AV結節 → His束 → 【下壁壊死】中隔・前側壁は脱分極するが、下壁の起電力と壁収縮が脱落',
    mechanismDetail: '右冠動脈（RCA）の閉塞により横隔膜に接する左室下壁が壊死に陥ります。足元電極（II, III, aVF）で深い「異常Q波」と著明なST上昇が生じ、対側の高位側壁誘導（I, aVL）に鋭敏な鏡像的ST低下が出現します。',
    ecgFeaturesDetail: '① 第II、III、aVF誘導での顕著なST上昇（ST in III > ST in II）と異常Q波。② 第I、aVL誘導での明瞭な鏡像的ST低下。',
    whyLeadChanges: '第II、III、aVF誘導は足元から心臓の下壁を真下から直接見上げています。そのため下壁の虚血傷害電流を直撃で捉えて大きなST上昇となり、左肩から見下ろす第I誘導やaVL誘導では裏返しのST低下として記録されます。',
    teachingPoints: [
      '「II、III、aVFのST上昇」＋「I、aVLの対側性ST低下」が下壁梗塞の黄金パターン',
      '心臓模式図の下端（下壁領域）が暗紫灰色の梗塞領域となり収縮が低下していることを確認',
      '右冠動脈（RCA）閉塞ではST上昇が III > II となりやすく、房室結節虚血による徐脈・房室ブロック合併に注意'
    ],
    hrDisplay: 'HR 75 bpm',
    atrialHrBpm: 75,
    ventricularHrBpm: 75,
    scenarioDurationSec: miScenarioSec,
    conductionProfile: {
      infarctedRegions: ['lv_inferior'],
      beats: miBeats,
    },
    leads: build12LeadsFromSchedule(miBeats, miScenarioSec, {
      customTemplate: INFERIOR_MI_PRIMARY_TEMPLATE,
    }),
    leadNotes: {
      II: '【直視誘導】深い異常Q波と著明なST上昇（+0.56mV）。足元から下壁虚血を直視する。',
      III: '【最重要所見】ST上昇が最も顕著（+0.90mV、ST in III > ST in II であり右冠動脈RCA閉塞を示唆）。',
      aVF: '下壁直視誘導。大きなドーム状ST上昇（+0.73mV）と異常Q波。',
      I: '【対側性変化】明瞭な鏡像的ST低下（-0.34mV）。',
      aVL: '【対側性変化】下壁梗塞において最も鋭敏に対側性ST低下（-0.62mV）が出現するキー誘導。'
    }
  }
];
