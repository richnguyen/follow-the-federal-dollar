import { type ReactNode, useEffect, useState } from 'react';
import { useJourney } from './state';

// Uncle Sam, drawn as a friendly everyday American: reading glasses pushed up on his hat,
// sleeves of a man who balances the family checkbook at the kitchen table. Flat and quiet,
// in the same palette in both themes.
export type Mood = 'happy' | 'proud' | 'worried' | 'thinking' | 'surprised';

const C = { navy: '#23406e', red: '#b8372f', white: '#fbfaf6', skin: '#f0c6a0', skinShade: '#dfa983', hair: '#eceae3', line: '#3b2f2a', glass: '#7fa3c8' };

export function UncleSam({ mood = 'happy', size = 140, title }: { mood?: Mood; size?: number; title?: string }) {
  const brows: Record<Mood, string> = {
    happy: 'M41 77 q6 -4 12 -1 M67 76 q6 -3 12 1',
    proud: 'M41 76 q6 -5 12 -2 M67 74 q6 -3 12 2',
    worried: 'M41 75 q6 3 12 1 M67 76 q6 -2 12 -1',
    thinking: 'M41 78 q6 -2 12 0 M67 73 q6 -4 12 0',
    surprised: 'M41 72 q6 -5 12 -2 M67 70 q6 -3 12 2',
  };
  const mouth: Record<Mood, ReactNode> = {
    happy: <path d="M50 104 q10 9 20 0" fill="none" stroke={C.line} strokeWidth="2.6" strokeLinecap="round" />,
    proud: <path d="M48 103 q12 11 24 0 q-12 5 -24 0z" fill={C.line} />,
    worried: <path d="M51 107 q9 -6 18 0" fill="none" stroke={C.line} strokeWidth="2.6" strokeLinecap="round" />,
    thinking: <path d="M52 105 q8 3 15 -2" fill="none" stroke={C.line} strokeWidth="2.6" strokeLinecap="round" />,
    surprised: <ellipse cx="60" cy="105" rx="4.5" ry="5.5" fill={C.line} />,
  };
  return (
    <svg className="sam" width={size} height={size * (150 / 120)} viewBox="0 0 120 150" role="img" aria-label={title ?? `Uncle Sam, looking ${mood}`}>
      {/* coat and shoulders */}
      <path d="M14 150 q4 -30 30 -36 l16 10 l16 -10 q26 6 30 36z" fill={C.navy} />
      <path d="M44 114 l16 22 l16 -22 l-6 -3 l-10 9 l-10 -9z" fill={C.white} />
      <path d="M52 122 l8 6 l8 -6 l0 8 l-8 -2 l-8 2z" fill={C.red} />
      {/* rolled-up-sleeve elbow patch detail: a pencil in the breast pocket */}
      <rect x="80" y="128" width="12" height="3" rx="1" fill={C.white} opacity="0.85" />
      <rect x="86" y="121" width="2.2" height="9" rx="1" fill="#e0b64a" />
      {/* neck */}
      <path d="M50 108 h20 v8 q-10 6 -20 0z" fill={C.skinShade} />
      {/* hair tufts */}
      <path d="M30 78 q-6 10 2 20 q2 -10 6 -14z M90 78 q6 10 -2 20 q-2 -10 -6 -14z" fill={C.hair} stroke="#cfccc3" strokeWidth="0.8" />
      {/* face */}
      <path d="M34 70 q0 -8 8 -10 h36 q8 2 8 10 v22 q0 26 -26 26 q-26 0 -26 -26z" fill={C.skin} />
      <ellipse cx="34" cy="88" rx="4" ry="6" fill={C.skinShade} />
      <ellipse cx="86" cy="88" rx="4" ry="6" fill={C.skinShade} />
      {/* goatee */}
      <path d="M50 108 q10 6 20 0 q-2 14 -10 22 q-8 -8 -10 -22z" fill={C.hair} stroke="#cfccc3" strokeWidth="0.8" />
      {/* eyes */}
      {mood === 'happy' || mood === 'proud' ? (
        <path d="M44 86 q4 -4 8 0 M68 86 q4 -4 8 0" fill="none" stroke={C.line} strokeWidth="2.6" strokeLinecap="round" />
      ) : (
        <>
          <circle cx="48" cy="86" r={mood === 'surprised' ? 3.4 : 2.8} fill={C.line} />
          <circle cx="72" cy="86" r={mood === 'surprised' ? 3.4 : 2.8} fill={C.line} />
        </>
      )}
      <path d={brows[mood]} fill="none" stroke="#bdb9ae" strokeWidth="3.2" strokeLinecap="round" />
      {/* nose and cheeks */}
      <path d="M60 88 q-4 8 0 10 q3 0 4 -2" fill="none" stroke={C.skinShade} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="42" cy="97" r="4" fill="#e9a58a" opacity="0.45" />
      <circle cx="78" cy="97" r="4" fill="#e9a58a" opacity="0.45" />
      {mouth[mood]}
      {/* top hat: brim, striped crown, starred band */}
      <ellipse cx="60" cy="61" rx="38" ry="7" fill={C.navy} />
      <path d="M38 60 l4 -50 q18 -6 36 0 l4 50z" fill={C.white} />
      <path d="M45 58 l2 -48 h6 l-1 48z M58 58 v-49 h6 l1 49z M72 58 l-1 -48 h6 l3 48z" fill={C.red} />
      <ellipse cx="60" cy="9" rx="18" ry="3.4" fill={C.white} stroke="#d9d5ca" strokeWidth="0.9" />
      <path d="M38.5 52 h43 l0.6 8 h-44.2z" fill={C.navy} />
      {[47, 60, 73].map((x) => (
        <path key={x} d={`M${x} 53.2 l1.2 2.4 l2.6 0.3 l-1.9 1.8 l0.5 2.6 l-2.4 -1.3 l-2.4 1.3 l0.5 -2.6 l-1.9 -1.8 l2.6 -0.3z`} fill={C.white} />
      ))}
      {/* reading glasses pushed up on the brim */}
      <g opacity="0.95">
        <circle cx="50" cy="66" r="5" fill="none" stroke={C.glass} strokeWidth="1.8" />
        <circle cx="70" cy="66" r="5" fill="none" stroke={C.glass} strokeWidth="1.8" />
        <path d="M55 66 h10" stroke={C.glass} strokeWidth="1.8" />
      </g>
      {mood === 'thinking' && <circle cx="100" cy="40" r="3" fill="var(--muted)" opacity="0.7" />}
      {mood === 'thinking' && <circle cx="108" cy="30" r="4.5" fill="var(--muted)" opacity="0.5" />}
    </svg>
  );
}

