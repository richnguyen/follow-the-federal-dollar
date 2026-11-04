import { LevelIcon, SpeakerIcon } from './icons';
import { diffKey, isUnlocked, MAX_STARS, rankFor, STOP_BY_ID, STOPS } from './levels';
import { useJourney } from './state';
import { useNarrator } from './voice';

// The player's standing, always in view: current level, the ten-level track, stars, title,
// a one-tap way back into play, and Uncle Sam's voice switch.

export function StatusBar({ route, compact = false }: { route: string; compact?: boolean }) {
  const j = useJourney();
  const n = useNarrator();
  const done = STOPS.filter((s) => j.done.includes(s.id)).length;
  const stars = STOPS.reduce((a, s) => a + (j.stars[s.id] ?? 0), 0);
  const next = STOPS.find((s) => !j.done.includes(s.id) && isUnlocked(s.id, j.done, j.settings.freeRoam));
  const here = STOP_BY_ID[route];
  const focus = here ?? next ?? STOPS[STOPS.length - 1];
  const rank = rankFor(done);
  const voiceOn = j.settings.narration;
  const toggleVoice = () => {
    if (voiceOn) n.stop();
    j.setSettings({ narration: !voiceOn });
  };
  return (
    <div className={'statusbar' + (compact ? ' compact' : '')} role="group" aria-label="Your progress">
      <a className="stb-level" href={'#' + focus.id} aria-label={`Level ${focus.n} of ${STOPS.length}: ${focus.title}`}>
        <span className="stb-icon" data-diff={diffKey(focus.difficulty)}><LevelIcon id={focus.icon} size={compact ? 16 : 18} /></span>
        <span><span className="stb-k">Level</span> <strong className="num">{focus.n}</strong><span className="muted num">/{STOPS.length}</span></span>
      </a>
      <span className="stb-track" role="progressbar" aria-valuemin={0} aria-valuemax={STOPS.length} aria-valuenow={done} aria-label={`${done} of ${STOPS.length} levels done`}>
        {STOPS.map((s) => <i key={s.id} data-done={j.done.includes(s.id)} data-hard={s.kind === 'desk'} data-diff={diffKey(s.difficulty)} data-here={s.id === focus.id} />)}
      </span>
      <span className="stb-stars" aria-label={`${stars} of ${MAX_STARS} stars`}><span aria-hidden="true">★</span> <strong className="num">{stars}</strong>{!compact && <span className="muted num">/{MAX_STARS}</span>}</span>
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
