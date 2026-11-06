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
    // A short link (?plan=<id>) is looked up by the plan page.
    const id = q.get('plan');
    if (id && /^[0-9a-f]{12}$/.test(id)) keep.set('id', id);
    for (const k of ['p', 'lv', 'ph', 'by', 'b']) { const v = q.get(k); if (v != null) keep.set(k, v); }
    const daily = q.has('daily');
    const isPlan = keep.has('p') || keep.has('id');
    if (!isPlan && !daily && !s) return;
    const hash = isPlan ? '#plan?' + keep.toString() : daily ? '#daily' : location.hash;
    // A link through a preview page (/p/<kind>/) lands on the game's root.
    history.replaceState(null, '', location.pathname.replace(/p\/[^/]+\/?$/, '') + hash);
  } catch { /* not allowed in this frame */ }
}
