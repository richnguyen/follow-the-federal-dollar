import { useEffect, useRef, useState } from 'react';
import { SOURCE_BY_ID } from '../data';
import { money, pct } from '../lib/format';
import { OPTIONS_DATA } from '../lib/planData';
import { type Choice, useVotes } from '../lib/votes';
import { DESK, isUnlocked, LEVELS, type Level, type Quiz, type Step, unlockText, type VoteSpec } from './levels';
import { useJourney } from './state';
import { SamSays, UncleSam } from './UncleSam';

const CHOICE_LETTERS = ['A', 'B', 'C', 'D'];

export default function LevelPage({ id }: { id: string }) {
  const level = LEVELS.find((l) => l.id === id)!;
  const j = useJourney();
  if (!isUnlocked(id, j.done, j.settings.freeRoam)) return <Locked level={level} />;
  return <LevelRun key={id} level={level} />;
}

function Locked({ level }: { level: Level }) {
  const j = useJourney();
  const next = LEVELS.find((l) => !j.done.includes(l.id) && isUnlocked(l.id, j.done, false));
  return (
    <div className="level">
      <LevelHead level={level} />
      <SamSays mood="thinking">We’ll get there. This level builds on the one before it. {unlockText(level.id)}.</SamSays>
      <div className="sb-actions" style={{ marginTop: 16 }}>
        {next && <a className="btn btn-primary" href={'#' + next.id}>Go to level {next.n}: {next.title}</a>}
        <button type="button" className="btn" onClick={() => j.setSettings({ freeRoam: true })}>Unlock every level (free roam)</button>
        {level.deepDive.map((d) => <a key={d.route} className="btn" href={'#' + d.route}>Read the full chapter: {d.label}</a>)}
      </div>
    </div>
  );
}

function LevelHead({ level }: { level: Level }) {
  return (
    <header className="level-head">
      <div className="eyebrow">Level {level.n} of {LEVELS.length} · {level.difficulty} · about {level.minutes} min</div>
      <h1 className="page-title">{level.title}</h1>
      <p className="lede">{level.topic}</p>
    </header>
  );
}

