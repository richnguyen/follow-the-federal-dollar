import { useEffect, useRef } from 'react';
import { useHaptics } from './haptics';
import { LevelIcon } from './icons';
import { DIFF_COLOR, diffKey, LEVELS, STOPS, type Stop } from './levels';
import { GAME_NAME, shareCard, SITE_URL } from './share';
import { ShareButton } from './ShareButton';
import { SamSays } from './UncleSam';

// The celebration card that pops up when a level is finished: stars, the certificate earned,
// a quote, a way to share, and the next level. It is earned, never interrupts play, and closes
// with one tap or Escape.

const CHEER: Record<number, string> = {
  3: 'Well done, partner! Three stars. You have a real head for this.',
  2: 'Nicely done! That’s another level in the books.',
  1: 'We made it through that one together. On to the next!',
  0: 'We made it through that one together. On to the next!',
};

export function factFor(stop: Stop) {
  const l = LEVELS.find((x) => x.id === stop.id);
  return l ? l.takeaways[0] : `I met the goal “${stop.title.toLowerCase()}” using real options priced by the Congressional Budget Office.`;
}

export function Celebration({ stop, stars, onClose, line }: { stop: Stop; stars: number; onClose: () => void; line?: string }) {
  const next = STOPS[stop.n] as Stop | undefined; // n is 1-based, so this is the following level
  const primary = useRef<HTMLAnchorElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const buzz = useHaptics();
  useEffect(() => {
    primary.current?.focus({ preventScroll: true });
    buzz('win');
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    document.documentElement.classList.add('modal-open');
    return () => { window.removeEventListener('keydown', k); document.documentElement.classList.remove('modal-open'); };
  }, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps
  const say = line ?? CHEER[stars];
  const fact = factFor(stop);
  const text = `I just finished level ${stop.n} of “${GAME_NAME}” with ${stars} of 3 stars. ${fact}`;
  const card = () => shareCard({ eyebrow: `Level ${stop.n} of ${STOPS.length} complete`, title: stop.title, stars, fact, color: DIFF_COLOR[stop.difficulty], samSvg: box.current?.querySelector('svg.sam')?.outerHTML });
  return (
    <div className="celebrate-scrim" onClick={onClose}>
      <div className="celebrate" role="dialog" aria-modal="true" aria-labelledby="celebrate-t" onClick={(e) => e.stopPropagation()} ref={box} data-diff={diffKey(stop.difficulty)}>
        <div className="celebrate-band">
          <span className="celebrate-level"><LevelIcon id={stop.icon} size={18} /> Level {stop.n} of {STOPS.length} · {stop.difficulty}</span>
          <button type="button" className="celebrate-x" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="celebrate-body">
          <h2 className="celebrate-title" id="celebrate-t">Level complete!</h2>
          <div className="celebrate-stars" aria-label={`${stars} of 3 stars`}>
            {[1, 2, 3].map((k) => <span key={k} className="cstar" data-on={k <= stars} style={{ animationDelay: `${0.15 + k * 0.18}s` }}>★</span>)}
          </div>
          <div className="celebrate-badge"><span className="stat-label">Certificate earned</span><strong>{stop.badge}</strong></div>
          <SamSays mood="cheering" compact auto delay={350}>{say}</SamSays>
          <figure className="celebrate-quote">
            <blockquote>“{stop.quote.text}”</blockquote>
            <figcaption>— {stop.quote.who}, <span className="muted">{stop.quote.where}</span></figcaption>
          </figure>
          <div className="celebrate-share">
            <div className="small"><span className="stat-label">Your fact card</span><div>{fact}</div></div>
            <div className="celebrate-share-actions"><ShareButton text={text} card={card} url={SITE_URL + '#' + stop.id} /></div>
          </div>
          {next ? (
            <div className="celebrate-next" data-diff={diffKey(next.difficulty)}>
              <span className="celebrate-next-icon"><LevelIcon id={next.icon} size={22} /></span>
              <div>
                <div className="stat-label">Up next · level {next.n} · {next.difficulty}{next.kind === 'desk' ? ' level' : ''}</div>
                <strong>{next.title}</strong>
                {next.kind === 'desk' && <div className="small muted">A budget-desk level: you fix the budget yourself. Take your time; the hint is free and unlimited.</div>}
              </div>
            </div>
          ) : (
            <p className="small">That was the final level. Your Informed Budget Voter certificate is on the road map.</p>
          )}
          <div className="celebrate-actions">
            {next
              ? <a ref={primary} className="btn btn-primary btn-lg" href={'#' + next.id} onClick={onClose}>Play level {next.n}</a>
              : <a ref={primary} className="btn btn-primary btn-lg" href="#journey" onClick={onClose}>See my certificate</a>}
            <a className="btn" href="#journey" onClick={onClose}>Road map</a>
            <button type="button" className="btn" onClick={onClose}>Stay here</button>
          </div>
        </div>
      </div>
    </div>
  );
}
