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
  isJunctionalRhythm?: boolean;
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

interface SubSegmentWaveFrontTrack {
  id: MyocardialSubSegmentId;
  startPt: [number, number];
  endPt: [number, number];
  controlPt?: [number, number];
}

/**
 * 各心筋サブセグメント内を進行する activation front 波頭バンドの解剖学的始点→終点トラック
 */
const SUB_SEGMENT_FRONT_TRACKS: SubSegmentWaveFrontTrack[] = [
  { id: 'ra_superior', startPt: [111, 80], endPt: [162, 77] },
  { id: 'ra_inferior', startPt: [96, 119], endPt: [144, 160] },
  { id: 'la_body', startPt: [224, 66], endPt: [288, 116] },
  { id: 'septal_middle', startPt: [205, 257], endPt: [183, 255] },
  { id: 'septal_superior', startPt: [200, 198], endPt: [180, 211] },
  { id: 'septal_apical', startPt: [214, 312], endPt: [218, 343] },
  { id: 'rv_apical', startPt: [193, 335], endPt: [142, 310] },
  { id: 'rv_lateral', startPt: [134, 297], endPt: [105, 248] },
  { id: 'rv_basal', startPt: [102, 233], endPt: [89, 178] },
  { id: 'lv_apical', startPt: [240, 354], endPt: [275, 333] },
  { id: 'lv_inferior', startPt: [236, 380], endPt: [251, 392] },
  { id: 'lv_anterior', startPt: [278, 329], endPt: [302, 301] },
  { id: 'lv_lateral', startPt: [304, 285], endPt: [316, 235] },
  { id: 'lv_basal', startPt: [315, 224], endPt: [303, 174] },
];

// Retrograde atrial fronts climb from the valve/junction side along the walls.
const RETROGRADE_ATRIAL_TRACKS: Partial<Record<MyocardialSubSegmentId, SubSegmentWaveFrontTrack>> = {
  ra_inferior: { id: 'ra_inferior', startPt: [156, 168], controlPt: [80, 178], endPt: [85, 124] },
  ra_superior: { id: 'ra_superior', startPt: [162, 77], endPt: [111, 80] },
  la_body: { id: 'la_body', startPt: [307, 145], controlPt: [334, 93], endPt: [281, 65] },
};

