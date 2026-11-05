import { useEffect, useRef, useState } from 'react';
import { BADGES, loadProgress } from '../lib/game';
import { AwardIcon, LevelIcon, SpeakerIcon } from './icons';
import { isUnlocked, MAX_STARS, rankFor, STOP_BY_ID, STOPS } from './levels';
import { MEDALS } from './medals';
import { useJourney } from './state';
import { useNarrator } from './voice';

// The player's standing, always in view: current level, the ten-level track (green = finished),
// stars, title, accomplishments, a one-tap way back into play, and Uncle Sam's voice switch.

/** Budget-desk badges are saved by the desk itself; re-read them whenever it saves. */
function useDeskBadges() {
  const [b, setB] = useState(() => loadProgress().badges);
  useEffect(() => {
    const on = () => setB(loadProgress().badges);
    window.addEventListener('ftd-progress', on);
    return () => window.removeEventListener('ftd-progress', on);
  }, []);
  return b;
}

export function StatusBar({ route, compact = false }: { route: string; compact?: boolean }) {
  const j = useJourney();
  const n = useNarrator();
  const desk = useDeskBadges();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const done = STOPS.filter((s) => j.done.includes(s.id)).length;
  const stars = STOPS.reduce((a, s) => a + (j.stars[s.id] ?? 0), 0);
  const next = STOPS.find((s) => !j.done.includes(s.id) && isUnlocked(s.id, j.done, j.settings.freeRoam));
  const here = STOP_BY_ID[route];
  const focus = here ?? next ?? STOPS[STOPS.length - 1];
  const rank = rankFor(done);
  const voiceOn = j.settings.narration;
  const earned = j.medals.length + BADGES.filter((b) => desk.includes(b.id)).length;
  const total = MEDALS.length + BADGES.length;
  const toggleVoice = () => {
    if (voiceOn) n.stop();
    j.setSettings({ narration: !voiceOn });
  };
  useEffect(() => { setOpen(false); }, [route]);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc); };
  }, [open]);
  const focusDone = j.done.includes(focus.id);
  return (
    <div className={'statusbar' + (compact ? ' compact' : '')} role="group" aria-label="Your progress">
      <a className="stb-level" href={'#' + focus.id} aria-label={`Level ${focus.n} of ${STOPS.length}: ${focus.title}${focusDone ? ', finished' : ''}`}>
        <span className="stb-icon" data-done={focusDone}><LevelIcon id={focus.icon} size={compact ? 16 : 18} /></span>
        <span><span className="stb-k">Level</span> <strong className="num">{focus.n}</strong><span className="muted num">/{STOPS.length}</span></span>
      </a>
      <span className="stb-track" role="progressbar" aria-valuemin={0} aria-valuemax={STOPS.length} aria-valuenow={done} aria-label={`${done} of ${STOPS.length} levels finished`}>
        {STOPS.map((s) => <i key={s.id} data-done={j.done.includes(s.id)} data-here={s.id === focus.id} />)}
      </span>
      <span className="stb-stars" aria-label={`${stars} of ${MAX_STARS} stars`}><span aria-hidden="true">★</span> <strong className="num">{stars}</strong>{!compact && <span className="muted num">/{MAX_STARS}</span>}</span>
      <div className="stb-acc" ref={box}>
        <button type="button" className="stb-acc-btn" aria-expanded={open} aria-haspopup="dialog" aria-label={`Accomplishments: ${earned} of ${total}`} onClick={() => setOpen(!open)}>
          <AwardIcon size={compact ? 16 : 18} /> <strong className="num">{earned}</strong>
        </button>
        {open && (
          <div className="stb-pop" role="dialog" aria-label="Accomplishments">
            <div className="stb-pop-head"><strong>Accomplishments</strong><span className="small muted">{earned} of {total} · {rank.name}</span></div>
            <div className="stat-label">Medals</div>
            <ul className="stb-pop-list">
              {MEDALS.map((m) => <li key={m.id} data-got={j.medals.includes(m.id)}><AwardIcon size={14} /><span><strong>{m.name}</strong><span className="small muted"> {m.desc}</span></span></li>)}
            </ul>
            <div className="stat-label">Budget-desk badges</div>
            <ul className="stb-pop-list">
              {BADGES.map((b) => <li key={b.id} data-got={desk.includes(b.id)}><AwardIcon size={14} /><span><strong>{b.name}</strong><span className="small muted"> {b.desc}</span></span></li>)}
            </ul>
            <a className="small" href="#journey" onClick={() => setOpen(false)}>See certificates and fact cards on the road map</a>
          </div>
        )}
      </div>
      {!compact && <span className="stb-rank">{rank.name}</span>}
      {next && next.id !== route && (
        <a className="btn btn-primary stb-go" href={'#' + next.id}>{compact ? `Play ${next.n}` : done || j.started ? `Continue: level ${next.n}` : 'Start level 1'}</a>
      )}
      {n.supported && (
        <button type="button" className="icon-btn stb-voice" aria-pressed={voiceOn} aria-label={voiceOn ? 'Turn off Uncle Sam’s voice' : 'Turn on Uncle Sam’s voice'} title={voiceOn ? 'Uncle Sam’s voice is on' : 'Uncle Sam’s voice is off'} onClick={toggleVoice}>
          <SpeakerIcon on={voiceOn} />
        </button>
      )}
    </div>
  );
}
