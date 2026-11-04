import { useId, useState } from 'react';
import { Seg } from '../components/ui';
import { type TextSize, type ThemeChoice, useJourney } from './state';
import { hasRecordings, isMaleVoice, pickVoice, useNarrator } from './voice';
import { hapticsSupported } from './haptics';
import { VOICE_TEST } from './script';

/** Reading and play settings: text size, theme, Uncle Sam's voice, and free roam. */
export function ReadingSettings({ compact = false }: { compact?: boolean }) {
  const j = useJourney();
  const n = useNarrator();
  const s = j.settings;
  const [confirm, setConfirm] = useState(false);
  const vid = useId();
  const us = n.voices.filter((v) => /^en[-_]US/i.test(v.lang));
  const others = n.voices.filter((v) => !/^en[-_]US/i.test(v.lang));
  const auto = pickVoice(n.voices);
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
      <label className="switch"><input type="checkbox" checked={s.narration && n.supported} disabled={!n.supported} onChange={(e) => { if (!e.target.checked) n.stop(); j.setSettings({ narration: e.target.checked }); }} /> Uncle Sam speaks his lines as you play{!n.supported && ' (not supported in this browser)'}</label>
      {n.supported && !compact && (
        <div className="settings-row">
          <label className="stat-label" htmlFor={vid}>Voice</label>
          <select id={vid} className="select" style={{ maxWidth: 360 }} value={s.voice} onChange={(e) => j.setSettings({ voice: e.target.value })}>
            <option value="auto">{hasRecordings ? 'Uncle Sam’s own voice (natural, recommended)' : `Automatic: best U.S. English voice${auto ? ` (${auto.name})` : ''}`}</option>
            {us.length > 0 && <optgroup label="Your device’s voices: U.S. English">{us.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}</optgroup>}
            {others.length > 0 && <optgroup label="Your device’s voices: other English">{others.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}</optgroup>}
          </select>
          <button type="button" className="btn" onClick={() => n.speak('voice-test', VOICE_TEST, 'happy')}>Test the voice</button>
        </div>
      )}
      {n.supported && !compact && (
        <p className="small muted">{n.recorded
          ? 'Uncle Sam’s lines were recorded with Kokoro, an open-source neural voice model, so he sounds the same on every device.'
          : n.voice && !isMaleVoice(n.voice)
            ? `Using ${n.voice.name}, a voice from your device. Your device has no male U.S. English voice; adding one in your system’s speech settings makes it available here.`
            : 'Device voices vary in quality; the natural and enhanced ones sound most like a person.'}</p>
      )}
      {hapticsSupported && <label className="switch"><input type="checkbox" checked={s.haptics} onChange={(e) => j.setSettings({ haptics: e.target.checked })} /> Gentle vibration on answers and wins (this device supports it)</label>}
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