function LevelRun({ level }: { level: Level }) {
  const j = useJourney();
  const doneSteps = j.steps[level.id] ?? [];
  const firstOpen = level.steps.findIndex((_, i) => !doneSteps.includes(i));
  const [i, setI] = useState(() => (j.done.includes(level.id) ? level.steps.length : firstOpen < 0 ? level.steps.length : firstOpen));
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => { j.start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (n: number) => {
    setI(n);
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const finishStep = () => {
    j.completeStep(level.id, i);
    if (i === level.steps.length - 1) j.completeLevel(level.id);
    go(i + 1);
  };

  const step = level.steps[i];
  const quizOk = step?.kind !== 'quiz' || !!j.quiz[step.quiz!.id]?.correct || (j.quiz[step.quiz!.id]?.tries ?? 0) >= 2;
  return (
    <div className="level" ref={top}>
      <LevelHead level={level} />
      <StepTrack level={level} at={i} done={doneSteps} finished={j.done.includes(level.id)} onGo={go} />
      {step ? (
        <section className="level-stage" aria-live="polite" aria-labelledby="step-label">
          <div className="step-count" id="step-label">Step {i + 1} of {level.steps.length} · {step.label}</div>
          <StepBody step={step} />
          <div className="level-nav">
            <button type="button" className="btn" onClick={() => go(Math.max(0, i - 1))} disabled={i === 0}>Back</button>
            <button type="button" className="btn btn-primary" onClick={finishStep} disabled={!quizOk}>
              {step.kind === 'vote' ? (hasVoted(step.vote!, j.choices) ? 'Finish the level' : 'Skip the vote and finish') : i === level.steps.length - 1 ? 'Finish the level' : 'Continue'}
            </button>
            {!quizOk && <span className="small muted">Answer the question to continue.</span>}
          </div>
        </section>
      ) : (
        <Complete level={level} onReview={() => go(0)} />
      )}
      <FinePrint level={level} />
    </div>
  );
}

function hasVoted(v: VoteSpec, choices: Record<string, string>) {
  return v.kind === 'option' ? !!choices['option:' + v.optionId] : !!choices[v.id];
}

function StepTrack({ level, at, done, finished, onGo }: { level: Level; at: number; done: number[]; finished: boolean; onGo: (n: number) => void }) {
  const n = level.steps.length;
  const count = finished ? n : done.length;
  return (
    <nav className="steptrack" aria-label="Steps in this level">
      <div className="steptrack-bar" role="progressbar" aria-valuemin={0} aria-valuemax={n} aria-valuenow={count} aria-label={`${count} of ${n} steps done`}>
        {level.steps.map((s, k) => {
          const isDone = finished || done.includes(k);
          const reachable = isDone || k <= Math.max(at, done.length ? Math.max(...done) + 1 : 0);
          return (
            <button key={s.id} type="button" className="steptrack-seg" data-done={isDone} data-current={k === at} disabled={!reachable} onClick={() => onGo(k)} aria-current={k === at ? 'step' : undefined} title={s.label}>
              <span className="sr-only">Step {k + 1}: {s.label}{isDone ? ' (done)' : ''}</span>
            </button>
          );
        })}
      </div>
      <ol className="steptrack-labels">
        {level.steps.map((s, k) => (
          <li key={s.id} data-done={finished || done.includes(k)} data-current={k === at}>
            <span aria-hidden="true">{finished || done.includes(k) ? '✓' : k + 1}</span> {s.label}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function StepBody({ step }: { step: Step }) {
  if (step.kind === 'story') return <SamSays mood={step.mood} size={150}>{step.sam}</SamSays>;
  if (step.kind === 'quiz') return <QuizCard quiz={step.quiz!} />;
  if (step.kind === 'vote') return (
    <>
      {step.sam && <SamSays mood={step.mood} compact>{step.sam}</SamSays>}
      <VoteCard vote={step.vote!} />
    </>
  );
  return (
    <>
      {step.sam && <SamSays mood={step.mood} compact>{step.sam}</SamSays>}
      <div className="card level-card">{step.body?.()}</div>
    </>
  );
}

function QuizCard({ quiz }: { quiz: Quiz }) {
  const j = useJourney();
  const rec = j.quiz[quiz.id];
  const [picked, setPicked] = useState<number | null>(rec?.correct ? quiz.correct : null);
  const [wrong, setWrong] = useState<number[]>([]);
  const solved = picked === quiz.correct;
  const revealed = !solved && (rec?.tries ?? 0) >= 2;
  const pick = (k: number) => {
    if (solved) return;
    setPicked(k);
    if (k !== quiz.correct) setWrong((w) => (w.includes(k) ? w : [...w, k]));
    j.answer(quiz.id, k === quiz.correct);
  };
  const mood = solved ? 'proud' : picked != null ? 'thinking' : 'happy';
  return (
    <div className="quiz">
      <SamSays mood={mood} compact>{solved ? (rec && rec.tries > 1 ? 'You got it. Nice work sticking with it.' : 'That’s right!') : picked != null ? (revealed ? 'That one’s tricky. Here’s the answer.' : 'Not quite. Want to try again?') : 'Quick check. Take your best guess; there’s no penalty.'}</SamSays>
      <fieldset className="card quiz-card">
        <legend className="quiz-q">{quiz.question}</legend>
        <div className="quiz-choices">
          {quiz.choices.map((c, k) => {
            const state = solved && k === quiz.correct ? 'right' : revealed && k === quiz.correct ? 'answer' : wrong.includes(k) ? 'wrong' : undefined;
            return (
              <button key={k} type="button" className="quiz-choice" data-state={state} aria-pressed={picked === k} disabled={solved || (wrong.includes(k) && !revealed) || (revealed && k !== quiz.correct)} onClick={() => pick(k)}>
                <span className="quiz-letter" aria-hidden="true">{state === 'right' || state === 'answer' ? '✓' : state === 'wrong' ? '✕' : CHOICE_LETTERS[k]}</span>
                <span>{c}</span>
              </button>
            );
          })}
        </div>
        {(solved || revealed || picked != null) && (
          <div className="quiz-feedback" data-ok={solved} role="status">
            <strong>{solved ? 'Correct.' : revealed ? `The answer is ${CHOICE_LETTERS[quiz.correct]}.` : 'Not quite.'}</strong>{' '}
            {solved || revealed ? quiz.explain : 'Give it another try.'}
          </div>
        )}
      </fieldset>
    </div>
  );
}

function VoteCard({ vote }: { vote: VoteSpec }) {
  const j = useJourney();
  const votes = useVotes();
  if (vote.kind === 'option') {
    const o = OPTIONS_DATA.options.find((x) => x.id === vote.optionId)!;
    const key = 'option:' + o.id;
    const mine = votes.available ? votes.mine.options[o.id] : undefined;
    const local = j.choices[key];
    const cur = mine === 1 ? 'support' : mine === -1 ? 'oppose' : local;
    const t = votes.options[o.id] ?? { support: 0, oppose: 0 };
    const n = t.support + t.oppose;
    const cast = (v: 'support' | 'oppose') => {
      j.choose(key, cur === v ? '' : v);
      if (votes.available && votes.canVote !== false) votes.voteOption(o.id, (v === 'support' ? 1 : -1) as Choice);
    };
    return (
      <article className="card ballot">
        <div className="eyebrow">{o.side === 'revenue' ? 'Tax option' : 'Spending option'} · priced by CBO</div>
        <h2 className="ballot-title">{o.name}</h2>
        <p>{o.summary}</p>
        <dl className="ballot-facts">
          <div><dt>Ten-year savings</dt><dd className="num">{money(o.savings10 * 1e9)}</dd></div>
          <div><dt>Who it affects</dt><dd>{o.affects}</dd></div>
        </dl>
        {o.obbbaNote && <p className="small muted">{o.obbbaNote}</p>}
        <div className="ballot-actions" role="group" aria-label="Your vote">
          <button type="button" className={'vote-btn' + (cur === 'support' ? ' on' : '')} aria-pressed={cur === 'support'} onClick={() => cast('support')}>Support</button>
          <button type="button" className={'vote-btn' + (cur === 'oppose' ? ' on' : '')} aria-pressed={cur === 'oppose'} onClick={() => cast('oppose')}>Oppose</button>
          {cur && <span className="small muted">Your vote is recorded. You can change it any time.</span>}
        </div>
        {votes.available && cur && n > 0 && (
          <div className="vote-tally" aria-label={`${t.support} support, ${t.oppose} oppose`}>
            <span className="vote-bar"><span style={{ width: `${(t.support / n) * 100}%`, background: 'var(--div-neg)' }} /><span style={{ width: `${(t.oppose / n) * 100}%`, background: 'var(--div-pos)' }} /></span>
            <span className="small muted num">{pct(t.support / n, 0)} support · {n} vote{n === 1 ? '' : 's'}</span>
          </div>
        )}
        <VoteFoot votes={votes} />
        <p className="small"><a href={o.source.url} target="_blank" rel="noreferrer">Read CBO’s full write-up of this option</a></p>
      </article>
    );
  }
  const shared = votes.available ? votes.mine.issues[vote.id] : undefined;
  const cur = shared ?? j.choices[vote.id];
  const tally = votes.issues[vote.id] ?? {};
  const n = Object.values(tally).reduce((a, b) => a + b, 0);
  const cast = (v: string) => {
    j.choose(vote.id, cur === v ? '' : v);
    if (votes.available && votes.canVote !== false) votes.voteIssue(vote.id, v);
  };
  return (
    <article className="card ballot">
      <div className="eyebrow">Your vote</div>
      <h2 className="ballot-title">{vote.question}</h2>
      <p className="small" style={{ color: 'var(--ink-2)' }}>{vote.context}</p>
      <div className="ballot-choices" role="radiogroup" aria-label={vote.question}>
        {vote.choices.map((c) => (
          <button key={c.value} type="button" role="radio" aria-checked={cur === c.value} className="ballot-choice" onClick={() => cast(c.value)}>
            <span className="ballot-radio" aria-hidden="true" />
            <span className="ballot-label">{c.label}</span>
            {votes.available && cur && n > 0 && (
              <span className="ballot-share num">
                <span className="ballot-share-bar"><span style={{ width: `${((tally[c.value] ?? 0) / n) * 100}%` }} /></span>
                {pct((tally[c.value] ?? 0) / n, 0)}
              </span>
            )}
          </button>
        ))}
      </div>
      {cur && <p className="small muted">Your vote is recorded{votes.available && n > 0 ? `, along with ${n - 1 > 0 ? `${n - 1} other${n - 1 === 1 ? '' : 's'}` : 'no others yet'}` : ''}. You can change it any time.</p>}
      <VoteFoot votes={votes} />
    </article>
  );
}

function VoteFoot({ votes }: { votes: ReturnType<typeof useVotes> }) {
  if (!votes.available) return <p className="small muted">Your votes are saved in this browser and collected on your ballot on the Journey page.</p>;
  if (votes.canVote === false) return <p className="small muted">You can see the results, but adding your vote to the shared count needs Contributor access to this page. Your choice is still saved in this browser.</p>;
  if (votes.error) return <p className="small muted">{votes.error}</p>;
  return <p className="small muted">An informal poll of people who opened this page, not a scientific survey. One ballot per person.</p>;
}

function Complete({ level, onReview }: { level: Level; onReview: () => void }) {
  const j = useJourney();
  const next = LEVELS.find((l) => l.n === level.n + 1);
  const desk = DESK.find((d) => !j.done.includes(d.id) && isUnlocked(d.id, j.done, false));
  const quizzes = level.steps.filter((s) => s.quiz).map((s) => j.quiz[s.quiz!.id]);
  const firstTry = quizzes.filter((q) => q?.correct && q.tries === 1).length;
  const levelsDone = LEVELS.filter((l) => j.done.includes(l.id)).length;
  return (
    <section className="complete card" aria-labelledby="complete-t">
      <div className="complete-top">
        <UncleSam mood="proud" size={120} />
        <div>
          <div className="eyebrow">Level {level.n} complete</div>
          <h2 className="complete-title" id="complete-t">{level.badge}: explained</h2>
          <p className="small muted">{firstTry === quizzes.length ? 'Every question right on the first try. ' : `${firstTry} of ${quizzes.length} questions right on the first try. `}{levelsDone} of {LEVELS.length} chapter levels done.</p>
        </div>
      </div>
      <div className="stat-label">What we figured out together</div>
      <ul className="takeaways">
        {level.takeaways.map((t) => <li key={t}>{t}</li>)}
      </ul>
      {desk && <div className="callout"><div className="callout-title">New at the budget desk</div><p className="small">You unlocked the <strong>{desk.difficulty}</strong> mission: {desk.title.toLowerCase()}. <a href={'#' + desk.id}>Try it now</a></p></div>}
      <div className="sb-actions">
        {next ? <a className="btn btn-primary" href={'#' + next.id}>Next: level {next.n}, {next.title}</a> : <a className="btn btn-primary" href="#journey">Back to the journey</a>}
        <a className="btn" href="#journey">See your progress</a>
        <button type="button" className="btn" onClick={onReview}>Review this level</button>
      </div>
    </section>
  );
}

function FinePrint({ level }: { level: Level }) {
  const docs = [
    ...level.sources.map((s) => SOURCE_BY_ID[s]).filter(Boolean).map((d) => ({ title: d.title, url: d.url, by: d.publisher as string | undefined })),
    ...(level.links ?? []).map((d) => ({ title: d.title, url: d.url, by: undefined })),
  ].filter((d, k, a) => a.findIndex((x) => x.url === d.url) === k);
  const item = (d: (typeof docs)[number]) => <li key={d.url}><a href={d.url} target="_blank" rel="noreferrer">{d.title}</a>{d.by && <span className="muted"> ({d.by})</span>}</li>;
  return (
    <aside className="fineprint" aria-label="The fine print">
      <div>
        <div className="stat-label">The full chapter</div>
        <ul>{level.deepDive.map((d) => <li key={d.route}><a href={'#' + d.route}>{d.label}</a>: every chart, with data tables and sources</li>)}</ul>
      </div>
      <div>
        <div className="stat-label">The original documents</div>
        <ul>{docs.slice(0, 5).map(item)}</ul>
        {docs.length > 5 && (
          <details className="fineprint-more">
            <summary>Show all {docs.length} documents</summary>
            <ul>{docs.slice(5).map(item)}</ul>
          </details>
        )}
      </div>
    </aside>
  );
}
