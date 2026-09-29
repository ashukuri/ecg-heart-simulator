import { BeatScheduleItem, Disease } from '../../types';
import {
  build12LeadsFromSchedule,
  computeScenarioDurationSec,
} from '../../utils/ecgGenerator';

const THREE_BEAT_OFFSETS = [0.0, 0.8, 1.6];

function createConductionBeats(
  mode: 'rbbb' | 'lbbb' | 'lafb' | 'lpfb',
  qrsDur = 0.135
): BeatScheduleItem[] {
  return THREE_BEAT_OFFSETS.map((base) => ({
    atrialStartSec: base + 0.05,
    atrialDurationSec: 0.09,
    atrialMode: 'normal',
    avStartSec: base + 0.12,
    avDurationSec: 0.09,
    ventricularStartSec: base + 0.21,
    ventricularDurationSec: qrsDur,
    repolarizationStartSec: base + 0.21 + qrsDur + 0.05,
    repolarizationDurationSec: 0.17,
    ventricularMode: mode,
  }));
}

const lbbbBeats = createConductionBeats('lbbb', 0.145);
const rbbbBeats = createConductionBeats('rbbb', 0.135);
const lafbBeats = createConductionBeats('lafb', 0.095);
const lpfbBeats = createConductionBeats('lpfb', 0.095);

const conductionScenarioSec = computeScenarioDurationSec(lbbbBeats, {
  periodicCycleSec: 2.4, // 0.80s (75 bpm) × 3拍 = 2.40秒周期
});

