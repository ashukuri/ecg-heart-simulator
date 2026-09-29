import React, { useState } from 'react';
import { ConductionPathId, ConductionPathRenderState, MasterTimelineSnapshot } from '../utils/timelineEngine';

interface ConductionOverlayProps {
  snapshot: MasterTimelineSnapshot;
}

interface PolylineDefinition {
  id: ConductionPathId;
  points: [number, number][];
  isNode?: boolean;
  nodeCenter?: [number, number];
  nodeRadius?: [number, number];
}

/**
 * 四腔断面座標系 (viewBox 0 0 400 430) 上の刺激伝導系座標定義
 * 心房が上 (y: 65..170)、房室弁輪・AV結節が中央 (y: 165..185)、
 * 心室中隔が中央縦 (x: 196, y: 185..365)、心尖部が下端 (x: 200, y: 380)
 */
const CONDUCTION_GEOMETRY: PolylineDefinition[] = [
  {
    id: 'sa_node',
    isNode: true,
    nodeCenter: [110, 86],
    nodeRadius: [9, 6],
    points: [[106, 86], [114, 86]],
  },
  {
    id: 'internodal_ra',
    points: [
      [110, 86],
      [118, 118],
      [142, 145],
      [182, 165],
    ],
  },
  {
    id: 'internodal_la',
    points: [
      [110, 86],
      [165, 76],
      [235, 82],
      [278, 110],
    ],
  },
  {
    id: 'av_node',
    isNode: true,
    nodeCenter: [190, 169],
    nodeRadius: [8, 5.5],
    points: [
      [182, 165],
      [195, 173],
    ],
  },
  {
    id: 'his_bundle',
    points: [
      [195, 173],
      [196, 194],
      [196, 212],
    ],
  },
  {
    id: 'right_bundle',
    points: [
      [196, 212],
      [183, 238],
      [174, 278],
      [166, 322],
      [154, 348],
    ],
  },
  {
    id: 'left_bundle_stem',
    points: [
      [196, 212],
      [208, 226],
      [216, 238],
    ],
  },
  {
    id: 'left_bundle_ant',
    points: [
      [216, 238],
      [236, 265],
      [258, 302],
      [272, 336],
    ],
  },
  {
    id: 'left_bundle_post',
    points: [
      [216, 238],
      [214, 274],
      [218, 315],
      [226, 350],
    ],
  },
  {
    id: 'purkinje_rv',
    points: [
      [154, 348],
      [132, 332],
      [118, 296],
      [112, 252],
    ],
  },
  {
    id: 'purkinje_lv',
    points: [
      [272, 336],
      [292, 312],
      [304, 268],
      [298, 222],
    ],
  },
  {
    id: 'accessory_pathway',
    points: [
      [292, 152],
      [298, 176],
      [296, 204],
    ],
  },
  {
    id: 'transseptal_lv_to_rv',
    points: [
      [218, 285],
      [196, 292],
      [172, 300],
      [142, 310],
    ],
  },
  {
    id: 'transseptal_rv_to_lv',
    points: [
      [172, 285],
      [196, 292],
      [224, 300],
      [262, 308],
    ],
  },
];

function pointsToPathD(pts: [number, number][]): string {
  if (pts.length === 0) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
}

function getPointAlongPolyline(pts: [number, number][], progress: number): [number, number] {
  if (pts.length === 0) return [0, 0];
  if (pts.length === 1 || progress <= 0) return pts[0];
  if (progress >= 1) return pts[pts.length - 1];

  const segLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    segLengths.push(len);
    total += len;
  }
  if (total === 0) return pts[0];

  let target = progress * total;
  for (let i = 0; i < segLengths.length; i++) {
    if (target <= segLengths[i]) {
      const r = segLengths[i] > 0 ? target / segLengths[i] : 0;
      return [
        pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r,
        pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r,
      ];
    }
    target -= segLengths[i];
  }
  return pts[pts.length - 1];
}

