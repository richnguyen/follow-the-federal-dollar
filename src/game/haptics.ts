import { useCallback } from 'react';
import { useJourney } from './state';

// Light haptic feedback on phones that support the Vibration API (most Android browsers; not iOS
// Safari). Short, quiet patterns: a tick for a right answer, a soft double tap for a miss, a
// small flourish for a finished level. Off with one switch in settings.

const PATTERN = {
  tap: 8,
  right: [16],
  wrong: [28, 60, 28],
  vote: [12],
  card: [10],
  win: [22, 70, 22, 70, 60],
  medal: [14, 50, 14],
} as const;
export type Haptic = keyof typeof PATTERN;

export const hapticsSupported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function useHaptics() {
  const { settings } = useJourney();
  return useCallback((kind: Haptic) => {
    if (!settings.haptics || !hapticsSupported) return;
    try { navigator.vibrate(PATTERN[kind] as number | number[]); } catch { /* blocked, e.g. inside a frame */ }
  }, [settings.haptics]);
}
