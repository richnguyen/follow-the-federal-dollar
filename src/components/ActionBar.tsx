import type { ReactNode } from 'react';

// The action bar: the buttons that move the player forward on a screen (continue, take the
// challenge, play the next level, share). On phones and tablets (900 px wide or less) it's fixed
// to the bottom of the screen, so the actions available are always in the same place, in reach of
// a thumb; on wider screens it sits in the page where it's placed. One per screen: the app's
// default bar (continue the game) steps aside when a page brings its own (see app.css).
// `phoneOnly`: the bar exists only on small screens, because the page shows these actions
// elsewhere on wide ones (the budget desk's scoreboard).
// `keepSam`: taps on this bar don't slide Uncle Sam away by themselves (a level step's Continue and
// Back decide what happens to him).
export function ActionBar({ children, label = 'Actions', className = '', phoneOnly = false, keepSam = false }: { children: ReactNode; label?: string; className?: string; phoneOnly?: boolean; keepSam?: boolean }) {
  return (
    <div className={'actionbar' + (phoneOnly ? ' actionbar-phone' : '') + (className ? ' ' + className : '')} role="group" aria-label={label} data-sam-keep={keepSam || undefined}>
      {children}
    </div>
  );
}
