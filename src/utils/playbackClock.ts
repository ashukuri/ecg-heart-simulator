import { advanceMasterTimeSec, EDUCATION_TIME_SCALE } from './ecgGenerator';

export const PLAYBACK_SPEEDS = [0.25, 0.5, 1] as const;
export type PlaybackSpeed = typeof PLAYBACK_SPEEDS[number];

// Change only wall-clock playback speed. All views still share physiological time.
export function advancePlaybackTimeSec(
  currentTimeSec: number,
  realDeltaSec: number,
  scenarioDurationSec: number,
  speed: PlaybackSpeed,
): number {
  return advanceMasterTimeSec(
    currentTimeSec, realDeltaSec * (speed / EDUCATION_TIME_SCALE), scenarioDurationSec,
  );
}

// Seeking includes both endpoints; resuming from the end uses the normal loop.
export function clampPlaybackTimeSec(timeSec: number, durationSec: number): number {
  if (!Number.isFinite(timeSec)) return 0;
  return Math.min(Math.max(0, timeSec), Math.max(0, durationSec));
}
