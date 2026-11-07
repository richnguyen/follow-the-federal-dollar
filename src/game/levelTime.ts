import { useEffect } from 'react';
import { load, save } from '../lib/storage';

// How long the player spent on each level: active time only (the screen showing the level), so a
// level left open overnight doesn't count the night. Kept in this browser. Shown on the level's
// certificate ("in 4 minutes"); a replay from the start counts afresh.

type Times = Record<string, { s: number; done?: number }>;
const all = () => load<Times>('level-time', {});

/** Counts active seconds on a level while the component using it is on screen. */
export function useLevelTimer(level: string, running: boolean) {
  useEffect(() => {
    if (!running) return;
    let since = document.hidden ? 0 : Date.now();
    const flush = () => {
      if (!since) return;
      const t = all();
      const cur = t[level] ?? { s: 0 };
      t[level] = { ...cur, s: cur.s + Math.min(3600, (Date.now() - since) / 1000) };
      save('level-time', t);
      since = document.hidden ? 0 : Date.now();
    };
    const vis = () => { if (document.hidden) flush(); else since = Date.now(); };
    document.addEventListener('visibilitychange', vis);
    const iv = setInterval(flush, 15000);
    return () => { flush(); clearInterval(iv); document.removeEventListener('visibilitychange', vis); };
  }, [level, running]);
}

/** Starting a level over: the clock starts again. */
export function resetLevelTime(level: string) {
  const t = all();
  delete t[level];
  save('level-time', t);
}

/** The level is finished: keep the time it took (in whole minutes, at least 1). */
export function finishLevelTime(level: string, extraSeconds = 0) {
  const t = all();
  const cur = t[level] ?? { s: 0 };
  const mins = Math.max(1, Math.round((cur.s + extraSeconds) / 60));
  t[level] = { s: 0, done: mins };
  save('level-time', t);
  return mins;
}

/** Minutes the last finish took, if known and believable (under two hours). */
export function levelMinutes(level: string) {
  const m = all()[level]?.done;
  return m && m < 120 ? m : null;
}
