import { BeatScheduleItem, Disease } from '../../types';
import {
  build12LeadsFromSchedule,
  computeScenarioDurationSec,
  createJunctionalEscapeBeat,
  createTorsadesBeat,
  PrimarySourceLeadId,
} from '../../utils/ecgGenerator';

const THREE_BEAT_OFFSETS = [0.0, 0.8, 1.6];

// 1. 1度房室ブロック: PR間隔が 0.28秒 へ一定延長 (HR 75 bpm, R-R = 0.80s × 3拍 = 2.40s)
const avBlock1Beats: BeatScheduleItem[] = THREE_BEAT_OFFSETS.map((base) => ({
  atrialStartSec: base + 0.04,
  atrialDurationSec: 0.09,
  atrialMode: 'normal',
  avStartSec: base + 0.11,
  avDurationSec: 0.21, // 顕著な房室伝導遅延 (PR = 0.28s)
  avSlowed: true,
  ventricularStartSec: base + 0.32,
  ventricularDurationSec: 0.085,
  repolarizationStartSec: base + 0.48,
  repolarizationDurationSec: 0.16,
  ventricularMode: 'normal',
}));
const avBlock1ScenarioSec = computeScenarioDurationSec(avBlock1Beats, { periodicCycleSec: 2.4 });

// 2. Wenckebach型房室ブロック: P-P間隔 0.68s 一定 (Atrial 88 bpm)、PR 0.16s → 0.24s → 0.32s、第4拍QRS脱落 + loopPauseSec 0.42s
const wenckebachBeats: BeatScheduleItem[] = [
  {
    atrialStartSec: 0.06,
    atrialDurationSec: 0.09,
    atrialMode: 'normal',
    avStartSec: 0.13,
    avDurationSec: 0.09, // PR = 0.16s
    ventricularStartSec: 0.22,
    ventricularDurationSec: 0.085,
    repolarizationStartSec: 0.38,
    repolarizationDurationSec: 0.15,
    ventricularMode: 'normal',
  },
  {
    atrialStartSec: 0.74, // P-P = 0.68s 一定
    atrialDurationSec: 0.09,
    atrialMode: 'normal',
    avStartSec: 0.81,
    avDurationSec: 0.17, // PR = 0.24s
    avSlowed: true,
    ventricularStartSec: 0.98,
    ventricularDurationSec: 0.085,
    repolarizationStartSec: 1.14,
    repolarizationDurationSec: 0.15,
    ventricularMode: 'normal',
  },
  {
    atrialStartSec: 1.42, // P-P = 0.68s 一定
    atrialDurationSec: 0.09,
    atrialMode: 'normal',
    avStartSec: 1.49,
    avDurationSec: 0.25, // PR = 0.32s
    avSlowed: true,
    ventricularStartSec: 1.74,
    ventricularDurationSec: 0.085,
    repolarizationStartSec: 1.90,
    repolarizationDurationSec: 0.15,
    ventricularMode: 'normal',
  },
  {
    atrialStartSec: 2.10, // P-P = 0.68s 一定
    atrialDurationSec: 0.09,
    atrialMode: 'normal',
    avStartSec: 2.17,
    avDurationSec: 0.16,
    avBlocked: true, // 第4拍: 房室結節で完全遮断 → QRS脱落！
  },
];
const wenckebachPauseSec = 0.42;
const wenckebachScenarioSec = computeScenarioDurationSec(wenckebachBeats, {
  loopPauseSec: wenckebachPauseSec,
}); // 2.33 + 0.42 = 2.75s

// 3. Mobitz II型房室ブロック: P-P間隔 0.70s 一定 (Atrial 86 bpm)、PR 0.17s 一定、第3拍でHis束下突然QRS脱落 + loopPauseSec 0.40s
const mobitz2Beats: BeatScheduleItem[] = [
  {
    atrialStartSec: 0.06,
    atrialDurationSec: 0.09,
    atrialMode: 'normal',
    avStartSec: 0.13,
    avDurationSec: 0.10, // PR = 0.17s
    ventricularStartSec: 0.23,
    ventricularDurationSec: 0.09,
    repolarizationStartSec: 0.39,
    repolarizationDurationSec: 0.15,
    ventricularMode: 'normal',
  },
  {
    atrialStartSec: 0.76, // P-P = 0.70s 一定
    atrialDurationSec: 0.09,
    atrialMode: 'normal',
    avStartSec: 0.83,
    avDurationSec: 0.10, // PR = 0.17s (不変)
    ventricularStartSec: 0.93,
    ventricularDurationSec: 0.09,
    repolarizationStartSec: 1.09,
    repolarizationDurationSec: 0.15,
    ventricularMode: 'normal',
  },
  {
    atrialStartSec: 1.46, // P-P = 0.70s 一定
    atrialDurationSec: 0.09,
    atrialMode: 'normal',
    avStartSec: 1.53,
    avDurationSec: 0.09,
    hisBlocked: true, // 第3拍: His束下で突然遮断 → QRS脱落！
  },
  {
    atrialStartSec: 2.16, // P-P = 0.70s 一定
    atrialDurationSec: 0.09,
    atrialMode: 'normal',
    avStartSec: 2.23,
    avDurationSec: 0.10, // PR = 0.17s
    ventricularStartSec: 2.33,
    ventricularDurationSec: 0.09,
    repolarizationStartSec: 2.49,
    repolarizationDurationSec: 0.15,
    ventricularMode: 'normal',
  },
];
const mobitz2PauseSec = 0.40;
const mobitz2ScenarioSec = computeScenarioDurationSec(mobitz2Beats, {
  loopPauseSec: mobitz2PauseSec,
}); // 2.64 + 0.40 = 3.04s

// 4. 完全房室ブロック: 心房 75 bpm (P-P = 0.80s: 0.08, 0.88, 1.68, 2.48s)、心室接合部補充調律 45 bpm (R-R = 1.333s: 0.44, 1.773s)
const completeAvBlockBeats: BeatScheduleItem[] = [
  { atrialStartSec: 0.08, atrialDurationSec: 0.09, atrialMode: 'normal', avStartSec: 0.15, avDurationSec: 0.10, avBlocked: true },
  { atrialStartSec: 0.88, atrialDurationSec: 0.09, atrialMode: 'normal', avStartSec: 0.95, avDurationSec: 0.10, avBlocked: true },
  { atrialStartSec: 1.68, atrialDurationSec: 0.09, atrialMode: 'normal', avStartSec: 1.75, avDurationSec: 0.10, avBlocked: true },
  { atrialStartSec: 2.48, atrialDurationSec: 0.09, atrialMode: 'normal', avStartSec: 2.55, avDurationSec: 0.10, avBlocked: true },
  {
    atrialMode: 'none',
    ventricularStartSec: 0.44,
    ventricularDurationSec: 0.085,
    repolarizationStartSec: 0.60,
    repolarizationDurationSec: 0.17,
    ventricularMode: 'normal',
  },
  {
    atrialMode: 'none',
    ventricularStartSec: 1.773,
    ventricularDurationSec: 0.085,
    repolarizationStartSec: 1.933,
    repolarizationDurationSec: 0.17,
    ventricularMode: 'normal',
  },
];
const completeAvPauseSec = 0.35;
const completeAvScenarioSec = computeScenarioDurationSec(completeAvBlockBeats, {
  loopPauseSec: completeAvPauseSec,
}); // 2.65 + 0.35 = 3.00s

