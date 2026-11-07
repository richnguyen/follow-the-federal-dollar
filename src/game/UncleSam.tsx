import { type ReactNode, useEffect, useId, useRef } from 'react';
import { useJourney } from './state';
import { useSamDock } from './samdock';
import { type Mood, useNarrator } from './voice';

export type { Mood } from './voice';

// Uncle Sam, drawn as a friendly everyday American: reading glasses pushed up on his hat, a
// pencil in his pocket. Flat and quiet, in the same palette in both themes. His face, hat and
// arms change with his mood, and he nods and talks while his line is read aloud.

const C = { navy: '#23406e', red: '#b8372f', white: '#fbfaf6', skin: '#f0c6a0', skinShade: '#dfa983', hair: '#eceae3', line: '#3b2f2a', glass: '#7fa3c8', gold: '#c9a645' };

const HAT: Record<Mood, string | undefined> = {
  happy: undefined,
  proud: 'rotate(-6 60 58)',
  worried: 'translate(0 2)',
  thinking: 'rotate(4 60 58)',
  surprised: 'translate(0 -7)',
  cheering: 'translate(6 -13) rotate(14 60 40)',
};

export function UncleSam({ mood = 'happy', size = 140, title, speaking = false }: { mood?: Mood; size?: number; title?: string; speaking?: boolean }) {
  const brows: Record<Mood, string> = {
    happy: 'M41 77 q6 -4 12 -1 M67 76 q6 -3 12 1',
    proud: 'M41 76 q6 -5 12 -2 M67 74 q6 -3 12 2',
    worried: 'M41 74 q6 4 12 2 M67 76 q6 -2 12 -2',
    thinking: 'M41 78 q6 -2 12 0 M67 72 q6 -4 12 0',
    surprised: 'M41 71 q6 -6 12 -2 M67 69 q6 -4 12 2',
    cheering: 'M41 74 q6 -6 12 -2 M67 72 q6 -4 12 2',
  };
  const rest: Record<Mood, ReactNode> = {
    happy: <path d="M50 104 q10 9 20 0" fill="none" stroke={C.line} strokeWidth="2.6" strokeLinecap="round" />,
    proud: <path d="M48 103 q12 11 24 0 q-12 5 -24 0z" fill={C.line} />,
    worried: <path d="M51 107 q9 -6 18 0" fill="none" stroke={C.line} strokeWidth="2.6" strokeLinecap="round" />,
    thinking: <path d="M52 105 q8 3 15 -2" fill="none" stroke={C.line} strokeWidth="2.6" strokeLinecap="round" />,
    surprised: <ellipse cx="60" cy="105" rx="4.5" ry="5.5" fill={C.line} />,
    cheering: <path d="M47 101 q13 15 26 0z" fill={C.line} />,
  };
  // The open "talking" shape alternates with the resting mouth while he speaks.
  const talk = mood === 'worried' ? <ellipse cx="60" cy="105" rx="5" ry="3.6" fill={C.line} /> : <path d="M50 102 q10 11 20 0 q-10 3 -20 0z" fill={C.line} />;
  const closedEyes = mood === 'happy' || mood === 'proud' || mood === 'cheering';
  return (
    <svg className="sam" data-mood={mood} data-speaking={speaking || undefined} width={size} height={size * (150 / 120)} viewBox="0 0 120 150" role="img" aria-label={title ?? `Uncle Sam, looking ${mood}${speaking ? ', speaking' : ''}`}>
      {/* raised arms when cheering */}
      {mood === 'cheering' && (
        <g className="sam-arms">
          <path d="M24 134 q-14 -16 -12 -40" fill="none" stroke={C.navy} strokeWidth="11" strokeLinecap="round" />
          <path d="M96 134 q14 -16 12 -40" fill="none" stroke={C.navy} strokeWidth="11" strokeLinecap="round" />
          <circle cx="12" cy="90" r="6.5" fill={C.white} stroke="#d9d5ca" strokeWidth="0.9" />
          <circle cx="108" cy="90" r="6.5" fill={C.white} stroke="#d9d5ca" strokeWidth="0.9" />
        </g>
      )}
      {/* coat and shoulders */}
      <path d="M14 150 q4 -30 30 -36 l16 10 l16 -10 q26 6 30 36z" fill={C.navy} />
      <path d="M44 114 l16 22 l16 -22 l-6 -3 l-10 9 l-10 -9z" fill={C.white} />
      <path d="M52 122 l8 6 l8 -6 l0 8 l-8 -2 l-8 2z" fill={C.red} />
      {/* a pencil in the breast pocket */}
      <rect x="80" y="128" width="12" height="3" rx="1" fill={C.white} opacity="0.85" />
      <rect x="86" y="121" width="2.2" height="9" rx="1" fill="#e0b64a" />
      <path d="M50 108 h20 v8 q-10 6 -20 0z" fill={C.skinShade} />
      <g className="sam-head">
        <path d="M30 78 q-6 10 2 20 q2 -10 6 -14z M90 78 q6 10 -2 20 q-2 -10 -6 -14z" fill={C.hair} stroke="#cfccc3" strokeWidth="0.8" />
        <path d="M34 70 q0 -8 8 -10 h36 q8 2 8 10 v22 q0 26 -26 26 q-26 0 -26 -26z" fill={C.skin} />
        <ellipse cx="34" cy="88" rx="4" ry="6" fill={C.skinShade} />
        <ellipse cx="86" cy="88" rx="4" ry="6" fill={C.skinShade} />
        <path d="M50 108 q10 6 20 0 q-2 14 -10 22 q-8 -8 -10 -22z" fill={C.hair} stroke="#cfccc3" strokeWidth="0.8" />
        <g className="sam-eyes">
          {closedEyes ? (
            <path d="M44 86 q4 -4 8 0 M68 86 q4 -4 8 0" fill="none" stroke={C.line} strokeWidth="2.6" strokeLinecap="round" />
          ) : (
            <>
              <circle cx="48" cy="86" r={mood === 'surprised' ? 3.6 : 2.8} fill={C.line} />
              <circle cx="72" cy="86" r={mood === 'surprised' ? 3.6 : 2.8} fill={C.line} />
              {mood === 'thinking' && <path d="M45 84 h6 M69 84 h6" stroke={C.skin} strokeWidth="1.6" />}
            </>
          )}
        </g>
        <path className="sam-brows" d={brows[mood]} fill="none" stroke="#bdb9ae" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M60 88 q-4 8 0 10 q3 0 4 -2" fill="none" stroke={C.skinShade} strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="42" cy="97" r={mood === 'cheering' || mood === 'proud' ? 5 : 4} fill="#e9a58a" opacity={mood === 'worried' ? 0.2 : 0.45} />
        <circle cx="78" cy="97" r={mood === 'cheering' || mood === 'proud' ? 5 : 4} fill="#e9a58a" opacity={mood === 'worried' ? 0.2 : 0.45} />
        <g className="sam-mouth-rest">{rest[mood]}</g>
        <g className="sam-mouth-talk">{talk}</g>
        {mood === 'worried' && <path className="sam-sweat" d="M89 70 q4 6 0 9 q-4 -3 0 -9z" fill="#9cc3e6" />}
        <g className="sam-hat" transform={HAT[mood]}>
          <ellipse cx="60" cy="61" rx="38" ry="7" fill={C.navy} />
          <path d="M38 60 l4 -50 q18 -6 36 0 l4 50z" fill={C.white} />
          <path d="M45 58 l2 -48 h6 l-1 48z M58 58 v-49 h6 l1 49z M72 58 l-1 -48 h6 l3 48z" fill={C.red} />
          <ellipse cx="60" cy="9" rx="18" ry="3.4" fill={C.white} stroke="#d9d5ca" strokeWidth="0.9" />
          <path d="M38.5 52 h43 l0.6 8 h-44.2z" fill={C.navy} />
          {[47, 60, 73].map((x) => (
            <path key={x} d={`M${x} 53.2 l1.2 2.4 l2.6 0.3 l-1.9 1.8 l0.5 2.6 l-2.4 -1.3 l-2.4 1.3 l0.5 -2.6 l-1.9 -1.8 l2.6 -0.3z`} fill={C.white} />
          ))}
          <g opacity="0.95">
            <circle cx="50" cy="66" r="5" fill="none" stroke={C.glass} strokeWidth="1.8" />
            <circle cx="70" cy="66" r="5" fill="none" stroke={C.glass} strokeWidth="1.8" />
            <path d="M55 66 h10" stroke={C.glass} strokeWidth="1.8" />
          </g>
        </g>
      </g>
      {/* a hand at the chin when thinking */}
      {mood === 'thinking' && (
        <g className="sam-arms">
          <path d="M98 142 q-4 -18 -22 -24" fill="none" stroke={C.navy} strokeWidth="10" strokeLinecap="round" />
          <circle cx="74" cy="116" r="6" fill={C.white} stroke="#d9d5ca" strokeWidth="0.9" />
        </g>
      )}
      {mood === 'thinking' && <g className="sam-think"><circle cx="100" cy="40" r="3" fill="var(--muted)" opacity="0.7" /><circle cx="108" cy="30" r="4.5" fill="var(--muted)" opacity="0.5" /></g>}
      {(mood === 'cheering' || mood === 'proud') && (
        <g className="sam-spark" fill={C.gold}>
          {(mood === 'cheering' ? [[8, 60, 1], [112, 58, 1], [20, 30, 0.7], [100, 22, 0.8]] : [[104, 70, 0.8]]).map(([x, y, s], k) => (
            <path key={k} transform={`translate(${x} ${y}) scale(${s})`} d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6z" />
          ))}
        </g>
      )}
    </svg>
  );
}