/** Speak a line aloud with the browser's own voice (only on request; respects the setting). */
export function useNarration() {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);
  const speak = (text: string) => {
    if (!supported) return;
    const s = window.speechSynthesis;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.98;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    s.speak(u);
  };
  const stop = () => { if (supported) window.speechSynthesis.cancel(); setSpeaking(false); };
  return { supported, speaking, speak, stop };
}

const plain = (n: ReactNode): string => {
  if (n == null || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(plain).join('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const el = n as any;
  return el?.props ? plain(el.props.children) : '';
};

/** Uncle Sam with a speech bubble; optional "Listen" reads the bubble aloud. */
export function SamSays({ mood = 'happy', children, size = 120, compact = false }: { mood?: Mood; children: ReactNode; size?: number; compact?: boolean }) {
  const { settings } = useJourney();
  const n = useNarration();
  const text = plain(children);
  return (
    <div className={'samsays' + (compact ? ' compact' : '')}>
      <UncleSam mood={mood} size={compact ? 72 : size} />
      <div className="bubble">
        <div className="bubble-name">Uncle Sam</div>
        <div className="bubble-text">{children}</div>
        {settings.narration && n.supported && text && (
          <button type="button" className="link-btn bubble-listen" onClick={() => (n.speaking ? n.stop() : n.speak(text))} aria-pressed={n.speaking}>
            {n.speaking ? 'Stop reading' : 'Listen'}
          </button>
        )}
      </div>
    </div>
  );
}
