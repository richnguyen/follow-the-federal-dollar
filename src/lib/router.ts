import { useEffect, useState } from 'react';

// Routes are plain hash names (#spending, #state-ca) so links work on any static host
// and inside a claude.ai artifact.
export const ROUTES = [
  'journey', 'level-1', 'level-2', 'level-3', 'level-4', 'level-5', 'level-6', 'level-7', 'level-8',
  'level-9', 'level-10',
  'overview', 'spending', 'revenue', 'gap', 'debt', 'laws', 'process', 'state', 'social-security',
  'receipt', 'glossary', 'sources', 'results',
] as const;
export type Route = (typeof ROUTES)[number];

export function parseHash(hash: string): { route: Route; param: string | null } {
  const h = hash.replace(/^#/, '').toLowerCase();
  if (h.startsWith('state-')) return { route: 'state', param: h.slice(6) };
  if (h.startsWith('sources-')) return { route: 'sources', param: h.slice(8) };
  // Links from earlier versions: the budget desk's separate missions and its free-play page.
  const legacy: Record<string, Route> = { 'desk-normal': 'level-5', 'desk-hard': 'level-8', 'desk-expert': 'level-10', sandbox: 'level-10' };
  if (legacy[h]) {
    try { history.replaceState(null, '', '#' + legacy[h]); } catch { /* not allowed in this frame */ }
    return { route: legacy[h], param: null };
  }
  if ((ROUTES as readonly string[]).includes(h)) return { route: h as Route, param: null };
  return { route: 'journey', param: null };
}

export function useHashRoute() {
  const [loc, setLoc] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setLoc(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return loc;
}

export function go(hash: string) {
  if (window.location.hash !== '#' + hash) window.location.hash = hash;
}
