import { useEffect, useMemo, useRef, useState } from 'react';
import { TimeChart } from '../components/charts';
import { DragBars, EconMeter, GapBar, type GapSegment, LeverIcon, SIDE_COLOR, SplitBar, Stars, Toasts, useToasts, useTween } from '../components/game';
import { ChartFrame, Legend, PageHead, Section, Seg, Term } from '../components/ui';
import { budget, cbo } from '../data';
import { dateLabel, dollars, money, pct } from '../lib/format';
import { BADGES, earnedBadges, evaluate, loadProgress, MISSIONS, planText, type Progress, saveProgress } from '../lib/game';
import { economics, extraFor, type Goal, goalMet, MULT, mid, optimize, optionPath, type PlanContext, planCost, type Protect, score, shortfall } from '../lib/plan';
import { OPTIONS_DATA, PRESETS, withEcon } from '../lib/planData';
import { LEVERS, type LeverId, type Levers, simulate, ZERO } from '../lib/sandbox';
import { type Choice, useVotes } from '../lib/votes';
import { Celebration } from '../game/Celebrate';
import { DESK, type DeskLevel, isUnlocked, STOP_BY_ID, STOPS } from '../game/levels';
import { useJourney } from '../game/state';
import { SamSays } from '../game/UncleSam';
import type { Mood } from '../game/voice';

type Desk = DeskLevel;

const LEVER_NAME: Record<LeverId, string> = {
  revenues: 'Taxes', socialSecurity: 'Social Security', medicare: 'Medicare', medicaid: 'Medicaid',
  otherMandatory: 'Farm and other programs', defense: 'Defense', nondefense: 'Grants and other programs',
};
const dragLevel = (s: number): 1 | 2 | 3 => (s < 0.55 ? 1 : s < 1.15 ? 2 : 3);
type Filter = 'all' | 'revenue' | 'spending';
type Sort = 'impact' | 'gentle';

