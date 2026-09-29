import { BeatScheduleItem, Disease } from '../../types';
import {
  build12LeadsFromSchedule,
  computeScenarioDurationSec,
  LeadMorphologyTemplate,
  PrimarySourceLeadId,
} from '../../utils/ecgGenerator';

const THREE_BEAT_OFFSETS = [0.0, 0.8, 1.6];

const electrolyteScenarioSec = 2.4; // 0.80s (75 bpm) × 3拍 = 2.40秒周期

// 1. 高K血症用スケジュール: P波平低化・PR延長(0.21s)・QRS拡大(0.115s)・急速尖鋭T波
const hyperKBeats: BeatScheduleItem[] = THREE_BEAT_OFFSETS.map((base) => ({
  atrialStartSec: base + 0.05,
  atrialDurationSec: 0.09,
  atrialMode: 'normal',
  avStartSec: base + 0.12,
  avDurationSec: 0.14,
  avSlowed: true,
  ventricularStartSec: base + 0.26,
  ventricularDurationSec: 0.115,
  repolarizationStartSec: base + 0.40,
  repolarizationDurationSec: 0.11,
  ventricularMode: 'normal',
}));

const HYPERK_PRIMARY_TEMPLATE: Partial<Record<PrimarySourceLeadId, Partial<LeadMorphologyTemplate>>> = {
  I:  { tAmp: 0.65 },
  II: { tAmp: 1.15 },
  V1: { tAmp: 0.52 },
  V2: { tAmp: 1.28 },
  V3: { tAmp: 1.38 },
  V4: { tAmp: 1.32 },
  V5: { tAmp: 1.12 },
  V6: { tAmp: 0.85 },
};

// 2. 低K血症用スケジュール: 正常QRS・ST低下・T波平低化・巨大なU波
const hypoKBeats: BeatScheduleItem[] = THREE_BEAT_OFFSETS.map((base) => ({
  atrialStartSec: base + 0.05,
  atrialDurationSec: 0.09,
  atrialMode: 'normal',
  avStartSec: base + 0.12,
  avDurationSec: 0.09,
  ventricularStartSec: base + 0.21,
  ventricularDurationSec: 0.085,
  repolarizationStartSec: base + 0.35,
  repolarizationDurationSec: 0.12,
  uWaveStartSec: base + 0.49,
  uWaveDurationSec: 0.12,
  ventricularMode: 'normal',
}));

const HYPOK_PRIMARY_TEMPLATE: Partial<Record<PrimarySourceLeadId, Partial<LeadMorphologyTemplate>>> = {
  I:  { stOffset: -0.10, tAmp: 0.08 },
  II: { stOffset: -0.16, tAmp: 0.10 },
  V1: { stOffset: -0.06, tAmp: 0.05 },
  V2: { stOffset: -0.16, tAmp: 0.10 },
  V3: { stOffset: -0.18, tAmp: 0.11 },
  V4: { stOffset: -0.18, tAmp: 0.12 },
  V5: { stOffset: -0.15, tAmp: 0.10 },
  V6: { stOffset: -0.12, tAmp: 0.08 },
};

const HYPOK_PRIMARY_UWAVE_MAP: Partial<Record<PrimarySourceLeadId, number>> = {
  I: 0.16, II: 0.32,
  V1: 0.14, V2: 0.38, V3: 0.42, V4: 0.38, V5: 0.30, V6: 0.22,
};

// 3. 高Ca血症用スケジュール: STセグメント消失・QRS直後からT波が立ち上がる著明なQT短縮
const hyperCaBeats: BeatScheduleItem[] = THREE_BEAT_OFFSETS.map((base) => ({
  atrialStartSec: base + 0.05,
  atrialDurationSec: 0.09,
  atrialMode: 'normal',
  avStartSec: base + 0.12,
  avDurationSec: 0.09,
  ventricularStartSec: base + 0.21,
  ventricularDurationSec: 0.085,
  repolarizationStartSec: base + 0.27, // QRS終了直後にT波開始 (ST消失・QT短縮)
  repolarizationDurationSec: 0.12,
  ventricularMode: 'normal',
}));

// 4. 低Ca血症用スケジュール: プラトー相(STセグメント)の水平延長による著明なQT延長
const hypoCaBeats: BeatScheduleItem[] = THREE_BEAT_OFFSETS.map((base) => ({
  atrialStartSec: base + 0.05,
  atrialDurationSec: 0.09,
  atrialMode: 'normal',
  avStartSec: base + 0.12,
  avDurationSec: 0.09,
  ventricularStartSec: base + 0.21,
  ventricularDurationSec: 0.085,
  repolarizationStartSec: base + 0.50, // 長い平坦STの後に正常幅のT波が出現 (QT延長)
  repolarizationDurationSec: 0.15,
  ventricularMode: 'normal',
}));

