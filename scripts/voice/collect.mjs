// Lists every sentence Uncle Sam can say, grouped into recording banks, and writes
// scripts/voice/lines.json for synth.py. Run with the dev server up:
//   npx vite --port 5173 &  node scripts/voice/collect.mjs http://localhost:5173/
// Most lines are listed straight from the game's modules (level steps, every quiz outcome,
// coaching, celebrations, the road map); lines that depend on live calculations (the budget
// desk's opening lines, the first greeting) are captured by visiting those pages.
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Playwright is not a project dependency; use a global install (npm i -g playwright) or npx.
const { chromium } = createRequire(import.meta.url)('playwright');

const base = process.argv[2] || 'http://localhost:5173/';
const out = new URL('./lines.json', import.meta.url);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => {
  // Use a stand-in speech engine (so nothing is recorded twice) and count the page as interacted with.
  window.__spoken = [];
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [], speak: (u) => window.__spoken.push(u.text), cancel() {}, addEventListener() {}, removeEventListener() {} } });
  Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { hasBeenActive: true, isActive: true } });
  if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, settings: { voice: 'device', voiceV: 2, narration: true, freeRoam: true } }));
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(base + '#sources');
await page.waitForTimeout(500);

const banks = await page.evaluate(async () => {
  const L = await import('/src/game/levels.tsx');
  const S = await import('/src/game/script.ts');
  const U = await import('/src/game/UncleSam.tsx');
  const V = await import('/src/game/voice.tsx');
  const out = {};
  const add = (bank, text) => { for (const s of V.toSentences(text)) (out[bank] ??= []).push(s); };
  for (const l of L.LEVELS) {
    for (const st of l.steps) {
      if (st.sam) add(l.id, U.plain(st.sam));
      if (st.quiz) {
        const q = st.quiz, ex = U.plain(q.explain), Q = S.QUIZ_LINES;
        add(l.id, Q.ask(q.question));
        add(l.id, Q.wrong);
        add(l.id, `${Q.right} ${ex}`);
        add(l.id, `${Q.rightLater} ${ex}`);
        add(l.id, `${Q.revealSay(q.choices[q.correct])} ${ex}`);
      }
    }
  }
  for (const s of L.STOPS) add('common', S.lockedLine(L.unlockText(s.id)));
  Object.values(S.CHEER).forEach((t) => add('common', t));
  Object.values(S.DESK_PARTY).forEach((t) => add('desk', t));
  Object.values(S.COACH).forEach((t) => add('desk', t));
  add('common', S.VOICE_TEST);
  add('common', S.JOURNEY_LINES.finished);
  for (const r of L.RANKS) {
    add('common', S.JOURNEY_LINES.back(r.name.toLowerCase()));
    for (const d of L.DESK) add('common', S.JOURNEY_LINES.hardNext(r.name.toLowerCase(), d.n));
  }
  return out;
});

// Lines computed on the page: the first greeting and each budget-desk level's opening.
const capture = async (route, bank) => {
  await page.evaluate(() => { window.__spoken.length = 0; });
  await page.goto(base + '#' + route);
  await page.waitForTimeout(1400);
  for (const s of await page.evaluate(() => window.__spoken.splice(0))) (banks[bank] ??= []).push(s);
};
await page.evaluate(() => localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, settings: { voice: 'device', voiceV: 2, narration: true, freeRoam: true } })));
await capture('journey', 'common');
for (const r of ['level-5', 'level-8', 'level-10']) await capture(r, 'desk');
await browser.close();

// A sentence used in more than one bank moves to "common", which every page loads.
const where = new Map();
for (const [b, list] of Object.entries(banks)) for (const s of new Set(list)) where.set(s, [...(where.get(s) ?? []), b]);
const final = { common: [] };
for (const [s, bs] of where) {
  const b = bs.length > 1 ? 'common' : bs[0];
  (final[b] ??= []).push(s);
}
const total = Object.values(final).reduce((a, l) => a + l.length, 0);
writeFileSync(out, JSON.stringify({ voice: 'am_michael', banks: final }, null, 1) + '\n');
console.log(Object.entries(final).map(([b, l]) => `${b}: ${l.length}`).join(', '), `· ${total} sentences →`, out.pathname);
