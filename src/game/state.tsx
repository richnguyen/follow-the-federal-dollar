import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { load, save } from '../lib/storage';

// The player's journey: which levels are done, quiz attempts, their choices on each level's
// issue, and reading settings. Kept in this browser only (a per-viewer convenience).

export type TextSize = 'normal' | 'large' | 'larger';
export type ThemeChoice = 'system' | 'light' | 'dark';

export interface JourneyState {
  done: string[]; // completed level ids (level-1 … level-7, desk-normal …)
  steps: Record<string, number[]>; // completed step indexes per level
  quiz: Record<string, { tries: number; correct: boolean }>; // by quiz id
  choices: Record<string, string>; // local record of the player's vote on each issue
  started: string | null;
  settings: { text: TextSize; theme: ThemeChoice; freeRoam: boolean; narration: boolean };
}

const DEFAULT: JourneyState = {
  done: [],
  steps: {},
  quiz: {},
  choices: {},
  started: null,
  settings: { text: 'normal', theme: 'system', freeRoam: false, narration: true },
};

interface Journey extends JourneyState {
  completeStep: (level: string, step: number) => void;
  completeLevel: (level: string) => void;
  answer: (quizId: string, correct: boolean) => void;
  choose: (issueId: string, value: string) => void;
  setSettings: (s: Partial<JourneyState['settings']>) => void;
  start: () => void;
  reset: () => void;
}

const Ctx = createContext<Journey | null>(null);

export function JourneyProvider({ children }: { children: ReactNode }) {
  const [st, setSt] = useState<JourneyState>(() => {
    const s = load<Partial<JourneyState>>('journey', {});
    return { ...DEFAULT, ...s, settings: { ...DEFAULT.settings, ...(s.settings ?? {}) } };
  });
  const update = (f: (p: JourneyState) => JourneyState) => setSt((p) => { const n = f(p); save('journey', n); return n; });

  // Reading settings apply to the whole page. "System" restores whatever theme the host set
  // (the claude.ai viewer sets data-theme itself), so the page never clears the host's choice.
  const hostTheme = useRef<string | undefined>(document.documentElement.dataset.theme);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.text = st.settings.text;
    if (st.settings.theme === 'system') {
      if (hostTheme.current) root.dataset.theme = hostTheme.current;
      else delete root.dataset.theme;
    } else root.dataset.theme = st.settings.theme;
  }, [st.settings.text, st.settings.theme]);

  const value: Journey = {
    ...st,
    completeStep: (level, step) => update((p) => {
      const cur = p.steps[level] ?? [];
      return cur.includes(step) ? p : { ...p, steps: { ...p.steps, [level]: [...cur, step] } };
    }),
    completeLevel: (level) => update((p) => (p.done.includes(level) ? p : { ...p, done: [...p.done, level] })),
    answer: (quizId, correct) => update((p) => {
      const q = p.quiz[quizId] ?? { tries: 0, correct: false };
      return { ...p, quiz: { ...p.quiz, [quizId]: { tries: q.tries + 1, correct: q.correct || correct } } };
    }),
    choose: (issueId, v) => update((p) => ({ ...p, choices: { ...p.choices, [issueId]: v } })),
    setSettings: (s) => update((p) => ({ ...p, settings: { ...p.settings, ...s } })),
    start: () => update((p) => (p.started ? p : { ...p, started: new Date().toISOString() })),
    reset: () => update((p) => ({ ...DEFAULT, settings: p.settings })),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useJourney() {
  const j = useContext(Ctx);
  if (!j) throw new Error('JourneyProvider missing');
  return j;
}