function getStrokeColor(status: ConductionPathRenderState['status']): string {
  switch (status) {
    case 'normal':
      return '#facc15'; // 黄色: 正常伝導中
    case 'delayed':
      return '#fb923c'; // オレンジ: 伝導遅延
    case 'blocked':
      return '#ef4444'; // 赤: 完全遮断
    case 'waiting':
    default:
      return 'rgba(253, 224, 71, 0.28)'; // 待機中の伝導路: 薄い低彩度色
  }
}

export const ConductionOverlay: React.FC<ConductionOverlayProps> = ({ snapshot }) => {
  const [hoveredId, setHoveredId] = useState<ConductionPathId | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 200, y: 150 });

  const handlePointerEnter = (id: ConductionPathId, pts: [number, number][]) => {
    const mid = getPointAlongPolyline(pts, 0.5);
    setHoveredId(id);
    setTooltipPos({ x: mid[0], y: mid[1] });
  };

  const hoveredState = hoveredId ? snapshot.paths[hoveredId] : null;
  const hideNormalConduction = snapshot.ventricularWaveMode === 'vfib_chaos';

  return (
    <g className="conduction-overlay">
      {/* 1. 常時薄く表示する伝導路および発光アニメーション */}
      {!hideNormalConduction &&
        CONDUCTION_GEOMETRY.map((geo) => {
          const state = snapshot.paths[geo.id];
          if (!state || !state.visible) return null;

          const pathD = pointsToPathD(geo.points);
          const activeColor = getStrokeColor(state.status);
          const isExcited = state.progress > 0.01 && state.status !== 'waiting';
          const tipPoint = getPointAlongPolyline(geo.points, state.progress);
          const blockMid = getPointAlongPolyline(geo.points, 0.45);

          return (
            <g
              key={geo.id}
              onMouseEnter={() => handlePointerEnter(geo.id, geo.points)}
              onMouseLeave={() => setHoveredId(null)}
              onTouchStart={() => handlePointerEnter(geo.id, geo.points)}
              className="cursor-pointer"
            >
              {/* 待機中のベース伝導路（常時薄く表示） */}
              {geo.isNode && geo.nodeCenter && geo.nodeRadius ? (
                <ellipse
                  cx={geo.nodeCenter[0]}
                  cy={geo.nodeCenter[1]}
                  rx={geo.nodeRadius[0]}
                  ry={geo.nodeRadius[1]}
                  fill={
                    state.status === 'blocked'
                      ? 'rgba(239, 68, 68, 0.35)'
                      : isExcited
                        ? activeColor
                        : 'rgba(253, 224, 71, 0.26)'
                  }
                  stroke={state.status === 'blocked' ? '#ef4444' : isExcited ? '#fef08a' : 'rgba(253, 224, 71, 0.55)'}
                  strokeWidth={isExcited ? 2.2 : 1.3}
                />
              ) : (
                <>
                  <path
                    d={pathD}
                    fill="none"
                    stroke={state.status === 'blocked' ? 'rgba(239, 68, 68, 0.55)' : 'rgba(253, 224, 71, 0.26)'}
                    strokeWidth={geo.id.startsWith('purkinje') ? 2.2 : 3.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={
                      geo.id === 'transseptal_lv_to_rv' || geo.id === 'transseptal_rv_to_lv'
                        ? '4 3'
                        : undefined
                    }
                  />

                  {/* 進行中の発光経路 */}
                  {isExcited && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke={activeColor}
                      strokeWidth={geo.id.startsWith('purkinje') ? 3.2 : 4.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      pathLength={100}
                      strokeDasharray={`${Math.max(2, state.progress * 100)} 100`}
                      filter="url(#conduction-glow)"
                    />
                  )}
                </>
              )}

              {/* 完全遮断マーカー（赤の × 印と遮断リング） */}
              {state.status === 'blocked' && (
                <g transform={`translate(${blockMid[0]}, ${blockMid[1]})`}>
                  <circle r={7} fill="#7f1d1d" stroke="#ef4444" strokeWidth={1.6} />
                  <path
                    d="M -3.2 -3.2 L 3.2 3.2 M -3.2 3.2 L 3.2 -3.2"
                    stroke="#fecaca"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </g>
              )}

              {/* 発光の先端に移動する小さな光点 */}
              {state.showTip && state.progress > 0.02 && state.progress < 0.99 && (
                <g transform={`translate(${tipPoint[0]}, ${tipPoint[1]})`}>
                  <circle
                    r={5.5}
                    fill={state.status === 'delayed' ? '#fb923c' : state.status === 'blocked' ? '#ef4444' : '#fde047'}
                    opacity={0.45}
                  />
                  <circle
                    r={3.0}
                    fill="#ffffff"
                    stroke={state.status === 'delayed' ? '#f97316' : '#eab308'}
                    strokeWidth={1.5}
                  />
                </g>
              )}

              {/* ホバー判定用の透明ヒットエリア */}
              <path
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth={15}
                strokeLinecap="round"
              />
            </g>
          );
        })}

      {/* 2. Purkinje線維網の細かい枝（常時薄く表示＋Purkinje興奮時に黄色発光） */}
      {!hideNormalConduction && (
        <g className="pointer-events-none">
          {/* 右室側Purkinje小枝 */}
          {[
            'M 154 348 L 142 358',
            'M 132 332 L 122 318',
            'M 118 296 L 108 282',
          ].map((d, idx) => (
            <path
              key={`rv-p-sub-${idx}`}
              d={d}
              fill="none"
              stroke={
                snapshot.paths.purkinje_rv.progress > 0.3
                  ? getStrokeColor(snapshot.paths.purkinje_rv.status)
                  : 'rgba(253, 224, 71, 0.22)'
              }
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          ))}
          {/* 左室側Purkinje小枝 */}
          {[
            'M 226 350 L 242 362',
            'M 272 336 L 284 346',
            'M 292 312 L 306 296',
            'M 304 268 L 314 252',
          ].map((d, idx) => (
            <path
              key={`lv-p-sub-${idx}`}
              d={d}
              fill="none"
              stroke={
                snapshot.paths.purkinje_lv.progress > 0.3
                  ? getStrokeColor(snapshot.paths.purkinje_lv.status)
                  : 'rgba(253, 224, 71, 0.22)'
              }
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          ))}
        </g>
      )}

      {/* 3. AF（心房細動）時の心房内多重マイクロリエントリー波 */}
      {snapshot.atrialWaveMode === 'afib_wavelets' && (
        <g className="pointer-events-none">
          {[
            { cx: 132, cy: 112, r: 16, speed: 6.5, phase: 0 },
            { cx: 164, cy: 132, r: 13, speed: -8.0, phase: 1.5 },
            { cx: 242, cy: 108, r: 17, speed: 7.2, phase: 2.4 },
            { cx: 268, cy: 136, r: 14, speed: -6.8, phase: 0.8 },
          ].map((w, idx) => {
            const angle = (snapshot.masterTimeSec * w.speed + w.phase) * 55;
            return (
              <g key={`af-wave-${idx}`} transform={`translate(${w.cx}, ${w.cy}) rotate(${angle})`}>
                <circle
                  r={w.r}
                  fill="none"
                  stroke="#fb923c"
                  strokeWidth={2.0}
                  strokeDasharray="16 14"
                  opacity={0.75}
                />
                <circle cx={w.r} cy={0} r={2.6} fill="#fde047" />
              </g>
            );
          })}
        </g>
      )}

      {/* 4. AFL（心房粗動）時の右房マクロリエントリー旋回リング */}
      {snapshot.atrialWaveMode === 'aflutter_loop' && (
        <g className="pointer-events-none" transform="translate(146, 122)">
          <ellipse
            rx={30}
            ry={24}
            fill="none"
            stroke="#fb923c"
            strokeWidth={2.8}
            strokeDasharray="10 6"
            opacity={0.85}
          />
          {(() => {
            const theta = -((snapshot.masterTimeSec % 0.20) / 0.20) * Math.PI * 2;
            const px = 30 * Math.cos(theta);
            const py = 24 * Math.sin(theta);
            return (
              <g transform={`translate(${px}, ${py})`}>
                <circle r={5} fill="#fb923c" opacity={0.5} />
                <circle r={2.8} fill="#fef08a" />
              </g>
            );
          })()}
        </g>
      )}

      {/* 5. VF（心室細動）時の無秩序な心室スパイラルウェーブ */}
      {snapshot.ventricularWaveMode === 'vfib_chaos' && (
        <g className="pointer-events-none">
          {[
            { cx: 150, cy: 265, r: 22, speed: 9.5, phase: 0.2 },
            { cx: 162, cy: 325, r: 18, speed: -11.0, phase: 1.8 },
            { cx: 236, cy: 255, r: 24, speed: -10.2, phase: 0.9 },
            { cx: 258, cy: 318, r: 20, speed: 12.0, phase: 2.7 },
            { cx: 204, cy: 342, r: 16, speed: 8.8, phase: 3.9 },
          ].map((w, idx) => {
            const angle = (snapshot.masterTimeSec * w.speed + w.phase) * 65;
            return (
              <g key={`vf-spiral-${idx}`} transform={`translate(${w.cx}, ${w.cy}) rotate(${angle})`}>
                <circle
                  r={w.r}
                  fill="none"
                  stroke={idx % 2 === 0 ? '#fb923c' : '#38bdf8'}
                  strokeWidth={2.4}
                  strokeDasharray="18 14"
                  opacity={0.82}
                />
                <circle cx={w.r} cy={0} r={3} fill="#fef08a" />
              </g>
            );
          })}
        </g>
      )}

      {/* 6. 異所性興奮源（PAC / PVC / VT / 房室接合部）の発火パルス表示 */}
      {snapshot.ectopicFocus && snapshot.ectopicFiring && (
        <g className="pointer-events-none">
          {(() => {
            const focusCoords: Record<NonNullable<MasterTimelineSnapshot['ectopicFocus']>, [number, number]> = {
              atria_ectopic: [255, 105],
              av_junction: [194, 178],
              rv_outflow: [138, 232],
              lv_apex_scar: [262, 318],
              multi_ventricular: [232, 295],
            };
            const [fx, fy] = focusCoords[snapshot.ectopicFocus];
            const pulseR = 6 + ((snapshot.masterTimeSec * 20) % 1) * 16;
            return (
              <g transform={`translate(${fx}, ${fy})`}>
                <circle r={pulseR} fill="none" stroke="#fb923c" strokeWidth={2.2} opacity={0.75} />
                <circle r={5} fill="#f97316" stroke="#fff" strokeWidth={1.5} />
              </g>
            );
          })()}
        </g>
      )}

      {/* 7. 伝導路ホバー時の英語＋日本語名称ツールチップ */}
      {hoveredState && (
        <g
          transform={`translate(${Math.min(310, Math.max(90, tooltipPos.x))}, ${Math.max(36, tooltipPos.y - 26)})`}
          className="pointer-events-none"
        >
          <rect
            x={-82}
            y={-22}
            width={164}
            height={34}
            rx={6}
            fill="rgba(15, 23, 42, 0.92)"
            stroke="rgba(148, 163, 184, 0.4)"
            strokeWidth={1}
          />
          <text
            x={0}
            y={-8}
            textAnchor="middle"
            fill="#f8fafc"
            fontSize={10}
            fontWeight="600"
            fontFamily="ui-monospace, SFMono-Regular, monospace"
          >
            {hoveredState.nameEn}
          </text>
          <text
            x={0}
            y={6}
            textAnchor="middle"
            fill="#fde047"
            fontSize={10.5}
            fontWeight="700"
          >
            {hoveredState.nameJa}
          </text>
        </g>
      )}
    </g>
  );
};
