import { useMemo, useState } from 'react';
import { TimeChart } from '../components/charts';
import { ChartFrame, Legend, PageHead, Section, Seg, Stat, Term } from '../components/ui';
import { budget, cbo } from '../data';
import { dateLabel, money, pct } from '../lib/format';
import { economics, extraFor, GOALS, type Goal, goalGap, goalMet, MULT, mid, optimize, type PlanContext, type Protect, score } from '../lib/plan';
import { OPTIONS_DATA, PRESETS, withEcon } from '../lib/planData';
import { LEVERS, type LeverId, type Levers, simulate, ZERO } from '../lib/sandbox';
import { type Choice, useVotes } from '../lib/votes';

const RATING: Record<string, { label: string; cls: string; note: string }> = {
  gentle: { label: 'Gentle on the economy', cls: 'pill-ok', note: 'tightens by no more than 0.5% of GDP in any year' },
  moderate: { label: 'Moderate', cls: 'pill-warn', note: 'tightens by 0.5% to 1% of GDP in its steepest year' },
  steep: { label: 'Steep', cls: 'pill-crit', note: 'tightens by more than 1% of GDP in a single year' },
};

const harm = (s: number) => (s < 0.55 ? { label: 'Low drag', cls: 'pill-ok' } : s < 1.15 ? { label: 'Medium drag', cls: 'pill-warn' } : { label: 'High drag', cls: 'pill-crit' });

