import { useState } from 'react';
import { TimeChart } from '../components/charts';
import { ChartFrame, Legend, PageHead, Section, Stat, Term } from '../components/ui';
import { ssa } from '../data';
import { compactAxis, money, pct } from '../lib/format';

const Q = ['first', 'second', 'third', 'fourth'];

export default function SocialSecurity() {
  const [born, setBorn] = useState(1975);
  const all = ssa.oasdi.filter((r) => r.year >= 1980);
  const lastHist = all.filter((r) => !r.projected).at(-1)!;
  const projIdx = all.findIndex((r) => r.projected);
  const peak = all.reduce((m, r) => (r.reserves > m.reserves ? r : m), all[0]);
  const firstDeficit = all.find((r) => r.year >= 2010 && r.cost > r.income);
  const dep = ssa.depletion;
  const year = new Date().getFullYear();
  const ageAt = (y: number) => y - born;
  const yearsLeft = dep.oasdi.year - year;

  return (
    <>
      <PageHead
        eyebrow="Social Security trust fund timeline"
        title="Social Security’s countdown"
        lede={<>Social Security pays benefits to about {ssa.beneficiaries ? `${(ssa.beneficiaries.total / 1e6).toFixed(0)} million` : 'tens of millions of'} Americans. Since {firstDeficit?.year ?? 2021} it has paid out more each year than it takes in, drawing down savings in its <Term id="trust-fund">trust funds</Term>. The program’s trustees project when those savings run out in their {ssa.report}.</>}
      />

      <div className="grid-3">
        <div className="card">
          <Stat
            label={<><span className="pill pill-crit">Retirement fund (OASI)</span></>}
            value={`${dep.oasi.year}`}
            note={<>Reserves projected to run out{dep.oasi.quarter ? ` in the ${Q[dep.oasi.quarter - 1]} quarter of ${dep.oasi.year}` : ''}. After that, incoming taxes would cover about <strong>{dep.oasi.payablePct}%</strong> of scheduled retirement and survivor benefits.</>}
          />
        </div>
        <div className="card">
          <Stat
            label={<><span className="pill pill-warn">Combined funds (OASDI)</span></>}
            value={`${dep.oasdi.year}`}
            note={<>If the retirement and disability funds were combined, as Congress has done before, reserves would last until {dep.oasdi.quarter ? `the ${Q[dep.oasdi.quarter - 1]} quarter of ` : ''}{dep.oasdi.year}, then about <strong>{dep.oasdi.payablePct}%</strong> of benefits would be payable.</>}
          />
        </div>
        <div className="card">
          {dep.hi ? (
            <Stat
              label={<><span className="pill pill-warn">Medicare hospital fund (HI)</span></>}
              value={`${dep.hi.year}`}
              note={<>Medicare Part A’s trust fund is projected to be depleted in {dep.hi.year}, then cover about <strong>{dep.hi.payablePct}%</strong> of costs ({dep.hi.report}).</>}
            />
          ) : (
            <Stat label="Disability fund (DI)" value={dep.di ? `${dep.di.year}` : 'Not depleted'} note="The disability insurance fund is not projected to run out within the 75-year projection period." />
          )}
        </div>
      </div>

      <Section id="timeline" title="The trust fund rises, peaks, and runs down" sub={`Combined OASI and DI trust fund reserves at the end of each year, actual through ${lastHist.year} and projected after that. Reserves peaked at ${money(peak.reserves)} in ${peak.year}.`}>
        <div className="card">
          <ChartFrame
            title="Social Security trust fund reserves (OASI + DI combined)"
            sub="Nominal dollars, calendar years. Projections are the trustees’ intermediate assumptions."
            sourceIds={ssa.sourceIds}
            table={{
              columns: [{ key: 'y', label: 'Year' }, { key: 'i', label: 'Income', align: 'r' }, { key: 'c', label: 'Cost', align: 'r' }, { key: 'r', label: 'Reserves, end of year', align: 'r' }, { key: 'k', label: '' }],
              rows: all.map((r) => ({ y: r.year, i: money(r.income), c: money(r.cost), r: money(r.reserves), k: r.projected ? 'Projected' : 'Actual' })),
            }}
          >
            <TimeChart
              label="Social Security trust fund reserves"
              x={all.map((r) => r.year)}
              height={300}
              projectFrom={projIdx > 0 ? projIdx : undefined}
              projectLabel="Trustees’ projection"
              series={[{ id: 'res', label: 'Reserves', color: 'var(--c-ss)', kind: 'bar', values: all.map((r) => (r.reserves > 0 ? r.reserves : null)) }]}
              overlay={({ x, y, h }) => {
                const i = all.findIndex((r) => r.year === dep.oasdi.year);
                if (i < 0) return null;
                return (
                  <g>
                    <line x1={x(i)} x2={x(i)} y1={0} y2={h} stroke="var(--critical)" strokeWidth={1.5} />
                    <text x={x(i) - 6} y={y(peak.reserves * 0.9)} textAnchor="end" className="data-label">Reserves depleted, {dep.oasdi.year}</text>
                  </g>
                );
              }}
            />
          </ChartFrame>
        </div>
        <div className="card">
          <ChartFrame
            title="Income vs. cost each year"
            sub="When the cost line rises above income, the program draws down reserves."
            legend={<Legend items={[{ label: 'Total income (payroll taxes, benefit taxes, interest)', color: 'var(--c-emph)', kind: 'line' }, { label: 'Total cost (benefits and administration)', color: 'var(--c-interest)', kind: 'line' }]} />}
            sourceIds={ssa.sourceIds}
          >
            <TimeChart
              label="Social Security income and cost"
              x={all.map((r) => r.year)}
              height={260}
              yFormat={compactAxis}
              projectFrom={projIdx > 0 ? projIdx : undefined}
              projectLabel="Projected"
              series={[
                { id: 'inc', label: 'Income', color: 'var(--c-emph)', kind: 'line', values: all.map((r) => r.income) },
                { id: 'cost', label: 'Cost', color: 'var(--c-interest)', kind: 'line', values: all.map((r) => r.cost) },
              ]}
            />
          </ChartFrame>
        </div>
      </Section>

      <Section id="you" title="What it means for you" sub="Benefits don’t stop at depletion. They would be cut automatically to what incoming payroll taxes can pay, unless Congress acts first.">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field" style={{ maxWidth: 260 }}>
            <label htmlFor="born">Your birth year</label>
            <input id="born" className="input" type="number" min={1920} max={2025} value={born} onChange={(e) => setBorn(Math.max(1920, Math.min(2025, Number(e.target.value) || 1975)))} />
          </div>
          <div className="grid-3">
            <Stat label={`Your age in ${dep.oasi.year}`} value={`${ageAt(dep.oasi.year)}`} note={ageAt(dep.oasi.year) >= 62 ? 'Likely already collecting, or eligible to.' : `You would reach 67, full retirement age, in ${born + 67}.`} />
            <Stat label="Years until the combined funds run out" value={`${Math.max(0, yearsLeft)}`} note={`Counting from ${year}.`} />
            <Stat label="Benefit cut if Congress does nothing" value={`about ${100 - dep.oasdi.payablePct}%`} note={`Across the board, starting in ${dep.oasdi.year} (about ${100 - dep.oasi.payablePct}% for retirement benefits if the funds stay separate).`} />
          </div>
          <p className="small muted">An across-the-board cut means a $2,000 monthly check would fall to about ${(2000 * dep.oasdi.payablePct / 100).toLocaleString()}.</p>
        </div>
      </Section>

      {ssa.fixes && ssa.fixes.length > 0 && (
        <Section id="fixes" title="What it would take to fix" sub={`The trustees estimate the program’s 75-year shortfall at ${ssa.actuarialDeficit != null ? `${ssa.actuarialDeficit.toFixed(2)}% of taxable payroll` : 'a few percent of taxable payroll'}. Any one of these, starting immediately, would close it.`}>
          <div className="facts">
            {ssa.fixes.map((f) => (
              <div className="fact" key={f.label}><div className="fact-big">{f.value}</div><p>{f.label}</p></div>
            ))}
          </div>
          <p className="small muted">Real proposals usually combine smaller tax increases and benefit changes. The longer Congress waits, the larger the changes must be.</p>
        </Section>
      )}

      <div className="callout">
        <div className="callout-title">Where the money comes from</div>
        <p>Most Social Security income is the 12.4% payroll tax on wages up to an annual limit, split between workers and employers. The rest comes from income taxes some retirees pay on their benefits and interest on the trust fund’s Treasury bonds. Because the bonds are owed by the Treasury, drawing them down means the rest of the government must borrow more or collect more to repay them. That’s one reason Social Security and the overall deficit are linked. Total income in {lastHist.year}: {money(lastHist.income)}; cost: {money(lastHist.cost)} ({pct(lastHist.cost / lastHist.income - 1, 0)} more).</p>
      </div>
    </>
  );
}
