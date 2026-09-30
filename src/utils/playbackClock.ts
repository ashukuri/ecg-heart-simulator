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
