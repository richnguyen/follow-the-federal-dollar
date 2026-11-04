import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

// Citizen voting, backed by the claude.ai artifact's shared database (`db` capability).
// Each voter keeps one ballot document at votes/<their id>; everyone who can open the page
// reads all ballots to count them. On the standalone site (no window.claude) voting with others
// is unavailable; choices are still kept locally so the game can continue.

export type Choice = 1 | -1;
export interface Ballot {
  options: Record<string, Choice>; // support / oppose on policy cards
  plan: string | null; // favorite ready-made plan
  issues: Record<string, string>; // single-choice questions, e.g. { goal: 'stabilize' }
  updated: string;
}
export interface Tally { support: number; oppose: number }

export interface VoteState {
  available: boolean;
  canVote: boolean | null;
  loading: boolean;
  stale: boolean;
  error: string | null;
  mine: Ballot;
  voters: number;
  options: Record<string, Tally>;
  plans: Record<string, number>;
  issues: Record<string, Record<string, number>>;
}

const EMPTY: Ballot = { options: {}, plan: null, issues: {}, updated: '' };

type Votes = VoteState & {
  voteOption: (id: string, choice: Choice) => void;
  votePlan: (plan: string) => void;
  voteIssue: (id: string, value: string) => void;
};

const Ctx = createContext<Votes | null>(null);

/* eslint-disable @typescript-eslint/no-explicit-any */
export function VotesProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<VoteState>({ available: false, canVote: null, loading: true, stale: false, error: null, mine: EMPTY, voters: 0, options: {}, plans: {}, issues: {} });
  const dbRef = useRef<any>(null);
  const uidRef = useRef<string | null>(null);
  const writing = useRef(false);
  const pending = useRef<Ballot | null>(null);
  const mineRef = useRef<Ballot>(EMPTY);

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
          const issues: Record<string, Record<string, number>> = {};
          let mine: Ballot = EMPTY;
          for (const d of snap.docs) {
            const b = d.data() as Partial<Ballot> | undefined;
            if (!b) continue;
            if (d.id === uid) mine = { options: { ...(b.options ?? {}) }, plan: b.plan ?? null, issues: { ...(b.issues ?? {}) }, updated: b.updated ?? '' };
            for (const [k, v] of Object.entries(b.options ?? {})) {
              const t = (options[k] ??= { support: 0, oppose: 0 });
              if (v === 1) t.support++;
              else if (v === -1) t.oppose++;
            }
            if (typeof b.plan === 'string') plans[b.plan] = (plans[b.plan] ?? 0) + 1;
            for (const [k, v] of Object.entries(b.issues ?? {})) {
              if (typeof v !== 'string') continue;
              const t = (issues[k] ??= {});
              t[v] = (t[v] ?? 0) + 1;
            }
          }
          if (!snap.metadata?.fromCache && timer) { clearTimeout(timer); timer = null; }
          const m = pending.current ?? mine;
          mineRef.current = m;
          setS((p) => ({ ...p, loading: false, stale: snap.metadata?.fromCache ? p.stale : false, voters: snap.size, options, plans, issues, mine: m }));
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
    mineRef.current = next;
    pending.current = next;
    setS((p) => ({ ...p, mine: next }));
    void flush();
  }, [flush]);

  const voteOption = useCallback((id: string, choice: Choice) => {
    const cur = mineRef.current;
    const opts = { ...cur.options };
    if (opts[id] === choice) delete opts[id];
    else opts[id] = choice;
    write({ ...cur, options: opts, updated: new Date().toISOString() });
  }, [write]);

  const votePlan = useCallback((plan: string) => {
    const cur = mineRef.current;
    write({ ...cur, plan: cur.plan === plan ? null : plan, updated: new Date().toISOString() });
  }, [write]);

  const voteIssue = useCallback((id: string, value: string) => {
    const cur = mineRef.current;
    const issues = { ...cur.issues };
    if (issues[id] === value) delete issues[id];
    else issues[id] = value;
    write({ ...cur, issues, updated: new Date().toISOString() });
  }, [write]);

  return <Ctx.Provider value={{ ...s, voteOption, votePlan, voteIssue }}>{children}</Ctx.Provider>;
}

export function useVotes(): Votes {
  const v = useContext(Ctx);
  if (!v) throw new Error('VotesProvider missing');
  return v;
}
