import { createContext, useContext, useState, type ReactNode } from 'react';
import { HH, POP } from '../data';
import { dollars, money } from './format';
import { load, save } from './storage';

// Global "per-person framing": every total can be shown as-is, per person, or per household.
export type UnitMode = 'total' | 'person' | 'household';

interface Units {
  mode: UnitMode;
  setMode: (m: UnitMode) => void;
  /** Convert a national total to the current unit. */
  conv: (v: number) => number;
  /** Format a national total in the current unit. */
  fmt: (v: number) => string;
  suffix: string;
}

const Ctx = createContext<Units | null>(null);

export function UnitsProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<UnitMode>(() => load<UnitMode>('units', 'total'));
  const setMode = (m: UnitMode) => {
    setModeState(m);
    save('units', m);
  };
  const div = mode === 'person' ? POP : mode === 'household' ? HH : 1;
  const conv = (v: number) => v / div;
  const fmt = (v: number) => {
    const x = v / div;
    return mode === 'total' ? money(x) : dollars(x);
  };
  const suffix = mode === 'person' ? ' per person' : mode === 'household' ? ' per household' : '';
  return <Ctx.Provider value={{ mode, setMode, conv, fmt, suffix }}>{children}</Ctx.Provider>;
}

export function useUnits() {
  const u = useContext(Ctx);
  if (!u) throw new Error('UnitsProvider missing');
  return u;
}

/** Per-person and per-household helpers that ignore the global mode. */
export const perPerson = (v: number) => v / POP;
export const perHousehold = (v: number) => v / HH;
