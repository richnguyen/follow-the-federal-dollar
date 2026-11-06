import { load, save } from '../lib/storage';

// When the game is installed on a phone's home screen and reopened, it drops the player back
// into the level they were playing (within a day), instead of the road map. A normal visit to
// the website still opens wherever its link points.

const DAY = 24 * 60 * 60 * 1000;

export const isInstalled = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

/** Remember the level being played. */
export function noteLevel(route: string) {
  if (/^level-\d+$/.test(route)) save('last-level', { route, at: Date.now() });
}

export function resumeInstalledApp() {
  if (!isInstalled() || (location.hash && location.hash !== '#' && location.hash !== '#journey')) return;
  const last = load<{ route: string; at: number } | null>('last-level', null);
  if (!last || Date.now() - last.at > DAY || !/^level-\d+$/.test(last.route)) return;
  const done = load<{ done?: string[] }>('journey', {}).done ?? [];
  if (done.includes(last.route)) return;
  location.replace('#' + last.route);
}
