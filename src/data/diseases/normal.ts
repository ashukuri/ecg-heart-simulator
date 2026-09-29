import { BeatScheduleItem, Disease } from '../../types';
import {
  build12LeadsFromSchedule,
  computeScenarioDurationSec,
  LeadMorphologyTemplate,
  PrimarySourceLeadId,
} from '../../utils/ecgGenerator';

const THREE_BEAT_OFFSETS = [0.0, 0.8, 1.6];

function createNormalBeats(atrialStartOffset = 0.05): BeatScheduleItem[] {
  return THREE_BEAT_OFFSETS.map((base) => ({
    atrialStartSec: base + atrialStartOffset,
    atrialDurationSec: 0.09,
    atrialMode: 'normal',
    avStartSec: base + atrialStartOffset + 0.07,
    avDurationSec: 0.09,
    ventricularStartSec: base + atrialStartOffset + 0.16,
    ventricularDurationSec: 0.085,
    repolarizationStartSec: base + atrialStartOffset + 0.32,
    repolarizationDurationSec: 0.16,
    ventricularMode: 'normal',
  }));
}

/**
 * 右胸心（内臓逆位）の一次ソーステンプレート (I, II, V1〜V6)
 * - I_dextro = -I_normal
 * - II_dextro = II_normal - I_normal (= III_normal)
 * ここから Einthoven / Goldberger 方程式により:
 * - III_dextro = II_dextro - I_dextro = II_normal
 * - aVR_dextro = -(I_dextro + II_dextro)/2 = aVL_normal (陽性化！)
 * - aVL_dextro = I_dextro - II_dextro/2 = aVR_normal (陰性化！)
 * - aVF_dextro = II_dextro - I_dextro/2 = aVF_normal
 * が数学的に完全一致で自動導出される。
 * - 胸部誘導 V1〜V6 は V1(RS型) → V6 に向かって段階的に減衰する Reverse R wave progression。
 */
const DEXTROCARDIA_PRIMARY_TEMPLATE: Partial<Record<PrimarySourceLeadId, Partial<LeadMorphologyTemplate>>> = {
  I: {
    pAmp: -0.14,
    qAmp: 0.05,
    rAmp: -0.95,
    sAmp: 0.14,
    tAmp: -0.28,
  },
  II: {
    pAmp: -0.08,
    qAmp: 0.02,
    rAmp: -0.25,
    sAmp: 0.08,
    tAmp: -0.10,
  },
  V1: { pAmp: 0.12, qAmp: -0.03, rAmp: 0.95, sAmp: -0.65, tAmp: 0.26 },
  V2: { pAmp: 0.09, qAmp: 0.00,  rAmp: 0.68, sAmp: -0.78, tAmp: 0.18 },
  V3: { pAmp: 0.06, qAmp: 0.00,  rAmp: 0.42, sAmp: -0.58, tAmp: 0.12 },
  V4: { pAmp: 0.04, qAmp: 0.00,  rAmp: 0.26, sAmp: -0.40, tAmp: 0.08 },
  V5: { pAmp: 0.03, qAmp: 0.00,  rAmp: 0.16, sAmp: -0.25, tAmp: 0.05 },
  V6: { pAmp: 0.02, qAmp: 0.00,  rAmp: 0.10, sAmp: -0.16, tAmp: 0.03 },
};

const normalBeats = createNormalBeats();
const normalScenarioDurationSec = computeScenarioDurationSec(normalBeats, {
  periodicCycleSec: 2.4, // 0.80s (75 bpm) × 3拍 = 2.40秒で自然ループ
});

