import { load, save } from '../lib/storage';
import type { SharedPlan } from './plans';

// The challenge a player accepted from a friend's link, kept in this browser until they finish
// or drop it. Only one at a time.

export interface Challenge { plan: SharedPlan; at: string }

export const activeChallenge = (): Challenge | null => load<Challenge | null>('challenge', null);
export const acceptChallenge = (plan: SharedPlan) => { save('challenge', { plan, at: new Date().toISOString() }); window.dispatchEvent(new Event('ftd-challenge')); };
export const dropChallenge = () => { save('challenge', null); window.dispatchEvent(new Event('ftd-challenge')); };

/** Read once on load: a plan link (?p=…) opens the friend's plan, and its channel tag is kept as the first-touch source. */
export function takeLinkFromSearch() {
  try {
    const q = new URLSearchParams(location.search);
    const s = q.get('s');
    if (s && /^[a-z0-9-]{1,16}$/.test(s) && !load<string>('src', '')) save('src', s);
    const keep = new URLSearchParams();
    for (const k of ['p', 'lv', 'ph', 'by', 'b']) { const v = q.get(k); if (v != null) keep.set(k, v); }
    const daily = q.has('daily');
    if (!keep.has('p') && !daily && !s) return;
    const hash = keep.has('p') ? '#plan?' + keep.toString() : daily ? '#daily' : location.hash;
    history.replaceState(null, '', location.pathname + hash);
  } catch { /* not allowed in this frame */ }
}
