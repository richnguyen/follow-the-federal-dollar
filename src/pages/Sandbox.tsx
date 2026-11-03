import { useMemo, useState } from 'react';
import { TimeChart } from '../components/charts';
import { ChartFrame, Legend, PageHead, Section, Stat, Term } from '../components/ui';
import { budget, cbo } from '../data';
import { money, pct, signedMoney } from '../lib/format';
import { LEVERS, type LeverId, type Levers, simulate, solveBalance, ZERO } from '../lib/sandbox';

const PRESETS: { label: string; lv: Partial<Levers> }[] = [
  { label: 'Start over', lv: {} },
  { label: 'Cut non-defense discretionary 10%', lv: { nondefense: -10 } },
  { label: 'Raise taxes 10%', lv: { revenues: 10 } },
  { label: 'Cut defense 20%', lv: { defense: -20 } },
  { label: 'Mixed: taxes +6%, Medicare & Medicaid −8%, discretionary −10%', lv: { revenues: 6, medicare: -8, medicaid: -8, defense: -10, nondefense: -10 } },
];

export default function Sandbox() {
  const [lv, setLv] = useState<Levers>({ ...ZERO });
  const startYear = budget.latestFY;
  const base = useMemo(() => cbo.baseline.filter((b) => b.fy > startYear), [startYear]);
  const start = cbo.baseline.find((b) => b.fy === startYear) ?? cbo.history.find((h) => h.fy === startYear)!;
  const startDebt = start.debtPublic;
  const mine = useMemo(() => simulate(base, startDebt, lv), [base, startDebt, lv]);
  const baseline = useMemo(() => simulate(base, startDebt, ZERO), [base, startDebt]);
  const last = mine.at(-1)!;
  const lastB = baseline.at(-1)!;
  const sum = (a: { deficit: number }[]) => a.reduce((s, r) => s + r.deficit, 0);
  const tenMine = sum(mine);
  const tenBase = sum(baseline);
  const intSaved = baseline.reduce((s, r) => s + r.interest, 0) - mine.reduce((s, r) => s + r.interest, 0);
  const balancedYears = mine.filter((r) => r.deficit <= 0).length;
  const needTax = useMemo(() => solveBalance(base, startDebt, ['revenues'], 1), [base, startDebt]);
  const needCut = useMemo(() => solveBalance(base, startDebt, ['socialSecurity', 'medicare', 'medicaid', 'otherMandatory', 'defense', 'nondefense'], -1), [base, startDebt]);
  const needCutNoSSMed = useMemo(() => solveBalance(base, startDebt, ['medicaid', 'otherMandatory', 'defense', 'nondefense'], -1), [base, startDebt]);
  const years = base.map((b) => b.fy);

  const set = (id: LeverId, v: number) => setLv((p) => ({ ...p, [id]: v }));

  return (
    <>
      <PageHead
        eyebrow="Balance the budget"
        title="Your turn to close the gap"
        lede={<>Start from CBO’s {cbo.vintage} projection for FY{years[0]}–FY{years.at(-1)}, which assumes current law stays the same. Move the sliders to raise or cut each part of the budget in every year, and watch what happens to deficits, interest, and the debt.</>}
      />
      <div className="facts">
        {needTax != null && <div className="fact"><div className="fact-big">+{needTax.toFixed(0)}% taxes</div><p>Raising all federal revenue by about this much would balance the budget by FY{years.at(-1)}, with no spending cuts.</p></div>}
        {needCut != null && <div className="fact"><div className="fact-big">−{needCut.toFixed(0)}% spending</div><p>Or cutting every program (but not interest) by about this much would do it, with no tax increases.</p></div>}
        {needCutNoSSMed != null ? (
          <div className="fact"><div className="fact-big">−{needCutNoSSMed.toFixed(0)}%</div><p>If Social Security and Medicare are off the table, everything else, including defense, would need to be cut this much.</p></div>
        ) : (
          <div className="fact"><div className="fact-big">Not possible</div><p>With Social Security and Medicare off the table, even eliminating everything else would not balance the budget by FY{years.at(-1)}.</p></div>
        )}
      </div>

      <div className="split">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="chart-title">Your plan</div>
          <p className="small muted" style={{ marginBottom: 6 }}>Percent change from CBO’s projection, in every year from FY{years[0]}.</p>
          {LEVERS.map((l) => (
            <div className="range-row" key={l.id}>
              <label htmlFor={'lv-' + l.id}><span className="swatch" style={{ background: l.color }} />{l.label}</label>
              <input id={'lv-' + l.id} type="range" min={l.min} max={l.max} step={1} value={lv[l.id]} onChange={(e) => set(l.id, Number(e.target.value))} />
              <output htmlFor={'lv-' + l.id}>{lv[l.id] > 0 ? '+' : ''}{lv[l.id]}%</output>
            </div>
          ))}
          <div className="chips" style={{ marginTop: 10 }}>
            {PRESETS.map((p) => (
              <button key={p.label} type="button" className="chip" onClick={() => setLv({ ...ZERO, ...p.lv })}>{p.label}</button>
            ))}
          </div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="grid-2">
            <Stat label={`10-year deficits, FY${years[0]}–${String(years.at(-1)).slice(2)}`} value={money(tenMine)} note={`CBO baseline: ${money(tenBase)} · ${signedMoney(tenMine - tenBase)}`} />
            <Stat label={<>Debt held by the public, FY{years.at(-1)}</>} value={pct(last.debt / last.gdp, 0) + ' of GDP'} note={`Baseline: ${pct(lastB.debt / lastB.gdp, 0)} · ${money(last.debt)}`} />
            <Stat label="Interest costs saved" value={money(intSaved)} note="Less borrowing means less interest over ten years." />
            <Stat label={`Deficit in FY${years.at(-1)}`} value={last.deficit <= 0 ? 'Balanced' : money(last.deficit)} note={last.deficit <= 0 ? `Surplus of ${money(-last.deficit)} · ${balancedYears} balanced year${balancedYears === 1 ? '' : 's'}` : `${pct(last.deficit / last.gdp)} of GDP`} />
          </div>
        </div>
      </div>

      <Section id="paths" title="Deficits: your plan vs. CBO’s projection">
        <div className="card">
          <ChartFrame
            title="Annual deficit"
            legend={<Legend items={[{ label: 'CBO baseline', color: 'var(--c-deemph)', kind: 'line' }, { label: 'Your plan', color: 'var(--c-emph)', kind: 'line' }]} />}
            sourceIds={[cbo.baselineSourceId]}
            table={{ columns: [{ key: 'fy', label: 'Fiscal year' }, { key: 'b', label: 'Baseline deficit', align: 'r' }, { key: 'm', label: 'Your plan', align: 'r' }, { key: 'd', label: 'Your debt (% GDP)', align: 'r' }], rows: mine.map((r, i) => ({ fy: `FY${r.fy}`, b: money(baseline[i].deficit), m: money(r.deficit), d: pct(r.debt / r.gdp, 0) })) }}
          >
            <TimeChart
              label="Annual deficit under the CBO baseline and your plan"
              x={years}
              tipTitle={(y) => `FY${y}`}
              height={280}
              zeroLine
              series={[
                { id: 'b', label: 'CBO baseline', color: 'var(--c-deemph)', kind: 'line', values: baseline.map((r) => r.deficit), width: 2.5 },
                { id: 'm', label: 'Your plan', color: 'var(--c-emph)', kind: 'line', values: mine.map((r) => r.deficit) },
              ]}
            />
          </ChartFrame>
        </div>
        <p className="small muted">
          How the model works: each slider scales that category by the same percentage in every year. Net interest is recalculated from the size of the debt, using CBO’s projected interest rates. It ignores how the changes would affect the economy, which CBO calls <Term id="dynamic">dynamic effects</Term>, so treat results as rough. Other mandatory includes income security, federal retirement, veterans’ benefits, and offsetting receipts.
        </p>
      </Section>
    </>
  );
}
