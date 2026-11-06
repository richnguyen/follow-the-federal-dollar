import { EconMeter, SplitBar, Stars } from '../components/game';
import { Section } from '../components/ui';
import { LAST_FY } from '../lib/assess';
import { pct } from '../lib/format';
import { acceptChallenge } from './challenge';
import { AgreementCard, assessShared, cardName, GOAL_PLAN, HeadToHead, whoPays } from './ChallengeParts';
import { PlanProposal } from './DeskExtras';
import { LevelIcon } from './icons';
import { STOP_BY_ID, STOPS } from './levels';
import { BALLOT, ballotFrom, closestPreset, compare, decodePlan, myName, planLink } from './plans';
import { PLAN_LINES } from './script';
import { useJourney } from './state';
import { SamSays } from './UncleSam';

// A friend's shared plan (#plan?p=…): what they did, how it scored, and the challenge to beat it.

export default function PlanPage({ param }: { param: string | null }) {
  const j = useJourney();
  const plan = param ? decodePlan(new URLSearchParams(param)) : null;
  if (!plan) {
    return (
      <div className="level">
        <header className="level-head"><h1 className="page-title">A plan from a friend</h1></header>
        <SamSays mood="worried" auto>{PLAN_LINES.broken}</SamSays>
        <div className="sb-actions"><a className="btn btn-primary" href="#journey">Start the game</a></div>
      </div>
    );
  }
  const stop = STOP_BY_ID[plan.level];
  const by = plan.by || 'Your friend';
  const a = assessShared(plan);
  const mineSaved = j.plans?.[plan.level];
  const mine = mineSaved ? assessShared({ ...mineSaved, goal: plan.goal }) : null;
  // Cards count only once the player has a plan of their own on this level; until then, only the
  // big questions both of you answered.
  const agreement = compare({ ids: mineSaved?.ids ?? [], ballot: ballotFrom(j.choices) }, { ids: mineSaved ? plan.ids : [], ballot: plan.ballot });
  const near = closestPreset(plan.ids);
  const slidersUsed = Object.values(plan.lv).some((v) => v !== 0);
  const taxes = a.shares.filter((s) => s.side === 'revenue');
  const cuts = a.shares.filter((s) => s.side === 'spending');
  const answered = BALLOT.filter((q) => plan.ballot?.[q.key]);
  const myLink = mineSaved ? planLink({ level: plan.level, goal: plan.goal, ids: mineSaved.ids, lv: mineSaved.lv, gradual: mineSaved.gradual, by: myName() || undefined, ballot: ballotFrom(j.choices) }) : undefined;
  const take = () => { acceptChallenge(plan); location.hash = plan.level; };
  const share = (x: number) => (x >= 1 ? 'the whole gap' : x < 0.01 ? 'under 1%' : `${Math.round(x * 100)}%`);

  return (
    <div className="level planpage">
      <header className="level-head">
        <div className="eyebrow level-eyebrow"><LevelIcon id={stop.icon} size={16} /> A plan from a friend · level {stop.n} of {STOPS.length} · {stop.difficulty}</div>
        <h1 className="page-title">{by === 'Your friend' ? 'Your friend’s' : `${by}’s`} {GOAL_PLAN[plan.goal]}</h1>
      </header>
      <SamSays mood="surprised" auto>{mine ? PLAN_LINES.played : PLAN_LINES.intro}</SamSays>

      <section className="card friendplan" aria-label="How the plan scores">
        <div className="friendplan-head">
          <Stars n={a.ev.stars} size="lg" label={`${a.ev.stars} of 3 stars`} />
          <div>
            <strong>{a.met ? 'Meets the goal' : `Closes ${Math.round(a.progress * 100)}% of the gap`}</strong>
            <div className="small muted">FY{LAST_FY}: deficit {a.last.deficit <= 0 ? 'balanced' : `${pct(a.last.deficit / a.last.gdp, 1)} of GDP`}, debt {pct(a.last.debt / a.last.gdp, 0)} of GDP · {a.shares.length} card{a.shares.length === 1 ? '' : 's'}{slidersUsed ? ' plus across-the-board changes' : ''}{plan.gradual ? ', phased in' : ''}</div>
          </div>
        </div>
        <div className="friendplan-bars">
          <div><div className="stat-label">Hit to the economy</div><EconMeter peakStep={a.econ.peakStep} /></div>
          <div><div className="stat-label">Who pays: {whoPays(a)}</div><SplitBar revenue={a.revTen} spending={a.spTen} /></div>
        </div>
      </section>

      <div className="sb-actions plan-cta">
        <button type="button" className="btn btn-primary btn-lg" onClick={take}>{mine ? 'Play it again and try to beat it' : 'Take the challenge'}</button>
        <a className="btn" href="#journey">Start the game from level 1</a>
      </div>
      <p className="small muted">The challenge opens level {stop.n} right away, even if you haven’t reached it yet. Beat {by === 'Your friend' ? 'their' : `${by}’s`} plan on stars, a gentler steepest year for the economy, or fewer cards.</p>

      {mine && (
        <Section id="vs" title="Your plan against theirs" sub={`Your latest plan on level ${stop.n}, scored the same way.`}>
          <HeadToHead mine={mine} theirs={a} by={by === 'Your friend' ? 'Them' : by} />
        </Section>
      )}
      {agreement.of > 0 && (
        <Section id="agree" title="How much you agree">
          <AgreementCard a={agreement} by={by === 'Your friend' ? 'your friend' : by} shareUrl={myLink} />
        </Section>
      )}

      <Section id="cards" title="The cards they played" sub="Each card’s share of the gap is measured on its own; together they can add up to a little less, because they interact through interest costs.">
        <div className="grid-2">
          {[{ t: 'Taxes', list: taxes }, { t: 'Spending cuts', list: cuts }].map((g) => (
            <div className="card" key={g.t}>
              <div className="stat-label">{g.t}</div>
              {g.list.length ? (
                <ul className="plan-cards">{g.list.map((s) => <li key={s.id}><span>{cardName(s.id)}</span><span className="num muted">{share(s.share)}</span></li>)}</ul>
              ) : <p className="small muted">None.</p>}
            </div>
          ))}
        </div>
        {near && <div style={{ marginTop: 10 }}><PlanProposal id={near.id} /><p className="small muted">Their plan is closest to the ready-made plan “{near.name}”.</p></div>}
      </Section>

      {answered.length > 0 && (
        <Section id="ballot" title="Their answers to the big questions">
          <ul className="plan-ballot">
            {answered.map((q) => {
              const v = plan.ballot![q.key];
              const yours = j.choices[q.key];
              return (
                <li key={q.key}>
                  <span className="small muted">Level {q.level}</span>
                  <strong>{q.question}</strong>
                  <span>{q.labels[q.values.indexOf(v)]}{yours ? <span className="small muted"> · you said {q.labels[q.values.indexOf(yours)] ?? yours}</span> : <span className="small muted"> · play level {q.level} to answer</span>}</span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
      <p className="small muted">Plans are scored with the same CBO estimates and rules as the game’s budget desk. See <a href="#sources">Sources &amp; methods</a>.</p>
    </div>
  );
}
