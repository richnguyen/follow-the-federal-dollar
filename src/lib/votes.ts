import { useCallback, useEffect, useRef, useState } from 'react';

// Citizen voting, backed by the claude.ai artifact's shared database (`db` capability).
// Each voter keeps one ballot document at votes/<their id>; everyone who can open the page
// reads all ballots to count them. On the standalone site (no window.claude) voting is hidden.

export type Choice = 1 | -1;
export interface Ballot { options: Record<string, Choice>; plan: string | null; updated: string }
export interface Tally { support: number; oppose: number }

export interface VoteState {
  available: boolean; // the page can reach the shared store
  canVote: boolean | null; // null = not told; keep controls and let a refused write decide
  loading: boolean;
  stale: boolean; // store not reached within 10 s
  error: string | null;
  mine: Ballot;
  voters: number;
  options: Record<string, Tally>;
  plans: Record<string, number>;
}

const EMPTY: Ballot = { options: {}, plan: null, updated: '' };

/* eslint-disable @typescript-eslint/no-explicit-any */
export function useVotes() {
  const [s, setS] = useState<VoteState>({ available: false, canVote: null, loading: true, stale: false, error: null, mine: EMPTY, voters: 0, options: {}, plans: {} });
  const dbRef = useRef<any>(null);
  const uidRef = useRef<string | null>(null);
  const writing = useRef(false);
  const pending = useRef<Ballot | null>(null);

  useEffect(() => {
    const c = (window as any).claude;
    if (!c?.use) { setS((p) => ({ ...p, loading: false })); return; }
    let unsub: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    (async () => {
      const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
      if (cancelled) return;
      if (!db) { setS((p) => ({ ...p, loading: false })); return; }
      const uid = user ? await user.id() : null;
      const can = user ? await user.can('data.write') : null;
      if (cancelled) return;
      dbRef.current = db;
      uidRef.current = uid;
      setS((p) => ({ ...p, available: true, canVote: uid ? can : false }));
      timer = setTimeout(() => setS((p) => ({ ...p, stale: true })), 10000);
      unsub = db.collection('votes').onSnapshot(
        (snap: any) => {
          const options: Record<string, Tally> = {};
          const plans: Record<string, number> = {};
          let mine: Ballot = EMPTY;
          for (const d of snap.docs) {
            const b = d.data() as Partial<Ballot> | undefined;
            if (!b) continue;
            if (d.id === uid) mine = { options: { ...(b.options ?? {}) }, plan: b.plan ?? null, updated: b.updated ?? '' };
            for (const [k, v] of Object.entries(b.options ?? {})) {
              const t = (options[k] ??= { support: 0, oppose: 0 });
              if (v === 1) t.support++;
              else if (v === -1) t.oppose++;
            }
            if (typeof b.plan === 'string') plans[b.plan] = (plans[b.plan] ?? 0) + 1;
          }
          if (!snap.metadata?.fromCache && timer) { clearTimeout(timer); timer = null; }
          setS((p) => ({ ...p, loading: false, stale: snap.metadata?.fromCache ? p.stale : false, voters: snap.size, options, plans, mine: pending.current ?? mine }));
        },
        (e: any) => {
          if (timer) { clearTimeout(timer); timer = null; }
          setS((p) => ({ ...p, loading: false, error: e?.code === 'revoked' ? null : 'Vote counts are unavailable right now.' }));
        },
      );
    })();
    return () => {
      cancelled = true;
      unsub?.();
      if (timer) clearTimeout(timer);
    };
  }, []);

  // One write at a time to the ballot; a burst of clicks collapses into the latest ballot.
  const flush = useCallback(async () => {
    const db = dbRef.current;
    const uid = uidRef.current;
    if (!db || !uid || writing.current || !pending.current) return;
    writing.current = true;
    while (pending.current) {
      const b = pending.current;
      pending.current = null;
      try {
        await db.doc('votes/' + uid).set(b);
      } catch (e: any) {
        if (e?.code === 'invalid_argument' || e?.code === 'not_granted') setS((p) => ({ ...p, canVote: false }));
        else if (e?.code === 'quota_exceeded') setS((p) => ({ ...p, error: 'The vote store is full, so new votes can’t be saved.' }));
        else setS((p) => ({ ...p, error: 'Your vote could not be saved. Try again in a moment.' }));
        break;
      }
    }
    writing.current = false;
  }, []);

  const write = useCallback((next: Ballot) => {
    pending.current = next;
    setS((p) => ({ ...p, mine: next }));
    void flush();
  }, [flush]);

  const voteOption = useCallback((id: string, choice: Choice) => {
    setS((p) => {
      const opts = { ...p.mine.options };
      if (opts[id] === choice) delete opts[id];
      else opts[id] = choice;
      const next = { ...p.mine, options: opts, updated: new Date().toISOString() };
      queueMicrotask(() => write(next));
      return p;
    });
  }, [write]);

  const votePlan = useCallback((plan: string) => {
    setS((p) => {
      const next = { ...p.mine, plan: p.mine.plan === plan ? null : plan, updated: new Date().toISOString() };
      queueMicrotask(() => write(next));
      return p;
    });
  }, [write]);

  return { ...s, voteOption, votePlan };
}
