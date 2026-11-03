import { useState } from 'react';
import { TimeChart } from '../components/charts';
import { ChartFrame, Legend, PageHead, Section, Stat, Term, TipRow } from '../components/ui';
import { ssa } from '../data';
import { compactAxis, dateLabel, money, people } from '../lib/format';

const Q = ['first', 'second', 'third', 'fourth'];
const qText = (d: { year: number; quarter?: number }) => (d.quarter ? `the ${Q[d.quarter - 1]} quarter of ${d.year}` : String(d.year));

export default function SocialSecurity() {
  const [born, setBorn] = useState(1975);
  const dep = ssa.depletion;
  const hist = ssa.oasdi;
  const last = hist.at(-1)!;
  const first = hist[0];
  const peak = ssa.oasi.reduce((m, r) => ((r.reserves ?? 0) > (m.reserves ?? 0) ? r : m), ssa.oasi[0]);
  const firstShort = hist.find((r) => r.cost > r.income);
  // Fiscal-year axis from the first Treasury year through the year after combined depletion.
  const endFY = dep.oasdi.year + 1;
  const years = Array.from({ length: endFY - first.year + 1 }, (_, i) => first.year + i);
  const at = (arr: typeof hist, y: number) => arr.find((r) => r.year === y);
  const lastIdx = years.indexOf(last.year);
  // Calendar-quarter depletion dates placed on the fiscal-year axis (FY N = Oct N-1 … Sep N).
  const fyPos = (d: { year: number; quarter?: number }) => {
    const q = d.quarter ?? 2;
    const fy = q === 4 ? d.year + 1 : d.year;
    // Oct–Dec (calendar Q4) opens the next fiscal year; Jan–Mar, Apr–Jun, Jul–Sep fill the rest.
    const frac = q === 4 ? 0.125 : 0.125 + q * 0.25;
    return { fy, frac };
  };
  const year = new Date().getFullYear();
  const ageAt = (y: number) => y - born;
  const avg = 2000;

  return (
    <>
      <PageHead
        eyebrow="Social Security trust fund timeline"
        title="Social Security’s countdown"
        lede={<>Social Security pays benefits to about {ssa.beneficiaries ? people(ssa.beneficiaries.total) : 'tens of millions of'} people. Since FY{firstShort?.year ?? 2021} its two trust funds have paid out more each year than they took in, so their savings are shrinking. The program’s trustees project when those savings run out in the {ssa.report}, released {dateLabel(ssa.released)}.</>}
      />

      <div className="grid-3">
        <div className="card">
          <Stat
            label={<span className="pill pill-crit">Retirement fund (OASI)</span>}
            value={`Late ${dep.oasi.year}`}
            note={<>Reserves run out in {qText(dep.oasi)}. After that, incoming taxes would cover about <strong>{dep.oasi.payablePct}%</strong> of scheduled retirement and survivor benefits.</>}
          />
        </div>
        <div className="card">
          <Stat
            label={<span className="pill pill-warn">Combined funds (OASDI)</span>}
            value={`${dep.oasdi.year}`}
            note={<>If the retirement and disability funds were combined, as Congress has done before, reserves would last until {qText(dep.oasdi)}. Then about <strong>{dep.oasdi.payablePct}%</strong> of benefits would be payable{ssa.payableLongRun ? `, falling to ${ssa.payableLongRun.pct}% by ${ssa.payableLongRun.year}` : ''}.</>}
          />
        </div>
        <div className="card">
          {dep.hi ? (
            <Stat
              label={<span className="pill pill-warn">Medicare hospital fund (HI)</span>}
              value={`${dep.hi.year}`}
              note={<>Medicare Part A’s trust fund runs out in {qText(dep.hi)}, then covers about <strong>{dep.hi.payablePct}%</strong> of hospital costs ({dep.hi.report}).</>}
            />
          ) : (
            <Stat label="Disability fund (DI)" value="Not depleted" note="Not projected to run out within 75 years." />
          )}
        </div>
      </div>
      <p className="small muted">The disability insurance (DI) fund is not projected to run out within the trustees’ 75-year projection period.</p>

      <Section
        id="timeline"
        title="The savings are being spent down"
        sub={`Trust fund reserves at the end of each fiscal year, from the Treasury’s accounts, with the trustees’ projected depletion dates. The retirement fund peaked at ${money(peak.reserves ?? 0)} in FY${peak.year} and stood at ${money(at(ssa.oasi, last.year)?.reserves ?? 0)} at the end of FY${last.year}.`}
      >
        <div className="card">
          <ChartFrame
            title="Social Security trust fund reserves, end of fiscal year"
            sub={`Actual balances FY${first.year}–FY${last.year}. Markers show when the trustees project reserves to run out.`}
            legend={<Legend items={[{ label: 'Retirement & survivors (OASI)', color: 'var(--c-ss)' }, { label: 'Disability (DI)', color: 'var(--c-veterans)' }, { label: 'Projected depletion', color: 'var(--critical)', kind: 'line' }]} />}
            sourceIds={ssa.sourceIds}
            table={{
              columns: [{ key: 'y', label: 'Fiscal year' }, { key: 'o', label: 'OASI reserves', align: 'r' }, { key: 'd', label: 'DI reserves', align: 'r' }, { key: 'i', label: 'OASDI income', align: 'r' }, { key: 'c', label: 'OASDI cost', align: 'r' }],
              rows: hist.map((r) => ({ y: `FY${r.year}`, o: money(at(ssa.oasi, r.year)?.reserves ?? 0), d: money(at(ssa.di, r.year)?.reserves ?? 0), i: money(r.income), c: money(r.cost) })),
            }}
          >
            <TimeChart
              label="Social Security trust fund reserves by fiscal year with projected depletion dates"
              x={years}
              xLabel={(y) => `’${String(y).slice(2)}`}
              tipTitle={(y) => `FY${y}`}
              height={320}
              projectFrom={lastIdx + 1}
              projectLabel="Trustees’ projection"
              series={[
                { id: 'oasi', label: 'Retirement & survivors (OASI)', color: 'var(--c-ss)', kind: 'bar', stack: 'r', values: years.map((y) => at(ssa.oasi, y)?.reserves ?? null) },
                { id: 'di', label: 'Disability (DI)', color: 'var(--c-veterans)', kind: 'bar', stack: 'r', values: years.map((y) => at(ssa.di, y)?.reserves ?? null) },
              ]}
              tipExtra={(i) => {
                const r = at(hist, years[i]);
                return r ? <><TipRow label="Income that year" value={money(r.income)} /><TipRow label="Cost that year" value={money(r.cost)} /></> : <div className="tooltip-note">Projected years: see the depletion markers.</div>;
              }}
              overlay={({ x, y, h, step }) => {
                const marks = [
                  { d: dep.oasi, label: `OASI runs out: late ${dep.oasi.year}`, dy: 0 },
                  { d: dep.oasdi, label: `Combined: ${dep.oasdi.year}`, dy: 18 },
                ];
                return (
                  <g>
                    {marks.map((m) => {
                      const p = fyPos(m.d);
                      const i = years.indexOf(p.fy);
                      if (i < 0) return null;
                      const xx = x(i) - step / 2 + p.frac * step;
                      return (
                        <g key={m.label}>
                          <line x1={xx} x2={xx} y1={0} y2={h} stroke="var(--critical)" strokeWidth={1.5} />
                          <circle cx={xx} cy={y(0)} r={4} fill="var(--critical)" stroke="var(--surface)" strokeWidth={2} />
                          <text x={xx - 6} y={y(0) - 14 - m.dy} textAnchor="end" className="data-label">{m.label}</text>
                        </g>
                      );
                    })}
                  </g>
                );
              }}
            />
          </ChartFrame>
        </div>
        <div className="card">
          <ChartFrame
            title="Income vs. cost each year (OASI and DI combined)"
            sub="When cost rises above income, the program draws down its reserves."
            legend={<Legend items={[{ label: 'Income (payroll taxes, taxes on benefits, interest)', color: 'var(--c-emph)', kind: 'line' }, { label: 'Cost (benefits and administration)', color: 'var(--c-interest)', kind: 'line' }]} />}
            sourceIds={['mts8']}
          >
            <TimeChart
              label="Social Security income and cost by fiscal year"
              x={hist.map((r) => r.year)}
              xLabel={(y) => `’${String(y).slice(2)}`}
              tipTitle={(y) => `FY${y}`}
              height={240}
              yFormat={compactAxis}
              series={[
                { id: 'inc', label: 'Income', color: 'var(--c-emph)', kind: 'line', values: hist.map((r) => r.income) },
                { id: 'cost', label: 'Cost', color: 'var(--c-interest)', kind: 'line', values: hist.map((r) => r.cost) },
              ]}
              tipExtra={(i) => <TipRow label={hist[i].cost > hist[i].income ? 'Drawn from reserves' : 'Added to reserves'} value={money(Math.abs(hist[i].income - hist[i].cost))} />}
            />
          </ChartFrame>
        </div>
      </Section>

      <Section id="you" title="What it means for you" sub="Benefits don’t stop when the reserves run out. By law they would be cut to what incoming taxes can pay, unless Congress acts first.">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field" style={{ maxWidth: 260 }}>
            <label htmlFor="born">Your birth year</label>
            <input id="born" className="input" type="number" min={1920} max={2025} value={born} onChange={(e) => setBorn(Math.max(1920, Math.min(2025, Number(e.target.value) || 1975)))} />
          </div>
          <div className="grid-3">
            <Stat label={`Your age in ${dep.oasi.year}`} value={`${ageAt(dep.oasi.year)}`} note={ageAt(dep.oasi.year) >= 62 ? 'You will likely be collecting, or eligible to.' : `You would reach 67, full retirement age, in ${born + 67}.`} />
            <Stat label="Years until the retirement fund runs out" value={`${Math.max(0, dep.oasi.year - year)}`} note={`Counting from ${year}.`} />
            <Stat label="Automatic cut if Congress does nothing" value={`about ${100 - dep.oasi.payablePct}%`} note={`For retirement and survivor benefits, starting in late ${dep.oasi.year}; about ${100 - dep.oasdi.payablePct}% across all benefits if the funds are combined.`} />
          </div>
          <p className="small muted">For example, a ${avg.toLocaleString()} monthly check would fall to about ${Math.round((avg * dep.oasi.payablePct) / 100).toLocaleString()}.</p>
        </div>
      </Section>

      {ssa.fixes && ssa.fixes.length > 0 && (
        <Section id="fixes" title="What it would take to fix" sub={`The trustees put the 75-year shortfall at ${ssa.actuarialDeficit != null ? `${ssa.actuarialDeficit.toFixed(2)}% of taxable payroll` : 'several percent of taxable payroll'}. Any one of these changes, made right away, would close it.`}>
          <div className="facts">
            {ssa.fixes.map((f) => (
              <div className="fact" key={f.label}><div className="fact-big">{f.value}</div><p>{f.label}</p></div>
            ))}
          </div>
          <p className="small muted">Real proposals usually combine smaller tax increases and benefit changes. The longer Congress waits, the larger the changes must be.</p>
        </Section>
      )}

      <div className="callout">
        <div className="callout-title">Where the money comes from, and why it matters for the deficit</div>
        <p>Most Social Security income is the 12.4% <Term id="payroll-tax">payroll tax</Term> on wages up to an annual limit ($184,500 in 2026), split between workers and employers. The rest comes from income taxes some retirees pay on their benefits and interest on the trust funds’ Treasury bonds. Those bonds are owed by the Treasury, so when the trust funds cash them in, the rest of the government has to borrow or collect more to repay them. In FY{last.year} the two funds took in {money(last.income)} and paid out {money(last.cost)}.</p>
      </div>
    </>
  );
}
