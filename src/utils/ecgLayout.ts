import type { ECGLeadId } from '../types';

export type ECGLayoutMode = 'recording' | 'standard';
export interface CardPosition { x: number; y: number }

export const STANDARD_LEAD_ROWS: ECGLeadId[][] = [
  ['I', 'aVR', 'V1', 'V4'],
  ['II', 'aVL', 'V2', 'V5'],
  ['III', 'aVF', 'V3', 'V6'],
];

// Positions in the existing SVG/card coordinate scale: ECG paper calibration
// and the physiological timeline are independent of the display arrangement.
export const RECORDING_LEAD_POSITIONS: Record<ECGLeadId, CardPosition> = {
  aVR: { x: 0, y: 50 }, V1: { x: 0, y: 162 },
  V2: { x: 0, y: 274 }, V3: { x: 0, y: 386 },
  II: { x: 164, y: 418 }, aVF: { x: 326, y: 418 }, III: { x: 488, y: 418 },
  aVL: { x: 652, y: 0 }, I: { x: 652, y: 109 },
  V4: { x: 652, y: 218 }, V5: { x: 652, y: 327 }, V6: { x: 652, y: 436 },
};

export const STANDARD_LEAD_POSITIONS = Object.fromEntries(
  STANDARD_LEAD_ROWS.flatMap((row, rowIndex) => row.map((lead, columnIndex) => [
    lead, { x: 356 + columnIndex * 162, y: 102 + rowIndex * 112 },
  ])),
) as Record<ECGLeadId, CardPosition>;
