import React from 'react';
import {
  MasterTimelineSnapshot,
  MyocardialSubSegmentId,
  MyocardialSubSegmentState,
} from '../utils/timelineEngine';
import { ConductionOverlay } from './ConductionOverlay';

interface HeartDiagramProps {
  snapshot: MasterTimelineSnapshot;
  showElectricVector: boolean;
}

/**
 * 各心筋サブセグメントの位相 (phase) と伝播様式 (propagationMode) に応じた塗り色
 * - resting (静止心筋)：低彩度の解剖学的心筋赤色 (#b83b4a)
 * - front_active (心筋activation front進行中)：
 *   - purkinje_fast / retrograde / reentrant: 明るい淡黄〜シアン (#fde047 / #67e8f9)
 *   - transmyocardial_slow / ectopic / chaotic: 暖色アンバー〜オレンジ (#fb923c / #fdba74)
 * - depolarized (興奮済みプラトー相)：淡い水色 (#38bdf8 / #7dd3fc)
 * - repolarizing (再分極進行中)：控えめな青灰色 (#64748b)
 * - infarcted (梗塞壊死領域)：暗い赤紫〜グレー (#4e2a3e)
 */
function getSubSegmentFillColor(sub: MyocardialSubSegmentState): string {
  if (sub.isInfarcted || sub.phase === 'infarcted') {
    return '#4e2a3e';
  }
  if (sub.phase === 'front_active') {
    const isSlowOrEctopic =
      sub.propagationMode === 'transmyocardial_slow' ||
      sub.propagationMode === 'ectopic' ||
      sub.propagationMode === 'chaotic';
    if (isSlowOrEctopic) {
      return sub.frontProgress < 0.55 ? '#fdba74' : '#fb923c';
    }
    return sub.frontProgress < 0.45 ? '#fef08a' : '#67e8f9';
  }
  if (sub.phase === 'depolarized') {
    return '#38bdf8';
  }
  if (sub.phase === 'repolarizing') {
    return '#64748b';
  }
  return '#b83b4a';
}

function getSubSegmentStrokeColor(sub: MyocardialSubSegmentState): string {
  if (sub.isInfarcted || sub.phase === 'infarcted') {
    return '#64748b';
  }
  if (sub.phase === 'front_active') {
    const isSlowOrEctopic =
      sub.propagationMode === 'transmyocardial_slow' ||
      sub.propagationMode === 'ectopic' ||
      sub.propagationMode === 'chaotic';
    return isSlowOrEctopic ? '#fed7aa' : '#fef9c3';
  }
  if (sub.phase === 'depolarized') {
    return '#bae6fd';
  }
  if (sub.phase === 'repolarizing') {
    return '#94a3b8';
  }
  return '#881d2c';
}

interface SubSegmentWaveFrontTrack {
  id: MyocardialSubSegmentId;
  startPt: [number, number];
  endPt: [number, number];
}

/**
 * 各心筋サブセグメント内を進行する activation front 波頭バンドの解剖学的始点→終点トラック
 */
const SUB_SEGMENT_FRONT_TRACKS: SubSegmentWaveFrontTrack[] = [
  { id: 'ra_superior',     startPt: [116, 84],  endPt: [100, 118] },
  { id: 'ra_inferior',     startPt: [100, 122], endPt: [102, 158] },
  { id: 'la_body',         startPt: [222, 76],  endPt: [296, 142] },
  { id: 'septal_middle',   startPt: [206, 255], endPt: [188, 255] },
  { id: 'septal_superior', startPt: [204, 202], endPt: [188, 202] },
  { id: 'septal_apical',   startPt: [204, 318], endPt: [192, 348] },
  { id: 'rv_apical',       startPt: [176, 352], endPt: [142, 316] },
  { id: 'rv_lateral',      startPt: [138, 310], endPt: [108, 242] },
  { id: 'rv_basal',        startPt: [104, 236], endPt: [96, 182] },
  { id: 'lv_apical',       startPt: [222, 358], endPt: [256, 332] },
  { id: 'lv_inferior',     startPt: [198, 368], endPt: [218, 384] },
  { id: 'lv_anterior',     startPt: [258, 328], endPt: [284, 296] },
  { id: 'lv_lateral',      startPt: [284, 290], endPt: [304, 236] },
  { id: 'lv_basal',        startPt: [304, 230], endPt: [306, 182] },
];

