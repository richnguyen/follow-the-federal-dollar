import { DESK } from './levels';
import { ARCHETYPES } from './plans';

// Link previews for shared plans. Link-preview crawlers read a page's preview tags and ignore the
// query string, so each shared link points at one of a fixed set of small static pages
// (public/p/<kind>/index.html), one per level × stars × budget personality, each with its own
// preview card (public/p/img/<kind>.jpg). The page forwards people to the plan right away.
// Regenerate both with `npm run previews` (scripts/make-previews.mjs) when the wording changes.

export interface PreviewKind { id: string; level: number; stars: 1 | 2 | 3; archetype: string }

export const PREVIEW_KINDS: PreviewKind[] = DESK.flatMap((d) =>
  ([1, 2, 3] as const).flatMap((stars) => Object.keys(ARCHETYPES).map((a) => ({ id: `${d.n}-${stars}-${a}`, level: d.n, stars, archetype: a }))));

/** The kind for a plan, from its level, stars, and personality. */
export const previewKindId = (level: number, stars: number, archetype: string) => `${level}-${Math.min(3, Math.max(1, Math.round(stars)))}-${archetype}`;

// About someone else's plan, so in the third person (the Budget Story speaks to the player).
const LINE: Record<string, string> = {
  'revenue-gentle': 'Closes the gap mostly with revenue, chosen to go easy on the economy.',
  'revenue-bold': 'Makes big changes to the tax code to close the gap fast.',
  'balanced-gentle': 'Splits the load between taxes and spending cuts, phased in gently.',
  'balanced-bold': 'Goes big on both taxes and spending: everyone gives a little.',
  'spending-gentle': 'Closes the gap mostly by spending smarter, going easy on the economy.',
  'spending-bold': 'Makes big spending cuts and leaves taxes where they are.',
};
const GOAL: Record<number, { phrase: string; short: string }> = {
  5: { phrase: 'A plan to stop Uncle Sam’s debt from outgrowing the economy.', short: 'Stop the debt from outgrowing the economy' },
  8: { phrase: 'A plan to cut Uncle Sam’s deficit to 3% of GDP.', short: 'Cut the deficit to 3% of GDP' },
  10: { phrase: 'A plan to balance Uncle Sam’s budget.', short: 'Balance the budget' },
};

/** The People's Budget's own preview (public/p/peoples/). */
export const PEOPLES_PREVIEW = {
  id: 'peoples',
  title: 'The People’s Budget: fix Uncle Sam’s books together',
  description: 'One budget, built by everyone who plays. One move a day: push a policy card in or out, and watch the country close the gap together. Real CBO numbers.',
  alt: 'The People’s Budget: one budget built by everyone, one move a day.',
};

export function previewText(k: PreviewKind) {
  const a = ARCHETYPES[k.archetype];
  const d = DESK.find((x) => x.n === k.level)!;
  const title = `Can you beat ${a.name}’s ${k.stars}-star plan?`;
  const description = `${GOAL[k.level].phrase} ${LINE[k.archetype]} Can you do better? Play free, with real CBO numbers.`;
  return {
    title,
    description,
    goal: GOAL[k.level].short,
    personality: a.name,
    line: LINE[k.archetype],
    level: d.n,
    difficulty: d.difficulty,
    alt: `${title} Level ${d.n}: ${GOAL[k.level].short}. ${k.stars} of 3 stars. Budget personality: ${a.name}.`,
  };
}
