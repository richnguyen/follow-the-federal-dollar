import { useState } from 'react';
import { Seg } from '../components/ui';
import { type TextSize, type ThemeChoice, useJourney } from './state';

/** Reading and play settings: text size, theme, read-aloud, and free roam. */
export function ReadingSettings({ compact = false }: { compact?: boolean }) {
  const j = useJourney();
  const s = j.settings;
  const speech = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [confirm, setConfirm] = useState(false);
  return (
    <div className={'settings' + (compact ? ' compact' : '')}>
      <div className="settings-row">
        <span className="stat-label">Text size</span>
        <Seg<TextSize> label="Text size" value={s.text} onChange={(v) => j.setSettings({ text: v })} options={[{ value: 'normal', label: 'Standard' }, { value: 'large', label: 'Large' }, { value: 'larger', label: 'Larger' }]} />
      </div>
      <div className="settings-row">
        <span className="stat-label">Theme</span>
        <Seg<ThemeChoice> label="Theme" value={s.theme} onChange={(v) => j.setSettings({ theme: v })} options={[{ value: 'system', label: 'Automatic' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      </div>
      <label className="switch"><input type="checkbox" checked={s.narration && speech} disabled={!speech} onChange={(e) => j.setSettings({ narration: e.target.checked })} /> Read Uncle Sam’s lines aloud on request{!speech && ' (not supported in this browser)'}</label>
      <label className="switch"><input type="checkbox" checked={s.freeRoam} onChange={(e) => j.setSettings({ freeRoam: e.target.checked })} /> Free roam: unlock every level</label>
      {!compact && (
        <div>
          <button type="button" className="btn" onClick={() => { if (confirm) { j.reset(); setConfirm(false); } else setConfirm(true); }} onBlur={() => setConfirm(false)}>
            {confirm ? 'Click again to erase your progress' : 'Start the journey over'}
          </button>
        </div>
      )}
    </div>
  );
}