export const electrolyteDiseases: Disease[] = [
  // 1. 高カリウム血症 (Hyperkalemia)
  {
    id: 'hyperkalemia',
    nameJa: '高カリウム血症',
    nameEn: 'Hyperkalemia',
    category: 'electrolyte',
    categoryNameJa: '電解質異常',
    subtitle: '再分極加速による対称性尖鋭T波（テント状T波）と伝導遅延（P波平低化・QRS拡大）',
    shortDescription: '血清K+上昇により再分極が急速化して幅狭く鋭い「テント状T波」を呈し、同時に心房・心室伝導が遅延してP波平低化・PR延長・QRS拡大を伴う。',
    heartOrigin: '洞房結節（重症時は洞機能抑制）',
    conductionSequence: '洞結節 → 心房筋（興奮性低下でP波平低化） → AV結節（遅延） → His-Purkinje・心室筋（伝導遅延でQRS拡大） → 心室再分極（急速一斉再分極で尖鋭T波）',
    mechanismDetail: '細胞外K+濃度が上昇すると、心筋静止膜電位が浅くなりNa+チャネルの不活化が進むため、脱分極立ち上がり速度が低下して伝導が遅延（P波平低化、PR延長、QRS幅拡大）します。一方で遅延整流K+チャネル（IKr）のコンダクタンスが増加するため第3相再分極が急速かつ一斉に完了し、底面が狭く鋭く切り立った「テント状T波（peaked T wave）」が全誘導（特にV2〜V4、II）で形成されます。各誘導本来のrS型（V1-V2）やqRs型（V4-V6）のQRS形態は維持されたまま拡大します。',
    ecgFeaturesDetail: '① 狭い基底部と高い頂点を持つ左右対称の「テント状T波（特にV2〜V4、IIで顕著）」。② P波の平低化とPR間隔の延長。③ 12誘導それぞれの本来のQRS極性を保ったままQRS幅が拡大。',
    whyLeadChanges: '心室全体の再分極が短時間で一斉に完了するため、胸部中間誘導（V2〜V4）および下壁誘導（II）でそびえ立つような尖鋭T波が記録されます。',
    teachingPoints: [
      '「鋭く尖った左右対称のテント状T波（V2〜V4で特に顕著）」は救急での最重要警告サイン',
      '12誘導の基本QRS形態（V1-V2のrS、V3の移行帯、V4-V6の高いR波）を保ったままQRS幅が拡大しT波が尖鋭化する',
      'グルコン酸カルシウム（心筋膜安定化）の緊急静注が第一選択'
    ],
    hrDisplay: 'HR 75 bpm',
    atrialHrBpm: 75,
    ventricularHrBpm: 75,
    scenarioDurationSec: computeScenarioDurationSec(hyperKBeats, { periodicCycleSec: electrolyteScenarioSec }),
    conductionProfile: {
      delayedPaths: ['av_node', 'his_bundle', 'iv_septum'],
      beats: hyperKBeats,
    },
    leads: build12LeadsFromSchedule(hyperKBeats, electrolyteScenarioSec, {
      customTemplate: HYPERK_PRIMARY_TEMPLATE,
      pAmpFactor: 0.42,
      qrsWidthFactor: 1.35,
      tWidthSec: 0.024,
    }),
    leadNotes: {
      II: '【典型的テント状T波】P波が低く平坦化し、QRS幅が拡大。T波は底が狭く鋭い左右対称のテント状T波となる。',
      V1: '本来のrS形態を維持しつつQRSが拡大し、T波が陽性に尖鋭化。',
      V2: '胸部誘導で最も鋭く高いテント状T波（+1.28mV）が観察される。',
      V3: '移行帯のRS波形に続き、そびえ立つテント状T波（+1.38mV）が出現。',
      V4: '高いR波に匹敵する鋭利なテント状T波を記録。'
    }
  },

  // 2. 低カリウム血症 (Hypokalemia)
  {
    id: 'hypokalemia',
    nameJa: '低カリウム血症',
    nameEn: 'Hypokalemia',
    category: 'electrolyte',
    categoryNameJa: '電解質異常',
    subtitle: '心室再分極遅延によるT波平低化・ST低下と巨大U波の出現（V2〜V4で顕著）',
    shortDescription: '血清K+低下により再分極第3相が遅延。正常な12誘導QRSに続き、ST低下・平低T波と明瞭な陽性U波が出現してQU延長を呈する。',
    heartOrigin: '洞房結節（SA node）',
    conductionSequence: '洞結節 → 心房筋 → AV結節 → His-Purkinje → 心室筋（正常脱分極の後、再分極第3相とPurkinje再分極が遅延しU波出現）',
    mechanismDetail: '細胞外K+濃度が低下するとIKr電流が抑制され、再分極第3相が遅延します。その結果、12誘導の正常なP波・QRS波に続いて軽度のST低下とT波の平低化が生じ、さらにT波の直後にPurkinje線維・M細胞の遅延再分極による大きな「U波（prominent U wave）」が出現します。U波は胸部誘導V2〜V4で最も明瞭に観察されます。',
    ecgFeaturesDetail: '① 12誘導の正常P/QRS形態は保持。② ST部分の軽度低下とT波の平低化。③ T波直後の顕著な陽性U波（特にV2、V3、V4、II誘導でU波 > T波）。④ 見かけ上のQT（QU）延長。',
    whyLeadChanges: 'U波は前壁〜中隔を直視する胸部中間誘導（V2〜V4）および第II誘導で最も高く記録されます。',
    teachingPoints: [
      '「ST低下」「平低T波」「巨大U波（特にV2〜V4）」の3徴を確認する',
      'T波とU波が二峰性に連なり、見かけ上のQT延長（QU延長）を呈する',
      '低カルシウム血症（ST部分の単純水平延長でU波なし）との波形鑑別が重要'
    ],
    hrDisplay: 'HR 75 bpm',
    atrialHrBpm: 75,
    ventricularHrBpm: 75,
    scenarioDurationSec: computeScenarioDurationSec(hypoKBeats, { periodicCycleSec: electrolyteScenarioSec }),
    conductionProfile: {
      beats: hypoKBeats,
    },
    leads: build12LeadsFromSchedule(hypoKBeats, electrolyteScenarioSec, {
      customTemplate: HYPOK_PRIMARY_TEMPLATE,
      uWaveAmp: HYPOK_PRIMARY_UWAVE_MAP,
      tWidthSec: 0.036,
    }),
    leadNotes: {
      II: 'ST低下と平低化したT波の直後に、T波より背の高い明瞭なU波が出現。',
      V2: '本来のrS波に続き、平低T波と極めて鮮明な陽性U波（+0.38mV）が観察される。',
      V3: '【最重要所見】胸部誘導V3で最大級のU波（+0.42mV）が出現し、T-U融合二峰性波形が明瞭。',
      V4: '高いR波の後、ST低下・平低T波に続いて大きなU波が確認できる。'
    }
  },

  // 3. 高カルシウム血症 (Hypercalcemia)
  {
    id: 'hypercalcemia',
    nameJa: '高カルシウム血症',
    nameEn: 'Hypercalcemia',
    category: 'electrolyte',
    categoryNameJa: '電解質異常',
    subtitle: '心筋活動電位プラトー相の短縮によるSTセグメント消失・著明なQT短縮',
    shortDescription: '細胞外Ca2+上昇によりプラトー相（第2相）が短縮しST部分が消失。12誘導の正常QRS終了直後から直ちにT波が立ち上がりQT間隔が著しく短縮する。',
    heartOrigin: '洞房結節（SA node）',
    conductionSequence: '洞結節 → 心房筋 → AV結節 → His-Purkinje → 心室筋（正常QRS脱分極の直後にプラトー相なしで早期再分極開始）',
    mechanismDetail: '細胞外Ca2+濃度が上昇すると、L型Ca2+チャネルの不活化が加速され、活動電位第2相（プラトー相）が著明に短縮します。そのため12誘導すべての本来のP波・QRS波形は保たれたまま、平坦なSTセグメントが消失し、QRS波の終末部（J点）から直ちにT波が立ち上がってQT間隔が著しく短縮します。',
    ecgFeaturesDetail: '① 12誘導の正常P/QRS形態は保持。② STセグメントの消失（QRS直後からT波が立ち上がる）。③ 著明なQT間隔の短縮（QT ≈ 0.26秒）。',
    whyLeadChanges: 'プラトー相短縮は全心室筋に一様に起きるため、V1〜V6・I〜aVFの全12誘導で各誘導のQRS形態を保ったままST部分の消失とQT短縮が観察されます。',
    teachingPoints: [
      '「正常なQRSの終わりから平坦なST部分を経ずにすぐT波が始まり、QTが非常に短い」のが高Ca血症の特徴',
      '正常比較モードをONにすると、正常波形に比べてT波が大幅に前倒しになっていることが一目で分かる',
      '悪性腫瘍や原発性副甲状腺機能亢進症で遭遇する'
    ],
    hrDisplay: 'HR 75 bpm',
    atrialHrBpm: 75,
    ventricularHrBpm: 75,
    scenarioDurationSec: computeScenarioDurationSec(hyperCaBeats, { periodicCycleSec: electrolyteScenarioSec }),
    conductionProfile: {
      beats: hyperCaBeats,
    },
    leads: build12LeadsFromSchedule(hyperCaBeats, electrolyteScenarioSec, {
      tWidthSec: 0.038,
      tAmpFactor: 1.05,
    }),
    leadNotes: {
      II: '【著明なQT短縮】QRS波の終末から平坦なST部分を経ずに直ちにT波が立ち上がり、QT間隔が著しく短縮している。',
      V3: '移行帯のRS波形直後からすぐT波が始まる。',
      V5: '高いR波の直後にT波が近接して出現（正常比較ONでT波の前倒しが明瞭）。'
    }
  },

  // 4. 低カルシウム血症 (Hypocalcemia)
  {
    id: 'hypocalcemia',
    nameJa: '低カルシウム血症',
    nameEn: 'Hypocalcemia',
    category: 'electrolyte',
    categoryNameJa: '電解質異常',
    subtitle: '心筋活動電位プラトー相の延長による著明なQT延長（平坦なST部分の水平延長）',
    shortDescription: '細胞外Ca2+低下によりプラトー相（第2相）が延長。12誘導のP/QRSおよびT波自体の形は保たれたまま、平坦なSTセグメントが長く引き伸ばされQT間隔が延長する。',
    heartOrigin: '洞房結節（SA node）',
    conductionSequence: '洞結節 → 心房筋 → AV結節 → His-Purkinje → 心室筋（正常QRS脱分極の後、プラトー相が著明に延長し遅れてT波再分極）',
    mechanismDetail: '細胞外Ca2+濃度が低下すると、L型Ca2+チャネルのCa2+依存性不活化が遅延し、活動電位第2相（プラトー相）が長く引き延ばされます。そのため12誘導それぞれのP波・QRS波・T波の形態は保たれたまま、STセグメントだけが等電位線上で水平に長く延長し、T波の出現タイミングが後ろへシフトして著明なQT延長（QT ≈ 0.52秒）を呈します。',
    ecgFeaturesDetail: '① 12誘導の正常P/QRS形態は保持。② STセグメントの平坦な水平延長。③ T波の幅や形状自体は正常（U波は伴わない）。④ 著明なQT間隔延長。',
    whyLeadChanges: '全心室筋のプラトー相が一様に延長するため、V1〜V6・I〜aVFの全12誘導で長い平坦STセグメントと遅れて出現する正常形状のT波が記録されます。',
    teachingPoints: [
      '「P/QRSやT波の形は綺麗なのに、平坦なSTセグメントだけが異常に長く伸びてQTが延長する」のが低Ca血症の決定的特徴',
      '正常比較モードをONにすると、P・QRSは完全一致し、T波だけが後ろへ大きくシフトしていることが一目で理解できる',
      '低カリウム血症（ST低下＋平低T波＋巨大U波）との鑑別が重要'
    ],
    hrDisplay: 'HR 75 bpm',
    atrialHrBpm: 75,
    ventricularHrBpm: 75,
    scenarioDurationSec: computeScenarioDurationSec(hypoCaBeats, { periodicCycleSec: electrolyteScenarioSec }),
    conductionProfile: {
      beats: hypoCaBeats,
    },
    leads: build12LeadsFromSchedule(hypoCaBeats, electrolyteScenarioSec, {
      tWidthSec: 0.046,
    }),
    leadNotes: {
      II: '【著明なQT延長】QRS波の後に平坦なST部分が長く引き伸ばされて続き、その後に正常形状のT波が遅れて出現している。',
      V4: '本来の高いR波の後、長い平坦ST部分を経てT波が出現。',
      V5: '正常比較をONにすると、ST部分だけが純粋に延長してT波が後ろへずれている様子が一目瞭然。'
    }
  }
];
