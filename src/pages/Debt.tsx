import { useMemo } from 'react';
import { SegBar, TimeChart } from '../components/charts';
import { Guilloche } from '../components/Guilloche';
import { ChartFrame, Legend, PageHead, Section, Stat, Term, TipRow } from '../components/ui';
import { budget, cbo, debt, HH, POP } from '../data';
import { categoryTotals, cboSeries } from '../lib/derive';
import { dateLabel, dollars, money, moneyWords, pct } from '../lib/format';
import { useLive } from '../lib/live';

export default function Debt() {
  const live = useLive();
  const d = live.debt ?? debt.latest;
  const byFY = debt.byFY.filter((r) => r.fy >= 1990);
  const lastFY = byFY.at(-1)!;
  const deficits = Object.fromEntries(budget.annual.map((a) => [a.fy, a.deficit]));
  const cboDef = Object.fromEntries(cbo.history.map((h) => [h.fy, h.deficit]));
  const rows = useMemo(() => cboSeries(), []);
  const projIdx = rows.findIndex((r) => !r.actual);
  const years = Object.keys(budget.functionsByFY).map(Number).sort((a, b) => a - b);
  const interestTreasury = years.map((y) => categoryTotals(y).find((c) => c.id === 'interest')!.amount);
  const defenseTreasury = years.map((y) => categoryTotals(y).find((c) => c.id === 'defense')!.amount);
  const crossIdx = rows.findIndex((r) => r.netInterest > r.defense);
  const rates = debt.rates.filter((r) => r.date >= '2005-01-01');
  const lastRate = rates.at(-1);
  const minRate = rates.reduce((m, r) => (r.marketable < m.marketable ? r : m), rates[0]);
  const yrs10 = byFY.find((r) => r.fy === lastFY.fy - 10);

  return (
    <>
      <PageHead
        eyebrow="Debt & interest"
        title="What we owe, and what it costs"
        lede={<>Each year’s deficit is borrowed by selling Treasury securities, and the borrowing adds up. The <Term id="gross-debt">total public debt</Term> is the running total of everything the government still owes.</>}
      />
      <section className="hero" aria-labelledby="debt-t">
        <Guilloche />
        <div className="eyebrow">Debt to the Penny · {dateLabel(d.date)}{live.debt && <> <span className="pill pill-live">Live from Treasury</span></>}</div>
        <h2 id="debt-t" className="sr-only">Total public debt outstanding</h2>
        <div className="hero-figure">{money(d.total)}</div>
        <p className="hero-sentence">
          That’s <strong>{dollars(d.total / POP)}</strong> for every person in the U.S., or <strong>{dollars(d.total / HH)}</strong> per household.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
          <SegBar
            label="Total public debt by holder"
            parts={[
              { label: 'Debt held by the public', value: d.public, color: 'var(--c-emph)', ink: 'var(--accent-ink)' },
              { label: 'Intragovernmental holdings', value: d.intragov, color: 'var(--c-deemph)', ink: 'var(--ink)' },
            ]}
          />
          <div className="grid-2">
            <Stat label={<><span className="swatch" style={{ background: 'var(--c-emph)' }} /><Term id="debt-public">Debt held by the public</Term></>} value={money(d.public)} note="Owed to investors, banks, pension funds, foreign governments, and the Federal Reserve. This is the debt that competes for savings and drives interest costs." />
            <Stat label={<><span className="swatch" style={{ background: 'var(--c-deemph)' }} /><Term id="intragov">Intragovernmental holdings</Term></>} value={money(d.intragov)} note="Owed by the Treasury to federal trust funds such as Social Security and military and civil service retirement." />
          </div>
        </div>
      </section>

      <Section
        id="added"
        title="What each fiscal year added to the debt"
        sub={<>Change in total public debt outstanding from one September 30 to the next. It usually tracks the deficit closely; differences come from changes in the Treasury’s cash balance, student loans and other credit programs, and trust fund surpluses.{yrs10 ? ` Over the past ten years the debt rose by ${moneyWords(lastFY.total - yrs10.total)}.` : ''}</>}
      >
        <div className="card">
          <ChartFrame
            title={`Increase in total public debt, FY${byFY[0].fy}–FY${lastFY.fy}`}
            legend={<Legend items={[{ label: 'Added to the debt', color: 'var(--c-interest)' }, { label: 'Debt went down', color: 'var(--div-neg)' }]} />}
            sourceIds={['debtHist']}
            table={{
              columns: [{ key: 'fy', label: 'Fiscal year' }, { key: 't', label: 'Debt on Sep 30', align: 'r' }, { key: 'c', label: 'Change', align: 'r' }, { key: 'd', label: 'Deficit that year', align: 'r' }],
              rows: byFY.map((r) => ({ fy: `FY${r.fy}`, t: money(r.total), c: r.change == null ? '—' : money(r.change), d: deficits[r.fy] != null ? money(deficits[r.fy]) : cboDef[r.fy] != null ? money(cboDef[r.fy]) : '—' })),
            }}
          >
            <TimeChart
              label="Annual change in total public debt"
              x={byFY.map((r) => r.fy)}
              tipTitle={(y) => `FY${y}`}
              height={300}
              zeroLine
              series={[
                { id: 'up', label: 'Added to the debt', color: 'var(--c-interest)', kind: 'bar', stack: 'a', values: byFY.map((r) => (r.change != null && r.change >= 0 ? r.change : null)) },
                { id: 'down', label: 'Debt went down', color: 'var(--div-neg)', kind: 'bar', stack: 'a', values: byFY.map((r) => (r.change != null && r.change < 0 ? r.change : null)) },
              ]}
              tipExtra={(i) => {
                const r = byFY[i];
                const def = deficits[r.fy] ?? cboDef[r.fy];
                return <>
                  <TipRow label="Debt on Sep 30" value={money(r.total)} />
                  {def != null && <TipRow label="Deficit that year" value={money(def)} />}
                </>;
              }}
            />
          </ChartFrame>
        </div>
      </Section>

      <Section
        id="interest"
        eyebrow="The cost of borrowing"
        title={interestTreasury.at(-1)! > defenseTreasury.at(-1)! ? 'Interest now costs more than defense' : 'Interest is closing in on defense'}
        sub={<>Net interest is the interest the government pays on debt held by the public, minus interest it earns. {crossIdx >= 0 ? `It passed defense spending in FY${rows[crossIdx].fy}${rows[crossIdx].actual ? '' : ' (projected)'}` : 'It is approaching defense spending'}{crossIdx >= 0 && rows[crossIdx].fy < 2000 ? ' for a time in the 1990s as well' : ''}.</>}
      >
        <div className="grid-2">
          <div className="card">
            <ChartFrame
              title="Net interest vs. national defense"
              sub={`Treasury net outlays, FY${years[0]}–FY${years.at(-1)}`}
              legend={<Legend items={[{ label: 'Net interest', color: 'var(--c-interest)', kind: 'line' }, { label: 'National defense', color: 'var(--c-defense)', kind: 'line' }]} />}
              sourceIds={['mts9']}
              table={{ columns: [{ key: 'fy', label: 'Fiscal year' }, { key: 'i', label: 'Net interest', align: 'r' }, { key: 'd', label: 'Defense', align: 'r' }], rows: years.map((y, i) => ({ fy: `FY${y}`, i: money(interestTreasury[i]), d: money(defenseTreasury[i]) })) }}
            >
              <TimeChart label="Net interest and defense outlays" x={years} xLabel={(y) => `’${String(y).slice(2)}`} tipTitle={(y) => `FY${y}`} height={260} series={[
                { id: 'i', label: 'Net interest', color: 'var(--c-interest)', kind: 'line', values: interestTreasury },
                { id: 'd', label: 'National defense', color: 'var(--c-defense)', kind: 'line', values: defenseTreasury },
              ]} />
            </ChartFrame>
          </div>
          <div className="card">
            <ChartFrame
              title="Where interest is headed"
              sub={`Net interest and defense as a share of GDP, with the ${cbo.vintage}`}
              legend={<Legend items={[{ label: 'Net interest', color: 'var(--c-interest)', kind: 'line' }, { label: 'Defense (discretionary)', color: 'var(--c-defense)', kind: 'line' }]} />}
              sourceIds={[cbo.historySourceId, cbo.baselineSourceId]}
            >
              <TimeChart
                label="Net interest and defense as a share of GDP"
                x={rows.map((r) => r.fy)}
                tipTitle={(y, i) => `FY${y}${rows[i].actual ? '' : ' (projected)'}`}
                height={260}
                yFormat={(v) => `${(v * 100).toFixed(0)}%`}
                tipFormat={(v) => pct(v)}
                projectFrom={projIdx > 0 ? projIdx : undefined}
                projectLabel={cbo.projBy}
                series={[
                  { id: 'i', label: 'Net interest', color: 'var(--c-interest)', kind: 'line', values: rows.map((r) => r.netInterest / r.gdp) },
                  { id: 'd', label: 'Defense', color: 'var(--c-defense)', kind: 'line', values: rows.map((r) => r.defense / r.gdp) },
                ]}
              />
            </ChartFrame>
          </div>
        </div>
        <div className="card">
          <ChartFrame
            title="Average interest rate on the government’s marketable debt"
            sub={lastRate ? `${pct(lastRate.marketable / 100, 2)} in ${lastRate.date.slice(0, 7)}, up from a low of ${pct(minRate.marketable / 100, 2)} in ${minRate.date.slice(0, 7)}. As old low-rate bonds mature, they are refinanced at today’s higher rates.` : undefined}
            sourceIds={['rates']}
          >
            <TimeChart
              label="Average interest rate on marketable Treasury debt"
              x={rates.map((r) => r.date)}
              xLabel={(d) => String(d).slice(0, 4)}
              xTicks={rates.map((r, i) => (r.date.slice(5, 7) === '01' && Number(r.date.slice(0, 4)) % 5 === 0 ? i : -1)).filter((i) => i >= 0)}
              tipTitle={(d) => String(d).slice(0, 7)}
              height={220}
              yFormat={(v) => `${v.toFixed(0)}%`}
              tipFormat={(v) => `${v.toFixed(2)}%`}
              series={[{ id: 'r', label: 'Marketable debt', color: 'var(--c-interest)', kind: 'line', values: rates.map((r) => r.marketable) }]}
            />
          </ChartFrame>
        </div>
        <p className="small muted">
          Treasury also reports gross <Term id="interest-expense">interest expense</Term> on all debt, including interest credited to trust funds: {money(debt.interestByFY.at(-1)?.gross ?? 0)} in FY{debt.interestByFY.at(-1)?.fy}. The budget counts only <em>net</em> interest, because interest paid to trust funds is money one part of the government owes another.
        </p>
      </Section>
    </>
  );
}