export const plain = (n: ReactNode): string => {
  if (n == null || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(plain).join('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const el = n as any;
  return el?.props ? plain(el.props.children) : '';
};

/**
 * Uncle Sam says a line. He speaks from his dock, the fixed spot just above the action bar (see
 * samdock.tsx), so he's always in the same place; this hands the line to the dock. With `auto`, he
 * reads it aloud when it appears. `inline` draws him in the page instead (the celebration card).
 */
export function SamSays(props: { mood?: Mood; children: ReactNode; size?: number; compact?: boolean; auto?: boolean; delay?: number; say?: string; inline?: boolean }) {
  const dock = useSamDock();
  return props.inline || !dock ? <SamInline {...props} /> : <SamDocked {...props} />;
}

function SamDocked({ mood = 'happy', children, auto = false, delay = 250, say }: { mood?: Mood; children: ReactNode; auto?: boolean; delay?: number; say?: string }) {
  const dock = useSamDock()!;
  const id = useId();
  const text = (say ?? plain(children)).trim();
  useEffect(() => { dock.present({ owner: id, mood, node: children, text, auto, delay }); }, [text, mood]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => dock.clear(id), []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Uncle Sam with a speech bubble, in the page. "Listen" replays the line at any time. */
function SamInline({ mood = 'happy', children, size = 120, compact = false, auto = false, delay = 250, say }: { mood?: Mood; children: ReactNode; size?: number; compact?: boolean; auto?: boolean; delay?: number; say?: string }) {
  const { settings } = useJourney();
  const n = useNarrator();
  const id = useId();
  const text = (say ?? plain(children)).trim();
  const speaking = n.speakingId === id;
  const last = useRef('');

  useEffect(() => {
    if (!auto || !settings.narration || !n.supported || !text) return;
    if (last.current === text + mood) return;
    const t = setTimeout(() => {
      if (!n.canAutoplay()) return;
      last.current = text + mood;
      n.speak(id, text, mood);
    }, delay);
    return () => clearTimeout(t);
  }, [auto, settings.narration, text, mood, n.supported]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => n.stop(id), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={'samsays' + (compact ? ' compact' : '')} data-speaking={speaking || undefined}>
      <UncleSam mood={mood} size={compact ? 72 : size} speaking={speaking} />
      <div className="bubble">
        <div className="bubble-name">Uncle Sam{speaking && <span className="bubble-live" aria-hidden="true"><i /><i /><i /></span>}</div>
        <div className="bubble-text">{children}</div>
        {n.supported && text && (
          <button type="button" className="link-btn bubble-listen" onClick={() => (speaking ? n.stop(id) : n.speak(id, text, mood))} aria-pressed={speaking}>
            {speaking ? 'Stop' : 'Listen'}
          </button>
        )}
      </div>
    </div>
  );
}
