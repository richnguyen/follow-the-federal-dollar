import { useState } from 'react';
import { Stars } from '../components/game';
import { Section } from '../components/ui';
import { budget } from '../data';
import { moneyWords } from '../lib/format';
import { OPTIONS_DATA } from '../lib/planData';
import { useVotes } from '../lib/votes';
import { LevelIcon, LockIcon } from './icons';
import { diffKey, isUnlocked, LEVELS, MAX_STARS, rankFor, STOPS, unlockText } from './levels';
import { MEDALS } from './medals';
import { GAME_NAME, SITE_URL } from './share';
import { ShareButton } from './ShareButton';
import { JOURNEY_LINES } from './script';
import { ReadingSettings } from './Settings';
import { useJourney } from './state';
import { SamSays, UncleSam } from './UncleSam';

export { LockIcon } from './icons';

const hard = (d: string) => d === 'Hard' || d === 'Super hard';
const pillFor = (d: string) => (d === 'Easy' ? 'pill-ok' : d === 'Medium' ? 'pill-warn' : 'pill-crit');

export default function Journey() {
  const j = useJourney();
  const votes = useVotes();
  const done = STOPS.filter((s) => j.done.includes(s.id));
  const next = STOPS.find((s) => !j.done.includes(s.id) && isUnlocked(s.id, j.done, j.settings.freeRoam)) ?? null;
  const minutesLeft = STOPS.filter((s) => !j.done.includes(s.id)).reduce((a, s) => a + s.minutes, 0);
  const total = STOPS.reduce((a, s) => a + s.minutes, 0);
  const stars = STOPS.reduce((a, s) => a + (j.stars[s.id] ?? 0), 0);
  const rank = rankFor(done.length);
  const finished = done.length === STOPS.length;
  const fresh = !j.started && done.length === 0;
  const T = budget.receiptsByFY[String(budget.latestFY)]?.reduce((s, r) => s + r.amount, 0) ?? 0;

  return (
    <div className="journey">
      <section className="journey-hero">
        <div className="journey-copy">
          <div className="eyebrow">A civic game about the federal budget</div>
          <h1 className="page-title">Help Uncle Sam balance the budget</h1>
          <SamSays mood={finished ? 'cheering' : fresh ? 'happy' : next && hard(next.difficulty) ? 'worried' : 'thinking'} size={150} auto>
            {finished
              ? JOURNEY_LINES.finished
              : fresh
                ? JOURNEY_LINES.fresh(moneyWords(T))
                : next && hard(next.difficulty)
                  ? JOURNEY_LINES.hardNext(rank.name.toLowerCase(), next.n)
                  : JOURNEY_LINES.back(rank.name.toLowerCase())}
          </SamSays>
          <div className="sb-actions">
            {next && <a className="btn btn-primary btn-lg" href={'#' + next.id}>{fresh ? 'Start level 1' : `Continue: level ${next.n}, ${next.title}`}</a>}
            <a className="btn" href="#daily">Today’s Daily Dollar</a>
            {j.plans && Object.keys(j.plans).length > 0 && <a className="btn" href="#story">Your Budget Story</a>}
            <a className="btn" href="#overview">Skip the game and read the guide</a>
          </div>
        </div>
        <div className="card journey-progress" aria-label="Your progress">
          <div className="jp-rank">
            <span className="stat-label">Your title</span>
            <strong>{rank.name}</strong>
          </div>
          <div className="jp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={STOPS.length} aria-valuenow={done.length} aria-label={`${done.length} of ${STOPS.length} levels done`}>
            {STOPS.map((s) => <span key={s.id} data-done={j.done.includes(s.id)} data-desk={s.kind === 'desk'} />)}
          </div>
          <div className="small"><strong>{done.length} of {STOPS.length}</strong> levels · <strong>★ {stars}</strong> of {MAX_STARS} stars · {finished ? 'all done' : `about ${minutesLeft} of ${total} minutes left`}</div>
          <p className="small muted">Easy levels explain one part of the budget in a few short steps, a couple of questions, and one vote. Every few levels comes a hard one at the budget desk, where you fix the budget yourself. The full chapters and original documents are always one click away.</p>
        </div>
      </section>

      <Section id="map" title="The road map" sub="Ten levels. Easy chapters build up to three hard budget-desk levels, so a tough level is always followed by a breather.">
        <ol className="roadmap">
          {STOPS.map((s) => {
            const isDone = j.done.includes(s.id);
            const open = isUnlocked(s.id, j.done, j.settings.freeRoam);
            const st = j.stars[s.id] ?? 0;
            return (
              <li key={s.id} className="stop" data-done={isDone} data-open={open} data-kind={s.kind} data-hard={hard(s.difficulty)} data-diff={diffKey(s.difficulty)} data-next={s.id === next?.id}>
                <span className="stop-node" aria-hidden="true">{open || isDone ? <LevelIcon id={s.icon} size={20} /> : <LockIcon />}</span>
                <div className="stop-body">
                  <div className="stop-meta">
                    <span>Level {s.n}</span>
                    <span className={'pill ' + pillFor(s.difficulty)}>{s.difficulty}{s.kind === 'desk' ? ' level' : ''}</span>
                    <span className="muted">about {s.minutes} min</span>
                    {isDone && <Stars n={st} size="sm" label={`${st} of 3 stars`} />}
                  </div>
                  <h3 className="stop-title">{open ? <a href={'#' + s.id}>{s.title}</a> : s.title}</h3>
                  <div className="small muted">{open ? s.topic : unlockText(s.id)}</div>
                </div>
                {open && <a className={'btn' + (s.id === next?.id ? ' btn-primary' : '')} href={'#' + s.id} aria-label={`${isDone ? 'Replay' : 'Play'} level ${s.n}: ${s.title}`}>{isDone ? 'Replay' : s.id === next?.id ? 'Play' : 'Open'}</a>}
              </li>
            );
          })}
        </ol>
      </Section>

      <Section id="facts" title="Your fact cards" sub="Every chapter you finish adds a card of what you learned, with the source. Share any of them.">
        <div className="factcards">
          {LEVELS.map((l) => {
            const got = j.done.includes(l.id);
            return (
              <article key={l.id} className="factcard" data-got={got} data-diff={diffKey(l.difficulty)}>
                <div className="factcard-top"><span className="factcard-icon"><LevelIcon id={l.icon} size={18} /></span><span className="stat-label">Level {l.n} · {l.badge}</span></div>
                {got ? (
                  <>
                    <ul className="factcard-list">{l.takeaways.map((t) => <li key={t}>{t}</li>)}</ul>
                    <div className="factcard-actions">
                      <ShareButton className="btn btn-sm" text={`Did you know? ${l.takeaways[0]} (from “${GAME_NAME}”, built on official U.S. government data)`} url={SITE_URL + '#' + l.id} />
                      {l.deepDive[0] && <a className="small" href={'#' + l.deepDive[0].route}>The full chapter</a>}
                    </div>
                  </>
                ) : (
                  <p className="small muted">Finish level {l.n}, {l.title}, to collect this card.</p>
                )}
              </article>
            );
          })}
        </div>
      </Section>

      <div className="callout results-callout">
        <div className="callout-title">{finished ? 'You finished the game. How did everyone else do?' : 'How is everyone else doing?'}</div>
        <p className="small">See how far players got, how many got each question right, and how everyone voted on every question and policy card. <a href="#results">How everyone played</a></p>
      </div>

      <Section id="ballot" title="Your budget ballot" sub={votes.available ? 'Your votes from each level, counted with everyone else who opened this page.' : 'Your votes from each level, saved in this browser.'}>
        <Ballot />
      </Section>

      <Section id="medals" title="Medals" sub={`${j.medals.length} of ${MEDALS.length} earned. Medals reward taking part, reading the fine print, and sharing, as much as winning.`}>
        <div className="medals">
          {MEDALS.map((m) => {
            const got = j.medals.includes(m.id);
            return (
              <div key={m.id} className="medal" data-got={got}>
                <span className="medal-disc" aria-hidden="true">{got ? '★' : ''}</span>
                <div><strong>{m.name}</strong><div className="small muted">{m.desc}</div></div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section id="awards" title="Certificates" sub="Earn one for each level you finish. Saved in this browser only.">
        <div className="badges">
          {STOPS.map((l) => {
            const got = j.done.includes(l.id);
            return (
              <div key={l.id} className="badge" data-got={got}>
                <span className="badge-medal" aria-hidden="true">{got ? <LevelIcon id={l.icon} size={18} /> : l.n}</span>
                <div><strong>{l.badge}</strong><div className="small muted">{got ? `Level ${l.n} complete · ${'★'.repeat(j.stars[l.id] ?? 0)}` : `Finish level ${l.n}, ${l.title}`}</div></div>
              </div>
            );
          })}
        </div>
        {finished && (
          <div className="certificate card">
            <UncleSam mood="proud" size={90} />
            <div>
              <div className="eyebrow">Certificate</div>
              <div className="complete-title">Informed Budget Voter</div>
              <p className="small muted">For learning where federal money comes from and goes, why the government borrows, how Congress budgets, what the future holds for Social Security, and for casting a vote on each.</p>
              <div className="sb-actions" style={{ marginTop: 8 }}><ShareButton text={`I finished all ${STOPS.length} levels of “${GAME_NAME}” and earned ${stars} of ${MAX_STARS} stars. I’m an Informed Budget Voter.`} /></div>
            </div>
          </div>
        )}
      </Section>

      <Section id="settings" title="Reading settings" sub="Make the game comfortable to read. These are saved in this browser.">
        <div className="card"><ReadingSettings /></div>
      </Section>

      <p className="fineprint-link small">Every level’s full chapter and the original government documents behind its numbers are listed in <a href="#sources">Sources &amp; methods</a>.</p>
    </div>
  );
}

function Ballot() {
  const j = useJourney();
  const votes = useVotes();
  const [copied, setCopied] = useState<'idle' | 'done' | 'manual'>('idle');
  const rows = LEVELS.flatMap((l) => l.steps.filter((s) => s.vote).map((s) => {
    const v = s.vote!;
    if (v.kind === 'option') {
      const o = OPTIONS_DATA.options.find((x) => x.id === v.optionId)!;
      const shared = votes.available ? votes.mine.options[o.id] : undefined;
      const c = shared === 1 ? 'support' : shared === -1 ? 'oppose' : j.choices['option:' + o.id] || '';
      return { level: l, q: o.name, a: c === 'support' ? 'Support' : c === 'oppose' ? 'Oppose' : '' };
    }
    const c = (votes.available ? votes.mine.issues[v.id] : undefined) ?? j.choices[v.id] ?? '';
    return { level: l, q: v.question, a: v.choices.find((x) => x.value === c)?.label ?? '' };
  }));
  const cast = rows.filter((r) => r.a);
  const text = [`My budget ballot from “${GAME_NAME}”:`, ...cast.map((r) => `• ${r.q}: ${r.a}`)].join('\n');
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied('done'); } catch { setCopied('manual'); } };
  return (
    <div className="card">
      <ul className="ballot-list">
        {rows.map((r) => (
          <li key={r.q} data-cast={!!r.a}>
            <span className="small muted">Level {r.level.n}</span>
            <span className="ballot-q">{r.q}</span>
            <span className="ballot-a">{r.a ? <strong>{r.a}</strong> : <a href={'#' + r.level.id}>{j.done.includes(r.level.id) ? 'Not voted' : 'Play to vote'}</a>}</span>
          </li>
        ))}
      </ul>
      <div className="sb-actions" style={{ marginTop: 12 }}>
        <span className="small muted">{cast.length} of {rows.length} questions answered.</span>
        {cast.length > 0 && <button type="button" className="btn" onClick={copy}>{copied === 'done' ? 'Copied' : 'Copy my ballot'}</button>}
        {cast.length > 0 && <ShareButton text={text} />}
      </div>
      {copied === 'manual' && <textarea className="input" readOnly rows={6} value={text} onFocus={(e) => e.currentTarget.select()} aria-label="Your ballot, ready to copy" />}
    </div>
  );
}