// 5. 心房細動 (AF): RR間隔が真に不規則 (0.18s, 0.72s, 1.58s, 2.18s → RR = 0.54s, 0.86s, 0.60s, 平均RR=0.667s = 90 bpm)
const afibBeats: BeatScheduleItem[] = [0.18, 0.72, 1.58, 2.18].map((qrsSec) => ({
  atrialMode: 'none',
  avStartSec: qrsSec - 0.06,
  avDurationSec: 0.06,
  ventricularStartSec: qrsSec,
  ventricularDurationSec: 0.08,
  repolarizationStartSec: qrsSec + 0.14,
  repolarizationDurationSec: 0.14,
  ventricularMode: 'normal',
}));
const afibPauseSec = 0.36;
const afibScenarioSec = computeScenarioDurationSec(afibBeats, {
  loopPauseSec: afibPauseSec,
}); // 2.46 + 0.36 = 2.82s

function evaluateAfibFwaves(lead: PrimarySourceLeadId, tSec: number): number {
  const ampMap: Record<PrimarySourceLeadId, { a1: number; a2: number; phase: number }> = {
    I:  { a1: 0.035, a2: 0.025, phase: 1.5 },
    II: { a1: 0.095, a2: 0.060, phase: 0.4 },
    V1: { a1: 0.115, a2: 0.075, phase: 0.0 },
    V2: { a1: 0.085, a2: 0.050, phase: 0.6 },
    V3: { a1: 0.060, a2: 0.040, phase: 1.1 },
    V4: { a1: 0.050, a2: 0.030, phase: 1.4 },
    V5: { a1: 0.040, a2: 0.025, phase: 1.8 },
    V6: { a1: 0.030, a2: 0.020, phase: 2.2 },
  };
  const cfg = ampMap[lead];
  return (
    cfg.a1 * Math.sin(tSec * 42 + cfg.phase) +
    cfg.a2 * Math.cos(tSec * 67 + cfg.phase * 1.7) +
    cfg.a2 * 0.6 * Math.sin(tSec * 93 - cfg.phase)
  );
}

// 6. 心室細動 (VF): 3次元スパイラル双極子を一次ソース (I, II, V1〜V6) へ投影し、III/aVR/aVL/aVF を厳密導出
const vfibScenarioSec = 2.6;
function evaluateVfibWave(lead: PrimarySourceLeadId, tSec: number): number {
  const leadMeta: Record<PrimarySourceLeadId, { angleRad: number; zWeight: number; scale: number; phase: number }> = {
    I:  { angleRad: 0,                   zWeight: 0.1, scale: 0.78, phase: 0.0 },
    II: { angleRad: (60 * Math.PI)/180,  zWeight: 0.3, scale: 0.98, phase: 0.4 },
    V1: { angleRad: (115 * Math.PI)/180, zWeight: 0.8, scale: 0.95, phase: 1.5 },
    V2: { angleRad: (90 * Math.PI)/180,  zWeight: 0.9, scale: 1.08, phase: 1.9 },
    V3: { angleRad: (65 * Math.PI)/180,  zWeight: 0.7, scale: 1.05, phase: 2.3 },
    V4: { angleRad: (45 * Math.PI)/180,  zWeight: 0.5, scale: 1.00, phase: 2.7 },
    V5: { angleRad: (22 * Math.PI)/180,  zWeight: 0.2, scale: 0.92, phase: 3.1 },
    V6: { angleRad: 0,                   zWeight: 0.0, scale: 0.82, phase: 3.5 },
  };
  const m = leadMeta[lead];
  const dx = 0.72 * Math.sin(tSec * 23 + 0.3) * Math.cos(tSec * 7) + 0.42 * Math.cos(tSec * 37 + 1.1);
  const dy = 0.76 * Math.cos(tSec * 27 + 0.8) * Math.sin(tSec * 9 + 0.4) + 0.38 * Math.sin(tSec * 43 - 0.7);
  const dz = 0.60 * Math.sin(tSec * 31 + m.phase) * Math.cos(tSec * 11 + 0.9);
  const proj = dx * Math.cos(m.angleRad) + dy * Math.sin(m.angleRad) + dz * m.zWeight;
  return proj * m.scale;
}

// 7. 心房粗動 (AFL 3:1伝導): F波 300 bpm (周期 0.20s × 15波 = 3.00s)、心室 100 bpm (RR = 0.60s × 5拍 = 3.00s)
const aflutterBeats: BeatScheduleItem[] = [0.28, 0.88, 1.48, 2.08, 2.68].map((qrsSec) => ({
  atrialMode: 'none',
  avStartSec: qrsSec - 0.08,
  avDurationSec: 0.08,
  ventricularStartSec: qrsSec,
  ventricularDurationSec: 0.08,
  repolarizationStartSec: qrsSec + 0.15,
  repolarizationDurationSec: 0.13,
  ventricularMode: 'normal',
}));
const aflutterScenarioSec = computeScenarioDurationSec(aflutterBeats, {
  periodicCycleSec: 3.0, // 0.60s (100 bpm) × 5拍 = 0.20s (300 bpm) × 15波 = 3.00秒で完全シームレスループ
});

function evaluateAflutterFwaves(lead: PrimarySourceLeadId, tSec: number): number {
  const phase = (tSec % 0.20) / 0.20;
  const saw = 1.0 - 2.0 * phase - 0.25 * Math.sin(phase * Math.PI * 2);
  if (lead === 'II') return -0.26 * saw; // IIが-0.26, Iが+0.03 → III=-0.29, aVF=-0.275 の鋸歯状F波が厳密導出される
  if (lead === 'I') return 0.03 * saw;
  if (lead === 'V1' || lead === 'V2') return 0.18 * Math.sin(phase * Math.PI * 2);
  return 0.06 * saw;
}

// 8. 心室頻拍 (VT): HR 150 bpm (RR = 0.40s × 7拍 = 2.80s シームレスループ)
const vtBeats: BeatScheduleItem[] = [0.08, 0.48, 0.88, 1.28, 1.68, 2.08, 2.48].map((qrsSec) => ({
  atrialMode: 'none',
  ventricularStartSec: qrsSec,
  ventricularDurationSec: 0.14,
  repolarizationStartSec: qrsSec + 0.15,
  repolarizationDurationSec: 0.12,
  ventricularMode: 'ectopic_lv',
  contractionStrength: 0.72,
}));
const vtScenarioSec = computeScenarioDurationSec(vtBeats, {
  periodicCycleSec: 2.8, // 0.40s (150 bpm) × 7拍 = 2.80秒周期
});

// 9. 心室期外収縮 (PVC): 第1拍 (0.08s) → 第2拍 PVC (0.72s) → 完全代償休止期 → 第3拍 (1.68s) + loopPauseSec 0.44s
const pvcBeats: BeatScheduleItem[] = [
  {
    atrialStartSec: 0.08,
    atrialDurationSec: 0.09,
    atrialMode: 'normal',
    avStartSec: 0.15,
    avDurationSec: 0.09,
    ventricularStartSec: 0.24,
    ventricularDurationSec: 0.085,
    repolarizationStartSec: 0.40,
    repolarizationDurationSec: 0.16,
    ventricularMode: 'normal',
  },
  {
    atrialMode: 'none',
    ventricularStartSec: 0.72,
    ventricularDurationSec: 0.145,
    repolarizationStartSec: 0.90,
    repolarizationDurationSec: 0.16,
    ventricularMode: 'ectopic_rv',
    contractionStrength: 0.85,
  },
  {
    atrialStartSec: 1.68,
    atrialDurationSec: 0.09,
    atrialMode: 'normal',
    avStartSec: 1.75,
    avDurationSec: 0.09,
    ventricularStartSec: 1.84,
    ventricularDurationSec: 0.085,
    repolarizationStartSec: 2.00,
    repolarizationDurationSec: 0.16,
    ventricularMode: 'normal',
  },
];
const pvcPauseSec = 0.44;
const pvcScenarioSec = computeScenarioDurationSec(pvcBeats, {
  loopPauseSec: pvcPauseSec,
}); // 2.16 + 0.44 = 2.60s