export default function Sandbox() {
  const startYear = budget.latestFY;
  const base = useMemo(() => cbo.baseline.filter((b) => b.fy > startYear), [startYear]);
  const start = cbo.baseline.find((b) => b.fy === startYear) ?? cbo.history.find((h) => h.fy === startYear)!;
  const ctx: PlanContext = useMemo(() => ({ baseline: base, startDebt: start.debtPublic, startRatio: start.debtPublic / start.gdp, options: withEcon() }), [base, start]);
  const years = base.map((b) => b.fy);
  const lastFY = years.at(-1)!;

  const [goal, setGoal] = useState<Goal>('stabilize');
  const [gradual, setGradual] = useState(true);
  const [protect, setProtect] = useState<Protect>({ retirees: true, lowIncome: true, investment: true });
  const [mix, setMix] = useState(true);
  // Open in a working state: the economists' plan under the default goal and ground rules.
  const [ids, setIds] = useState<string[]>(() => optimize(ctx, 'stabilize', { retirees: true, lowIncome: true, investment: true }, true, 1 / 3).ids);
  const [lv, setLv] = useState<Levers>({ ...ZERO });
  const [loaded, setLoaded] = useState<string | null>('economists');
  const votes = useVotes();

  const minShare = mix ? 1 / 3 : 0;
  const econPlan = useMemo(() => optimize(ctx, goal, protect, gradual, minShare), [ctx, goal, protect, gradual, minShare]);
  const presetIds = (p: (typeof PRESETS)[number]) => (p.optimizer ? econPlan.ids : p.ids ?? []);

  const run = (sel: string[], levers: Levers) => simulate(base, ctx.startDebt, levers, { phaseIn: gradual, extra: extraFor(sel, ctx, gradual) });
  const baseline = useMemo(() => simulate(base, ctx.startDebt, ZERO), [base, ctx.startDebt]);
  const mine = useMemo(() => run(ids, lv), [ids, lv, gradual, ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const econ = useMemo(() => economics(ctx, ids, lv, gradual), [ctx, ids, lv, gradual]);
  const last = mine.at(-1)!;
  const lastB = baseline.at(-1)!;
  const met = goalMet(goal, mine, ctx.startRatio);
  const gap = goalGap(goal, mine, ctx.startRatio);
  const selected = ctx.options.filter((o) => ids.includes(o.id));
  const tenYr = selected.reduce((s, o) => s + o.savings10, 0);
  const revTen = selected.filter((o) => o.side === 'revenue').reduce((s, o) => s + o.savings10, 0);
  const sumDef = (a: { deficit: number }[]) => a.reduce((s, r) => s + r.deficit, 0);
  const intSaved = baseline.reduce((s, r) => s + r.interest, 0) - mine.reduce((s, r) => s + r.interest, 0);
  const goalInfo = GOALS.find((g) => g.id === goal)!;

  const toggle = (id: string) => { setLoaded(null); setIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); };
  const loadPreset = (pid: string) => {
    const p = PRESETS.find((x) => x.id === pid)!;
    setIds(presetIds(p));
    setLv({ ...ZERO });
    setLoaded(pid);
    document.getElementById('your-plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const setLever = (id: LeverId, v: number) => { setLoaded(null); setLv((p) => ({ ...p, [id]: v })); };

  const presetStats = (sel: string[]) => {
    const sim = run(sel, ZERO);
    const e = economics(ctx, sel, ZERO, gradual);
    const s = sim.at(-1)!;
    const opts = ctx.options.filter((o) => sel.includes(o.id));
    const t = opts.reduce((a, o) => a + o.savings10, 0);
    const r = opts.filter((o) => o.side === 'revenue').reduce((a, o) => a + o.savings10, 0);
    return { met: goalMet(goal, sim, ctx.startRatio), deficitShare: s.deficit / s.gdp, debtShare: s.debt / s.gdp, e, ten: t, rev: t ? r / t : 0 };
  };

  const grouped = [
    { side: 'revenue' as const, title: 'Raise revenue' },
    { side: 'spending' as const, title: 'Cut spending' },
  ];

  return (
    <>
      <PageHead
        eyebrow="Balance the budget"
        title="Your turn to close the gap"
        lede={<>Pick a goal, then build a plan from real policy options that the Congressional Budget Office (CBO) has priced, or start from one of the plans below. The model starts from the {cbo.vintage} for FY{years[0]}–FY{lastFY}, {cbo.projAssumes}.</>}
      />

      <Section id="goal" title="1. Choose a goal and ground rules">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Seg<Goal> label="Goal" value={goal} onChange={setGoal} options={GOALS.map((g) => ({ value: g.id, label: g.label }))} />
          <p className="small" style={{ color: 'var(--ink-2)' }}>{goalInfo.blurb} Today debt held by the public is {pct(ctx.startRatio, 0)} of GDP; under the {cbo.projShort} it would be {pct(lastB.debt / lastB.gdp, 0)} in FY{lastFY}, with a deficit of {pct(lastB.deficit / lastB.gdp, 1)} of GDP.</p>
          <div className="chips" role="group" aria-label="Ground rules">
            <button type="button" className="chip" aria-pressed={gradual} onClick={() => setGradual(!gradual)}>Phase in over {3} years</button>
            <button type="button" className="chip" aria-pressed={mix} onClick={() => setMix(!mix)}>Mix revenue and spending (each at least a third)</button>
            <button type="button" className="chip" aria-pressed={protect.retirees} onClick={() => setProtect({ ...protect, retirees: !protect.retirees })}>Protect current retirees</button>
            <button type="button" className="chip" aria-pressed={protect.lowIncome} onClick={() => setProtect({ ...protect, lowIncome: !protect.lowIncome })}>Protect low-income programs</button>
            <button type="button" className="chip" aria-pressed={protect.investment} onClick={() => setProtect({ ...protect, investment: !protect.investment })}>Protect public investment</button>
          </div>
          <p className="small muted">These ground rules shape the economists’ plan below. They follow the main principles economists use for cutting deficits without needlessly hurting the economy; see <a href="#method" onClick={(e) => { e.preventDefault(); document.getElementById('method')?.scrollIntoView({ behavior: 'smooth' }); }}>how it works</a>.</p>
        </div>
      </Section>

      <Section id="plans" title="2. Plans to consider" sub={`Four ways to reach the goal. The economists’ plan is built automatically from your ground rules: of every combination of allowed options, it picks the one that meets the goal with the least total harm to the economy.${votes.available ? ' Pick the one you would choose; results update live.' : ''}`}>
        <div className="grid-2">
          {PRESETS.map((p) => {
            const sel = presetIds(p);
            const st = presetStats(sel);
            const names = ctx.options.filter((o) => sel.includes(o.id)).sort((a, b) => b.savings10 - a.savings10);
            const planVotes = votes.plans[p.id] ?? 0;
            const totalPlanVotes = Object.values(votes.plans).reduce((a, b) => a + b, 0);
            return (
              <article key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1.125rem' }}>{p.name}</h3>
                  <span className={'pill ' + (st.met ? 'pill-ok' : 'pill-warn')}>{st.met ? 'Meets the goal' : 'Falls short'}</span>
                </div>
                <p className="small" style={{ color: 'var(--ink-2)' }}>{p.blurb}</p>
                <div className="grid-3" style={{ gap: 10 }}>
                  <Stat label={`Deficit, FY${lastFY}`} value={pct(st.deficitShare, 1)} note="of GDP" />
                  <Stat label={`Debt, FY${lastFY}`} value={pct(st.debtShare, 0)} note="of GDP" />
                  <Stat label="Revenue share" value={pct(st.rev, 0)} note={`of ${money(st.ten * 1e9)} over 10 yrs`} />
                </div>
                <div><span className={'pill ' + RATING[st.e.rating].cls}>{RATING[st.e.rating].label}</span> <span className="small muted">{RATING[st.e.rating].note}</span></div>
                <p className="small"><strong>Includes:</strong> {names.length ? names.map((o) => o.name).join('; ') : 'Nothing; the projection already meets this goal.'}</p>
                {p.optimizer && !st.met && <p className="small" style={{ color: 'var(--ink-2)' }}>Even every option your ground rules allow leaves a deficit of {pct(st.deficitShare, 1)} of GDP in FY{lastFY}. Loosen the ground rules, or add across-the-board changes in your own plan.</p>}
                {p.optimizer && econPlan.mixRelaxed && <p className="small" style={{ color: 'var(--ink-2)' }}>No allowed combination met the goal with at least a third from each side, so this plan relaxes the mix rule.</p>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto', alignItems: 'center' }}>
                  <button type="button" className="btn" onClick={() => loadPreset(p.id)} disabled={!names.length}>{loaded === p.id ? 'Loaded below' : 'Load into my plan'}</button>
                  {votes.available && (
                    <button type="button" className={votes.mine.plan === p.id ? 'btn btn-primary' : 'btn'} aria-pressed={votes.mine.plan === p.id} disabled={votes.canVote === false} onClick={() => votes.votePlan(p.id)}>
                      {votes.mine.plan === p.id ? 'My pick' : 'Pick this plan'}
                    </button>
                  )}
                  {votes.available && <span className="small muted">{planVotes} of {totalPlanVotes} vote{totalPlanVotes === 1 ? '' : 's'}{totalPlanVotes ? ` (${pct(planVotes / totalPlanVotes, 0)})` : ''}</span>}
                </div>
              </article>
            );
          })}
        </div>
        <VoteNote votes={votes} />
      </Section>

      <Section id="your-plan" title="3. Build your own plan" sub={`Each option is a specific change CBO has estimated. Check the ones you want; the totals and charts update instantly. ${votes.available ? 'Tell lawmakers what you think: support or oppose each option.' : ''}`}>
        <div className="split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
            {grouped.map((g) => (
              <div key={g.side} className="card" style={{ paddingBlock: 8 }}>
                <div className="eyebrow" style={{ padding: '10px 0 4px' }}>{g.title}</div>
                <div className="opt-list">
                  {ctx.options.filter((o) => o.side === g.side).sort((a, b) => score(a.econ) - score(b.econ)).map((o) => {
                    const h = harm(score(o.econ));
                    const t = votes.options[o.id] ?? { support: 0, oppose: 0 };
                    const n = t.support + t.oppose;
                    const blocked = (protect.retirees && o.econ.tags.includes('retirees')) || (protect.lowIncome && o.econ.tags.includes('lowIncome')) || (protect.investment && o.econ.tags.includes('investment'));
                    return (
                      <div key={o.id} className="opt" data-on={ids.includes(o.id)}>
                        <input id={'opt-' + o.id} type="checkbox" checked={ids.includes(o.id)} onChange={() => toggle(o.id)} />
                        <div style={{ minWidth: 0 }}>
                          <label htmlFor={'opt-' + o.id} className="opt-name">{o.name}</label>
                          <div className="opt-meta">
                            <span className="num"><strong>{money(o.savings10 * 1e9)}</strong> over 10 years</span>
                            <span className={'pill ' + h.cls} title={`${MULT[o.econ.cls].label}: CBO multiplier ${MULT[o.econ.cls].lo}–${MULT[o.econ.cls].hi}`}>{h.label}</span>
                            {o.econ.growth === 1 && <span className="pill">Helps long-run growth</span>}
                            {o.econ.growth === -1 && <span className="pill">Hurts long-run growth</span>}
                            {blocked && <span className="pill">Outside your ground rules</span>}
                          </div>
                          <p className="small" style={{ color: 'var(--ink-2)', marginTop: 4 }}>{o.summary} <span className="muted">Affects: {o.affects}.</span></p>
                          <p className="small muted" style={{ marginTop: 2 }}>{o.econ.why}{o.obbbaNote ? ` ${o.obbbaNote}` : ''} <a href={o.source.url} target="_blank" rel="noreferrer">CBO estimate</a></p>
                          {votes.available && (
                            <div className="vote-row">
                              <VoteButton label="Support" on={votes.mine.options[o.id] === 1} disabled={votes.canVote === false} onClick={() => votes.voteOption(o.id, 1 as Choice)} />
                              <VoteButton label="Oppose" on={votes.mine.options[o.id] === -1} disabled={votes.canVote === false} onClick={() => votes.voteOption(o.id, -1 as Choice)} />
                              {n > 0 ? (
                                <span className="vote-tally" aria-label={`${t.support} support, ${t.oppose} oppose`}>
                                  <span className="vote-bar"><span style={{ width: `${(t.support / n) * 100}%`, background: 'var(--div-neg)' }} /><span style={{ width: `${(t.oppose / n) * 100}%`, background: 'var(--div-pos)' }} /></span>
                                  <span className="small muted num">{pct(t.support / n, 0)} support · {n} vote{n === 1 ? '' : 's'}</span>
                                </span>
                              ) : <span className="small muted">No votes yet</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <details className="card">
              <summary className="chart-title" style={{ cursor: 'pointer' }}>Fine-tune by category (percent change from the {cbo.projShort})</summary>
              <div style={{ marginTop: 10 }}>
                {LEVERS.map((l) => (
                  <div className="range-row" key={l.id}>
                    <label htmlFor={'lv-' + l.id}><span className="swatch" style={{ background: l.color }} />{l.label}</label>
                    <input id={'lv-' + l.id} type="range" min={l.min} max={l.max} step={1} value={lv[l.id]} onChange={(e) => setLever(l.id, Number(e.target.value))} />
                    <output htmlFor={'lv-' + l.id}>{lv[l.id] > 0 ? '+' : ''}{lv[l.id]}%</output>
                  </div>
                ))}
                <p className="small muted">Across-the-board changes are blunt: an across-the-board tax increase falls on everyone, and percentage cuts hit every program in a category alike.</p>
              </div>
            </details>
          </div>

          <aside className="card plan-summary" aria-live="polite">
            <div className="chart-title">Your plan</div>
            <div><span className={'pill ' + (met ? 'pill-ok' : 'pill-warn')}>{met ? 'Goal met' : `Short by ${money(gap)} in FY${lastFY}`}</span></div>
            <div className="grid-2" style={{ gap: 14 }}>
              <Stat label={`Deficit, FY${lastFY}`} value={last.deficit <= 0 ? 'Balanced' : pct(last.deficit / last.gdp, 1)} note={last.deficit <= 0 ? `Surplus ${money(-last.deficit)}` : `${money(last.deficit)} · was ${pct(lastB.deficit / lastB.gdp, 1)}`} />
              <Stat label={`Debt, FY${lastFY}`} value={pct(last.debt / last.gdp, 0)} note={`of GDP · today ${pct(ctx.startRatio, 0)}`} />
              <Stat label="Options chosen" value={`${selected.length}`} note={tenYr ? `${money(tenYr * 1e9)} over 10 years · ${pct(revTen / tenYr, 0)} revenue` : 'None yet'} />
              <Stat label="Interest saved" value={intSaved > 0 ? money(intSaved) : '$0'} note={`FY${years[0]}–${String(lastFY).slice(2)}`} />
            </div>
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="stat-label">Effect on the economy</div>
              <div><span className={'pill ' + RATING[econ.rating].cls}>{RATING[econ.rating].label}</span></div>
              <p className="small" style={{ color: 'var(--ink-2)' }}>
                Steepest year tightens by {pct(econ.peakStep, 1)} of GDP. Short-run drag on output peaks around {pct(econ.drag.mid, 1)} of GDP (range {pct(econ.drag.lo, 1)} to {pct(econ.drag.hi, 1)}), before the long-run gains from lower debt.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" onClick={() => loadPreset('economists')}>Use the economists’ plan</button>
              <button type="button" className="btn" onClick={() => { setIds([]); setLv({ ...ZERO }); setLoaded(null); }}>Start over</button>
            </div>
          </aside>
        </div>
      </Section>

      <div className="plan-bar" aria-hidden="true">
        <span className={'pill ' + (met ? 'pill-ok' : 'pill-warn')}>{met ? 'Goal met' : 'Short of goal'}</span>
        <span className="num">Deficit {last.deficit <= 0 ? 'balanced' : pct(last.deficit / last.gdp, 1)}</span>
        <span className="num">Debt {pct(last.debt / last.gdp, 0)}</span>
        <span className="num">{selected.length} options</span>
      </div>

      <Section id="paths" title={`Your plan vs. the ${cbo.projShort}`}>
        <div className="grid-2">
          <div className="card">
            <ChartFrame
              title="Deficit, share of GDP"
              legend={<Legend items={[{ label: cbo.projShort, color: 'var(--c-deemph)', kind: 'line' }, { label: 'Your plan', color: 'var(--c-emph)', kind: 'line' }]} />}
              sourceIds={[cbo.baselineSourceId]}
              table={{ columns: [{ key: 'fy', label: 'Fiscal year' }, { key: 'b', label: 'Projection', align: 'r' }, { key: 'm', label: 'Your plan', align: 'r' }], rows: mine.map((r, i) => ({ fy: `FY${r.fy}`, b: pct(baseline[i].deficit / baseline[i].gdp), m: pct(r.deficit / r.gdp) })) }}
            >
              <TimeChart label="Deficit as a share of GDP" x={years} tipTitle={(y) => `FY${y}`} height={240} zeroLine yFormat={(v) => `${+(v * 100).toFixed(1)}%`} tipFormat={(v) => pct(v)}
                series={[
                  { id: 'b', label: cbo.projShort, color: 'var(--c-deemph)', kind: 'line', values: baseline.map((r) => r.deficit / r.gdp), width: 2.5 },
                  { id: 'm', label: 'Your plan', color: 'var(--c-emph)', kind: 'line', values: mine.map((r) => r.deficit / r.gdp) },
                ]}
              />
            </ChartFrame>
          </div>
          <div className="card">
            <ChartFrame
              title="Debt held by the public, share of GDP"
              legend={<Legend items={[{ label: cbo.projShort, color: 'var(--c-deemph)', kind: 'line' }, { label: 'Your plan', color: 'var(--c-emph)', kind: 'line' }]} />}
              sourceIds={[cbo.baselineSourceId]}
              table={{ columns: [{ key: 'fy', label: 'Fiscal year' }, { key: 'b', label: 'Projection', align: 'r' }, { key: 'm', label: 'Your plan', align: 'r' }], rows: mine.map((r, i) => ({ fy: `FY${r.fy}`, b: pct(baseline[i].debt / baseline[i].gdp, 1), m: pct(r.debt / r.gdp, 1) })) }}
            >
              <TimeChart label="Debt held by the public as a share of GDP" x={years} tipTitle={(y) => `FY${y}`} height={240} yFormat={(v) => `${Math.round(v * 100)}%`} tipFormat={(v) => pct(v)}
                yMin={Math.min(...baseline.map((r) => r.debt / r.gdp), ...mine.map((r) => r.debt / r.gdp), ctx.startRatio) - 0.02}
                series={[
                  { id: 'b', label: cbo.projShort, color: 'var(--c-deemph)', kind: 'line', values: baseline.map((r) => r.debt / r.gdp), width: 2.5 },
                  { id: 'm', label: 'Your plan', color: 'var(--c-emph)', kind: 'line', values: mine.map((r) => r.debt / r.gdp) },
                ]}
              />
            </ChartFrame>
          </div>
        </div>
      </Section>

      <Section id="method" title="How the economists’ plan works" sub="There is no single formula economists agree on, but the main principles for reducing deficits without needlessly hurting the economy are well established. The plan applies them in this order:">
        <ol className="prose method-list">
          <li><strong>Aim for a sustainable path, not an instant balance.</strong> The default goal keeps debt from growing faster than the economy, which is how CBO and the IMF judge fiscal sustainability.</li>
          <li><strong>Go gradually.</strong> Changes phase in over three years, and each plan is rated by its steepest single-year tightening: gentle at 0.5% of GDP or less, moderate up to 1%, steep above that. These thresholds are this site’s, set in line with the IMF’s estimate below that debt can be stabilized with roughly 3 to 4.5% of GDP of adjustment spread over about six years.</li>
          <li><strong>Least total harm.</strong> Among every combination of allowed options, the plan picks the one that reaches the goal with the smallest total economic cost (dollars saved times harm per dollar). Each option’s harm per dollar is CBO’s estimated short-run effect on output for its type of policy (for example {MULT.corporate.lo}–{MULT.corporate.hi} for business taxes, {MULT.taxHigh.lo}–{MULT.taxHigh.hi} for taxes on higher earners, {MULT.purchases.lo}–{MULT.purchases.hi} for government purchases), using the midpoint, then adjusted by {(0.3).toFixed(1)} up or down for long-run growth effects such as fixing a harmful tax break or cutting investment.</li>
          <li><strong>Balance revenue and spending.</strong> At least a third of the savings comes from each side, as in most bipartisan deficit commissions.</li>
          <li><strong>Protect what matters most for people and growth.</strong> By default the plan skips options that cut benefits for current retirees, programs for low-income families, or public investment.</li>
        </ol>
        {OPTIONS_DATA.principles.length > 0 && (
          <div className="facts">
            {OPTIONS_DATA.principles.map((p) => (
              <div className="fact" key={p.id}>
                <p style={{ color: 'var(--ink)' }}>{p.claim}</p>
                {p.detail && <p className="small">{p.detail}</p>}
                {p.source?.url && <a className="small" href={p.source.url} target="_blank" rel="noreferrer">{p.source.title}</a>}
              </div>
            ))}
          </div>
        )}
        <div className="prose small">
          <p><strong>What the numbers are.</strong> Each option’s savings is CBO’s ten-year estimate from <a href={OPTIONS_DATA.volume.url} target="_blank" rel="noreferrer"><em>{OPTIONS_DATA.volume.title}</em></a> ({dateLabel(OPTIONS_DATA.volume.published)}). The model spreads it over FY{years[0]}–FY{years[0] + 9} in proportion to the economy (phased in when that rule is on) and shows the first {years.length} years. Estimates made before the One Big Beautiful Bill Act of July 2025 may be out of date where that law changed the same policy; those options say so.</p>
          <p><strong>What the model leaves out.</strong> Options can interact (two changes to the same tax are worth less than the sum), the economic ratings use CBO’s ranges rather than a full economic model, and CBO’s multipliers are largest when the economy is weak and the Federal Reserve cannot offset them. Net interest is recalculated from the size of the debt. The long-run gains from lower debt, which CBO finds raise income over time, are not added to the totals.</p>
          <p><strong>Midpoint multipliers used:</strong> {Object.entries(MULT).map(([k, m]) => `${m.label} ${mid(k as keyof typeof MULT).toFixed(2)}`).join('; ')}.</p>
        </div>
      </Section>
    </>
  );
}

function VoteButton({ label, on, disabled, onClick }: { label: string; on: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" className={'vote-btn' + (on ? ' on' : '')} aria-pressed={on} disabled={disabled} onClick={onClick}>
      {label}
    </button>
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
