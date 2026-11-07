import { type ReactNode, useEffect, useRef } from 'react';
import { useHaptics } from './haptics';
import { LevelIcon } from './icons';
import { DIFF_COLOR, diffKey, LEVELS, STOPS, type Stop } from './levels';
import { GAME_NAME, shareCard, SITE_URL } from './share';
import { ShareButton, SocialShare } from './ShareButton';
import { SamSays } from './UncleSam';
import { CHEER } from './script';
import type { Outcome } from './ChallengeParts';

// The celebration card that pops up when a level is finished: stars, the certificate earned,
// a quote, a way to share, and the next level. It is earned, never interrupts play, and closes
// with one tap or Escape.


export function factFor(stop: Stop) {
  const l = LEVELS.find((x) => x.id === stop.id);
  return l ? l.takeaways[0] : `I met the goal “${stop.title.toLowerCase()}” using real options priced by the Congressional Budget Office.`;
}

/**
 * `challenge`: the player took a friend's challenge, so the card ends with the result (send it back,
 * or try again). `newcomer`: they haven't played the earlier levels, so the next step is level 1.
 */
export function Celebration({ stop, stars, onClose, line, share, children, challenge, newcomer = false, onShare }: { stop: Stop; stars: number; onClose: () => void; line?: string; share?: { text: string; url: string }; children?: ReactNode; challenge?: { outcome: Outcome; by: string }; newcomer?: boolean; onShare?: () => void }) {
  const next = STOPS[stop.n] as Stop | undefined; // n is 1-based, so this is the following level
  const box = useRef<HTMLDivElement>(null);
  const buzz = useHaptics();
  useEffect(() => {
    box.current?.querySelector<HTMLElement>('[data-primary], [data-primary-wrap] button')?.focus({ preventScroll: true });
    buzz('win');
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    document.documentElement.classList.add('modal-open');
    return () => { window.removeEventListener('keydown', k); document.documentElement.classList.remove('modal-open'); };
  }, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps
  const say = line ?? CHEER[stars];
  const fact = factFor(stop);
  const text = share?.text ?? `I just finished level ${stop.n} of “${GAME_NAME}” with ${stars} of 3 stars. ${fact}`;
  const url = share?.url ?? SITE_URL;
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
          <SamSays mood="cheering" compact auto delay={350} inline>{say}</SamSays>
          <figure className="celebrate-quote">
            <blockquote>“{stop.quote.text}”</blockquote>
            <figcaption>— {stop.quote.who}, <span className="muted">{stop.quote.where}</span></figcaption>
          </figure>
          {!challenge && (
            <div className="celebrate-share">
              <div className="small"><span className="stat-label">{share ? 'Challenge a friend' : 'Your fact card'}</span><div>{share ? 'Send your plan as a link. Your friend plays the same level and sees how much you two agree.' : fact}</div></div>
              <div className="celebrate-share-actions"><ShareButton text={text} card={card} url={url} label={share ? 'Send the challenge' : 'Share'} kind={share ? 'plan' : 'level'} onShare={onShare} /></div>
              <SocialShare text={text} url={url} kind={share ? 'plan' : 'level'} onShare={onShare} />
            </div>
          )}
          {children}
          {challenge ? (
            <>
              <div className="celebrate-share">
                <div className="small"><span className="stat-label">{challenge.outcome === 'lost' ? `Not yet ahead of ${challenge.by}` : `Your turn to challenge ${challenge.by}`}</span><div>{challenge.outcome === 'lost' ? 'Try again for more stars, a gentler economy, or fewer cards. Or send yours anyway.' : `Send your plan back and see if ${challenge.by} can top it.`}</div></div>
                {challenge.outcome === 'lost' && <div className="celebrate-share-actions"><ShareButton text={text} url={url} label="Send it anyway" kind="plan" onShare={onShare} /></div>}
                <SocialShare text={text} url={url} kind="plan" onShare={onShare} />
              </div>
              <div className="celebrate-actions">
                {challenge.outcome === 'lost'
                  ? <button type="button" className="btn btn-primary btn-lg" data-primary onClick={onClose}>Try again</button>
                  : <span data-primary-wrap><ShareButton text={text} url={url} label={`Send it back to ${challenge.by}`} className="btn btn-primary btn-lg" kind="plan" onShare={onShare} /></span>}
                {newcomer && <a className="btn" href={'#' + STOPS[0].id} onClick={onClose}>Start from level 1: how the budget works</a>}
                {challenge.outcome !== 'lost' && <button type="button" className="btn" onClick={onClose}>Keep improving</button>}
                {!newcomer && <a className="btn" href="#journey" onClick={onClose}>Road map</a>}
              </div>
            </>
          ) : newcomer ? (
            <>
              <p className="small">New here? The earlier levels show where Uncle Sam’s money comes from and goes, a few minutes each.</p>
              <div className="celebrate-actions">
                <a className="btn btn-primary btn-lg" data-primary href={'#' + STOPS[0].id} onClick={onClose}>Start from level 1</a>
                <button type="button" className="btn" onClick={onClose}>Stay here</button>
              </div>
            </>
          ) : (
            <>
              {next ? (
                <div className="celebrate-next" data-diff={diffKey(next.difficulty)}>
                  <span className="celebrate-next-icon"><LevelIcon id={next.icon} size={22} /></span>
                  <div>
                    <div className="stat-label">Up next · level {next.n} · {next.difficulty}{next.kind === 'desk' ? ' level' : ''}</div>
                    <strong>{next.title}</strong>
                    {next.kind === 'desk' && <div className="small muted">A budget-desk level: you fix the budget yourself. Take your time.</div>}
                  </div>
                </div>
              ) : (
                <p className="small">That was the final level. Your Budget Story is ready: your budget personality and your biggest moves, as cards to share. You can also see how everyone played.</p>
              )}
              <div className="celebrate-actions">
                {next
                  ? <a className="btn btn-primary btn-lg" data-primary href={'#' + next.id} onClick={onClose}>Play level {next.n}</a>
                  : <a className="btn btn-primary btn-lg" data-primary href="#story" onClick={onClose}>See your Budget Story</a>}
                {!next && <a className="btn" href="#results" onClick={onClose}>How everyone played</a>}
                <a className="btn" href="#journey" onClick={onClose}>Road map</a>
                <button type="button" className="btn" onClick={onClose}>Stay here</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
