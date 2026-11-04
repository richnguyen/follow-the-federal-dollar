// Uncle Sam's lines outside the level content, in one place. Keeping them here means every
// sentence he can say can be listed ahead of time and recorded (see scripts/voice/).

export const QUIZ_LINES = {
  ask: (question: string) => `Quick check. ${question}`,
  prompt: 'Quick check. Take your best guess; there’s no penalty.',
  wrong: 'Not quite. Want to try again?',
  right: 'That’s right!',
  rightLater: 'You got it. Nice work sticking with it.',
  reveal: 'That one’s tricky. Here’s the answer.',
  revealSay: (answer: string) => `That one’s tricky. Here’s the answer. It’s ${answer}.`,
};

export const lockedLine = (unlock: string) => `We’ll get there. This level builds on the one before it. ${unlock}.`;

export const CHEER: Record<number, string> = {
  3: 'Well done, partner! Three stars. You have a real head for this.',
  2: 'Nicely done! That’s another level in the books.',
  1: 'We made it through that one together. On to the next!',
  0: 'We made it through that one together. On to the next!',
};

export const DESK_PARTY: Record<number, string> = {
  3: 'Three stars! We fixed it without knocking the economy flat, and both taxes and spending pitched in. Well done, partner!',
  2: 'We did it, partner! That plan meets the goal. Replay any time to go for three stars.',
  1: 'We did it! The goal is met. There are more stars to earn if you go easier on the economy and share the load.',
  0: 'We did it! The goal is met. There are more stars to earn if you go easier on the economy and share the load.',
};

export const COACH = {
  metWithHint: 'We did it! The cards alone couldn’t get us there, so the hint added across-the-board changes too.',
  met3: 'Three stars! That’s a plan I could take to Congress.',
  met: 'We did it! Now, can we earn the other stars too?',
  startStabilize: 'My debt is still outgrowing the economy. Pick a card to get us started.',
  start: 'We haven’t made a dent yet. Pick a card to get us started.',
  steep: 'Whoa, easy now. That’s a steep hit to the economy in a single year. Try phasing it in, or swap a card for a gentler one.',
  cardsShort: 'The cards alone won’t get us all the way. We’ll need some across-the-board changes, further down, or try the free hint.',
  almost: 'Almost there! One more card should do it.',
  partway: 'Good progress. We’re partway there.',
  begun: 'That’s a start. Keep going.',
};

export const VOICE_TEST = 'Howdy, partner. This is Uncle Sam. Let’s get my books in order.';

export const JOURNEY_LINES = {
  fresh: (tookIn: string) => `Howdy. I’m Uncle Sam. I took in ${tookIn} last year, and I still spent more than I made. I need a level-headed adviser to help me understand my books and decide what to do. Got a few minutes?`,
  finished: 'We did it, partner. You’ve seen where every dollar comes from and goes, and you’ve weighed in on the big choices. That makes you an informed budget voter.',
  hardNext: (rank: string, n: number) => `Welcome back, ${rank}. Next up is a hard one: level ${n}, where we try to fix my budget ourselves. Take your time; the hint is free.`,
  back: (rank: string) => `Welcome back. You’re my ${rank} now. Let’s pick up where we left off.`,
};
