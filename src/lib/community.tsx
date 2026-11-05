import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LEVELS } from '../game/levels';
import { useJourney } from '../game/state';

// How everyone played, from the claude.ai artifact's shared database (`db` capability). Each
// player keeps one anonymous record at players/<their id>: which levels they finished, their
// stars, whether each quick check was right on the first try, and their medals. No names or
// answers to the votes (those are in votes/<id>). Every page reads all records to show totals.
// On the standalone site there is no shared database, so only the player's own record exists.

export interface PlayerRecord {
  v: 1;
  done: string[];
  stars: Record<string, number>;
  firstTry: Record<string, boolean>;
  medals: string[];
  updated: string;
}

export interface CommunityState {
  available: boolean;
  canWrite: boolean | null;
  loading: boolean;
  stale: boolean;
  error: string | null;
  players: PlayerRecord[]; // everyone's records, including this player's latest
}

const Ctx = createContext<CommunityState | null>(null);
const QUIZ_IDS = LEVELS.flatMap((l) => l.steps.filter((s) => s.quiz).map((s) => s.quiz!.id));

/* eslint-disable @typescript-eslint/no-explicit-any */
export function CommunityProvider({ children }: { children: ReactNode }) {
  const j = useJourney();
  const [s, setS] = useState<CommunityState>({ available: false, canWrite: null, loading: true, stale: false, error: null, players: [] });
  const dbRef = useRef<any>(null);
  const uidRef = useRef<string | null>(null);
  const sent = useRef('');
  const others = useRef<PlayerRecord[]>([]);

  // This player's record, from their journey.
  const mine = useMemo<PlayerRecord>(() => ({
    v: 1,
    done: [...j.done].sort(),
    stars: Object.fromEntries(Object.entries(j.stars).filter(([, n]) => n > 0)),
    firstTry: Object.fromEntries(QUIZ_IDS.filter((q) => j.quiz[q]).map((q) => [q, !!(j.quiz[q].correct && j.quiz[q].tries === 1)])),
    medals: [...j.medals].sort(),
    updated: '',
  }), [j.done, j.stars, j.quiz, j.medals]);
  const played = mine.done.length > 0 || Object.keys(mine.firstTry).length > 0;

  useEffect(() => {
    const c = (window as any).claude;
    if (!c?.use) { setS((p) => ({ ...p, loading: false })); return; }
    let unsub: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    (async () => {
      const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
      if (cancelled || !db) { setS((p) => ({ ...p, loading: false })); return; }
      const uid = user ? await user.id() : null;
      const can = user ? await user.can('data.write') : null;
      if (cancelled) return;
      dbRef.current = db;
      uidRef.current = uid;
      setS((p) => ({ ...p, available: true, canWrite: uid ? can : false }));
      timer = setTimeout(() => setS((p) => ({ ...p, stale: true })), 10000);
      unsub = db.collection('players').onSnapshot(
        (snap: any) => {
          const list: PlayerRecord[] = [];
          for (const d of snap.docs) {
            if (d.id === uid) continue; // this player's own record comes from their journey
            const r = d.data() as Partial<PlayerRecord> | undefined;
            if (!r || !Array.isArray(r.done)) continue;
            list.push({ v: 1, done: r.done.filter((x) => typeof x === 'string'), stars: r.stars ?? {}, firstTry: r.firstTry ?? {}, medals: Array.isArray(r.medals) ? r.medals : [], updated: r.updated ?? '' });
          }
          others.current = list;
          if (!snap.metadata?.fromCache && timer) { clearTimeout(timer); timer = null; }
          setS((p) => ({ ...p, loading: false, stale: snap.metadata?.fromCache ? p.stale : false, players: list }));
        },
        (e: any) => {
          if (timer) { clearTimeout(timer); timer = null; }
          setS((p) => ({ ...p, loading: false, error: e?.code === 'revoked' ? null : 'Results from other players can’t be loaded right now.' }));
        },
      );
    })();
    return () => { cancelled = true; unsub?.(); if (timer) clearTimeout(timer); };
  }, []);

  // Save this player's record when it changes (a few seconds after, one write at a time).
  useEffect(() => {
    if (!s.available || s.canWrite === false || !played) return;
    const body = JSON.stringify({ ...mine, updated: '' });
    if (body === sent.current) return;
    const t = setTimeout(async () => {
      const db = dbRef.current, uid = uidRef.current;
      if (!db || !uid) return;
      try {
        await db.doc('players/' + uid).set({ ...mine, updated: new Date().toISOString() });
        sent.current = body;
      } catch (e: any) {
        if (e?.code === 'not_granted' || e?.code === 'invalid_argument') setS((p) => ({ ...p, canWrite: false }));
        else if (e?.code === 'quota_exceeded') setS((p) => ({ ...p, error: 'The results store is full, so new results can’t be saved.' }));
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [s.available, s.canWrite, played, mine]);

  const value = useMemo(() => ({ ...s, players: played ? [...s.players, mine] : s.players }), [s, played, mine]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCommunity(): CommunityState {
  const v = useContext(Ctx);
  if (!v) throw new Error('CommunityProvider missing');
  return v;
}
