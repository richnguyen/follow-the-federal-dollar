import { useMemo, useState } from 'react';
import { TimeChart } from '../components/charts';
import { ChartFrame, Legend, PageHead, Section, Seg, Term, TipRow } from '../components/ui';
import { cbo } from '../data';
import { cboSeries } from '../lib/derive';
import { compactAxis, money, pct } from '../lib/format';

type Basis = 'gdp' | 'dollars';

export default function Gap() {
  const [basis, setBasis] = useState<Basis>('gdp');
  const rows = useMemo(() => cboSeries(), []);
  const years = rows.map((r) => r.fy);
  const projIdx = rows.findIndex((r) => !r.actual);
  const val = (v: number, gdp: number) => (basis === 'gdp' ? v / gdp : v);
  const fmt = basis === 'gdp' ? (v: number) => pct(v, 1) : money;
  const axis = basis === 'gdp' ? (v: number) => `${Math.round(v * 100)}%` : compactAxis;
  const mi = rows.map((r) => val(r.mandatory + r.netInterest, r.gdp));
  const disc = rows.map((r) => val(r.discretionary, r.gdp));
  const rev = rows.map((r) => val(r.revenues, r.gdp));
  const overYears = rows.filter((r) => r.mandatory + r.netInterest > r.revenues);
  const overActual = overYears.filter((r) => r.actual).map((r) => r.fy);
  const overProj = overYears.filter((r) => !r.actual).map((r) => r.fy);
  const lastA = rows[projIdx > 0 ? projIdx - 1 : rows.length - 1];
  const lastP = rows.at(-1)!;
  const first = rows[0];
  const avgRev = rows.filter((r) => r.actual && r.fy >= first.fy).reduce((s, r) => s + r.revenues / r.gdp, 0) / rows.filter((r) => r.actual).length;

  const chartLabel = basis === 'gdp' ? 'as a share of the economy (GDP)' : 'in nominal dollars';

  return (
    <>
      <PageHead
        eyebrow="Deficits & the structural gap"
        title="The gap that doesn’t close"
        lede={<>A one-time deficit happens in a recession or a war. A <Term id="structural-deficit">structural deficit</Term> is built into current law: even in good years, the programs on autopilot plus interest cost about as much as everything the government collects.</>}
      />
      <div className="toolbar">
        <div className="toolbar-item">
          <span>Measure</span>
          <Seg<Basis> label="Measure" value={basis} onChange={setBasis} options={[{ value: 'gdp', label: 'Share of the economy' }, { value: 'dollars', label: 'Dollars' }]} />
        </div>
        <span className="small muted">Share of the economy (GDP) is the fairest way to compare across decades of inflation and growth.</span>
      </div>

      <Section
        id="structural"
        eyebrow="Visualizing the structural gap"
        title="Autopilot spending vs. all revenue"
        sub={<>The dark band is <Term id="mandatory">mandatory spending</Term> plus <Term id="net-interest">net interest</Term>. The light band on top is everything Congress votes on each year. The line is total revenue. Hatched years are when autopilot spending and interest alone cost more than all revenue.</>}
      >
        <div className="card">
          <ChartFrame
            title={`Federal spending and revenue, FY${first.fy}–FY${lastP.fy}, ${chartLabel}`}
            sub={`Actual through FY${lastA.fy}; CBO’s ${cbo.vintage} projection after that, assuming current law stays the same.`}
            legend={<Legend items={[
              { label: 'Mandatory programs + net interest', color: 'var(--c-emph)' },
              { label: 'Discretionary (defense + non-defense)', color: 'var(--c-deemph)' },
              { label: 'Total revenue', color: 'var(--c-revenue)', kind: 'line' },
              { label: 'Autopilot + interest exceeded revenue', color: 'var(--c-interest)', kind: 'hatch' },
            ]} />}
            sourceIds={[cbo.historySourceId, cbo.baselineSourceId]}
            table={{
              columns: [{ key: 'fy', label: 'Fiscal year' }, { key: 'mi', label: 'Mandatory + interest', align: 'r' }, { key: 'd', label: 'Discretionary', align: 'r' }, { key: 'o', label: 'Total outlays', align: 'r' }, { key: 'r', label: 'Revenue', align: 'r' }, { key: 'k', label: 'Kind' }],
              rows: rows.map((r, i) => ({ fy: `FY${r.fy}`, mi: fmt(mi[i]), d: fmt(disc[i]), o: fmt(val(r.outlays, r.gdp)), r: fmt(rev[i]), k: r.actual ? 'Actual' : 'CBO projection' })),
            }}
          >
            <TimeChart
              label={`Mandatory spending plus net interest, discretionary spending, and revenue ${chartLabel}`}
              x={years}
              xLabel={(y) => String(y)}
              tipTitle={(y, i) => `FY${y}${rows[i].actual ? '' : ' (projected)'}`}
              height={380}
              yFormat={axis}
              tipFormat={fmt}
              projectFrom={projIdx > 0 ? projIdx : undefined}
              projectLabel="CBO projection"
              series={[
                { id: 'mi', label: 'Mandatory + interest', color: 'var(--c-emph)', kind: 'area', stack: 's', values: mi, fillOpacity: 0.9 },
                { id: 'disc', label: 'Discretionary', color: 'var(--c-deemph)', kind: 'area', stack: 's', values: disc, fillOpacity: 1 },
                { id: 'rev', label: 'Revenue', color: 'var(--c-revenue)', kind: 'line', values: rev, width: 2.5 },
              ]}
              tipExtra={(i) => (
                <TipRow
                  label={mi[i] > rev[i] ? 'Autopilot + interest exceeded revenue by' : 'Revenue left after autopilot + interest'}
                  value={fmt(Math.abs(rev[i] - mi[i]))}
                />
              )}
              overlay={({ x, y, step }) => (
                <g>
                  <defs>
                    <pattern id="gap-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <rect width="1.8" height="5" fill="var(--c-interest)" />
                    </pattern>
                  </defs>
                  {rows.map((r, i) =>
                    mi[i] > rev[i] ? (
                      <rect key={r.fy} x={x(i) - step / 2} width={step} y={y(mi[i])} height={Math.max(0, y(rev[i]) - y(mi[i]))} fill="url(#gap-hatch)" />
                    ) : null,
                  )}
                </g>
              )}
            />
          </ChartFrame>
        </div>
        <div className="facts">
          <div className="fact">
            <div className="fact-big">{pct((lastA.mandatory + lastA.netInterest) / lastA.revenues, 0)}</div>
            <p>of all FY{lastA.fy} revenue was needed just for mandatory programs and interest ({money(lastA.mandatory + lastA.netInterest)} against {money(lastA.revenues)} collected).</p>
          </div>
          <div className="fact">
            <div className="fact-big">{overActual.length} years</div>
            <p>since FY{first.fy} when autopilot spending plus interest cost more than all revenue{overActual.length ? `: ${summarizeYears(overActual)}` : ''}.{overProj.length ? ` CBO projects it again in ${summarizeYears(overProj)}.` : ''}</p>
          </div>
          <div className="fact">
            <div className="fact-big">{pct(avgRev, 1)}</div>
            <p>of GDP is the average revenue level since FY{first.fy}. Spending has drifted well above that line while revenue has stayed in a narrow band.</p>
          </div>
        </div>
      </Section>

      <Section id="deficits" title="Every year’s deficit or surplus" sub="The government last ran a surplus in FY2001. Deficits jumped during the 2008–09 financial crisis and the COVID-19 pandemic, and stay large in CBO’s projections even without a recession.">
        <div className="card">
          <ChartFrame
            title={`Surplus or deficit, ${chartLabel}`}
            legend={<Legend items={[{ label: 'Deficit', color: 'var(--div-pos)' }, { label: 'Surplus', color: 'var(--div-neg)' }]} />}
            sourceIds={[cbo.historySourceId, cbo.baselineSourceId]}
            table={{ columns: [{ key: 'fy', label: 'Fiscal year' }, { key: 'v', label: 'Surplus (+) / deficit (−)', align: 'r' }, { key: 'k', label: 'Kind' }], rows: rows.map((r) => ({ fy: `FY${r.fy}`, v: fmt(-val(r.deficit, r.gdp)), k: r.actual ? 'Actual' : 'CBO projection' })) }}
          >
            <TimeChart
              label={`Federal surplus or deficit ${chartLabel}`}
              x={years}
              tipTitle={(y, i) => `FY${y}${rows[i].actual ? '' : ' (projected)'}`}
              height={280}
              yFormat={axis}
              tipFormat={fmt}
              zeroLine
              projectFrom={projIdx > 0 ? projIdx : undefined}
              projectLabel="CBO projection"
              series={[
                { id: 'def', label: 'Deficit', color: 'var(--div-pos)', kind: 'bar', stack: 'b', values: rows.map((r) => (r.deficit > 0 ? -val(r.deficit, r.gdp) : null)) },
                { id: 'sur', label: 'Surplus', color: 'var(--div-neg)', kind: 'bar', stack: 'b', values: rows.map((r) => (r.deficit <= 0 ? -val(r.deficit, r.gdp) : null)) },
              ]}
            />
          </ChartFrame>
        </div>
      </Section>

      <Section id="drivers" title="What drives the gap" sub="Three long-run forces, each shown as a share of the economy.">
        <div className="grid-3">
          {[
            { id: 'aging', title: 'Social Security, Medicare & Medicaid', sub: 'More retirees per worker and rising health costs.', color: 'var(--c-ss)', v: rows.map((r) => (r.socialSecurity + r.medicare + r.medicaid) / r.gdp) },
            { id: 'interest', title: 'Net interest', sub: 'A larger debt at higher interest rates.', color: 'var(--c-interest)', v: rows.map((r) => r.netInterest / r.gdp) },
            { id: 'rev', title: 'Revenue', sub: 'Roughly flat over decades, with tax cuts and recessions pulling it down.', color: 'var(--c-revenue)', v: rows.map((r) => r.revenues / r.gdp) },
          ].map((s) => (
            <div className="card" key={s.id}>
              <ChartFrame title={s.title} sub={s.sub}>
                <TimeChart
                  label={`${s.title} as a share of GDP`}
                  x={years}
                  height={180}
                  yFormat={(v) => `${Math.round(v * 100)}%`}
                  tipFormat={(v) => pct(v)}
                  tipTitle={(y, i) => `FY${y}${rows[i].actual ? '' : ' (projected)'}`}
                  projectFrom={projIdx > 0 ? projIdx : undefined}
                  projectLabel=" "
                  series={[{ id: s.id, label: s.title, color: s.color, kind: 'line', values: s.v }]}
                />
              </ChartFrame>
            </div>
          ))}
        </div>
        <div className="callout">
          <div className="callout-title">How laws and Congress’s habits feed the gap</div>
          <p>Major tax cuts, emergency packages, and new spending have been enacted with little or no offset, adding trillions to projected deficits. See <a href="#laws">laws that moved the needle</a>. Meanwhile Congress rarely completes its own formal budget process, relying on <Term id="cr">continuing resolutions</Term> and <Term id="omnibus">omnibus</Term> bills; see <a href="#process">how Congress budgets</a>.</p>
        </div>
      </Section>
    </>
  );
}

function summarizeYears(ys: number[]): string {
  if (!ys.length) return '';
  const runs: [number, number][] = [];
  for (const y of ys) {
    const last = runs.at(-1);
    if (last && y === last[1] + 1) last[1] = y;
    else runs.push([y, y]);
  }
  return runs.map(([a, b]) => (a === b ? `FY${a}` : `FY${a}–${String(b).slice(2)}`)).join(', ');
}