// 10. 心房期外収縮 (PAC): 第1拍 (0.08s) → 第2拍 PAC (0.62s) → 不完全代償休止期 → 第3拍 (1.52s) + loopPauseSec 0.42s
const pacBeats: BeatScheduleItem[] = [
  {
    atrialStartSec: 0.08,
    atrialDurationSec: 0.09,
    atrialMode: 'normal',
    avStartSec: 0.15,
    avDurationSec: 0.09,
    ventricularStartSec: 0.24,
    ventricularDurationSec: 0.085,
    repolarizationStartSec: 0.40,
    repolarizationDurationSec: 0.16,
    ventricularMode: 'normal',
  },
  {
    atrialStartSec: 0.62,
    atrialDurationSec: 0.09,
    atrialMode: 'ectopic',
    avStartSec: 0.69,
    avDurationSec: 0.10,
    ventricularStartSec: 0.79,
    ventricularDurationSec: 0.085,
    repolarizationStartSec: 0.95,
    repolarizationDurationSec: 0.16,
    ventricularMode: 'normal',
  },
  {
    atrialStartSec: 1.52,
    atrialDurationSec: 0.09,
    atrialMode: 'normal',
    avStartSec: 1.59,
    avDurationSec: 0.09,
    ventricularStartSec: 1.68,
    ventricularDurationSec: 0.085,
    repolarizationStartSec: 1.84,
    repolarizationDurationSec: 0.16,
    ventricularMode: 'normal',
  },
];
const pacPauseSec = 0.42;
const pacScenarioSec = computeScenarioDurationSec(pacBeats, {
  loopPauseSec: pacPauseSec,
}); // 2.00 + 0.42 = 2.42s

// 11. WPW症候群: HR 75 bpm (0.80s × 3拍 = 2.40s)
const wpwBeats: BeatScheduleItem[] = THREE_BEAT_OFFSETS.map((base) => ({
  atrialStartSec: base + 0.06,
  atrialDurationSec: 0.085,
  atrialMode: 'normal',
  avStartSec: base + 0.12,
  avDurationSec: 0.08,
  ventricularStartSec: base + 0.15,
  ventricularDurationSec: 0.13,
  repolarizationStartSec: base + 0.34,
  repolarizationDurationSec: 0.16,
  ventricularMode: 'wpw',
}));
const wpwScenarioSec = computeScenarioDurationSec(wpwBeats, { periodicCycleSec: 2.4 });

// 12. 房室接合部調律: 共通の AV junction source event (0.18s, 1.38s → R-R間隔 = 60/50 = 1.20秒 = 50.0 bpm) から
//     ① 逆行性心房伝播 (retrograde atrial propagation → 逆行性陰性P波)
//     ② 順行性His-Purkinje伝播 (antegrade His-Purkinje propagation → 正常Narrow QRS)
//     の2方向を派生させる（SA node発火 = false）
const junctionalBeats: BeatScheduleItem[] = [0.18, 1.38].map((sourceStartSec) =>
  createJunctionalEscapeBeat(sourceStartSec, {
    retrogradeAtrialDelaySec: 0.01,
    antegradeHisDelaySec: 0.06,
  })
);
const junctionalScenarioSec = computeScenarioDurationSec(junctionalBeats, {
  periodicCycleSec: 2.4, // 1.20s (50 bpm) × 2拍 = 2.40秒でシームレスループ
});

// 13. トルサード・ド・ポアント (TdP): 11拍 (11個の axisAngleDeg、拍間のR-R間隔は 11 - 1 = 10個 × 0.24s = 2.40s)
//     第1拍 0.08s 〜 第11拍 2.48s (QRS完了 2.61s、壁収縮完了 2.68s) + loopPauseSec 0.12s = 2.80s
export const TDP_AXIS_ANGLES_DEG = [-150, -105, -55, 0, 55, 110, 160, 130, 75, 15, -45];
export const TDP_AMPLITUDE_STRENGTHS = [
  0.52, 0.78, 0.98, 1.00, 0.80, 0.46, 0.74, 0.96, 1.00, 0.78, 0.54,
];
export const TDP_RR_INTERVAL_SEC = 0.24;
const tdpBeats: BeatScheduleItem[] = TDP_AXIS_ANGLES_DEG.map((angle, idx) =>
  createTorsadesBeat(
    Number((0.08 + idx * TDP_RR_INTERVAL_SEC).toFixed(3)),
    angle,
    TDP_AMPLITUDE_STRENGTHS[idx]
  )
);
const tdpPauseSec = 0.12;
const tdpScenarioSec = computeScenarioDurationSec(tdpBeats, {
  loopPauseSec: tdpPauseSec, // 10個のRR間隔(2.40s) + 初拍オフセット(0.08s) + 第11拍収縮完了(0.20s) + 休止(0.12s) = 2.80s
});