export const HeartDiagram: React.FC<HeartDiagramProps> = ({
  snapshot,
  showElectricVector,
}) => {
  const { walls, subSegments, electricVector, isDextrocardia } = snapshot;

  // サブセグメント別の局所壁運動 (内向き変位 px)
  const raSupShiftX = subSegments.ra_superior.contraction * 6.0;
  const raInfShiftX = subSegments.ra_inferior.contraction * 6.5;
  const raShiftY = ((subSegments.ra_superior.contraction + subSegments.ra_inferior.contraction) * 0.5) * 4.0;
  const laShiftX = -subSegments.la_body.contraction * 6.5;
  const laShiftY = subSegments.la_body.contraction * 4.0;

  const rvBasalShiftX = subSegments.rv_basal.contraction * 9.0;
  const rvLatShiftX = subSegments.rv_lateral.contraction * 9.5;
  const rvApiShiftX = subSegments.rv_apical.contraction * 8.5;

  const lvBasalShiftX = -subSegments.lv_basal.contraction * 10.5;
  const lvLatShiftX = -subSegments.lv_lateral.contraction * 10.5;
  const lvAntShiftX = -subSegments.lv_anterior.contraction * 8.5;
  const lvApiShiftX = -subSegments.lv_apical.contraction * 7.5;
  const lvInfShiftY = -subSegments.lv_inferior.contraction * 8.5;

  const septShiftX =
    (subSegments.lv_lateral.contraction - subSegments.rv_lateral.contraction) * 3.0;

  // 房室弁（三尖弁・僧帽弁）の開閉度
  const avValveOpen = Math.max(
    0,
    (walls.ra_wall.contraction + walls.la_wall.contraction) * 0.5 -
      walls.lv_lateral.contraction * 0.8
  );
  const valveDropY = 6 + avValveOpen * 11;

  return (
    <div className="relative flex flex-col items-center justify-center select-none pointer-events-none">
      {/* 中央2.5D四腔断面SVGキャンバス */}
      <div className="relative w-[330px] h-[350px] flex items-center justify-center pointer-events-auto">
        <svg
          viewBox="0 0 400 430"
          className="w-full h-full drop-shadow-[0_10px_24px_rgba(15,23,42,0.10)]"
        >
          <defs>
            {/* 2.5D立体陰影フィルター */}
            <filter id="heart-25d-shadow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.16" />
            </filter>
            {/* 伝導発光・Activation Frontグロー */}
            <filter id="conduction-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* 心腔内血液の深みグラデーション */}
            <linearGradient id="chamber-cavity-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b0d16" />
              <stop offset="100%" stopColor="#24070d" />
            </linearGradient>
            {/* 電気ベクトル矢印マーカー */}
            <marker
              id="electric-vector-arrow"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#10b981" />
            </marker>
          </defs>

          {/* 右胸心時は心臓断面全体を左右鏡像反転 */}
          <g transform={isDextrocardia ? 'translate(400, 0) scale(-1, 1)' : undefined}>
            {/* 0. 外膜・心膜シルエット（2.5D厚みベース） */}
            <path
              d="M 196 56
                 C 122 54, 76 92, 78 156
                 C 79 178, 86 196, 84 222
                 C 80 286, 118 358, 198 396
                 C 282 362, 330 282, 326 210
                 C 324 186, 316 170, 316 148
                 C 316 90, 270 58, 196 56 Z"
              fill="#6e1725"
              stroke="#4c0f19"
              strokeWidth="2.5"
              filter="url(#heart-25d-shadow)"
            />

            {/* 1. 4つの心腔内腔（右房・左房・右室・左室の暗赤色内腔） */}
            {/* 右房内腔 */}
            <path
              d={`M ${98 + raSupShiftX} ${96 + raShiftY}
                  C ${96 + raSupShiftX} 72, 146 68, 188 76
                  L 188 164
                  L ${104 + raInfShiftX} 164
                  C ${96 + raInfShiftX} 145, ${96 + raSupShiftX} 118, ${98 + raSupShiftX} ${96 + raShiftY} Z`}
              fill="url(#chamber-cavity-grad)"
            />
            {/* 左房内腔 */}
            <path
              d={`M 204 76
                  C 246 68, ${296 + laShiftX} 74, ${296 + laShiftX} ${98 + laShiftY}
                  C ${298 + laShiftX} 122, ${296 + laShiftX} 145, ${290 + laShiftX} 164
                  L 204 164 Z`}
              fill="url(#chamber-cavity-grad)"
            />
            {/* 右室内腔 */}
            <path
              d={`M ${106 + rvBasalShiftX} 180
                  L 184 180
                  L ${184 + septShiftX} 346
                  C 148 332, ${114 + rvLatShiftX} 276, ${106 + rvBasalShiftX} 180 Z`}
              fill="url(#chamber-cavity-grad)"
            />
            {/* 左室内腔 */}
            <path
              d={`M 210 180
                  L ${292 + lvBasalShiftX} 180
                  C ${296 + lvLatShiftX} 268, ${264 + lvAntShiftX} 336, 208 ${352 + lvInfShiftY}
                  L ${210 + septShiftX} 180 Z`}
              fill="url(#chamber-cavity-grad)"
            />

            {/* 2. 14心筋表示サブセグメント（Activation Front・興奮済み心筋・再分極・梗塞・局所収縮） */}

            {/* [Atrial 1] 右房上部 (ra_superior) */}
            <path
              d={`M 188 62
                  C 138 58, ${92 + raSupShiftX} 76, ${84 + raSupShiftX} 118
                  L ${102 + raSupShiftX} 118
                  C ${106 + raSupShiftX} 84, 145 72, 188 78 Z`}
              fill={getSubSegmentFillColor(subSegments.ra_superior)}
              stroke={getSubSegmentStrokeColor(subSegments.ra_superior)}
              strokeWidth="1.5"
            />

            {/* [Atrial 2] 右房下部 (ra_inferior) */}
            <path
              d={`M ${84 + raSupShiftX} 118
                  L ${84 + raInfShiftX} 154
                  L ${102 + raInfShiftX} 164
                  L ${102 + raSupShiftX} 118 Z`}
              fill={getSubSegmentFillColor(subSegments.ra_inferior)}
              stroke={getSubSegmentStrokeColor(subSegments.ra_inferior)}
              strokeWidth="1.5"
            />

            {/* [Atrial 3] 左房自由壁 (la_body) */}
            <path
              d={`M 204 62
                  C 264 58, ${310 + laShiftX} 86, ${308 + laShiftX} 152
                  L ${290 + laShiftX} 164
                  L ${290 + laShiftX} 102
                  C ${288 + laShiftX} 78, 248 72, 204 78 Z`}
              fill={getSubSegmentFillColor(subSegments.la_body)}
              stroke={getSubSegmentStrokeColor(subSegments.la_body)}
              strokeWidth="1.5"
            />

            {/* 心房中隔 */}
            <rect
              x={189}
              y={66}
              width={14}
              height={102}
              rx={5}
              fill={getSubSegmentFillColor(subSegments.ra_inferior)}
              stroke={getSubSegmentStrokeColor(subSegments.ra_inferior)}
              strokeWidth="1.2"
            />

            {/* [Ventricular 1] 右室基部・流出路 (rv_basal) */}
            <path
              d={`M ${86 + rvBasalShiftX} 176
                  L ${106 + rvBasalShiftX} 176
                  L ${112 + rvLatShiftX} 236
                  L ${92 + rvLatShiftX} 236 Z`}
              fill={getSubSegmentFillColor(subSegments.rv_basal)}
              stroke={getSubSegmentStrokeColor(subSegments.rv_basal)}
              strokeWidth="1.6"
            />

            {/* [Ventricular 2] 右室自由壁中部 (rv_lateral) */}
            <path
              d={`M ${92 + rvLatShiftX} 236
                  L ${112 + rvLatShiftX} 236
                  C ${118 + rvLatShiftX} 274, ${132 + rvApiShiftX} 302, ${146 + rvApiShiftX} 320
                  L ${128 + rvApiShiftX} 336
                  C ${106 + rvLatShiftX} 308, ${94 + rvLatShiftX} 274, ${92 + rvLatShiftX} 236 Z`}
              fill={getSubSegmentFillColor(subSegments.rv_lateral)}
              stroke={getSubSegmentStrokeColor(subSegments.rv_lateral)}
              strokeWidth="1.6"
            />

            {/* [Ventricular 3] 右室心尖部 (rv_apical) */}
            <path
              d={`M ${128 + rvApiShiftX} 336
                  L ${146 + rvApiShiftX} 320
                  C 162 336, 176 346, 188 352
                  L 194 386
                  C 166 372, 144 356, ${128 + rvApiShiftX} 336 Z`}
              fill={getSubSegmentFillColor(subSegments.rv_apical)}
              stroke={getSubSegmentStrokeColor(subSegments.rv_apical)}
              strokeWidth="1.6"
            />

            {/* [Ventricular 4] 心室中隔上部 (septal_superior) */}
            <path
              d={`M 184 172
                  L 210 172
                  L ${210 + septShiftX * 0.4} 226
                  L ${184 + septShiftX * 0.4} 226 Z`}
              fill={getSubSegmentFillColor(subSegments.septal_superior)}
              stroke={getSubSegmentStrokeColor(subSegments.septal_superior)}
              strokeWidth="1.6"
            />

            {/* [Ventricular 5] 心室中隔中部 (septal_middle — 正常・RBBBで最初に左→右へ脱分極) */}
            <path
              d={`M ${184 + septShiftX * 0.4} 226
                  L ${210 + septShiftX * 0.4} 226
                  L ${211 + septShiftX * 0.8} 292
                  L ${183 + septShiftX * 0.8} 292 Z`}
              fill={getSubSegmentFillColor(subSegments.septal_middle)}
              stroke={getSubSegmentStrokeColor(subSegments.septal_middle)}
              strokeWidth="1.6"
            />

            {/* [Ventricular 6] 心室中隔下部 (septal_apical) */}
            <path
              d={`M ${183 + septShiftX * 0.8} 292
                  L ${211 + septShiftX * 0.8} 292
                  L ${212 + septShiftX} 358
                  L 196 382
                  L ${182 + septShiftX} 354 Z`}
              fill={getSubSegmentFillColor(subSegments.septal_apical)}
              stroke={getSubSegmentStrokeColor(subSegments.septal_apical)}
              strokeWidth="1.6"
            />

            {/* [Ventricular 7] 左室下壁 (lv_inferior) */}
            <path
              d={`M 194 386
                  L 188 352
                  L 214 354
                  L 224 ${386 + lvInfShiftY}
                  C 212 ${394 + lvInfShiftY}, 202 ${394 + lvInfShiftY}, 194 386 Z`}
              fill={getSubSegmentFillColor(subSegments.lv_inferior)}
              stroke={getSubSegmentStrokeColor(subSegments.lv_inferior)}
              strokeWidth="1.6"
            />

            {/* [Ventricular 8] 左室心尖部 (lv_apical) */}
            <path
              d={`M 214 354
                  L ${248 + lvApiShiftX} 330
                  L ${266 + lvApiShiftX} 348
                  C 252 366, 238 378, 224 ${386 + lvInfShiftY} Z`}
              fill={getSubSegmentFillColor(subSegments.lv_apical)}
              stroke={getSubSegmentStrokeColor(subSegments.lv_apical)}
              strokeWidth="1.6"
            />

            {/* [Ventricular 9] 左室前側壁 (lv_anterior) */}
            <path
              d={`M ${248 + lvApiShiftX} 330
                  L ${274 + lvAntShiftX} 292
                  L ${296 + lvAntShiftX} 308
                  C ${286 + lvAntShiftX} 326, ${276 + lvApiShiftX} 338, ${266 + lvApiShiftX} 348 Z`}
              fill={getSubSegmentFillColor(subSegments.lv_anterior)}
              stroke={getSubSegmentStrokeColor(subSegments.lv_anterior)}
              strokeWidth="1.6"
            />

            {/* [Ventricular 10] 左室側壁中部 (lv_lateral) */}
            <path
              d={`M ${274 + lvAntShiftX} 292
                  C ${286 + lvLatShiftX} 266, ${292 + lvLatShiftX} 246, ${292 + lvLatShiftX} 228
                  L ${318 + lvLatShiftX} 228
                  C ${316 + lvLatShiftX} 258, ${308 + lvAntShiftX} 286, ${296 + lvAntShiftX} 308 Z`}
              fill={getSubSegmentFillColor(subSegments.lv_lateral)}
              stroke={getSubSegmentStrokeColor(subSegments.lv_lateral)}
              strokeWidth="1.6"
            />

            {/* [Ventricular 11] 左室側壁基部 (lv_basal — WPWデルタ波起始部 / 正常最終脱分極部) */}
            <path
              d={`M ${292 + lvBasalShiftX} 176
                  L ${320 + lvBasalShiftX} 176
                  L ${318 + lvLatShiftX} 228
                  L ${292 + lvLatShiftX} 228 Z`}
              fill={getSubSegmentFillColor(subSegments.lv_basal)}
              stroke={getSubSegmentStrokeColor(subSegments.lv_basal)}
              strokeWidth="1.6"
            />

            {/* 2b. 各サブセグメント内を進行する Activation Front 波頭ハイライトバンド */}
            <g className="pointer-events-none" filter="url(#conduction-glow)">
              {SUB_SEGMENT_FRONT_TRACKS.map((track) => {
                const sub = subSegments[track.id];
                if (!sub || sub.phase !== 'front_active' || sub.isInfarcted) return null;
                const p = sub.frontProgress;
                const cx = track.startPt[0] + (track.endPt[0] - track.startPt[0]) * p;
                const cy = track.startPt[1] + (track.endPt[1] - track.startPt[1]) * p;
                const isSlowOrEctopic =
                  sub.propagationMode === 'transmyocardial_slow' ||
                  sub.propagationMode === 'ectopic' ||
                  sub.propagationMode === 'chaotic';
                const frontColor = isSlowOrEctopic ? '#fb923c' : '#fef08a';
                const ringColor = isSlowOrEctopic ? '#ea580c' : '#38bdf8';

                return (
                  <g key={`front-wave-${track.id}`} transform={`translate(${cx}, ${cy})`}>
                    <circle r={7.5} fill={frontColor} opacity={0.42} />
                    <circle
                      r={4.2}
                      fill="#ffffff"
                      stroke={ringColor}
                      strokeWidth={1.8}
                      opacity={0.92}
                    />
                  </g>
                );
              })}
            </g>

            {/* 3. 房室弁（三尖弁・僧帽弁）の白い弁尖 */}
            <g stroke="#f1f5f9" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity={0.88}>
              {/* 三尖弁 (右房-右室間) */}
              <path d={`M ${104 + raInfShiftX} 170 Q 128 ${172 + valveDropY} 138 ${176 + valveDropY}`} />
              <path d={`M 184 170 Q 164 ${172 + valveDropY} 154 ${176 + valveDropY}`} />
              {/* 僧帽弁 (左房-左室間) */}
              <path d={`M 210 170 Q 232 ${172 + valveDropY} 242 ${176 + valveDropY}`} />
              <path d={`M ${292 + laShiftX} 170 Q 268 ${172 + valveDropY} 258 ${176 + valveDropY}`} />
            </g>

            {/* 4. 刺激伝導系オーバーレイ（常時薄く表示＋発光＋先端光点＋ホバー名称） */}
            <ConductionOverlay snapshot={snapshot} />
          </g>

          {/* 5. 合成電気ベクトル（トグルON時 ＆ 意味のある合成ベクトルが存在する時のみ表示） */}
          {showElectricVector && electricVector.active && (
            <g transform="translate(200, 245)" className="pointer-events-none">
              <circle r={3.2} fill="#10b981" />
              <line
                x1={0}
                y1={0}
                x2={electricVector.dx * 68}
                y2={electricVector.dy * 68}
                stroke="#10b981"
                strokeWidth={2.4}
                strokeLinecap="round"
                markerEnd="url(#electric-vector-arrow)"
              />
            </g>
          )}
        </svg>
      </div>

      {/* 下部コンパクト色凡例（教育用カラーガイド：Activation Front & 伝導系） */}
      <div className="mt-1 px-3 py-1 rounded-full bg-white/90 border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[10px] text-slate-600 pointer-events-auto">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
          伝導系/高速Front
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
          遅延/心筋内Front
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          完全遮断
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
          興奮済み心筋
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" />
          再分極
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#4e2a3e] inline-block" />
          梗塞領域
        </span>
      </div>
    </div>
  );
};