export const HeartDiagram: React.FC<HeartDiagramProps> = ({
  snapshot,
  showElectricVector,
  isJunctionalRhythm = false,
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

  // One continuous myocardial surface. The same local contraction values deform
  // its contour and cavities; activation is clipped to this moving tissue.
  const silhouette = `M 181 84
    C 158 51, ${100 + raSupShiftX} 53, ${82 + raSupShiftX} 96
    C 68 120, ${73 + raInfShiftX} 151, 82 173
    C ${70 + rvBasalShiftX} 214, ${88 + rvLatShiftX} 282, ${134 + rvApiShiftX} 329
    C 170 364, 217 397, 245 ${399 + lvInfShiftY}
    C 272 398, ${309 + lvApiShiftX} 357, ${325 + lvAntShiftX} 308
    C ${346 + lvLatShiftX} 252, ${341 + lvBasalShiftX} 197, 310 159
    C ${327 + laShiftX} 128, ${320 + laShiftX} 72, 285 ${59 + laShiftY}
    C 247 43, 207 54, 192 83 Q 187 91, 181 84 Z`;
  const raCavity = `M 171 91 C 150 ${66 + raShiftY}, ${111 + raSupShiftX} 69, ${97 + raSupShiftX} 103
    C ${84 + raInfShiftX} 130, 98 153, 119 158 Q 148 165, 171 153
    Q 188 120, 171 91 Z`;
  const laCavity = `M 206 88 C 222 64, 260 61, ${286 + laShiftX} ${77 + laShiftY}
    C ${307 + laShiftX} 95, 306 126, 292 148 Q 262 163, 219 153
    Q 199 128, 206 88 Z`;
  const rvCavity = `M ${96 + rvBasalShiftX} 178 Q 133 185, 171 176
    C ${168 + septShiftX} 215, ${175 + septShiftX} 250, 190 287
    Q 203 316, ${210 + rvApiShiftX} 337
    C 173 327, ${134 + rvApiShiftX} 297, ${114 + rvLatShiftX} 253
    Q ${97 + rvBasalShiftX} 215, ${96 + rvBasalShiftX} 178 Z`;
  const lvCavity = `M 205 178 Q 247 167, ${290 + lvBasalShiftX} 177
    C ${315 + lvLatShiftX} 215, ${310 + lvAntShiftX} 276, ${282 + lvApiShiftX} 325
    Q 263 356, 241 ${364 + lvInfShiftY}
    C 223 353, ${228 + septShiftX} 319, ${214 + septShiftX} 282
    C ${195 + septShiftX} 240, ${188 + septShiftX} 209, 205 178 Z`;
  const myocardium = `${silhouette} ${raCavity} ${laCavity} ${rvCavity} ${lvCavity}`;
  // Regions have no outlines. Adjacent regions meet within a single tissue clip,
  // preserving all 14 timeline IDs without drawing assembled pieces.
  const activationRegions: { id: MyocardialSubSegmentId; d: string }[] = [
    { id: 'ra_superior', d: 'M 50 40 H 195 V 115 H 50 Z' },
    { id: 'ra_inferior', d: 'M 50 115 H 195 V 170 H 50 Z' },
    { id: 'la_body', d: 'M 195 40 H 350 V 170 H 195 Z' },
    { id: 'rv_basal', d: 'M 50 170 H 160 L 165 230 H 50 Z' },
    { id: 'rv_lateral', d: 'M 50 230 H 165 L 195 300 L 145 330 H 50 Z' },
    { id: 'rv_apical', d: 'M 145 330 L 195 300 L 230 354 L 223 378 H 50 V 330 Z' },
    { id: 'septal_superior', d: 'M 160 170 H 228 L 232 230 H 165 Z' },
    { id: 'septal_middle', d: 'M 165 230 H 232 L 245 300 H 195 Z' },
    { id: 'septal_apical', d: 'M 195 300 H 245 L 252 354 H 230 Z' },
    { id: 'lv_basal', d: 'M 228 170 H 360 V 230 H 232 Z' },
    { id: 'lv_lateral', d: 'M 232 230 H 360 V 290 H 243 Z' },
    { id: 'lv_anterior', d: 'M 243 290 H 360 V 330 H 249 Z' },
    { id: 'lv_apical', d: 'M 249 330 H 360 V 378 H 223 L 230 354 H 252 Z' },
    { id: 'lv_inferior', d: 'M 50 378 H 360 V 420 H 50 Z' },
  ];

  return (
    <div className="relative flex flex-col items-center justify-center select-none pointer-events-none">
      {/* 中央2.5D四腔断面SVGキャンバス */}
      <div className="relative w-[330px] h-[350px] flex items-center justify-center pointer-events-auto">
        <svg
          viewBox="0 0 400 430"
          className="w-full h-full drop-shadow-[0_10px_24px_rgba(15,23,42,0.10)]"
        >
          <defs>
            <linearGradient id="myocardium-grad" x1="0" y1="0" x2="1" y2="0.8">
              <stop offset="0%" stopColor="#d46870" />
              <stop offset="45%" stopColor="#b94353" />
              <stop offset="100%" stopColor="#88283d" />
            </linearGradient>
            <clipPath id="myocardium-clip">
              <path d={myocardium} clipRule="evenodd" />
            </clipPath>
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
            <path d={myocardium} fill="url(#myocardium-grad)" fillRule="evenodd"
              stroke="#651b2b" strokeWidth={2} strokeLinejoin="round"
              filter="url(#heart-25d-shadow)" />
            <g fill="url(#chamber-cavity-grad)" stroke="#e89091" strokeOpacity={0.5} strokeWidth={1.4}>
              <path d={raCavity} />
              <path d={laCavity} />
              <path d={rvCavity} />
              <path d={lvCavity} />
            </g>
            <g clipPath="url(#myocardium-clip)" className="pointer-events-none">
              {activationRegions.map(({ id, d }) => {
                const sub = subSegments[id];
                return <path key={id} data-segment={id} d={d}
                  fill={getSubSegmentFillColor(sub)}
                  opacity={sub.phase === 'resting' ? 0 : sub.isInfarcted ? 0.85 : 0.65} />;
              })}
            </g>

            {/* 2b. 各サブセグメント内を進行する Activation Front 波頭ハイライトバンド */}
            <g className="pointer-events-none" clipPath="url(#myocardium-clip)" filter="url(#conduction-glow)">
              {SUB_SEGMENT_FRONT_TRACKS.map((normalTrack) => {
                const track = isJunctionalRhythm && snapshot.atrialPropagation === 'retrograde'
                  ? RETROGRADE_ATRIAL_TRACKS[normalTrack.id] ?? normalTrack
                  : normalTrack;
                const sub = subSegments[track.id];
                if (!sub || sub.phase !== 'front_active' || sub.isInfarcted) return null;
                const p = sub.frontProgress;
                const position = (axis: 0 | 1) => track.controlPt
                  ? (1 - p) ** 2 * track.startPt[axis] + 2 * (1 - p) * p * track.controlPt[axis] + p ** 2 * track.endPt[axis]
                  : track.startPt[axis] + (track.endPt[axis] - track.startPt[axis]) * p;
                const cx = position(0);
                const cy = position(1);
                const isSlowOrEctopic =
                  sub.propagationMode === 'transmyocardial_slow' ||
                  sub.propagationMode === 'ectopic' ||
                  sub.propagationMode === 'chaotic';
                const frontColor = isSlowOrEctopic ? '#fb923c' : '#fef08a';
                const ringColor = isSlowOrEctopic ? '#ea580c' : '#38bdf8';

                return (
                  <g key={`front-wave-${track.id}`} data-front={track.id} transform={`translate(${cx}, ${cy})`}>
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

            {/* Small leaflet pairs mark the two atrioventricular openings. */}
            <g stroke="#ffe1d7" strokeWidth={2.6} strokeLinecap="round" fill="none" opacity={0.9}>
              <path d={`M ${99 + raInfShiftX} 168 Q 122 ${171 + valveDropY} 139 ${170 + valveDropY}`} />
              <path d={`M 174 165 Q 160 ${169 + valveDropY} 149 ${171 + valveDropY}`} />
              <path d={`M 204 167 Q 221 ${168 + valveDropY} 239 ${169 + valveDropY}`} />
              <path d={`M ${290 + laShiftX} 166 Q 269 ${169 + valveDropY} 251 ${170 + valveDropY}`} />
            </g>

            {/* 4. 刺激伝導系オーバーレイ（常時薄く表示＋発光＋先端光点＋ホバー名称） */}
            <ConductionOverlay snapshot={snapshot} isJunctionalRhythm={isJunctionalRhythm} />
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
