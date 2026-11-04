import { useState } from 'react';
import { Stars } from '../components/game';
import { Section } from '../components/ui';
import { budget } from '../data';
import { moneyWords } from '../lib/format';
import { loadProgress } from '../lib/game';
import { OPTIONS_DATA } from '../lib/planData';
import { useVotes } from '../lib/votes';
import { ALL_STOPS, DESK, isUnlocked, LEVELS, unlockText } from './levels';
import { ReadingSettings } from './Settings';
import { useJourney } from './state';
import { SamSays, UncleSam } from './UncleSam';

// The order players meet the stops: four chapters, then the first desk mission, and so on.
export const PATH = ['level-1', 'level-2', 'level-3', 'level-4', 'desk-normal', 'level-5', 'level-6', 'desk-hard', 'level-7', 'desk-expert'];

const RANKS = [
  { at: 0, name: 'New volunteer' },
  { at: 2, name: 'Budget aide' },
  { at: 4, name: 'Budget analyst' },
  { at: 7, name: 'Senior budget adviser' },
  { at: PATH.length, name: 'Informed Budget Voter' },
];
export const rankFor = (n: number) => [...RANKS].reverse().find((r) => n >= r.at)!;

function stopInfo(id: string) {
  const l = LEVELS.find((x) => x.id === id);
  if (l) return { id, kind: 'level' as const, num: `Level ${l.n}`, title: l.title, topic: l.topic, difficulty: l.difficulty, minutes: l.minutes, badge: l.badge };
  const d = DESK.find((x) => x.id === id)!;
  return { id, kind: 'desk' as const, num: 'Budget desk', title: d.title, topic: 'Balance Uncle Sam’s books with real options CBO has priced', difficulty: d.difficulty, minutes: d.minutes, badge: `${d.difficulty} mission` };
}