export const normalDiseases: Disease[] = [
  {
    id: 'normal',
    nameJa: '正常洞調律',
    nameEn: 'Normal Sinus Rhythm',
    category: 'normal',
    categoryNameJa: '正常',
    subtitle: '洞結節発振から心室再分極までの生理的電気伝導',
    shortDescription: '規則正しい洞結節発振と房室伝導系を経て、P-QRS-T波が整然と形成される標準12誘導心電図。',
    heartOrigin: '洞房結節（SA node：上大静脈と右房境界部）',
    conductionSequence: '洞結節 → 結節間路・心房筋 → 房室結節（AV node遅延） → His束 → 左右脚 → Purkinje線維網 → 心室心内膜から心外膜へ',
    mechanismDetail: '洞結節で自動能により自発脱分極が生じ、電気刺激が心房筋に波状に伝わりP波を形成。房室結節で約0.08〜0.12秒遅延（心室充満の時間を確保、PR部分）。その後His-Purkinje高速伝導系を通じて中隔左室側から初期脱分極（小q/r波）、次いで厚い左室自由壁を主体とする心室全体が一気に脱分極（鋭いQRS波）。最後に心外膜側から心内膜側へ向かって再分極（T波）が完了します。',
    ecgFeaturesDetail: '① P波は第II誘導・aVFで明瞭な陽性、aVRで陰性。② PR間隔は0.16秒で一定。③ QRS幅は0.085秒（狭いQRS）。④ 胸部誘導ではV1からV4〜V5に向かってR波が漸増（R wave progression：V3が移行帯）。⑤ 四肢誘導はEinthoven・Goldbergerの法則（III=II-I, aVR=-(I+II)/2等）を厳密に満たす。',
    whyLeadChanges: '心臓全体の平均電気軸はおよそ+60°（右肩から左下・心尖部方向）を向いています。そのため、この向きとほぼ平行な第II誘導で最大の陽性P波・R波が記録されます。逆に背後から見下ろすaVRではすべての波が陰性になります。水平面ではV1・V2が初期中隔脱分極（小r）と左室後退ベクトル（深S）を捉え、V3の移行帯を経てV4・V5・V6が高い陽性R波を捉えます。',
    teachingPoints: [
      '「心臓の電気軸」と「各誘導の視線ベクトル」が平行なら陽性、逆向きなら陰性波になる基本を体感する',
      '房室結節での意図的な遅延（PR部分）が心房収縮による心室への血液流入時間を確保している',
      '胸部誘導V1→V2→V3→V4→V5→V6におけるR波のスムーズな増高（R wave progression）を確認する',
      'T波が陽性になるのは、興奮が「心内膜→心外膜」へ伝わり、回復（再分極）は「心外膜→心内膜」から進むため'
    ],
    hrDisplay: 'HR 75 bpm',
    atrialHrBpm: 75,
    ventricularHrBpm: 75,
    scenarioDurationSec: normalScenarioDurationSec,
    conductionProfile: {
      beats: normalBeats,
    },
    leads: build12LeadsFromSchedule(normalBeats, normalScenarioDurationSec),
    leadNotes: {
      I: '左側から見ているため陽性R波とT波。左室高位側壁の電気活動を反映。',
      II: '心臓の主伝導軸（+60°）と完全に一致するため、最も綺麗なP-QRS-T波が得られる。モニタ誘導の基本。',
      III: '下壁方向（+120°）。III = II - I の関係を厳密に満たす。',
      aVR: '心底・右肩から見下ろすため、正常ではP・QRS・T波すべてが完全に陰性になる。',
      aVL: '左肩から見る誘導。側壁虚血や左脚前枝ブロック（左軸偏位）で着目。',
      aVF: '足元から直下を見上げる。II・IIIと合わせて下壁梗塞のキー誘導。',
      V1: '右前胸部。中隔の初期興奮（左→右）を近づく波（小r）として捉え、その後の左室自由壁興奮を遠ざかる波（深S）として記録。',
      V2: '中隔の直前。rSパターンを示し、前壁中隔梗塞や脚ブロックの変化が鋭敏に現れる。',
      V3: 'V2とV4の中間。R波とS波の高さがほぼ等しくなる「移行帯（transition zone）」を呈する。',
      V4: '左鎖骨中線第5肋間（心尖部直上）。R波がS波を上回り、高い陽性R波を記録する。',
      V5: '左室前側壁。厚い左室自由壁の強い脱分極を直視するため最も高いR波が記録される。',
      V6: '左室側壁。V5と同様に高いR波と正立T波。'
    }
  },
  {
    id: 'dextrocardia',
    nameJa: '右胸心',
    nameEn: 'Dextrocardia (Situs Inversus)',
    category: 'normal',
    categoryNameJa: '正常',
    subtitle: '心臓解剖が左右反転し、電気ベクトルが鏡像となる病態',
    shortDescription: '伝導経路の機能自体は正常だが、解剖学的に心臓が右胸腔に位置し右前方を向くため、四肢誘導の反転と胸部誘導V1→V6でのR波減衰がみられる。',
    heartOrigin: '洞房結節（解剖学的には左側に位置する解剖学的右房）',
    conductionSequence: '洞結節 → 心房筋 → 房室結節 → His束 → 脚・Purkinje → 心尖部（右胸腔側）へ',
    mechanismDetail: '内臓逆位などを伴う右胸心では、心臓の解剖学的構造が左右対称に反転しています。刺激伝導系の細胞レベルの機能や順序は全く正常ですが、総合電気ベクトルが「左下方」ではなく「右下方」に向かって進行します。また左前胸部に装着された標準胸部誘導（V1〜V6）では、V1が最も心臓に近く、V2→V3→V4→V5→V6と左腋窩へ行くほど心臓から遠ざかるため、R波が段階的に小さくなる逆行性R波減衰（reverse R wave progression）を示します。',
    ecgFeaturesDetail: '① 第I誘導でP-QRS-Tすべてが完全逆転（全波が陰性）。② aVRとaVLが入れ替わり、aVRで陽性波形、aVLで陰性波形となる。③ 胸部誘導（V1〜V6）で通常みられるR波の漸増が逆転し、V1で最もR波が高く、V2→V3→V4→V5→V6に向かってR波および全体振幅が段階的に減衰・低電位化する。',
    whyLeadChanges: '第I誘導は「右手(-)から左手(+)」を見る電極配置です。心室興奮が本来と反対の「右側」に向かって進むため、第I誘導から完全に遠ざかり全波形が陰性になります。右肩電極（aVR）に向かってベクトルが近づくためaVRが陽性になります。胸部誘導は左前胸部に貼られているため、V1が最も大きく、左胸壁外側（V4〜V6）ほど心臓から離れて波形が減衰します。',
    teachingPoints: [
      '「電極の付け間違い（右手と左手の逆付け）」と最も鑑別を要する臨床的テーマ',
      '第I誘導が陰性でaVRが陽性であるとき、まず右胸心か四肢電極左右逆付けを疑う',
      '鑑別点：電極逆付けでは胸部誘導（V1〜V6）は正常なR波増高を示すが、右胸心ではV1→V6で段階的にR波が減衰する',
      '右胸心の確定診断や虚血評価には、右側胸部誘導（V3R〜V6R）を装着して再記録する'
    ],
    hrDisplay: 'HR 75 bpm',
    atrialHrBpm: 75,
    ventricularHrBpm: 75,
    scenarioDurationSec: normalScenarioDurationSec,
    conductionProfile: {
      isDextrocardia: true,
      beats: normalBeats,
    },
    leads: build12LeadsFromSchedule(normalBeats, normalScenarioDurationSec, {
      customTemplate: DEXTROCARDIA_PRIMARY_TEMPLATE,
    }),
    leadNotes: {
      I: '【特徴的変化】全波形（P-QRS-T）が完全逆転（陰性）。四肢電極逆付けとの鑑別出発点。',
      II: '本来の第III誘導の波形に相当。',
      III: '本来の第II誘導の波形に相当し、高いR波を示す。',
      aVR: '【特徴的変化】右肩・右胸腔方向へ興奮が進むため、通常陰性であるaVRが明確な陽性P波・R波・T波となる。',
      aVL: '通常陽性であるaVLが完全な陰性波形になる。',
      aVF: '下壁方向のため陽性を維持。',
      V1: '右胸骨縁にあり右胸腔の心臓に最も近いため、胸部誘導の中で最大のR波（RS型）を記録する。',
      V2: 'V1よりやや左側に移るため、V1よりR波が減衰し始める。',
      V3: '心臓からさらに左へ離れるため、通常の移行帯とは逆にR波が小さくrS型となる。',
      V4: '左鎖骨中線。右胸腔の心尖部から遠いため低電位のrS波形となる。',
      V5: '左前腋窩線。心臓から大きく離れるため著明な低電位となる。',
      V6: '左中腋窩線。R波の増高（R progression）が完全に失われ、極小の波形となる。'
    }
  }
];
