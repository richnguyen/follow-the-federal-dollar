import { useEffect, useState } from 'react';
import { myName, setMyName, useMyName } from './plans';

/** The player's first name, asked once and used wherever it makes a card or a challenge personal. */
export function NameField({ id, label = 'Your first name (optional)', hint, onDone }: { id: string; label?: string; hint?: string; onDone?: (name: string) => void }) {
  const stored = useMyName();
  const [v, setV] = useState(myName);
  // Another box on the page (or another tab) changed it.
  useEffect(() => { if (stored !== v.trim()) setV(stored); }, [stored]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="field namefield">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" value={v} maxLength={24} placeholder="First name" autoComplete="given-name" enterKeyHint="done"
        onChange={(e) => { setV(e.target.value); setMyName(e.target.value); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); onDone?.(myName()); } }} />
      {hint && <p className="small muted">{hint}</p>}
    </div>
  );
}
