import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useJourney } from './state';

// Uncle Sam's voice: the browser's own speech synthesis, preferring a male U.S. English voice.
// Delivery changes with his mood (pace and pitch), and only one line plays at a time.

export type Mood = 'happy' | 'proud' | 'worried' | 'thinking' | 'surprised' | 'cheering';

const PROSODY: Record<Mood, { rate: number; pitch: number }> = {
  happy: { rate: 1.0, pitch: 1.02 },
  proud: { rate: 0.95, pitch: 0.96 },
  worried: { rate: 0.9, pitch: 0.88 },
  thinking: { rate: 0.93, pitch: 0.94 },
  surprised: { rate: 1.06, pitch: 1.12 },
  cheering: { rate: 1.07, pitch: 1.1 },
};

const FEMALE = /(female|woman|samantha|victoria|karen|moira|tessa|zira|aria|jenny|michelle|emma|ava\b|allison|susan|nicky|joanna|salli|kimberly|ivy|kendra|kathy|princess|vicki|agnes|ellen|serena|catherine|fiona|veena|nora|libby|sonia|sara|clara|elizabeth|amy\b|ana\b|monica|paulina|zoe|shelley|sandy|flo\b|grandma|jane|emily|olivia|sophia|ashley|nancy|linda|hazel|heather|google us english)/i;
const MALE = /(\bmale|guy|david|mark|aaron|alex\b|fred|tom\b|christopher|eric|roger|steffan|andrew|brian|davis|jason|tony|evan|nathan|ryan|matthew|joey|justin|kevin|ralph|junior|bruce|reed|rocko|eddy|grandpa|daniel|james|john|richard|george|liam|noah|william|steve|michael|ethan|jacob|roy|lee\b)/i;
const isUS = (v: SpeechSynthesisVoice) => /^en[-_]US/i.test(v.lang);
export const isMaleVoice = (v: SpeechSynthesisVoice) => !FEMALE.test(v.name) && MALE.test(v.name);

function score(v: SpeechSynthesisVoice) {
  let s = 0;
  if (isUS(v)) s += 20;
  else if (/^en/i.test(v.lang)) s += 2;
  else s -= 40;
  if (FEMALE.test(v.name)) s -= 25;
  else if (MALE.test(v.name)) s += 10;
  if (/natural|enhanced|premium|neural/i.test(v.name)) s += 3;
  if (v.localService) s += 1;
  return s;
}

/** The best available male, American English voice (or the closest match). */
export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  return [...voices].sort((a, b) => score(b) - score(a))[0] ?? null;
}

// Long utterances can stall in some browsers, so lines are spoken a sentence at a time. Splits
// only where punctuation is followed by a space, so "$5.40" stays whole.
const sentences = (t: string) => t.replace(/\s+/g, ' ').trim().split(/(?<=[.!?]["”’)]?)\s+/).map((x) => x.trim()).filter(Boolean);

const UNIT: Record<string, string> = { T: 'trillion', B: 'billion', M: 'million', K: 'thousand' };
/** Rewrite on-screen shorthand ("$1.99T", "FY2026") the way a person would say it. */
export function speakable(t: string) {
  return t
    .replace(/\$(\d[\d,]*(?:\.\d+)?)\s?([TBMK])\b/g, (_, n, u) => `${n} ${UNIT[u]} dollars`)
    .replace(/\$(\d[\d,]*(?:\.\d+)?) (trillion|billion|million|thousand)\b/g, '$1 $2 dollars')
    .replace(/\bFY ?(\d{4})[–-]FY ?(\d{4})\b/g, 'fiscal years $1 to $2')
    .replace(/\bFY ?(\d{4})\b/g, 'fiscal year $1')
    .replace(/(\d)–(\d)/g, '$1 to $2')
    .replace(/\bGDP\b/g, 'G D P')
    .replace(/\bU\.S\./g, 'U.S')
    .replace(/\bCRs?\b/g, (m) => (m === 'CRs' ? 'continuing resolutions' : 'continuing resolution'));
}

interface Narrator {
  supported: boolean;
  voices: SpeechSynthesisVoice[];
  voice: SpeechSynthesisVoice | null;
  speakingId: string | null;
  speak: (id: string, text: string, mood?: Mood) => void;
  stop: (id?: string) => void;
  /** Browsers allow speech only after the person has interacted with the page. */
  canAutoplay: () => boolean;
}

const Ctx = createContext<Narrator | null>(null);

export function NarrationProvider({ children }: { children: ReactNode }) {
  const { settings } = useJourney();
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const current = useRef<string | null>(null);
  const token = useRef(0);

  useEffect(() => {
    if (!supported) return;
    const s = window.speechSynthesis;
    const load = () => setVoices(s.getVoices().filter((v) => /^en/i.test(v.lang)));
    load();
    s.addEventListener?.('voiceschanged', load);
    const off = () => s.cancel();
    window.addEventListener('pagehide', off);
    return () => { s.removeEventListener?.('voiceschanged', load); window.removeEventListener('pagehide', off); s.cancel(); };
  }, [supported]);

  const voice = useMemo(() => (settings.voice !== 'auto' && voices.find((v) => v.voiceURI === settings.voice)) || pickVoice(voices), [voices, settings.voice]);

  const stop = useCallback((id?: string) => {
    if (!supported) return;
    if (id && current.current !== id) return;
    token.current++;
    current.current = null;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, [supported]);

  const speak = useCallback((id: string, text: string, mood: Mood = 'happy') => {
    if (!supported || !text.trim()) return;
    const s = window.speechSynthesis;
    s.cancel();
    const my = ++token.current;
    current.current = id;
    setSpeakingId(id);
    const p = PROSODY[mood];
    // No male U.S. voice installed: lower the pitch of whatever voice is available.
    const deepen = voice && isMaleVoice(voice) ? 1 : 0.8;
    const parts = sentences(speakable(text));
    parts.forEach((part, k) => {
      const u = new SpeechSynthesisUtterance(part);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? 'en-US';
      // A little more lift on questions and exclamations.
      const lift = /[!?]["”’)]*$/.test(part) ? 1.05 : 1;
      u.rate = p.rate;
      u.pitch = Math.min(2, p.pitch * deepen * lift);
      if (k === parts.length - 1) {
        const done = () => { if (token.current === my) { current.current = null; setSpeakingId(null); } };
        u.onend = done;
        u.onerror = done;
      }
      s.speak(u);
    });
  }, [supported, voice]);

  const canAutoplay = useCallback(() => {
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    return ua ? ua.hasBeenActive : true;
  }, []);

  return <Ctx.Provider value={{ supported, voices, voice, speakingId, speak, stop, canAutoplay }}>{children}</Ctx.Provider>;
}

export function useNarrator() {
  const n = useContext(Ctx);
  if (!n) throw new Error('NarrationProvider missing');
  return n;
}