export const arrhythmiaDiseases: Disease[] = [
  // 1. 1度房室ブロック
  {
    id: 'av_block_1',
    nameJa: '1度房室ブロック',
    nameEn: 'First-degree AV Block',
    category: 'arrhythmia',
    categoryNameJa: '不整脈',
    subtitle: '房室結節の伝導時間が延長し、PR間隔が0.20秒以上に伸びる病態',
    shortDescription: '洞結節からの刺激はすべて心室へ伝わるが、房室結節での遅延が異常に長くなりPR間隔が一定して延長（0.28秒）する。',
    heartOrigin: '洞房結節（SA node）',
    conductionSequence: '洞結節 → 心房筋（正常） → 房室結節（顕著な伝導遅延：オレンジ） → His束 → 脚・Purkinje → 心室（正常）',
    mechanismDetail: '房室結節細胞の脱分極速度低下や不応期延長により、心房から心室への興奮伝導に通常（0.12〜0.20秒）以上の時間を要します。すべての刺激は最終的に心室へ到達するため、QRSの脱落は生じません。',
    ecgFeaturesDetail: '① PR間隔が0.20秒（大マス1個）を超えて一定して延長（約0.28秒）。② P波とQRS波は1:1で対応し、QRS波の脱落はない。③ QRS波自体の形と幅は正常（Narrow QRS）。',
    whyLeadChanges: '房室結節内での伝導遅延がPRセグメントの延長として全12誘導に共通して記録されます。',
    teachingPoints: [
      '1度房室ブロックではQRSの脱落（遮断）はなく、房室結節での「遅延（Delay）」である',
      'PR間隔 > 0.20秒（大マス1個以上）を確認する',
      '心臓模式図のAV nodeがオレンジ色（遅延伝導）で長く発光した後にHis-Purkinjeへ抜ける動きに注目'
    ],
    hrDisplay: 'HR 75 bpm',
    atrialHrBpm: 75,
    ventricularHrBpm: 75,
    scenarioDurationSec: avBlock1ScenarioSec,
    conductionProfile: {
      delayedPaths: ['av_node'],
      beats: avBlock1Beats,
    },
    leads: build12LeadsFromSchedule(avBlock1Beats, avBlock1ScenarioSec),
    leadNotes: {
      II: 'P波開始からQRS開始までのPR間隔が約0.28秒（大マス1.4個分）と著明に延長しているが、全拍でQRSが1:1に追随している。',
      V1: '二相性P波からQRSまでの間隔が一貫して延長。'
    }
  },

  // 2. Wenckebach型房室ブロック (Mobitz I)
  {
    id: 'wenckebach',
    nameJa: 'Wenckebach型房室ブロック (Mobitz I)',
    nameEn: 'Second-degree AV Block (Mobitz I / Wenckebach)',
    category: 'arrhythmia',
    categoryNameJa: '不整脈',
    subtitle: '一定のP-P間隔のもと、拍ごとにPR間隔が徐々に延長し4拍目でQRSが脱落する周期性ブロック',
    shortDescription: '洞性P波は規則正しい（P-P一定）が、房室結節の漸減伝導により拍ごとにPR間隔が延長（0.16s→0.24s→0.32s）し、4拍目のP波でQRSが完全に脱落する。',
    heartOrigin: '洞房結節（SA node：88 bpm で規則的発振）',
    conductionSequence: '洞結節（P-P一定） → 心房筋 → 房室結節（1拍目正常 → 2拍目遅延 → 3拍目高度遅延 → 4拍目で完全遮断・QRS脱落）',
    mechanismDetail: '房室結節の漸減伝導（decremental conduction）により、規則正しい洞性P波（P-P間隔 0.68秒一定）に対して房室結節通過時間が毎拍延長（PR: 0.16秒 → 0.24秒 → 0.32秒）します。ついに第4拍目のP波は房室結節の絶対不応期にぶつかって遮断（赤×印）され、His束以下へ伝導せずQRS波が1拍脱落します。休止期（0.42秒）の間に房室結節が回復し、次の周期が再開します。',
    ecgFeaturesDetail: '① P-P間隔は完全に一定（0.68秒）。② PR間隔が1拍ごとに徐々に延長（0.16s → 0.24s → 0.32s）。③ 第4拍目のP波の後にQRS波が完全に脱落（dropped QRS）。④ 脱落後の休止期を経て再び短いPRから再開。',
    whyLeadChanges: '全12誘導で規則正しいP波の列と、徐々に伸びるPR間隔、そして第4拍の孤立したP波（QRS脱落）が一斉に観察されます。',
    teachingPoints: [
      '「P-P間隔は一定」「PR間隔が徐々に伸びて、最後に1拍QRSが抜ける」のがWenckebach（Mobitz I型）の鉄則',
      '第1〜3拍ではQRSごとに心室が収縮し、第4拍では心房だけ収縮して心室収縮が起きない様子を心臓模式図で確認する',
      '障害部位は房室結節内（結節内ブロック）であり比較的予後良好'
    ],
    hrDisplay: 'Atrial 88 bpm / Ventricular 66 bpm (4:3)',
    atrialHrBpm: 88,
    ventricularHrBpm: 66,
    scenarioDurationSec: wenckebachScenarioSec,
    loopPauseSec: wenckebachPauseSec,
    conductionProfile: {
      beats: wenckebachBeats,
    },
    leads: build12LeadsFromSchedule(wenckebachBeats, wenckebachScenarioSec),
    leadNotes: {
      II: 'P波は0.68秒間隔で完全に規則的。1〜3拍目でPR間隔が0.16s→0.24s→0.32sと伸び、4拍目のP波の後にQRS波が脱落している。',
      V1: 'P波の規則性と4拍目のQRS脱落が明瞭。'
    }
  },

  // 3. Mobitz II型房室ブロック
  {
    id: 'mobitz_2',
    nameJa: 'Mobitz II型房室ブロック',
    nameEn: 'Second-degree AV Block (Mobitz II)',
    category: 'arrhythmia',
    categoryNameJa: '不整脈',
    subtitle: 'P-P間隔・PR間隔ともに一定のまま、予兆なく突然His束下でQRSが脱落する危険なブロック',
    shortDescription: '規則正しいP波と一定のPR間隔（0.17秒）が続く中、第3拍目で事前のPR延長なしにHis束下で突然伝導が遮断されQRSが脱落する。',
    heartOrigin: '洞房結節（SA node：86 bpm で規則的発振）',
    conductionSequence: '洞結節（P-P一定） → 心房筋 → 房室結節（PR一定で通過） → 第3拍でHis束・脚レベルにて突然完全遮断（赤×）',
    mechanismDetail: '病変部位は房室結節より遠位のHis束または脚（His束下ブロック）にあります。His-Purkinje系は全か無かの法則で伝導するため、事前のPR延長を示さず突然刺激が遮断されます。第1拍・第2拍・第4拍のPR間隔は全て0.17秒で完全に同一であり、第3拍だけQRSが突然抜け落ちます。',
    ecgFeaturesDetail: '① P-P間隔は完全に一定（0.70秒）。② 伝導される拍（第1・2・4拍）のPR間隔は完全に一定（0.17秒）。③ 第3拍で事前のPR延長なく突然QRS波が脱落。',
    whyLeadChanges: '全12誘導でPR間隔が不変のまま突然孤立したP波（non-conducted P wave）が出現します。',
    teachingPoints: [
      'Wenckebach型との決定的な違いは「脱落前後のPR間隔が完全に一定（0.17秒）であること」',
      '障害部位がHis束以下（infra-Hisian）にあるため完全房室ブロックやAdams-Stokes発作へ進行しやすく、ペースメーカー適応となる'
    ],
    hrDisplay: 'Atrial 86 bpm / Ventricular 64 bpm',
    atrialHrBpm: 86,
    ventricularHrBpm: 64,
    scenarioDurationSec: mobitz2ScenarioSec,
    loopPauseSec: mobitz2PauseSec,
    conductionProfile: {
      beats: mobitz2Beats,
    },
    leads: build12LeadsFromSchedule(mobitz2Beats, mobitz2ScenarioSec),
    leadNotes: {
      II: '第1拍・第2拍・第4拍のPR間隔がすべて0.17秒で完全一致しているにもかかわらず、第3拍のP波直後だけQRS波が突然消失している。'
    }
  },

  // 4. 完全房室ブロック
  {
    id: 'complete_av_block',
    nameJa: '完全房室ブロック (第3度房室ブロック)',
    nameEn: 'Third-degree (Complete) AV Block',
    category: 'arrhythmia',
    categoryNameJa: '不整脈',
    subtitle: '心房（75 bpm）と心室補充調律（45 bpm）が完全に独立して動く房室解離',
    shortDescription: '房室結節で完全遮断され、心房は洞結節（75 bpm・周期0.80s）、心室は房室接合部補充調律（45 bpm・周期1.333s・Narrow QRS）で互いに無関係に拍動する。',
    heartOrigin: '心房：洞房結節（75 bpm） / 心室：房室接合部補充ペースメーカー（45 bpm）',
    conductionSequence: '心房：洞結節 → 心房筋（AV結節で完全遮断） ／ 心室：His束近傍接合部 → 左右脚・Purkinjeを順行（Narrow QRS）',
    mechanismDetail: '房室結節内で刺激が完全遮断されているため、心房は洞結節の75回/分（0.80秒間隔）で規則正しく収縮し続けます。一方、心停止を防ぐため遮断部位直下の房室接合部が45回/分（1.333秒間隔）の固有レートで独立発振し、His-Purkinje系を通って狭いQRS波と心室収縮を作ります。P波とQRS波の周期が完全に独立してすれ違う「房室解離（AV dissociation）」が観察されます。',
    ecgFeaturesDetail: '① P波は75 bpm（P-P間隔 0.80秒）で規則的。② QRS波は45 bpm（R-R間隔 1.333秒）の徐脈で規則的（接合部補充調律のためNarrow QRS）。③ P波とQRS波に一切の関連がなく、PR間隔が毎拍変化する（房室解離）。',
    whyLeadChanges: '接合部補充調律は正常なHis-Purkinje系を下行するため、全12誘導でQRS波形自体は正常洞調律と同じ形態を示し、その間を等間隔のP波が通り抜けていきます。',
    teachingPoints: [
      '「P-P間隔が一定（75 bpm）」「R-R間隔も一定（45 bpm）」「しかしPとQRSは無関係（房室解離）」が完全房室ブロックの3大条件',
      '心臓模式図で心房の収縮（4回）と心室の収縮（2回）が別々のリズムで独立して動いていることを確認する'
    ],
    hrDisplay: 'Atrial 75 bpm / Ventricular 45 bpm',
    atrialHrBpm: 75,
    ventricularHrBpm: 45,
    scenarioDurationSec: completeAvScenarioSec,
    loopPauseSec: completeAvPauseSec,
    conductionProfile: {
      blockedPaths: ['av_node'],
      ectopicFocus: 'av_junction',
      beats: completeAvBlockBeats,
    },
    leads: build12LeadsFromSchedule(completeAvBlockBeats, completeAvScenarioSec),
    leadNotes: {
      II: '0.80秒間隔（75 bpm）の規則的なP波列と、1.333秒間隔（45 bpm）の規則的なNarrow QRS列が完全に独立して進行している。'
    }
  },

  // 5. 心房細動 (AF)
  {
    id: 'afib',
    nameJa: '心房細動 (AF)',
    nameEn: 'Atrial Fibrillation (AF)',
    category: 'arrhythmia',
    categoryNameJa: '不整脈',
    subtitle: '心房内の無秩序な細動波（f波）と、真に不規則なRR間隔（絶対性不整脈）',
    shortDescription: '規則的なP波が消失して誘導ごとに振幅の異なる細動波（f波）が連続し、房室結節をランダムに通過した4拍のNarrow QRSが不規則なRR間隔で出現する。',
    heartOrigin: '肺静脈開口部および両心房内の多重マイクロリエントリー（350〜600回/分）',
    conductionSequence: '心房内多重旋回波（f波：有効な心房収縮なし） → 房室結節の不規則通過 → His-Purkinje（正常） → 不規則な心室収縮',
    mechanismDetail: '心房内で無数の微小旋回波が持続するため、統一されたP波と心房収縮が消失し、基線が揺れる細動波（f波：特にV1、II、III、aVFで明瞭）となります。房室結節が不規則に刺激を間引くため、QRS波のRR間隔は「0.54s → 0.86s → 0.60s」と拍ごとに全く異なる絶対性不整脈（irregularly irregular）を示します。',
    ecgFeaturesDetail: '① P波の完全消失。② 誘導ごとに大きさと位相が異なるf波（V1・下壁誘導で明瞭、左側胸部では小振幅）。③ RR間隔が完全に不規則（0.54s, 0.86s, 0.60s）。④ QRS幅は正常（Narrow QRS）。',
    whyLeadChanges: '右房・左房に最も近いV1や下壁誘導でf波が大きく記録され、V5・V6・Iではf波が小さく記録されます。心室伝導自体は正常なため全12誘導のQRS極性は保たれます。',
    teachingPoints: [
      '「P波消失」「誘導差のある基線f波」「RR間隔の完全不整（絶対性不整脈）」の3徴を確認する',
      '1ループ内の4つのQRS波すべてに対応して、心室が不規則なタイミングで4回収縮する様子を確認する'
    ],
    hrDisplay: 'HR 90 bpm (Irregular)',
    ventricularHrBpm: 90,
    scenarioDurationSec: afibScenarioSec,
    loopPauseSec: afibPauseSec,
    conductionProfile: {
      blockedPaths: ['sa_node'],
      atrialContinuousMode: 'afib_wavelets',
      beats: afibBeats,
    },
    leads: build12LeadsFromSchedule(afibBeats, afibScenarioSec, {
      continuousWaveFunc: evaluateAfibFwaves,
    }),
    leadNotes: {
      V1: '【最重要所見】心房に近いため細動波（f波）の揺れが最も明瞭に観察され、RR間隔が拍ごとに不規則に変動している。',
      II: 'P波が消失して基線が小刻みに揺れ、QRSが 0.54s / 0.86s / 0.60s の不規則な間隔で出現。',
      V6: 'V1に比べてf波の揺れは小さく、不規則な間隔のR波が際立つ。'
    }
  },

  // 6. 心室細動 (VF)
  {
    id: 'vfib',
    nameJa: '心室細動 (VF)',
    nameEn: 'Ventricular Fibrillation (VF)',
    category: 'arrhythmia',
    categoryNameJa: '不整脈',
    subtitle: '心室筋が無秩序に痙攣し、全12誘導で極性・位相の異なるカオス的細動波を呈する心停止',
    shortDescription: '有効な心室収縮が完全に消失し、3次元的に乱舞するスパイラルウェーブにより12誘導それぞれで異なる無秩序な揺らぎ波形となる。即座の除細動（AED）が不可欠。',
    heartOrigin: '心室筋全体の多発スパイラルウェーブ（渦巻型リエントリー）',
    conductionSequence: '刺激伝導系は完全機能停止 → 心室各壁が非同期・無秩序に微小痙攣（心拍出量ゼロ）',
    mechanismDetail: '心室内で複数の渦巻波（スパイラルウェーブ）が分裂・衝突を繰り返すため、統一されたQRS波や有効な心室収縮は一切発生しません。3次元的な異常電流ベクトルが各誘導の視線方向へ投影されるため、12誘導それぞれで位相や振幅包絡線が異なる不規則な粗大細動波（coarse VF）が記録されます。',
    ecgFeaturesDetail: '① P波・QRS波・T波の完全消失。② 基線が不規則な周期と振幅でうねる粗大細動波。③ 各誘導の観察方向に応じて波形の山・谷の位相が異なる（四肢誘導はEinthoven/Goldbergerの関係を厳密保持）。',
    whyLeadChanges: '多方向に旋回する心室双極子を12個の異なる角度から観察するため、同一波形にはならず誘導ごとに固有の乱調波形が記録されます。',
    teachingPoints: [
      '心臓模式図で「まとまった収縮が一切なく、心室壁がバラバラに細かく震えるだけ（心拍出量ゼロ）」の状態を確認する',
      '認識した瞬間に胸骨圧迫（CPR）と電気的除細動（AED）を行う絶対的緊急病態'
    ],
    hrDisplay: 'HR 測定不能 (VF 心停止)',
    scenarioDurationSec: vfibScenarioSec,
    conductionProfile: {
      blockedPaths: ['sa_node', 'av_node', 'his_bundle', 'right_bundle', 'left_bundle_ant', 'left_bundle_post'],
      ventricularContinuousMode: 'vfib_chaos',
      beats: [],
    },
    leads: build12LeadsFromSchedule([], vfibScenarioSec, {
      continuousWaveFunc: evaluateVfibWave,
    }),
    leadNotes: {
      II: '【緊急事態】P-QRS-Tが完全に崩壊した不規則な粗大細動波。',
      V2: '前胸壁直下の渦巻興奮を強く捉え、振幅の大きく変動するカオス波形を示す。',
      aVR: '下壁誘導や左側胸部誘導とは逆向きの位相成分を持つ細動波が記録される。'
    }
  },

  // 7. 心房粗動 (Atrial Flutter - 3:1伝導)
  {
    id: 'aflutter',
    nameJa: '心房粗動 (AFL / 3:1伝導)',
    nameEn: 'Atrial Flutter (AFL with 3:1 Conduction)',
    category: 'arrhythmia',
    categoryNameJa: '不整脈',
    subtitle: '右房マクロリエントリー（300 bpm 鋸歯状F波）と3:1房室伝導（心室 100 bpm）',
    shortDescription: '右房内三尖弁輪周囲を300回/分（周期0.20秒＝大マス1個）で旋回する鋸歯状F波3個につき、1回の割合でQRSが出現（心室拍数100 bpm、周期0.60秒）。',
    heartOrigin: '右房内三尖弁輪周囲のマクロリエントリー回路（反時計方向旋回：300 bpm）',
    conductionSequence: '右房旋回回路（0.20s周期 F波） → 房室結節が3回に1回通過（3:1伝導） → His-Purkinje → 0.60s間隔（100 bpm）で心室収縮',
    mechanismDetail: '右房内の三尖弁輪周囲を反時計回りに毎分300回（1周期 0.20秒＝心電図の大マスちょうど1個分）で電気刺激が旋回します。房室結節がF波3個につき1個を心室へ通す（3:1伝導）ため、QRS波は0.60秒間隔（大マス3個分＝100 bpm）で規則正しく出現します。3.00秒のシナリオ周期にはF波15個と、それに完全同期した5拍のQRS波が描かれます。',
    ecgFeaturesDetail: '① 0.20秒周期（300 bpm＝大マス1個に1波）の規則的な鋸歯状波（F波）。② 下壁誘導（II, III, aVF）で明瞭な陰性ノコギリ波、V1で陽性F波。③ F波3個ごとに1個のNarrow QRSが出現する正確な3:1伝導（心室拍数 100 bpm）。',
    whyLeadChanges: '反時計回り旋回では右房中隔を下から上へ興奮が昇るため、下壁誘導（II, III, aVF）で連続する陰性の鋸歯状波となります。',
    teachingPoints: [
      '「心電図の大マス1個（0.20秒）に1つのF波＝300 bpm」「大マス3個（0.60秒）に1つのQRS＝100 bpm（3:1伝導）」の正確な数値対応を確認する',
      '1ループ内の5つのQRSすべてに対応して心室が規則正しく収縮する'
    ],
    hrDisplay: 'Atrial 300 bpm / Ventricular 100 bpm (3:1)',
    atrialHrBpm: 300,
    ventricularHrBpm: 100,
    scenarioDurationSec: aflutterScenarioSec,
    conductionProfile: {
      blockedPaths: ['sa_node'],
      atrialContinuousMode: 'aflutter_loop',
      beats: aflutterBeats,
    },
    leads: build12LeadsFromSchedule(aflutterBeats, aflutterScenarioSec, {
      continuousWaveFunc: evaluateAflutterFwaves,
    }),
    leadNotes: {
      II: '【3:1伝導の典型】大マス1個（0.20s）ごとの陰性鋸歯状F波（300 bpm）が3つ連なるごとに、大マス3個（0.60s）間隔でNarrow QRS（100 bpm）が出現。',
      III: 'IIと同様に鮮やかな陰性のこぎり波（sawtooth F waves）が連続。',
      aVF: '明瞭な陰性F波と3:1伝導。',
      V1: '下壁誘導とは逆に、上向きの陽性F波が0.20秒間隔で規則正しく刻まれる。'
    }
  },

  // 8. 心室頻拍 (VT)
  {
    id: 'vt',
    nameJa: '心室頻拍 (VT)',
    nameEn: 'Ventricular Tachycardia (VT)',
    category: 'arrhythmia',
    categoryNameJa: '不整脈',
    subtitle: '心室異所性起源から0.40秒間隔（150 bpm）で連続する単形性Wide QRS頻拍',
    shortDescription: '左室瘢痕部リエントリーから毎分150回（周期0.40秒）で幅広い変形QRS波が連続発火し、各QRSに対応して心室が高速収縮を繰り返す。',
    heartOrigin: '左室心尖部〜側壁の心筋瘢痕周囲リエントリー回路',
    conductionSequence: '左室異所性フォーカス発火 → His-Purkinjeを通らず心室筋を直接伝播（Wide QRS） → 毎拍心室が高速収縮',
    mechanismDetail: '心室内のリエントリー回路から0.40秒周期（150 bpm）で連続的に異常興奮が発生します。高速伝導系（His-Purkinje）を経由せず心室作業心筋を直接広がるため、QRS幅が0.14秒と著しく拡大した単形性Wide QRS頻拍（2.80秒周期で7連発）となり、7拍すべてで心室が連続収縮します。',
    ecgFeaturesDetail: '① 心拍数 150 bpm（周期 0.40秒＝大マス2個間隔）の規則的頻拍。② 全12誘導で幅0.14秒のWide QRSと逆向き二次性T波が連続。③ 左室心尖部側起源のため上方軸（II, III, aVFで陰性、aVRとV1-V3で陽性）を呈する。',
    whyLeadChanges: '左室心尖部側から心底部へ向けて下から上へ興奮が広がるため、足元誘導（II, III, aVF）や左側胸部（V4-V6）で深い陰性Wide QRSとなり、V1-V3およびaVRで高い陽性Wide QRSとなります。',
    teachingPoints: [
      '「Wide QRS規則的頻拍（150 bpm）」を見たら最優先でVTとして対応する',
      '7個のWide QRSすべてに同期して、心室異所性発火と心室収縮が7回連続で起きることを確認する'
    ],
    hrDisplay: 'HR 150 bpm',
    ventricularHrBpm: 150,
    scenarioDurationSec: vtScenarioSec,
    conductionProfile: {
      blockedPaths: ['sa_node', 'av_node', 'his_bundle'],
      ectopicFocus: 'lv_apex_scar',
      beats: vtBeats,
    },
    leads: build12LeadsFromSchedule(vtBeats, vtScenarioSec),
    leadNotes: {
      II: '大マス2個（0.40秒＝150 bpm）間隔で、幅広く切れ込みのある陰性Wide QRSと陽性二次性T波が連続している。',
      V1: '右前胸部へ向かう興奮ベクトルにより、高い陽性のWide QRSが連続（RBBB様パターン）。',
      V5: '心尖部から遠ざかるベクトルにより深い陰性Wide QRSが連続。'
    }
  },

  // 9. 心室期外収縮 (PVC)
  {
    id: 'pvc',
    nameJa: '心室期外収縮 (PVC)',
    nameEn: 'Premature Ventricular Contraction (PVC)',
    category: 'arrhythmia',
    categoryNameJa: '不整脈',
    subtitle: '正常拍 → 先行P波のない早期Wide QRS（PVC） → 完全代償休止期 → 正常拍再開',
    shortDescription: '第1拍の正常洞調律に続き、予定より早く右室流出路から先行P波なしに幅広い変形QRS（PVC）が突発。完全代償休止期を経て第3拍の正常拍が再開する。',
    heartOrigin: '第1・3拍：洞房結節 ／ 第2拍（PVC）：右室流出路（RVOT）異所性自動能',
    conductionSequence: '第1拍：正常洞調律 → 第2拍：心室異所性起点から心筋内を直接伝播（Wide QRS・早期収縮） → 完全代償休止期 → 第3拍：正常洞調律再開',
    mechanismDetail: '第1拍（0.08s〜）は正常に伝導・収縮します。次の洞性拍（予定0.88s）が来る前の0.72秒に、右室流出路の異所性フォーカスが発火し、先行P波なしに幅広い変形QRS波（PVC）と逆向き二次性T波を作ります。心室が不応期に入るため予定の0.88秒の洞刺激は伝導されず、ちょうど2周期分（1.60秒後＝1.68秒）の「完全代償休止期」を経て第3拍の正常洞調律が再開し、0.44秒の休止区間をおいてループします。',
    ecgFeaturesDetail: '① 第1拍：正常P-QRS-T。② 第2拍（0.72s）：先行P波がなく、予定より早期に出現する幅広い変形QRS（>0.14s）と逆向きT波。③ 完全代償休止期を経て1.68sから第3拍の正常P-QRS-Tが再開。',
    whyLeadChanges: '右室流出路（RVOT）起源のPVCは上から下（心尖部方向）へ広がるため、下壁誘導（II, III, aVF）で高い陽性Wide QRS、V1-V2で深い陰性（LBBB様）Wide QRSとなります。',
    teachingPoints: [
      '1つの表示窓の中で「正常拍 → 早期Wide QRS（PVC） → 完全代償休止期 → 正常拍の再開」の一連の流れを確認する',
      '心臓模式図で第2拍だけSA nodeではなく心室（RVOT）からオレンジ色の異常発火が起き、心室が早期収縮する様子に注目'
    ],
    hrDisplay: 'HR 75 bpm (PVC単発)',
    atrialHrBpm: 75,
    ventricularHrBpm: 75,
    scenarioDurationSec: pvcScenarioSec,
    loopPauseSec: pvcPauseSec,
    conductionProfile: {
      ectopicFocus: 'rv_outflow',
      beats: pvcBeats,
    },
    leads: build12LeadsFromSchedule(pvcBeats, pvcScenarioSec),
    leadNotes: {
      II: '第1拍（正常）→ 第2拍（先行P波なし・早期の巨大陽性Wide QRS＋陰性T波）→ 長い代償休止期 → 第3拍（正常再開）が明瞭。',
      V1: 'RVOT起源PVCの特徴として、第2拍が深い陰性（LBBB様）Wide QRSを呈する。'
    }
  },

  // 10. 心房期外収縮 (PAC)
  {
    id: 'pac',
    nameJa: '心房期外収縮 (PAC / APC)',
    nameEn: 'Premature Atrial Contraction (PAC)',
    category: 'arrhythmia',
    categoryNameJa: '不整脈',
    subtitle: '正常拍 → 早期異所性P\'波＋Narrow QRS（PAC） → 不完全代償休止期 → 正常拍再開',
    shortDescription: '第1拍の正常拍に続き、予定より早く心房異所性フォーカスから変形P\'波が出現し、正常His-Purkinjeを通ってNarrow QRSを形成。不完全代償休止期を経て第3拍が再開する。',
    heartOrigin: '第1・3拍：洞房結節 ／ 第2拍（PAC）：心房内異所性フォーカス',
    conductionSequence: '第1拍：正常洞調律 → 第2拍：心房異所性発火（変形P\'波） → AV結節・His-Purkinje正常通過（Narrow QRS） → 不完全代償休止期 → 第3拍：正常洞調律',
    mechanismDetail: '第1拍（0.08s〜）の正常拍の後、予定（0.88s）より早い0.62秒に心房内の異所性フォーカスが発火して形の異なるP\'波を作ります。刺激は通常通り房室結節・His-Purkinje系を下行するため、後続するQRS波は正常と同じ狭い波形（Narrow QRS）となります。洞結節が早期刺激でリセットされるため、不完全代償休止期を経て1.52秒から第3拍の正常拍が再開し、0.42秒の休止区間をおいてループします。',
    ecgFeaturesDetail: '① 第1拍：正常P-QRS-T。② 第2拍（0.62s）：早期に出現する低振幅・変形の異所性P\'波（V1で陰性）と、それに続く正常幅の狭いQRS波。③ 不完全代償休止期を経て1.52sから第3拍の正常拍が再開。',
    whyLeadChanges: '異所性P\'波は発生部位が異なるため洞性P波と形・極性が変わりますが、心室へは正常伝導路を下行するため全12誘導のQRS波形は正常拍と同一です。',
    teachingPoints: [
      '「早期に出現する変形P\'波」＋「正常と同じNarrow QRS」＋「不完全代償休止期」の3点でPVCと明確に鑑別する',
      '3拍すべてのQRSで正常な心室収縮が発生することを確認する'
    ],
    hrDisplay: 'HR 75 bpm (PAC単発)',
    atrialHrBpm: 75,
    ventricularHrBpm: 75,
    scenarioDurationSec: pacScenarioSec,
    loopPauseSec: pacPauseSec,
    conductionProfile: {
      ectopicFocus: 'atria_ectopic',
      beats: pacBeats,
    },
    leads: build12LeadsFromSchedule(pacBeats, pacScenarioSec),
    leadNotes: {
      II: '第1拍のT波直後（0.62s）に予定より早く小さな変形P\'波が出現し、その後に正常と同じ狭いQRS波が続いている。',
      V1: '第2拍の早期異所性P\'波が陰性波として明瞭に識別できる。'
    }
  },

  // 11. WPW症候群
  {
    id: 'wpw',
    nameJa: 'WPW症候群 (Wolff-Parkinson-White)',
    nameEn: 'Wolff-Parkinson-White (WPW) Syndrome',
    category: 'arrhythmia',
    categoryNameJa: '不整脈',
    subtitle: '副伝導路（Kent束）による心室早期興奮・PR短縮・誘導別デルタ波',
    shortDescription: '房室結節の遅延を経由しないKent束を通って刺激が左室へ先回りし、短いPR間隔（0.09秒）とQRS立ち上がりの緩徐なデルタ波（スロープ）を形成する。',
    heartOrigin: '洞房結節（SA node）',
    conductionSequence: '洞結節 → 心房筋 → ①Kent束（遅延なしで左室側壁へ先回り：デルタ波） ＋ ②AV結節・His-Purkinje（遅れて合流し融合QRS）',
    mechanismDetail: '心房と左室の間に副伝導路（Kent束）が存在するため、心房の興奮が房室結節の遅延をバイパスして直ちに左室側壁を早期興奮（デルタ波）させます。直後にAV結節〜His-Purkinjeを通過した正常刺激が合流して残りの心室を脱分極させます（融合拍）。左室後側壁Kent束（A型WPW）のため、V1〜V6・I・IIで陽性デルタ波、aVRで陰性デルタ波となり、12誘導ごとに固有のデルタ波＋QRS形態を示します。',
    ecgFeaturesDetail: '① PR間隔の短縮（0.09秒 < 0.12秒）。② QRS立ち上がりの緩徐なスロープ「デルタ波（delta wave）」。③ QRS幅の拡大（0.13秒）。④ 12誘導ごとに異なるデルタ波の大きさと二次性ST-T変化。',
    whyLeadChanges: '左室後側壁のKent束から前下方・左側へ向けて早期興奮が始まるため、胸部誘導V1〜V6およびI・IIで陽性デルタ波、aVRで陰性デルタ波が記録されます。',
    teachingPoints: [
      '心臓模式図の左房-左室間に追加表示される「Kent束（副伝導路）」が先に光り、続いて正常His-Purkinjeが合流する二経路伝導を確認する',
      '「PR短縮」「デルタ波」「Wide QRS」の3徴を全12誘導で確認する'
    ],
    hrDisplay: 'HR 75 bpm',
    atrialHrBpm: 75,
    ventricularHrBpm: 75,
    scenarioDurationSec: wpwScenarioSec,
    conductionProfile: {
      showAccessoryPathway: true,
      beats: wpwBeats,
    },
    leads: build12LeadsFromSchedule(wpwBeats, wpwScenarioSec),
    leadNotes: {
      I: '短いPRの直後から陽性デルタ波のスロープで立ち上がり、高いR波と軽度陰性T波へ続く。',
      II: 'P波の終わりから隙間なく斜めに立ち上がる陽性デルタ波が極めて明瞭。',
      aVR: '早期興奮ベクトルが遠ざかるため、陰性のデルタ波と深いS/QS波を示す。',
      V1: 'A型WPW（左室側Kent束）の特徴として、陽性デルタ波と高いR波・二次性陰性T波を示す。',
      V3: '明瞭な陽性デルタ波と高いR波。',
      V5: '最も高い陽性デルタ波＋R波の融合波形が確認できる。'
    }
  },

  // 12. 房室接合部調律
  {
    id: 'junctional_rhythm',
    nameJa: '房室接合部調律',
    nameEn: 'Junctional (Escape) Rhythm',
    category: 'arrhythmia',
    categoryNameJa: '不整脈',
    subtitle: '洞結節不全時に房室接合部が50 bpm（R-R 1.20秒）で代行し、逆行性陰性P波とNarrow QRSを呈する補充調律',
    shortDescription: '洞結節が停止し、房室接合部が50 bpm（周期1.20秒）でペースメーカーを代行。心房へは下から上へ逆行伝導して陰性P波（II, III, aVF）となり、心室へは正常伝導してNarrow QRSとなる。',
    heartOrigin: '房室接合部（AV junction：His束近傍、50 bpm = R-R 1.20s）',
    conductionSequence: '房室接合部発火 → 【上向き】心房へ逆行性伝導（II/III/aVFで陰性P波） ＋ 【下向き】His-Purkinje順行伝導（正常Narrow QRS）',
    mechanismDetail: '洞結節の発振が停止した際、房室接合部が毎分50回（R-R間隔 1.20秒＝大マス6個分）の固有レートで補充調律を開始します。心房へは下から上に向かって逆行性に興奮が広がるため、II・III・aVFで下向きの陰性P波（aVRで陽性P波）がQRSの直前に記録されます。心室へはHis-Purkinje系を正常に下行するため、12誘導すべてのQRS波形は正常な狭いQRSとなります。',
    ecgFeaturesDetail: '① 50 bpm（R-R間隔 1.20秒＝大マス6個分）の規則的徐脈。② 下壁誘導（II, III, aVF）で逆行性の陰性P波、aVRで陽性P波。③ 短いPR間隔（0.06秒）。④ 12誘導すべてで正常なNarrow QRS。',
    whyLeadChanges: '心房興奮が下から上へ向かうため下壁誘導（II, III, aVF）でP波が陰転し、右肩のaVRでP波が陽転します。',
    teachingPoints: [
      '「規則的な徐脈（50 bpm：R-R間隔 1.20秒＝大マス6個）」「下壁誘導の陰性P波（aVRの陽性P波）」「正常なNarrow QRS」の3点セットを確認する',
      '心臓模式図でAV node付近から上向き（心房）と下向き（心室）に同時に興奮が広がる様子を確認する'
    ],
    hrDisplay: 'HR 50 bpm (接合部補充調律)',
    atrialHrBpm: 50,
    ventricularHrBpm: 50,
    scenarioDurationSec: junctionalScenarioSec,
    conductionProfile: {
      blockedPaths: ['sa_node'],
      ectopicFocus: 'av_junction',
      beats: junctionalBeats,
    },
    leads: build12LeadsFromSchedule(junctionalBeats, junctionalScenarioSec),
    leadNotes: {
      II: '大マス6個（1.20秒＝50 bpm）の間隔で、Narrow QRSの直前に下向きの逆行性陰性P波が明瞭に記録されている。',
      III: 'IIと同様に逆行性陰性P波と正常QRS。',
      aVF: '逆行性陰性P波。',
      aVR: '心房が下から上へ脱分極するため、通常陰性であるP波が陽性（上向き）になっている。'
    }
  },

  // 13. トルサード・ド・ポアント (TdP)
  {
    id: 'tdp',
    nameJa: 'トルサード・ド・ポアント (TdP)',
    nameEn: 'Torsades de Pointes (TdP)',
    category: 'arrhythmia',
    categoryNameJa: '不整脈',
    subtitle: 'QT延長を背景にQRS電気軸が連続回転し、12誘導ごとに極性と振幅がねじれる多形性VT',
    shortDescription: '心室内を移動する旋回興奮により1拍ごとにQRS電気軸が回転（-150°→+160°→-45°の11拍）。全12誘導それぞれの視線方向に応じた位相で紡錘形（スピンドル状）にねじれる。',
    heartOrigin: 'QT延長心筋における早期後脱分極（EAD）と移動性スパイラルローター',
    conductionSequence: '心室内旋回軸の連続移動 → 拍ごとに主脱分極領域・二次伝播領域を変えながら心室脱分極（11連発・RR間隔10個） → 各拍の振幅に連動する心室収縮',
    mechanismDetail: '著明なQT延長を基盤に早期後脱分極（EAD）から誘発される多形性心室頻拍です。心室内の興奮旋回軸が1拍ごとに角度を変えるため、その電気双極子を12個の異なる誘導角度へ投影すると、各誘導でQRS波の振幅が増減しながら基線を挟んで上下に反転する「頂点のねじれ（Torsades de Pointes）」が現れます。四肢誘導はEinthoven・Goldbergerの法則を厳密に満たしながら立体的なスピンドルを描きます。',
    ecgFeaturesDetail: '① 250 bpm（R-R間隔 0.24秒 × 10間隔＝11連発、周期 2.80秒）の幅広い多形性QRS頻拍。② QRSの振幅が紡錘形（スピンドル状）に増減し、基線を軸に極性が上下反転する。③ 12誘導それぞれの観察角度に応じてねじれの位相・極性が異なる。',
    whyLeadChanges: '回転する同一の心室電気ベクトルを異なる角度から同時に観察するため、ある誘導で振幅が最大になる瞬間に直交する誘導では振幅がゼロ（くびれ）になり、全12誘導で立体的なねじれが表現されます。',
    teachingPoints: [
      '「振幅がスピンドル状にうねりながらQRSの向きが上下に裏返る多形性VT」＝TdP',
      '全12誘導で同一波形ではなく、誘導の角度ごとにねじれの山と谷の位置がずれていることを確認する',
      '第一選択治療は硫酸マグネシウム（MgSO4）静注'
    ],
    hrDisplay: 'HR 250 bpm (多形性VT 11連発)',
    ventricularHrBpm: 250,
    scenarioDurationSec: tdpScenarioSec,
    loopPauseSec: tdpPauseSec,
    conductionProfile: {
      blockedPaths: ['sa_node', 'av_node', 'his_bundle'],
      ectopicFocus: 'multi_ventricular',
      beats: tdpBeats,
    },
    leads: build12LeadsFromSchedule(tdpBeats, tdpScenarioSec),
    leadNotes: {
      II: '【特徴的ねじれ】下向きWide QRSから徐々に振幅が縮小してくびれを作り、中央で上向きWide QRSへ反転、後半で再び下向きへとねじれている。',
      aVR: '第II誘導とほぼ逆向きの視線のため、IIが上向きの時に下向きとなる対照的なねじれスピンドルを描く。',
      V2: '前胸壁視点でのダイナミックな多形性QRSの極性反転が確認できる。',
      V6: 'V1・V2とは異なる位相でくびれ（節）と最大振幅を迎える。'
    }
  }
];
