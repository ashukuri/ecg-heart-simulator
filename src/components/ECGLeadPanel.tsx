import React from 'react';
import { ECGLeadId, ECGPoint } from '../types';
import { ECG_LEADS } from '../data/leads';
import {
  ECG_SMALL_GRID_PX,
  ECG_LARGE_GRID_PX,
  ECG_PLOT_W,
  ECG_PLOT_H,
  ECG_MV_SCALE,
  ECG_PADDING_X,
  ECG_PADDING_Y,
  ECG_CARD_WIDTH,
} from '../utils/ecgGenerator';

interface ECGLeadPanelProps {
  leadId: ECGLeadId;
  points: ECGPoint[];
  normalPoints?: ECGPoint[];
  normalizedTime: number; // 0.0 to 1.0 (masterTimeSec / ECG_WINDOW_SEC)
  phaseColor: string;
  phaseLabelJa: string;
  isSelected: boolean;
  onSelect: (leadId: ECGLeadId) => void;
  compareMode: boolean;
}

/**
 * 500Hz (1601 samples) 波形から R波・Q波・S波・ST/T波の極値を一切落とさない
 * Peak-Preserving SVG Path 生成関数（clampY による頭打ちなし）
 */
function buildPeakPreservingPathD(
  pts: ECGPoint[],
  maxT: number,
  paddingX: number,
  midY: number,
  plotW: number,
  mVScale: number
): string {
  if (!pts || pts.length === 0) return '';
  const filtered = pts.filter((p) => p.t <= maxT + 0.0005);
  if (filtered.length === 0) {
    const p0 = pts[0];
    const x0 = paddingX + p0.t * plotW;
    const y0 = midY - p0.v * mVScale;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)}`;
  }

  // 各4サンプル窓(8ms)内で最小・最大・変曲点(局所ピーク)をすべて保持して描画精度を最大化
  const selectedIndices = new Set<number>();
  selectedIndices.add(0);
  selectedIndices.add(filtered.length - 1);

  const bucketSize = 3;
  for (let i = 0; i < filtered.length; i += bucketSize) {
    const end = Math.min(filtered.length - 1, i + bucketSize - 1);
    let minIdx = i;
    let maxIdx = i;
    for (let j = i; j <= end; j++) {
      if (filtered[j].v < filtered[minIdx].v) minIdx = j;
      if (filtered[j].v > filtered[maxIdx].v) maxIdx = j;
      if (j > 0 && j < filtered.length - 1) {
        const dv1 = filtered[j].v - filtered[j - 1].v;
        const dv2 = filtered[j + 1].v - filtered[j].v;
        if (dv1 * dv2 <= 0 && (Math.abs(dv1) > 1e-4 || Math.abs(dv2) > 1e-4)) {
          selectedIndices.add(j);
        }
      }
    }
    selectedIndices.add(minIdx);
    selectedIndices.add(maxIdx);
  }

  const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
  return sortedIndices
    .map((idx, pos) => {
      const p = filtered[idx];
      const x = paddingX + p.t * plotW;
      const y = midY - p.v * mVScale;
      return `${pos === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export const ECGLeadPanel: React.FC<ECGLeadPanelProps> = ({
  leadId,
  points,
  normalPoints,
  normalizedTime,
  phaseColor,
  phaseLabelJa,
  isSelected,
  onSelect,
  compareMode,
}) => {
  const leadInfo = ECG_LEADS[leadId];

  const plotW = ECG_PLOT_W;
  const plotH = ECG_PLOT_H;
  const paddingX = ECG_PADDING_X;
  const paddingY = ECG_PADDING_Y;
  const width = ECG_CARD_WIDTH; // 156px 固定
  const height = plotH + paddingY * 2; // 85px 固定
  const midY = paddingY + plotH / 2; // 42.5px (上下それぞれ 40.5px = ±2.25 mV)
  const mVScale = ECG_MV_SCALE;

  const fullPathD = buildPeakPreservingPathD(points, 1.0, paddingX, midY, plotW, mVScale);
  const drawnPathD = buildPeakPreservingPathD(points, normalizedTime, paddingX, midY, plotW, mVScale);
  const normalPathD = normalPoints
    ? buildPeakPreservingPathD(normalPoints, 1.0, paddingX, midY, plotW, mVScale)
    : '';

  const currentX = paddingX + normalizedTime * plotW;

  let currentV = 0;
  if (points && points.length > 0) {
    const rawIdx = normalizedTime * (points.length - 1);
    const idx0 = Math.max(0, Math.min(Math.floor(rawIdx), points.length - 1));
    const idx1 = Math.max(0, Math.min(idx0 + 1, points.length - 1));
    const frac = rawIdx - idx0;
    const v0 = points[idx0]?.v ?? 0;
    const v1 = points[idx1]?.v ?? v0;
    currentV = v0 + (v1 - v0) * frac;
  }
  const currentDotY = midY - currentV * mVScale;

  return (
    <div
      onClick={() => onSelect(leadId)}
      className={`group relative rounded-lg border transition-colors duration-150 cursor-pointer overflow-hidden select-none shrink-0 ${
        isSelected
          ? 'bg-blue-50/40 border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
          : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
      }`}
      style={{ width: `${width}px` }}
    >
      {/* 誘導ヘッダー */}
      <div
        className={`flex items-center justify-between px-1.5 py-0.5 border-b transition-colors ${
          isSelected ? 'bg-blue-50/80 border-blue-200' : 'bg-slate-50/80 border-slate-200/80'
        }`}
      >
        <div className="flex items-center gap-1 min-w-0">
          <span
            className={`font-bold text-[10.5px] font-mono tracking-tight ${
              isSelected ? 'text-blue-700' : 'text-slate-900'
            }`}
          >
            {leadId}
          </span>
          <span
            className="text-[9px] text-slate-500 truncate max-w-[76px]"
            title={leadInfo?.targetRegion}
          >
            {leadInfo?.targetRegion}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: phaseColor }}
            title={phaseLabelJa}
          />
          <span className="text-[9px] font-mono text-slate-600 font-semibold">
            {currentV >= 0 ? `+${currentV.toFixed(2)}` : currentV.toFixed(2)}
          </span>
        </div>
      </div>

      {/* 心電図描画領域：薄い赤〜ピンク系の心電図用紙風グリッド (±2.25 mV = 9大マス) */}
      <div className="relative" style={{ height: `${height}px` }}>
        <svg width={width} height={height} className="w-full h-full bg-[#fffbfc] block">
          <defs>
            {/* 1mm相当 (1.8px) の細グリッド: 非常に薄い赤ピンク */}
            <pattern
              id={`ecg-minor-${leadId}`}
              width={ECG_SMALL_GRID_PX}
              height={ECG_SMALL_GRID_PX}
              patternUnits="userSpaceOnUse"
              x={paddingX}
              y={paddingY + (plotH / 2) % ECG_SMALL_GRID_PX}
            >
              <path
                d={`M ${ECG_SMALL_GRID_PX} 0 L 0 0 0 ${ECG_SMALL_GRID_PX}`}
                fill="none"
                stroke="#fce8ec"
                strokeWidth="0.35"
              />
            </pattern>
            {/* 5mm相当 (9px) の太グリッド: 低彩度の薄いピンク (0mV基線が正確に大マス境界線に一致) */}
            <pattern
              id={`ecg-major-${leadId}`}
              width={ECG_LARGE_GRID_PX}
              height={ECG_LARGE_GRID_PX}
              patternUnits="userSpaceOnUse"
              x={paddingX}
              y={paddingY + (plotH / 2) % ECG_LARGE_GRID_PX}
            >
              <rect
                width={ECG_LARGE_GRID_PX}
                height={ECG_LARGE_GRID_PX}
                fill={`url(#ecg-minor-${leadId})`}
              />
              <path
                d={`M ${ECG_LARGE_GRID_PX} 0 L 0 0 0 ${ECG_LARGE_GRID_PX}`}
                fill="none"
                stroke="#f7cdd6"
                strokeWidth="0.65"
              />
            </pattern>
            <clipPath id={`ecg-clip-${leadId}`}>
              <rect x={paddingX} y={paddingY} width={plotW} height={plotH} />
            </clipPath>
          </defs>

          {/* 心電図方眼紙グリッド */}
          <rect
            x={paddingX}
            y={paddingY}
            width={plotW}
            height={plotH}
            fill={`url(#ecg-major-${leadId})`}
          />

          {/* 0mV 等電位基線 */}
          <line
            x1={paddingX}
            y1={midY}
            x2={width - paddingX}
            y2={midY}
            stroke="#f1c0cb"
            strokeWidth="0.6"
            strokeDasharray="2,2"
          />

          <g clipPath={`url(#ecg-clip-${leadId})`}>
            {/* 正常比較波形（compareMode ON時のみ薄い点線で重ね表示） */}
            {compareMode && normalPathD && (
              <path
                d={normalPathD}
                fill="none"
                stroke="#64748b"
                strokeWidth="1.15"
                strokeDasharray="2.5,2.5"
                opacity="0.65"
              />
            )}

            {/* 波形全体の完成形（最初から薄い線で表示） */}
            <path
              d={fullPathD}
              fill="none"
              stroke={isSelected ? '#93c5fd' : '#cbd5e1'}
              strokeWidth="1.15"
              opacity="0.75"
            />

            {/* 現在時刻までの波形（濃く表示、選択誘導は太さとコントラストを強調） */}
            <path
              d={drawnPathD}
              fill="none"
              stroke={isSelected ? '#1d4ed8' : '#0f172a'}
              strokeWidth={isSelected ? '2.1' : '1.6'}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* 現在時刻の縦同期カーソル（全12誘導で完全同期） */}
          <line
            x1={currentX}
            y1={paddingY}
            x2={currentX}
            y2={height - paddingY}
            stroke="#dc2626"
            strokeWidth="1.1"
            opacity="0.85"
          />

          {/* 現在位置の小さなマーカー */}
          <circle cx={currentX} cy={currentDotY} r="2.2" fill="#dc2626" />
        </svg>
      </div>
    </div>
  );
};