export default function Sandbox({ desk }: { desk?: Desk }) {
  const startYear = budget.latestFY;
  const base = useMemo(() => cbo.baseline.filter((b) => b.fy > startYear), [startYear]);
  const start = cbo.baseline.find((b) => b.fy === startYear) ?? cbo.history.find((h) => h.fy === startYear)!;
  const ctx: PlanContext = useMemo(() => ({ baseline: base, startDebt: start.debtPublic, startRatio: start.debtPublic / start.gdp, options: withEcon() }), [base, start]);
  const years = base.map((b) => b.fy);
  const lastFY = years.at(-1)!;
  const HH = budget.households.value;

  const [goal, setGoal] = useState<Goal>(desk?.goal ?? 'stabilize');
  const journey = useJourney();
  const [gradual, setGradual] = useState(true);
  const [protect, setProtect] = useState<Protect>({ retirees: true, lowIncome: true, investment: true });
  const [mix, setMix] = useState(true);
  const [ids, setIds] = useState<string[]>([]);
  const [lv, setLv] = useState<Levers>({ ...ZERO });
  const [loaded, setLoaded] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('impact');
  const [progress, setProgressState] = useState<Progress>(() => loadProgress());
  const [copied, setCopied] = useState<'idle' | 'done' | 'manual'>('idle');
  const votes = useVotes();
  const toasts = useToasts();
  const mission = MISSIONS.find((m) => m.id === goal)!;

  // --- model ---
  const run = (sel: string[], levers: Levers) => simulate(base, ctx.startDebt, levers, { phaseIn: gradual, extra: extraFor(sel, ctx, gradual) });
  const baseline = useMemo(() => simulate(base, ctx.startDebt, ZERO), [base, ctx.startDebt]);
  const lastB = baseline.at(-1)!;
  const short0 = shortfall(goal, baseline, ctx.startRatio);
  const shareOf = useMemo(() => {
    // Each card's share of the gap, measured on its own.
    const m: Record<string, number> = {};
    for (const o of ctx.options) m[o.id] = short0 > 0 ? (short0 - shortfall(goal, run([o.id], ZERO), ctx.startRatio)) / short0 : 0;
    return m;
  }, [goal, gradual, ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const mine = useMemo(() => run(ids, lv), [ids, lv, gradual, ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const cardsOnly = useMemo(() => run(ids, ZERO), [ids, gradual, ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const last = mine.at(-1)!;
  const prog = short0 > 0 ? (short0 - shortfall(goal, mine, ctx.startRatio)) / short0 : 1;
  const progCards = short0 > 0 ? (short0 - shortfall(goal, cardsOnly, ctx.startRatio)) / short0 : 1;
  const met = goalMet(goal, mine, ctx.startRatio);
  const econ = useMemo(() => economics(ctx, ids, lv, gradual), [ctx, ids, lv, gradual]);
  const selected = ctx.options.filter((o) => ids.includes(o.id));
  const revTen = selected.filter((o) => o.side === 'revenue').reduce((s, o) => s + o.savings10, 0);
  const spTen = selected.filter((o) => o.side === 'spending').reduce((s, o) => s + o.savings10, 0);
  const revenueShare = revTen + spTen ? revTen / (revTen + spTen) : 0;
  const slidersUsed = Object.values(lv).some((v) => v !== 0);
  const crossesRules = selected.some((o) => o.econ.tags.some((t) => t === 'retirees' || t === 'lowIncome' || t === 'investment'));

  // Segments: each card's own share, scaled so cards together equal their combined progress;
  // across-the-board changes fill whatever they add on top.
  const rawSum = selected.reduce((s, o) => s + Math.max(0, shareOf[o.id] ?? 0), 0);
  const k = rawSum > 0 ? Math.max(0, progCards) / rawSum : 0;
  const segments: GapSegment[] = [
    ...selected.filter((o) => o.side === 'revenue').map((o) => ({ id: o.id, label: o.name, share: Math.max(0, shareOf[o.id]) * k, side: o.side })),
    ...selected.filter((o) => o.side === 'spending').map((o) => ({ id: o.id, label: o.name, share: Math.max(0, shareOf[o.id]) * k, side: o.side })),
    ...(slidersUsed && prog - progCards > 0.001 ? [{ id: 'sliders', label: 'Across-the-board changes', share: prog - progCards, side: (lv.revenues > 0 ? 'revenue' : 'spending') as 'revenue' | 'spending' }] : []),
  ];

  const econPlan = useMemo(() => optimize(ctx, goal, protect, gradual, mix ? 1 / 3 : 0), [ctx, goal, protect, gradual, mix]);
  const econCost = econPlan.met ? planCost(ctx, econPlan.ids) : null;
  const myCost = planCost(ctx, ids);
  const efficiency = met && !slidersUsed && econCost != null && myCost > 0 ? Math.min(100, Math.round((econCost / myCost) * 100)) : null;

  // Coaching: the gentlest unused card that would finish the job on its own, else the biggest;
  // cards that break the protections are suggested only when nothing else is left.
  const remaining = Math.max(0, 1 - prog);
  const isCrossing = (o: (typeof ctx.options)[number]) => o.econ.tags.some((t) => t === 'retirees' || t === 'lowIncome' || t === 'investment');
  const unusedAll = ctx.options.filter((o) => !ids.includes(o.id) && (shareOf[o.id] ?? 0) > 0);
  const unused = unusedAll.some((o) => !isCrossing(o)) ? unusedAll.filter((o) => !isCrossing(o)) : unusedAll;
  const totalHarm = (o: (typeof ctx.options)[number]) => Math.max(0.01, score(o.econ)) * o.savings10;
  const finisher = unused.filter((o) => shareOf[o.id] >= remaining * 1.02).sort((a, b) => totalHarm(a) - totalHarm(b))[0];
  const biggest = [...unused].sort((a, b) => shareOf[b.id] - shareOf[a.id])[0];
  const suggest = finisher ?? biggest;
  const ev = evaluate({
    met, econ, revenueShare, count: selected.length, crossesRules,
    topLeft: suggest ? { name: suggest.name, pct: shareOf[suggest.id], finishes: !!finisher } : null,
    heavySide: selected.length ? (revenueShare > 2 / 3 ? 'revenue' : revenueShare < 1 / 3 ? 'spending' : null) : null,
  });
  const voted = Object.keys(votes.mine.options).length > 0 || !!votes.mine.plan;

  // --- rewards: best stars per mission and badges, saved in this browser ---
  const first = useRef(true);
  useEffect(() => {
    const earned = earnedBadges({ goal, ev, count: selected.length, revenueShare, efficiency: loaded === 'economists' ? null : efficiency, voted });
    const fresh = earned.filter((b) => !progress.badges.includes(b));
    const best = Math.max(progress.stars[goal] ?? 0, ev.stars);
    if (fresh.length || best !== (progress.stars[goal] ?? 0)) {
      const next: Progress = { stars: { ...progress.stars, [goal]: best }, badges: [...progress.badges, ...fresh] };
      setProgressState(next);
      saveProgress(next);
      if (!first.current && fresh.length) {
        const names = fresh.map((b) => BADGES.find((x) => x.id === b)?.name).filter(Boolean);
        toasts.push(names.length === 1 ? `Badge unlocked: ${names[0]}` : `${names.length} badges unlocked: ${names.join(', ')}`);
      }
    }
    first.current = false;
  }, [ev.stars, ev.met, ev.gentle, ev.promiseKept, selected.length, revenueShare, efficiency, voted, goal]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- the journey: meeting the goal completes this level (free play counts once it is unlocked) ---
  const deskStop = desk ?? DESK.find((d) => d.goal === goal)!;
  const [party, setParty] = useState<number | null>(null);
  const wasMet = useRef(met);
  useEffect(() => {
    const counts = !!desk || isUnlocked(deskStop.id, journey.done, journey.settings.freeRoam);
    if (met && counts && (!journey.done.includes(deskStop.id) || ev.stars > (journey.stars[deskStop.id] ?? 0))) journey.completeLevel(deskStop.id, ev.stars);
    if (met && desk && !wasMet.current) setParty(ev.stars);
    wasMet.current = met;
  }, [met, ev.stars, deskStop.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const nextStop = desk ? STOPS[desk.n] : undefined;

  // Uncle Sam reacts to the plan as it changes, like a coach at the player's elbow.
  const steep = econ.peakStep > 0.01;
  const cardsCanWin = useMemo(() => goalMet(goal, run(ctx.options.map((o) => o.id), ZERO), ctx.startRatio), [goal, gradual, ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const coach: { mood: Mood; line: string } = met && slidersUsed && loaded === 'economists'
    ? { mood: 'cheering', line: 'We did it! The cards alone couldn’t get us there, so the hint added across-the-board changes too.' }
    : met
    ? (ev.stars === 3 ? { mood: 'cheering', line: 'Three stars! That’s a plan I could take to Congress.' } : { mood: 'cheering', line: 'We did it! Now, can we earn the other stars too?' })
    : prog <= 0.001
      ? { mood: 'worried', line: goal === 'stabilize' ? 'My debt is still outgrowing the economy. Pick a card to get us started.' : 'We haven’t made a dent yet. Pick a card to get us started.' }
      : steep
        ? { mood: 'surprised', line: 'Whoa, easy now. That’s a steep hit to the economy in a single year. Try phasing it in, or swap a card for a gentler one.' }
        : prog >= 0.75 && !cardsCanWin && !slidersUsed
          ? { mood: 'thinking', line: 'The cards alone won’t get us all the way. We’ll need some across-the-board changes, further down, or try the free hint.' }
        : prog >= 0.75
          ? { mood: 'happy', line: 'Almost there! One more card should do it.' }
          : prog >= 0.4
            ? { mood: 'thinking', line: 'Good progress. We’re partway there.' }
            : { mood: 'thinking', line: 'That’s a start. Keep going.' };

  // --- actions ---
  const toggle = (id: string) => { setLoaded(null); setCopied('idle'); setIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); };
  // When no combination of cards reaches the goal (balancing the budget, for one), the free hint
  // tops up with the smallest even mix of across-the-board tax increases and spending cuts, so no
  // level is ever left unwinnable.
  const topUp = (sel: string[]): Levers | null => {
    const room = (id: LeverId) => LEVERS.find((l) => l.id === id)!;
    for (let x = 1; x <= 40; x++) {
      const lv: Levers = { ...ZERO, revenues: Math.min(x, room('revenues').max), defense: -Math.min(x, -room('defense').min), nondefense: -Math.min(x, -room('nondefense').min), otherMandatory: -Math.min(x, -room('otherMandatory').min) };
      if (goalMet(goal, run(sel, lv), ctx.startRatio)) return lv;
    }
    return null;
  };
  const loadPlan = (pid: string) => {
    const p = PRESETS.find((x) => x.id === pid)!;
    const sel = p.optimizer ? econPlan.ids : p.ids ?? [];
    setIds(sel);
    setLv(p.optimizer && !econPlan.met ? topUp(sel) ?? { ...ZERO } : { ...ZERO });
    setLoaded(pid);
    setCopied('idle');
    document.getElementById('game')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const reset = () => { setIds([]); setLv({ ...ZERO }); setLoaded(null); setCopied('idle'); };
  const text = planText({ mission, names: selected.map((o) => o.name), deficit: pct(Math.max(0, last.deficit) / last.gdp, 1), debt: pct(last.debt / last.gdp, 0), stars: ev.stars, fy: lastFY });
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied('done'); } catch { setCopied('manual'); }
  };

  const shownProg = useTween(Math.max(0, prog));
  const stillNeeded = Math.max(0, shortfall(goal, mine, ctx.startRatio));
  const neededText = goal === 'stabilize' ? `${money(stillNeeded)} less debt by FY${lastFY}` : `${money(stillNeeded)} less borrowing in FY${lastFY}`;

  const deck = ctx.options
    .filter((o) => filter === 'all' || o.side === filter)
    .sort((a, b) => (sort === 'impact' ? (shareOf[b.id] ?? 0) - (shareOf[a.id] ?? 0) : score(a.econ) - score(b.econ)));

  const missionFacts = (g: Goal) => {
    if (g === 'stabilize') return `Debt is ${pct(ctx.startRatio, 0)} of GDP today and heads to ${pct(lastB.debt / lastB.gdp, 0)} by FY${lastFY}.`;
    if (g === 'deficit3') return `The deficit is projected at ${pct(lastB.deficit / lastB.gdp, 1)} of GDP in FY${lastFY}.`;
    return `That means closing a ${money(lastB.deficit)} deficit in FY${lastFY}.`;
  };

  return (
    <>
      <PageHead
        eyebrow={desk ? `Level ${desk.n} of ${STOPS.length} · ${desk.difficulty} level · budget desk` : 'Budget desk · free play'}
        title={desk ? mission.title : 'Can you fix the budget?'}
        lede={desk ? <>Play policy cards, real options the Congressional Budget Office (CBO) has priced, until the bar reaches the goal. Earn stars for going easy on the economy and for balancing tax increases with spending cuts.</> : <>Pick a mission, then play policy cards, real options the Congressional Budget Office (CBO) has priced, until the bar reaches the goal. Earn stars for going easy on the economy and for balancing tax increases with spending cuts.</>}
      />
      {desk && (
        <SamSays mood={met ? 'proud' : goal === 'balance' ? 'worried' : 'thinking'} auto={!met}>
          {met
            ? <>You did it, partner. That plan meets the goal. {ev.stars < 3 ? 'See if you can earn all three stars, or ' : ''}{nextStop ? <>move on to level {nextStop.n}.</> : <>that was the hardest level there is.</>}</>
            : goal === 'stabilize'
              ? <>Here’s my budget desk. My debt is growing faster than the economy. {missionFacts(goal)} Help me pick changes that stop that by FY{lastFY}, without knocking the economy flat or putting the whole load on one group.</>
              : goal === 'deficit3'
                ? <>Let’s be bolder. {missionFacts(goal)} Economists often point to about 3% as a level the country can keep up for the long haul. Can you get me there by FY{lastFY}?</>
                : <>The big one: no borrowing at all. {missionFacts(goal)} It hasn’t happened since FY2001. Fair warning: {cardsCanWin ? 'this takes a lot of cards.' : 'even every card on the table isn’t quite enough, so we’ll need some across-the-board changes too.'}</>}
        </SamSays>
      )}

      <ol className="howto" aria-label="How to play">
        <li><span className="howto-n">1</span><div>{desk ? <><strong>Know the goal.</strong> {mission.goalText}</> : <><strong>Choose a mission.</strong> Each one is a real target lawmakers and economists talk about.</>}</div></li>
        <li><span className="howto-n">2</span><div><strong>Play cards.</strong> Each card shows how much of the gap it closes and what it means per household.</div></li>
        <li><span className="howto-n">3</span><div><strong>Earn stars.</strong> Reach the goal, keep the economy steady, and balance taxes with cuts.</div></li>
      </ol>

      {!desk && <Section id="missions" title="Choose your mission">
        <div className="missions" role="radiogroup" aria-label="Mission">
          {MISSIONS.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={goal === m.id} className="mission" onClick={() => setGoal(m.id)}>
              <span className="mission-top"><span className={'pill ' + (m.level === 'Normal' ? 'pill-ok' : m.level === 'Hard' ? 'pill-warn' : 'pill-crit')}>{m.level}</span><Stars n={progress.stars[m.id] ?? 0} size="sm" label={`Best: ${progress.stars[m.id] ?? 0} of 3 stars`} /></span>
              <span className="mission-title">{m.title}</span>
              <span className="mission-goal">{m.goalText}</span>
              <span className="mission-fact">{missionFacts(m.id)}</span>
            </button>
          ))}
        </div>
      </Section>}

      <div className="game" id="game">
        <aside className="scoreboard card" aria-label="Scoreboard">
          <div className="sb-head">
            <div>
              <div className="eyebrow">{desk ? `Level ${desk.n} · ${desk.difficulty} level` : `${mission.level} mission`}</div>
              <div className="chart-title">{mission.short}</div>
            </div>
            <Stars n={ev.stars} size="lg" />
          </div>
          {desk && <div className="sb-coach"><SamSays mood={coach.mood} compact auto={party == null && !(met && !wasMet.current)} delay={900}>{coach.line}</SamSays></div>}
          <div aria-live="polite" className="sb-progress">
            <div className="sb-big">{met ? (desk ? 'Level complete!' : 'Mission complete!') : `${Math.min(99, Math.floor(shownProg * 100))}% of the way there`}</div>
            <GapBar segments={segments} progress={Math.max(0, prog)} />
            <div className="small muted">{met ? `You beat the goal: deficit ${last.deficit <= 0 ? 'balanced' : pct(last.deficit / last.gdp, 1) + ' of GDP'} and debt ${pct(last.debt / last.gdp, 0)} of GDP in FY${lastFY}.` : `Still needed: ${neededText}.`}</div>
          </div>
          <ul className="checks">
            {ev.checks.map((c) => (
              <li key={c.id} data-done={c.done}>
                <span className="check-mark" aria-hidden="true">{c.done ? '★' : '☆'}</span>
                <div><strong>{c.label}</strong><div className="small muted">{c.tip}</div></div>
              </li>
            ))}
          </ul>
          <div className="sb-block">
            <div className="stat-label">Hit to the economy</div>
            <EconMeter peakStep={econ.peakStep} />
            <label className="switch"><input type="checkbox" checked={gradual} onChange={(e) => setGradual(e.target.checked)} /> Phase in over 3 years</label>
          </div>
          <div className="sb-block">
            <div className="stat-label">Who pays: taxes vs. spending cuts (10-year savings)</div>
            <SplitBar revenue={revTen} spending={spTen} />
          </div>
          {efficiency != null && loaded !== 'economists' && (
            <div className="sb-block small"><strong>Efficiency {efficiency}/100.</strong> {efficiency >= 91 ? 'Your plan is about as gentle on the economy as the least-cost plan.' : `The least-cost plan for this mission does about ${Math.round((1 - efficiency / 100) * 100)}% less economic harm. Try the hint to compare.`}</div>
          )}
          <div className="sb-actions">
            <button type="button" className="btn" onClick={() => loadPlan('economists')} disabled={!econPlan.ids.length}>Free hint: the economists’ answer</button>
            <button type="button" className="btn" onClick={reset} disabled={!ids.length && !slidersUsed}>Start over</button>
            {met && <button type="button" className="btn btn-primary" onClick={copy}>{copied === 'done' ? 'Copied' : 'Copy my plan'}</button>}
          </div>
          {copied === 'manual' && <textarea className="input" readOnly rows={6} value={text} onFocus={(e) => e.currentTarget.select()} aria-label="Your plan, ready to copy" />}
          {desk && met && (
            <div className="sb-block sb-next">
              <strong>Level {desk.n} complete.</strong>
              <div className="sb-actions">
                {nextStop ? <a className="btn btn-primary" href={'#' + nextStop.id}>Play level {nextStop.n}</a> : <a className="btn btn-primary" href="#journey">See your certificate</a>}
                <a className="btn" href="#journey">Road map</a>
              </div>
            </div>
          )}
        </aside>

        <section className="deck" aria-labelledby="deck-t">
          <div className="deck-head">
            <h2 className="section-title" id="deck-t">Your policy cards</h2>
            <div className="deck-tools">
              <Seg<Filter> label="Show" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'revenue', label: 'Taxes' }, { value: 'spending', label: 'Spending cuts' }]} />
              <Seg<Sort> label="Sort" value={sort} onChange={setSort} options={[{ value: 'impact', label: 'Biggest impact' }, { value: 'gentle', label: 'Gentlest first' }]} />
            </div>
          </div>
          <p className="small muted">Numbers are CBO’s estimates. “Per household” spreads the FY{lastFY} amount across all {Math.round(HH / 1e6)} million U.S. households; real effects fall on the groups named on each card.</p>
          <div className="pcards">
            {deck.map((o) => {
              const on = ids.includes(o.id);
              const y = optionPath(o, base, gradual).at(-1)!;
              const share = shareOf[o.id] ?? 0;
              const t = votes.options[o.id] ?? { support: 0, oppose: 0 };
              const n = t.support + t.oppose;
              const rules = [
                o.econ.tags.includes('retirees') && 'Affects current retirees',
                o.econ.tags.includes('lowIncome') && 'Hits low-income families',
                o.econ.tags.includes('investment') && 'Cuts public investment',
              ].filter(Boolean) as string[];
              return (
                <article key={o.id} className="pcard" data-on={on} data-side={o.side}>
                  <div className="pcard-top">
                    <span className="pcard-icon" style={{ color: SIDE_COLOR[o.side] }}><LeverIcon lever={o.lever} /></span>
                    <span className="pcard-kind">{o.side === 'revenue' ? 'Tax' : `Spending cut · ${LEVER_NAME[o.lever]}`}</span>
                  </div>
                  <h3 className="pcard-title">{o.name}</h3>
                  <div className="pcard-big">{share >= 1 ? <>Closes <strong>the whole gap</strong>{share >= 1.5 ? ` (${(share).toFixed(1)}× over)` : ''}</> : <>Closes <strong>{share < 0.01 ? '<1%' : `${Math.round(share * 100)}%`}</strong> of the gap</>}</div>
                  <div className="pcard-sub num">{money(y)} in FY{lastFY} · about {dollars(y / HH)} per household</div>
                  <div className="pcard-meta">
                    <DragBars level={dragLevel(score(o.econ))} />
                    {o.econ.growth === 1 && <span className="pill">Helps long-run growth</span>}
                    {o.econ.growth === -1 && <span className="pill">Hurts long-run growth</span>}
                    {rules.map((r) => <span key={r} className="pill pill-warn">{r}</span>)}
                  </div>
                  <button type="button" className={'pcard-add' + (on ? ' on' : '')} aria-pressed={on} onClick={() => toggle(o.id)}>
                    {on ? '✓ In your plan' : '+ Add to plan'}
                  </button>
                  <details className="pcard-more">
                    <summary>What it does</summary>
                    <p>{o.summary}</p>
                    <p><strong>Who it affects:</strong> {o.affects}.</p>
                    <p><strong>Economic effect:</strong> {o.econ.why}</p>
                    {o.obbbaNote && <p className="muted">{o.obbbaNote}</p>}
                    <p><a href={o.source.url} target="_blank" rel="noreferrer">CBO’s estimate: {money(o.savings10 * 1e9)} over 10 years</a></p>
                  </details>
                  {votes.available && (
                    <div className="vote-row">
                      <button type="button" className={'vote-btn' + (votes.mine.options[o.id] === 1 ? ' on' : '')} aria-pressed={votes.mine.options[o.id] === 1} disabled={votes.canVote === false} onClick={() => votes.voteOption(o.id, 1 as Choice)}>Support</button>
                      <button type="button" className={'vote-btn' + (votes.mine.options[o.id] === -1 ? ' on' : '')} aria-pressed={votes.mine.options[o.id] === -1} disabled={votes.canVote === false} onClick={() => votes.voteOption(o.id, -1 as Choice)}>Oppose</button>
                      {n > 0 ? (
                        <span className="vote-tally" aria-label={`${t.support} support, ${t.oppose} oppose`}>
                          <span className="vote-bar"><span style={{ width: `${(t.support / n) * 100}%`, background: 'var(--div-neg)' }} /><span style={{ width: `${(t.oppose / n) * 100}%`, background: 'var(--div-pos)' }} /></span>
                          <span className="small muted num">{pct(t.support / n, 0)} support · {n}</span>
                        </span>
                      ) : <span className="small muted">No votes yet</span>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <div className="plan-bar" aria-hidden="true">
        <Stars n={ev.stars} size="sm" />
        <span className="plan-bar-track"><span style={{ width: `${Math.min(1, Math.max(0, prog)) * 100}%` }} /></span>
        <span className="num">{met ? 'Goal met' : `${Math.min(99, Math.floor(Math.max(0, prog) * 100))}%`}</span>
      </div>

      <Section id="plans" title="Or try a ready-made plan" sub={`How each plan does on the “${mission.short}” mission.${votes.available ? ' Pick the one you’d choose; results update live.' : ''}`}>
        <div className="grid-2">
          {PRESETS.map((p) => {
            const sel = p.optimizer ? econPlan.ids : p.ids ?? [];
            const sim = run(sel, ZERO);
            const e = economics(ctx, sel, ZERO, gradual);
            const opts = ctx.options.filter((o) => sel.includes(o.id));
            const r = opts.filter((o) => o.side === 'revenue').reduce((a, o) => a + o.savings10, 0);
            const s = opts.filter((o) => o.side === 'spending').reduce((a, o) => a + o.savings10, 0);
            const pe = evaluate({ met: goalMet(goal, sim, ctx.startRatio), econ: e, revenueShare: r + s ? r / (r + s) : 0, count: opts.length, crossesRules: false, heavySide: null });
            const pv = votes.plans[p.id] ?? 0;
            const pTot = Object.values(votes.plans).reduce((a, b) => a + b, 0);
            return (
              <article key={p.id} className="card preset">
                <div className="preset-head"><h3>{p.name}</h3><Stars n={pe.stars} size="sm" /></div>
                <p className="small muted">{p.blurb}</p>
                <SplitBar revenue={r} spending={s} />
                <p className="small">FY{lastFY}: deficit {pct(Math.max(0, sim.at(-1)!.deficit) / sim.at(-1)!.gdp, 1)} of GDP, debt {pct(sim.at(-1)!.debt / sim.at(-1)!.gdp, 0)}. {pe.met ? 'Meets the goal.' : 'Falls short of the goal.'}</p>
                <div className="sb-actions">
                  <button type="button" className="btn" onClick={() => loadPlan(p.id)} disabled={!sel.length}>{loaded === p.id ? 'Loaded' : 'Play this plan'}</button>
                  {votes.available && <button type="button" className={votes.mine.plan === p.id ? 'btn btn-primary' : 'btn'} aria-pressed={votes.mine.plan === p.id} disabled={votes.canVote === false} onClick={() => votes.votePlan(p.id)}>{votes.mine.plan === p.id ? 'My pick' : 'Pick this plan'}</button>}
                  {votes.available && <span className="small muted">{pv} of {pTot} vote{pTot === 1 ? '' : 's'}</span>}
                </div>
              </article>
            );
          })}
        </div>
        <VoteNote votes={votes} />
      </Section>

      <Section id="badges" title="Your badges" sub="Badges are saved in this browser only.">
        <div className="badges">
          {BADGES.map((b) => {
            const got = progress.badges.includes(b.id);
            return (
              <div key={b.id} className="badge" data-got={got}>
                <span className="badge-medal" aria-hidden="true">{got ? '★' : '?'}</span>
                <div><strong>{b.name}</strong><div className="small muted">{got ? b.desc : `Locked. ${b.desc}`}</div></div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section id="numbers" title="See the numbers" sub={`Your plan compared with the ${cbo.projShort}, which assumes ${cbo.projAssumes.replace(/^assuming /, '')}.`}>
        <div className="grid-2">
          <div className="card">
            <ChartFrame title="Deficit, share of GDP" legend={<Legend items={[{ label: cbo.projShort, color: 'var(--c-deemph)', kind: 'line' }, { label: 'Your plan', color: 'var(--c-emph)', kind: 'line' }]} />} sourceIds={[cbo.baselineSourceId]}
              table={{ columns: [{ key: 'fy', label: 'Fiscal year' }, { key: 'b', label: 'Projection', align: 'r' }, { key: 'm', label: 'Your plan', align: 'r' }], rows: mine.map((r, i) => ({ fy: `FY${r.fy}`, b: pct(baseline[i].deficit / baseline[i].gdp), m: pct(r.deficit / r.gdp) })) }}>
              <TimeChart label="Deficit as a share of GDP" x={years} tipTitle={(y) => `FY${y}`} height={220} zeroLine yFormat={(v) => `${+(v * 100).toFixed(1)}%`} tipFormat={(v) => pct(v)}
                series={[{ id: 'b', label: cbo.projShort, color: 'var(--c-deemph)', kind: 'line', values: baseline.map((r) => r.deficit / r.gdp), width: 2.5 }, { id: 'm', label: 'Your plan', color: 'var(--c-emph)', kind: 'line', values: mine.map((r) => r.deficit / r.gdp) }]} />
            </ChartFrame>
          </div>
          <div className="card">
            <ChartFrame title="Debt held by the public, share of GDP" legend={<Legend items={[{ label: cbo.projShort, color: 'var(--c-deemph)', kind: 'line' }, { label: 'Your plan', color: 'var(--c-emph)', kind: 'line' }]} />} sourceIds={[cbo.baselineSourceId]}
              table={{ columns: [{ key: 'fy', label: 'Fiscal year' }, { key: 'b', label: 'Projection', align: 'r' }, { key: 'm', label: 'Your plan', align: 'r' }], rows: mine.map((r, i) => ({ fy: `FY${r.fy}`, b: pct(baseline[i].debt / baseline[i].gdp, 1), m: pct(r.debt / r.gdp, 1) })) }}>
              <TimeChart label="Debt as a share of GDP" x={years} tipTitle={(y) => `FY${y}`} height={220} yFormat={(v) => `${Math.round(v * 100)}%`} tipFormat={(v) => pct(v)}
                yMin={Math.min(...baseline.map((r) => r.debt / r.gdp), ...mine.map((r) => r.debt / r.gdp), ctx.startRatio) - 0.02}
                series={[{ id: 'b', label: cbo.projShort, color: 'var(--c-deemph)', kind: 'line', values: baseline.map((r) => r.debt / r.gdp), width: 2.5 }, { id: 'm', label: 'Your plan', color: 'var(--c-emph)', kind: 'line', values: mine.map((r) => r.debt / r.gdp) }]} />
            </ChartFrame>
          </div>
        </div>
      </Section>

      <details className="card more">
        <summary className="chart-title">Rules for the economists’ hint</summary>
        <p className="small muted">The hint finds the plan that meets your mission with the least total harm to the economy. These rules limit what it may use.</p>
        <div className="chips" role="group" aria-label="Hint rules">
          <button type="button" className="chip" aria-pressed={mix} onClick={() => setMix(!mix)}>Mix taxes and cuts (each at least a third)</button>
          <button type="button" className="chip" aria-pressed={protect.retirees} onClick={() => setProtect({ ...protect, retirees: !protect.retirees })}>Protect current retirees</button>
          <button type="button" className="chip" aria-pressed={protect.lowIncome} onClick={() => setProtect({ ...protect, lowIncome: !protect.lowIncome })}>Protect low-income families</button>
          <button type="button" className="chip" aria-pressed={protect.investment} onClick={() => setProtect({ ...protect, investment: !protect.investment })}>Protect public investment</button>
        </div>
        {!econPlan.met && <p className="small" style={{ marginTop: 8 }}>With these rules, even every allowed card falls short of this mission. Loosen a rule or use across-the-board changes.</p>}
      </details>

      <details className="card more" open={slidersUsed || undefined}>
        <summary className="chart-title">Across-the-board changes (advanced)</summary>
        <p className="small muted">Blunt tools: percentage changes to whole categories, from the {cbo.projShort}. They count toward the goal but not toward the efficiency score.</p>
        {LEVERS.map((l) => (
          <div className="range-row" key={l.id}>
            <label htmlFor={'lv-' + l.id}><span className="swatch" style={{ background: l.color }} />{l.label}</label>
            <input id={'lv-' + l.id} type="range" min={l.min} max={l.max} step={1} value={lv[l.id]} onChange={(e) => { setLoaded(null); setLv((p) => ({ ...p, [l.id]: Number(e.target.value) })); }} />
            <output htmlFor={'lv-' + l.id}>{lv[l.id] > 0 ? '+' : ''}{lv[l.id]}%</output>
          </div>
        ))}
      </details>

      <details className="card more" id="method">
        <summary className="chart-title">How the scoring works</summary>
        <ol className="prose method-list" style={{ marginTop: 10 }}>
          <li><strong>The gap.</strong> Each mission’s gap is the distance between the {cbo.projShort} and the goal in FY{lastFY}. A card’s share is how much of that distance it closes by itself; cards combined can add up to slightly less because they interact through interest costs.</li>
          <li><strong>Drag on the economy.</strong> Each card’s drag is CBO’s estimated short-run effect on output per dollar for its type of policy (for example {MULT.corporate.lo}–{MULT.corporate.hi} for business taxes, {MULT.taxHigh.lo}–{MULT.taxHigh.hi} for taxes on higher earners, {MULT.purchases.lo}–{MULT.purchases.hi} for government purchases), using the midpoint, adjusted by 0.3 for long-run growth effects.</li>
          <li><strong>The economy gauge</strong> shows the plan’s steepest single-year tightening: gentle at 0.5% of GDP or less, moderate up to 1%, steep above that. These thresholds are this site’s, set in line with the IMF’s estimate that debt can be stabilized with roughly 3 to 4.5% of GDP of adjustment over about six years.</li>
          <li><strong>Stars:</strong> one for reaching the goal, one for staying gentle, and one for getting between a third and two-thirds of the savings from each of taxes and spending cuts, as most bipartisan deficit commissions did.</li>
          <li><strong>Efficiency</strong> compares your plan’s total economic cost (dollars saved times drag per dollar) with the least-cost plan the hint finds under its rules.</li>
        </ol>
        {OPTIONS_DATA.principles.length > 0 && (
          <div className="facts" style={{ marginTop: 12 }}>
            {OPTIONS_DATA.principles.map((p) => (
              <div className="fact" key={p.id}>
                <p style={{ color: 'var(--ink)' }}>{p.claim}</p>
                {p.detail && <p className="small">{p.detail}</p>}
                {p.source?.url && <a className="small" href={p.source.url} target="_blank" rel="noreferrer">{p.source.title}</a>}
              </div>
            ))}
          </div>
        )}
        <div className="prose small" style={{ marginTop: 12 }}>
          <p><strong>Where the numbers come from.</strong> Each card’s savings is CBO’s ten-year estimate from <a href={OPTIONS_DATA.volume.url} target="_blank" rel="noreferrer"><em>{OPTIONS_DATA.volume.title}</em></a> ({dateLabel(OPTIONS_DATA.volume.published)}), spread over FY{years[0]}–FY{years[0] + 9} in proportion to the economy (phased in when that switch is on). Estimates made before the One Big Beautiful Bill Act of July 2025 may be out of date where that law changed the same policy; those cards say so.</p>
          <p><strong>What the game leaves out.</strong> A full economic model, interactions between options on the same tax, and the long-run gains from lower debt, which CBO finds raise income over time. CBO’s multipliers are largest when the economy is weak and the Federal Reserve cannot offset them. Net interest is recalculated from the size of the debt. <Term id="dynamic">Dynamic effects</Term> are not included.</p>
          <p><strong>Midpoint multipliers used:</strong> {Object.entries(MULT).map(([key, m]) => `${m.label} ${mid(key as keyof typeof MULT).toFixed(2)}`).join('; ')}.</p>
        </div>
      </details>

      <Toasts items={toasts.items} />
      {party != null && desk && (
        <Celebration stop={STOP_BY_ID[desk.id]} stars={party} onClose={() => setParty(null)}
          line={party === 3 ? 'Three stars! We fixed it without knocking the economy flat, and both taxes and spending pitched in. Well done, partner!' : party === 2 ? 'We did it, partner! That plan meets the goal. Replay any time to go for three stars.' : 'We did it! The goal is met. There are more stars to earn if you go easier on the economy and share the load.'} />
      )}
    </>
  );
}

function VoteNote({ votes }: { votes: ReturnType<typeof useVotes> }) {
  if (!votes.available) return null;
  return (
    <p className="small muted">
      {votes.loading ? 'Loading votes…' : `${votes.voters} ${votes.voters === 1 ? 'person has' : 'people have'} voted so far.`}{' '}
      {votes.stale && 'Vote counts can’t be reached yet and may be out of date. '}
      {votes.error && `${votes.error} `}
      {votes.canVote === false && 'You can see the results, but voting needs Contributor access to this page; ask the person who shared it. '}
      Each person has one ballot and can change it at any time. This is an informal poll of people who opened this page, not a scientific survey.
    </p>
  );
}