export const conductionDiseases: Disease[] = [
  // 1. 完全左脚ブロック (CLBBB)
  {
    id: 'lbbb',
    nameJa: '完全左脚ブロック (CLBBB)',
    nameEn: 'Complete Left Bundle Branch Block (CLBBB)',
    category: 'conduction',
    categoryNameJa: '伝導障害',
    subtitle: '左脚完全遮断による右室先行・中隔逆行興奮と著明なWide QRS（≧0.14秒）',
    shortDescription: '左脚本幹の遮断により右脚から右室が先行興奮。心室中隔を右から左へ逆行し、厚い左室自由壁へ著しく遅延して伝わるため、幅広くノッチのある巨大R波を呈する。',
    heartOrigin: '洞房結節（SA node）',
    conductionSequence: '洞結節 → AV結節 → His束 → 【右脚正常伝導】右室先行脱分極 → 【左脚完全遮断】中隔を右から左へ逆行横断 → 左室自由壁へ著明に遅延興奮',
    mechanismDetail: '左脚本幹が完全に遮断されているため、His束からの刺激は右脚のみを下行します。①中隔脱分極が正常（左→右）と正反対の「右室側から左室側（右→左）」へ向かって進行するため、I, aVL, V5, V6で本来見られる初期微小q波が完全に消失します。②その後、刺激は中隔作業心筋をゆっくりと横断して左室心内膜へ達し、最後に分厚い左室自由壁を極めて遅れて脱分極させます。この結果、心室脱分極と左室収縮に長い時間を要し、QRS幅が著明に拡大（≧0.14秒：Wide QRS）します。③左側誘導（I, aVL, V5, V6）では頂点にノッチを持つ幅広の単峰性R波（M字型・notched R波）が記録され、右側〜中間誘導（V1〜V3）では幅広く深いQS/rS波と二次性ST上昇を示します。',
    ecgFeaturesDetail: '① 著明なQRS幅の延長（≧0.12秒、典型的には0.14秒以上のWide QRS）。② 第I、aVL、V5、V6誘導で幅広く頂点が二峰性（notched/slurred）の巨大R波（初期q波の消失）。③ V1、V2、V3誘導で幅の広い深いQS波またはrS波。④ 大きな二次性ST-T変化：V5/V6でST低下＋陰性T波、V1〜V3でST上昇＋陽性T波。',
    whyLeadChanges: '心室中隔から左室自由壁に至るすべての興奮ベクトルが、最初から最後まで一貫して「左側・左後方」に向かって進み続けます。そのため左側誘導（I, aVL, V5, V6）に向かって巨大な陽性ベクトルが持続してノッチを伴う幅広いR波となり、正反対の右前胸部（V1〜V3）からは終始遠ざかり続けるため幅広く深いQS/rS波となります。',
    teachingPoints: [
      '「Wide QRS（≧0.12秒）」＋「V5/V6/I/aVLで幅広く頂点ノッチのR波（q波消失）」＋「V1〜V3で深い広幅QS/rS波」がLBBBの決定打',
      '右室が先に収縮し、左室が遅れて収縮する「心室間非同期（dyssynchrony）」を生じる',
      '新規出現のLBBBは、急性心筋梗塞（STEMI相当）として緊急カテーテル検査を検討する最重要サイン'
    ],
    hrDisplay: 'HR 75 bpm',
    atrialHrBpm: 75,
    ventricularHrBpm: 75,
    scenarioDurationSec: conductionScenarioSec,
    conductionProfile: {
      blockedPaths: ['left_bundle_ant', 'left_bundle_post', 'left_bundle_sept'],
      delayedPaths: ['iv_septum', 'lv_anterior', 'lv_lateral', 'lv_inferior'],
      beats: lbbbBeats,
    },
    leads: build12LeadsFromSchedule(lbbbBeats, conductionScenarioSec),
    leadNotes: {
      I: '初期q波が消失し、幅広く二峰性ノッチを持つ陽性R波と二次性陰性T波を示す。',
      aVL: 'Iと同様にq波消失・幅広い二峰性R波と二次性ST-T低下を示す（aVL = I - II/2 で厳密整合）。',
      V1: '幅広く深い巨大なQS波と、二次性ST上昇・陽性T波。',
      V2: '深い広幅QS波と二次性ST上昇。',
      V3: '微小r波に続く深く幅広いS波（rS型）と二次性ST上昇。R波の増高が遅延する（poor R progression）。',
      V4: '左室遅延興奮への移行部。幅広い二相性波形。',
      V5: '【最重要所見】QRS幅が著明に拡大（>0.14秒）。初期q波が消失し、頂点に二峰性ノッチを持つ巨大R波とST低下・陰性T波。',
      V6: '典型的なLBBBパターン。幅広く二峰性のR波と二次性T波陰転。'
    }
  },

  // 2. 完全右脚ブロック (CRBBB)
  {
    id: 'rbbb',
    nameJa: '完全右脚ブロック (CRBBB)',
    nameEn: 'Complete Right Bundle Branch Block (CRBBB)',
    category: 'conduction',
    categoryNameJa: '伝導障害',
    subtitle: '右脚の伝導遮断により左室が先行興奮し、右室が遅れてゆっくり脱分極する',
    shortDescription: '左室興奮は正常・迅速に完了するが、右室へは心室中隔の筋間を介して遅れて刺激が伝わるため、V1〜V2で特徴的なM字型（rsR\'型）を示す。',
    heartOrigin: '洞房結節（SA node）',
    conductionSequence: '洞結節 → AV結節 → His束 → 【左脚正常伝導】左室・中隔先行興奮 → 【右脚遮断】中隔筋間を越えて右室自由壁へ遅延興奮',
    mechanismDetail: '右脚内の伝導が完全に遮断されているため、His束からの刺激は左脚のみを下行します。中隔の左室側から右室側への初期脱分極（V1のr波）と、左室自由壁の脱分極（V1のS波、V5のR波）は正常な速度で行われ、左室が先に収縮します。その後、左室から中隔作業心筋をゆっくりと横断して刺激が右室へ回り込み、遅れて右室自由壁を脱分極・収縮させます。この終末期の右前方への遅延ベクトルが、右側胸部誘導（V1, V2）に高い第二のR波（R\'波）を、左側誘導（I, aVL, V4〜V6）に幅広く遅いS波（slurred S波）を形成します。',
    ecgFeaturesDetail: '① QRS幅の延長（≧0.12秒：完全右脚ブロック）。② V1、V2（およびV3）誘導でM字型の「rsR\'パターン（兎の耳：rabbit ears）」。③ 第I、aVL、V4、V5、V6誘導で幅広く深い終末部S波（slurred S wave）。④ V1、V2で二次性T波陰転（ST低下・陰性T波）。',
    whyLeadChanges: 'V1・V2誘導は右室の直前にあります。左室興奮完了後、右室に向かって前方に電気刺激が近づいてくるため、V1・V2で高いR\'波が描かれます。逆に左側（I, aVL, V4〜V6）から見ると、最後の右室興奮は遠ざかっていくため幅の広い遅いS波として記録されます。',
    teachingPoints: [
      '「V1・V2でM字型（rsR\'）」「I・V5・V6で幅広く緩徐なS波」がRBBBの2大トレードマーク',
      '心臓模式図上で「左室が先に水色に脱分極・収縮し、その後中隔経由で右室が遅れて脱分極・収縮する」時間差に注目',
      '急性肺塞栓症（急性右室負荷）や心房中隔欠損症（ASD）との関連が重要'
    ],
    hrDisplay: 'HR 75 bpm',
    atrialHrBpm: 75,
    ventricularHrBpm: 75,
    scenarioDurationSec: conductionScenarioSec,
    conductionProfile: {
      blockedPaths: ['right_bundle'],
      delayedPaths: ['rv_wall'],
      beats: rbbbBeats,
    },
    leads: build12LeadsFromSchedule(rbbbBeats, conductionScenarioSec),
    leadNotes: {
      I: '正常な初期R波に続き、右室遅延興奮による幅広く鈍いS波（slurred S）を認める。',
      aVR: '終末期の右室前方・上方への遅延興奮ベクトルにより、後半に陽性R\'波が現れる。',
      V1: '【最重要所見】典型的なM字型（rsR\'パターン：兎耳徴候）。初期r波の後にs波、そして右室遅延脱分極による高いR\'波と陰性T波。',
      V2: 'V1と同様に明瞭なrsR\'パターンと二次性陰性T波を示す。',
      V3: 'rSR\'パターンから左側胸部への移行波形を示す。',
      V4: '高いR波の後に、右室側へ遠ざかる幅広い終末S波が続く。',
      V5: '左室先行興奮による鋭いR波と、幅広い終末S波（slurred S）。',
      V6: '鋭いR波の後に、右室遅延興奮を反映した幅広く緩徐なS波が確認できる。'
    }
  },

  // 3. 左脚前枝ブロック (LAFB)
  {
    id: 'lafb',
    nameJa: '左脚前枝ブロック (LAFB / LAHB)',
    nameEn: 'Left Anterior Fascicular Block (LAFB)',
    category: 'conduction',
    categoryNameJa: '伝導障害',
    subtitle: '左脚前枝の遮断により左室前側壁が遅れて興奮し、著明な左軸偏位を呈する',
    shortDescription: '左脚後枝から左室下後壁が先行脱分極した後、前枝領域の前側壁へ向かって下から上へ遅れて興奮が広がり、電気軸が左上方へ大きく偏る（-45°〜-90°）。',
    heartOrigin: '洞房結節（SA node）',
    conductionSequence: '洞結節 → AV結節 → His束 → 【左脚後枝・右脚】下後壁先行脱分極 → 【前枝遮断】下後壁から前側壁へ下から上へ遅延伝播',
    mechanismDetail: '左脚前枝がブロック（赤）されると、刺激は太い後枝を通って左室下後壁および心尖部を最初に脱分極（II, III, aVFで初期小r波、I, aVLで小q波）させます。その後、興奮は筋間を通って左室前壁および高位側壁へ向かって「下から上・左上」へ巻き上がるように遅延伝播（オレンジ）します。この強力な終末上向きベクトルが、著明な左軸偏位をもたらします。',
    ecgFeaturesDetail: '① 著明な左軸偏位（-45°〜-90°）。② 第I、aVL誘導でqRパターン（小q波と高いR波）。③ 第II、III、aVF誘導でrSパターン（小r波と深いS波、S in III > S in II）。④ QRS幅は正常または軽度延長（<0.12秒）。',
    whyLeadChanges: '最終的な興奮ベクトルが「左肩・上方」を指向するため、左肩電極である第I誘導とaVL誘導で高いR波となります。逆に足元電極であるII, III, aVFからは遠ざかるため、深いS波（rS波）となります。',
    teachingPoints: [
      '「明らかな左軸偏位（I・aVLが陽性qR、II・III・aVFが深い陰性rS）」を見たら真っ先にLAFBを考える',
      '心臓模式図で「左脚前枝（赤）が遮断され、後枝（黄）から前側壁へ遅れて広がる」経路を確認',
      '右脚ブロック（RBBB）と合併すると「2枝ブロック」となり、完全房室ブロックへの進行リスクが高まる'
    ],
    hrDisplay: 'HR 75 bpm',
    atrialHrBpm: 75,
    ventricularHrBpm: 75,
    scenarioDurationSec: conductionScenarioSec,
    conductionProfile: {
      blockedPaths: ['left_bundle_ant'],
      delayedPaths: ['lv_anterior', 'lv_lateral'],
      beats: lafbBeats,
    },
    leads: build12LeadsFromSchedule(lafbBeats, conductionScenarioSec),
    leadNotes: {
      I: '小q波に続く高いR波（qRパターン）。左肩に向かう強い電気ベクトルを反映。',
      aVL: '高いR波（qRパターン、+1.34mV）。左軸偏位の主導誘導。',
      II: '小r波に続く深いS波（rSパターン、-0.72mV）。第I誘導が陽性で第II誘導が陰性＝「左軸偏位」の決定的サイン。',
      III: '非常に深いS波（-1.70mV、S in III > S in II）。下壁から興奮が上へ遠ざかる様子を示す。',
      aVF: '明瞭なrSパターン（-1.21mV 陰性優位）。',
      V3: '移行帯付近のRS波形。',
      V5: '前側壁の遅延興奮に伴い終末S波がやや深くなる。'
    }
  },

  // 4. 左脚後枝ブロック (LPFB)
  {
    id: 'lpfb',
    nameJa: '左脚後枝ブロック (LPFB / LPHB)',
    nameEn: 'Left Posterior Fascicular Block (LPFB)',
    category: 'conduction',
    categoryNameJa: '伝導障害',
    subtitle: '左脚後枝の遮断により左室下後壁が遅れて興奮し、著明な右軸偏位を呈する',
    shortDescription: '左脚前枝から左室前側壁が先行脱分極した後、後枝領域の下後壁へ向かって上から下へ遅延興奮し、電気軸が右下方へ偏る（+90°〜+180°）。',
    heartOrigin: '洞房結節（SA node）',
    conductionSequence: '洞結節 → AV結節 → His束 → 【左脚前枝・右脚】前側壁先行脱分極 → 【後枝遮断】前側壁から下後壁へ上から下へ遅延伝播',
    mechanismDetail: '左脚後枝が遮断（赤）されると、刺激は前枝を通って左室前壁・高位側壁を先に脱分極（I, aVLで初期小r波、II, III, aVFで小q波）させます。その後、前壁から下後壁へ向かって「上から下・右下方」へ興奮が遅れて広がります。この終末下方ベクトルが著明な右軸偏位を形成します。',
    ecgFeaturesDetail: '① 著明な右軸偏位（+90°〜+180°）。② 第II、III、aVF誘導でqRパターン（小q波と高いR波、R in III > R in II）。③ 第I、aVL誘導でrSパターン（小r波と深いS波）。④ QRS幅は正常または軽度延長（<0.12秒）。',
    whyLeadChanges: '最終的な興奮ベクトルが「足元・右下」を指向するため、II, III, aVFで高いR波（qR）となり、左肩電極であるI, aVLからは遠ざかるため深いS波（rS）となります。LAFBと鏡像関係にあります。',
    teachingPoints: [
      '「著明な右軸偏位（I・aVLがrS陰性、II・III・aVFが高いqR陽性）」が特徴',
      '後枝は太く二重血流支配のため、LPFB単独出現は稀で広範な心筋病変を示唆する',
      '右室肥大や側壁梗塞による右軸偏位を除外して診断する'
    ],
    hrDisplay: 'HR 75 bpm',
    atrialHrBpm: 75,
    ventricularHrBpm: 75,
    scenarioDurationSec: conductionScenarioSec,
    conductionProfile: {
      blockedPaths: ['left_bundle_post'],
      delayedPaths: ['lv_inferior'],
      beats: lpfbBeats,
    },
    leads: build12LeadsFromSchedule(lpfbBeats, conductionScenarioSec),
    leadNotes: {
      I: '小r波に続く深いS波（rSパターン、-0.88mV）。右軸偏位の代表的サイン。',
      aVL: 'Iと同様に深いrSパターン（-1.32mV）を示す。',
      II: '小q波に続く高いR波（qRパターン、+0.88mV）。',
      III: '高いR波（+1.76mV、R in III > R in II）。下後壁へ向かう遅延興奮を強く捉える。',
      aVF: '高い陽性R波（+1.32mV）。電気軸が右下方へ偏位していることを示す。'
    }
  }
];