export default function Journey() {
  const j = useJourney();
  const votes = useVotes();
  const game = loadProgress();
  const done = PATH.filter((id) => j.done.includes(id));
  const nextId = PATH.find((id) => !j.done.includes(id) && isUnlocked(id, j.done, j.settings.freeRoam));
  const next = nextId ? stopInfo(nextId) : null;
  const minutesLeft = ALL_STOPS.filter((s) => !j.done.includes(s.id)).reduce((a, s) => a + s.minutes, 0);
  const total = ALL_STOPS.reduce((a, s) => a + s.minutes, 0);
  const rank = rankFor(done.length);
  const finished = done.length === PATH.length;
  const fresh = !j.started && done.length === 0;
  const T = budget.receiptsByFY[String(budget.latestFY)]?.reduce((s, r) => s + r.amount, 0) ?? 0;

  return (
    <div className="journey">
      <section className="journey-hero">
        <div className="journey-copy">
          <div className="eyebrow">A civic game about the federal budget</div>
          <h1 className="page-title">Help Uncle Sam balance the budget</h1>
          <SamSays mood={finished ? 'proud' : fresh ? 'happy' : 'thinking'} size={150}>
            {finished
              ? <>We did it, partner. You’ve seen where every dollar comes from and goes, and you’ve weighed in on the big choices. That makes you an informed budget voter.</>
              : fresh
                ? <>Howdy. I’m Uncle Sam. I took in {moneyWords(T)} last year, and I still spent more than I made. I need a level-headed adviser to help me understand my books and decide what to do. Got a few minutes?</>
                : <>Welcome back. You’re my {rank.name.toLowerCase()} now. Let’s pick up where we left off.</>}
          </SamSays>
          <div className="sb-actions">
            {next && <a className="btn btn-primary btn-lg" href={'#' + next.id}>{fresh ? 'Start level 1' : `Continue: ${next.num}${next.kind === 'level' ? `, ${next.title}` : ` (${next.difficulty})`}`}</a>}
            <a className="btn" href="#overview">Skip the game and read the guide</a>
          </div>
        </div>
        <div className="card journey-progress" aria-label="Your progress">
          <div className="jp-rank">
            <span className="stat-label">Your title</span>
            <strong>{rank.name}</strong>
          </div>
          <div className="jp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={PATH.length} aria-valuenow={done.length} aria-label={`${done.length} of ${PATH.length} stops done`}>
            {PATH.map((id) => <span key={id} data-done={j.done.includes(id)} data-desk={id.startsWith('desk')} />)}
          </div>
          <div className="small"><strong>{done.length} of {PATH.length}</strong> stops done · {finished ? 'all done' : `about ${minutesLeft} of ${total} minutes left`}</div>
          <p className="small muted">Each level turns official reports into a few short steps, a couple of questions, and one vote. The full chapters and original documents are always one click away.</p>
        </div>
      </section>

      <Section id="map" title="The road map" sub="Levels get harder as you go. Finishing chapters unlocks the budget desk, where you try to fix the budget yourself.">
        <ol className="roadmap">
          {PATH.map((id, k) => {
            const s = stopInfo(id);
            const isDone = j.done.includes(id);
            const open = isUnlocked(id, j.done, j.settings.freeRoam);
            const stars = s.kind === 'desk' ? game.stars[DESK.find((d) => d.id === id)!.goal] ?? 0 : 0;
            return (
              <li key={id} className="stop" data-done={isDone} data-open={open} data-kind={s.kind} data-next={id === nextId}>
                <span className="stop-node" aria-hidden="true">{isDone ? '✓' : open ? k + 1 : <LockIcon />}</span>
                <div className="stop-body">
                  <div className="stop-meta"><span>{s.num}</span><span className={'pill ' + (s.difficulty === 'Easy' || s.difficulty === 'Normal' ? 'pill-ok' : s.difficulty === 'Medium' || s.difficulty === 'Hard' ? 'pill-warn' : 'pill-crit')}>{s.difficulty}</span><span className="muted">about {s.minutes} min</span>{s.kind === 'desk' && stars > 0 && <Stars n={stars} size="sm" label={`Best: ${stars} of 3 stars`} />}</div>
                  <h3 className="stop-title">{open ? <a href={'#' + id}>{s.title}</a> : s.title}</h3>
                  <div className="small muted">{open ? s.topic : unlockText(id)}</div>
                </div>
                {open && <a className={'btn' + (id === nextId ? ' btn-primary' : '')} href={'#' + id} aria-label={`${isDone ? 'Replay' : 'Play'} ${s.num}: ${s.title}`}>{isDone ? 'Replay' : id === nextId ? 'Play' : 'Open'}</a>}
              </li>
            );
          })}
        </ol>
      </Section>

      <Section id="ballot" title="Your budget ballot" sub={votes.available ? 'Your votes from each level, counted with everyone else who opened this page.' : 'Your votes from each level, saved in this browser.'}>
        <Ballot />
      </Section>

      <Section id="awards" title="Certificates" sub="Earn one for each level you finish. Saved in this browser only.">
        <div className="badges">
          {LEVELS.map((l) => {
            const got = j.done.includes(l.id);
            return (
              <div key={l.id} className="badge" data-got={got}>
                <span className="badge-medal" aria-hidden="true">{got ? '★' : l.n}</span>
                <div><strong>{l.badge}: explained</strong><div className="small muted">{got ? `Level ${l.n} complete` : `Finish level ${l.n}, ${l.title}`}</div></div>
              </div>
            );
          })}
          {DESK.map((d) => {
            const got = j.done.includes(d.id);
            return (
              <div key={d.id} className="badge" data-got={got}>
                <span className="badge-medal" aria-hidden="true">{got ? '★' : '$'}</span>
                <div><strong>Budget desk: {d.difficulty}</strong><div className="small muted">{got ? 'Mission complete' : d.title}</div></div>
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
            </div>
          </div>
        )}
      </Section>

      <Section id="settings" title="Reading settings" sub="Make the game comfortable to read. These are saved in this browser.">
        <div className="card"><ReadingSettings /></div>
      </Section>

      <Section id="fine-print" title="Prefer the full story?" sub="Nothing in the game is hidden. Every level links to its full chapter and to the original government documents.">
        <div className="grid-2">
          <div className="card">
            <div className="chart-title">The field guide</div>
            <p className="small muted">Every chapter of this site, with all charts, data tables, and sources.</p>
            <ul className="link-list">
              <li><a href="#overview">The big picture</a></li>
              <li><a href="#spending">Where it goes</a> and <a href="#revenue">where it comes from</a></li>
              <li><a href="#gap">Deficits</a> and <a href="#debt">debt</a></li>
              <li><a href="#process">How Congress budgets</a> and <a href="#laws">laws that moved the needle</a></li>
              <li><a href="#state">Your state and district</a> and <a href="#social-security">Social Security</a></li>
              <li><a href="#glossary">Glossary</a> and <a href="#sources">every source, with methods</a></li>
            </ul>
          </div>
          <div className="card">
            <div className="chart-title">The original documents</div>
            <p className="small muted">The official sources the numbers come from, unedited.</p>
            <ul className="link-list">
              <li><a href="https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/" target="_blank" rel="noreferrer">Monthly Treasury Statement</a> (U.S. Treasury)</li>
              <li><a href="https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/" target="_blank" rel="noreferrer">Historical Tables of the U.S. Budget</a> (OMB)</li>
              <li><a href="https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/" target="_blank" rel="noreferrer">Debt to the Penny</a> (U.S. Treasury)</li>
              <li><a href="https://www.ssa.gov/oact/TR/2026/tr2026.pdf" target="_blank" rel="noreferrer">2026 Social Security Trustees Report</a> (PDF)</li>
              <li><a href={OPTIONS_DATA.volume.url} target="_blank" rel="noreferrer">{OPTIONS_DATA.volume.title}</a> (CBO)</li>
              <li><a href="https://www.usaspending.gov/" target="_blank" rel="noreferrer">USAspending.gov</a> (federal awards by place)</li>
            </ul>
          </div>
        </div>
      </Section>
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
  const text = ['My budget ballot (Follow the Federal Dollar)', ...cast.map((r) => `• ${r.q}: ${r.a}`)].join('\n');
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
      </div>
      {copied === 'manual' && <textarea className="input" readOnly rows={6} value={text} onFocus={(e) => e.currentTarget.select()} aria-label="Your ballot, ready to copy" />}
    </div>
  );
}

export function LockIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2.5" y="6" width="9" height="6.5" rx="1.5" fill="currentColor" /><path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>;
}
