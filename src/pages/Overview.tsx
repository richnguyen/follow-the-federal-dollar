import { useMemo, useState } from 'react';
import { SegBar, TimeChart, Waffle, hundredths } from '../components/charts';
import { Guilloche } from '../components/Guilloche';
import { ChartFrame, Legend, Section, Seg, Stat, Term, TipRow } from '../components/ui';
import { budget, cbo, debt, fyTotals, HH, POP } from '../data';
import { BUCKETS, CATEGORIES } from '../lib/categories';
import { dollars, fyRange, money, moneyWords, monthShort, pct, signedPct } from '../lib/format';
import { useLive } from '../lib/live';
import { type UnitMode, useUnits } from '../lib/units';
import { bucketYear, categoryTotals } from '../lib/derive';

export function UnitsToggle() {
  const u = useUnits();
  return (
    <div className="toolbar-item">
      <span>Show amounts</span>
      <Seg<UnitMode>
        label="Units"
        value={u.mode}
        onChange={u.setMode}
        options={[{ value: 'total', label: 'Total' }, { value: 'person', label: 'Per person' }, { value: 'household', label: 'Per household' }]}
      />
    </div>
  );
}

export default function Overview() {
  const fy = budget.latestFY;
  const t = fyTotals(fy);
  const prev = fyTotals(fy - 1);
  const u = useUnits();
  const live = useLive();
  const [active, setActive] = useState<string | null>(null);
  const cats = useMemo(() => categoryTotals(fy), [fy]);
  const counts = hundredths(cats.map((c) => c.amount));
  const perDay = t.outlays / (fy % 4 === 0 ? 366 : 365);
  const borrowedShare = t.deficit / t.outlays;
  const bucket = bucketYear(fy);
  const mi = bucket.y.mandatory + bucket.y.netInterest;
  const interest = cats.find((c) => c.id === 'interest')!.amount;
  const defense = cats.find((c) => c.id === 'defense')!.amount;
  const ssAmt = cats.find((c) => c.id === 'ss')!.amount;
  const months = budget.monthly.filter((m) => m.fy === fy);
  const fys = [fy - 2, fy - 1, fy];

  return (
    <>
      <section className="hero" aria-labelledby="hero-t">
        <Guilloche />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="eyebrow">Fiscal year {fy} · {fyRange(fy)}</div>
          <h1 id="hero-t" className="sr-only">Federal spending in fiscal year {fy}</h1>
          <div className="hero-figure" aria-hidden="true">{money(t.outlays)}<small>spent</small></div>
          <p className="hero-sentence">
            The federal government spent <strong>{moneyWords(t.outlays)}</strong> in fiscal year {fy}. It collected{' '}
            <strong>{moneyWords(t.receipts)}</strong> in taxes and other revenue and borrowed the other <strong>{moneyWords(t.deficit)}</strong>.
          </p>
        </div>
        <div className="grid-3">
          <Stat label="Spent" value={money(t.outlays)} note={<>{dollars(t.outlays / POP)} per person · {signedPct(t.outlays / prev.outlays - 1)} vs FY{fy - 1}</>} />
          <Stat label="Collected" value={money(t.receipts)} note={<>{dollars(t.receipts / POP)} per person · {signedPct(t.receipts / prev.receipts - 1)} vs FY{fy - 1}</>} />
          <Stat label={<>Borrowed (the <Term id="deficit">deficit</Term>)</>} value={money(t.deficit)} note={<>{dollars(t.deficit / POP)} per person · {signedPct(t.deficit / prev.deficit - 1)} vs FY{fy - 1}</>} />
        </div>
        <p className="small muted">
          That is about {money(perDay)} a day, or {dollars(t.outlays / HH)} for every household in the country. Totals are from the
          U.S. Treasury’s <Term id="mts">Monthly Treasury Statement</Term> for September {fy}.
          {live.mts && <> <span className="pill pill-live">Live</span> FY{live.mts.fy} so far, through {live.mts.date}: {money(live.mts.outlaysFYTD)} spent, {money(live.mts.receiptsFYTD)} collected.</>}
        </p>
      </section>

      <div className="toolbar"><UnitsToggle /></div>

      <Section
        id="every-100"
        eyebrow="Where it goes"
        title={`Where every $100 went in FY${fy}`}
        sub="Each square is one dollar out of every hundred the government spent. Point at a square or a row to highlight it."
      >
        <div className="card">
          <div className="waffle-wrap">
            <Waffle parts={cats.map((c) => ({ id: c.id, label: c.label, value: c.amount, color: c.color }))} active={active} onActive={setActive} label={`Every $100 of FY${fy} spending`} />
            <div className="key-list" role="list" onPointerLeave={() => setActive(null)}>
              {cats.map((c, i) => (
                <div key={c.id} role="listitem" className="key-row" data-active={active === c.id} onPointerEnter={() => setActive(c.id)}>
                  <span className="swatch" style={{ background: c.color }} />
                  <span>
                    <a href="#spending" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>{c.label}</a>
                    <div className="small muted">{c.blurb}</div>
                  </span>
                  <span className="amt">${counts[i]}</span>
                  <span className="share" title="Amount in current units">{u.fmt(c.amount)}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="small muted" style={{ marginTop: 14 }}>
            “Everything else” is shown after subtracting {money(-cats.find((c) => c.id === 'other')!.offset)} of{' '}
            <Term id="offsetting">undistributed offsetting receipts</Term>, money agencies collect or pay to each other that the
            Treasury books as negative spending. Amounts at right are {u.mode === 'total' ? 'totals' : u.suffix.trim()}.
          </p>
        </div>
      </Section>

      <Section
        id="each-dollar"
        eyebrow="Paying for it"
        title="How each dollar of spending was paid for"
        sub={`For every dollar the government spent in FY${fy}, ${Math.round((1 - borrowedShare) * 100)} cents came from taxes and other revenue. The rest was borrowed and added to the national debt.`}
      >
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SegBar
            label="Spending paid for by revenue versus borrowing"
            parts={[
              { label: 'Taxes and other revenue', value: t.receipts, color: 'var(--c-emph)', ink: 'var(--accent-ink)' },
              { label: 'Borrowed', value: t.deficit, color: 'var(--c-borrow)', ink: '#0b0b0b' },
            ]}
          />
          <Legend items={[{ label: `Taxes and other revenue · ${money(t.receipts)}`, color: 'var(--c-emph)' }, { label: `Borrowed · ${money(t.deficit)}`, color: 'var(--c-borrow)' }]} />
        </div>
      </Section>

      <Section
        id="buckets"
        eyebrow="Three kinds of spending"
        title="Most spending is on autopilot"
        sub={<>Congress votes every year on only about a quarter of the budget. The rest is set by permanent laws or is <Term id="net-interest">interest</Term> the government owes.</>}
      >
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SegBar
            label={`FY${bucket.y.fy} outlays by budget category`}
            parts={BUCKETS.map((b) => ({ label: b.label, value: bucket.y[b.id], color: b.color, ink: b.id === 'otherMandatory' ? '#0b0b0b' : '#fff' }))}
          />
          <Legend items={BUCKETS.map((b) => ({ label: b.label, color: b.color }))} />
          <div className="grid-3">
            <div className="stat">
              <div className="stat-label"><Term id="mandatory">Mandatory spending</Term></div>
              <div className="stat-value">{pct(bucket.y.mandatory / bucket.y.outlays, 0)}</div>
              <div className="stat-note">{u.fmt(bucket.y.mandatory)}{u.suffix}. Set by permanent law, not annual votes: Social Security, Medicare, Medicaid, veterans’ benefits and more. Costs grow automatically as the population ages and health care prices rise.</div>
            </div>
            <div className="stat">
              <div className="stat-label"><Term id="discretionary">Discretionary spending</Term></div>
              <div className="stat-value">{pct(bucket.y.discretionary / bucket.y.outlays, 0)}</div>
              <div className="stat-note">{u.fmt(bucket.y.discretionary)}{u.suffix}. Set each year in 12 <Term id="appropriations">appropriations</Term> bills. Split between defense ({pct(bucket.y.defense / bucket.y.discretionary, 0)}) and everything else: education, transportation, science, foreign aid, public health ({pct(bucket.y.nondefense / bucket.y.discretionary, 0)}).</div>
            </div>
            <div className="stat">
              <div className="stat-label"><Term id="net-interest">Net interest</Term></div>
              <div className="stat-value">{pct(bucket.y.netInterest / bucket.y.outlays, 0)}</div>
              <div className="stat-note">{u.fmt(bucket.y.netInterest)}{u.suffix}. Not a program or a benefit: the cost of past borrowing. It is one of the fastest-growing parts of the budget.</div>
            </div>
          </div>
          <p className="small muted">{bucket.label}</p>
        </div>
      </Section>

      <Section
        id="monthly"
        eyebrow="Month by month"
        title={`The FY${fy} deficit, as it built up`}
        sub="The Treasury reports receipts and spending every month. Spending usually beats revenue except in tax-filing months like April."
      >
        <div className="grid-2">
          <div className="card">
            <ChartFrame
              title="Monthly surplus or deficit"
              sub="Bars below zero are months the government spent more than it took in."
              sourceIds={['mts9']}
              table={{
                columns: [{ key: 'm', label: 'Month' }, { key: 'r', label: 'Receipts', align: 'r' }, { key: 'o', label: 'Outlays', align: 'r' }, { key: 'd', label: 'Surplus (+) / deficit (−)', align: 'r' }],
                rows: months.map((m) => ({ m: monthShort(m.date) + ' ' + m.date.slice(0, 4), r: money(m.receipts), o: money(m.outlays), d: money(-m.deficit) })),
              }}
            >
              <TimeChart
                label="Monthly surplus or deficit"
                x={months.map((m) => m.date)}
                xLabel={(d) => monthShort(String(d))}
                height={240}
                zeroLine
                series={[{ id: 'bal', label: 'Surplus (+) / deficit (−)', color: 'var(--c-interest)', kind: 'bar', values: months.map((m) => -m.deficit) }]}
                tipExtra={(i) => <><TipRow label="Receipts" value={money(months[i].receipts)} /><TipRow label="Outlays" value={money(months[i].outlays)} /></>}
              />
            </ChartFrame>
          </div>
          <div className="card">
            <ChartFrame
              title="Running total of the deficit"
              sub={`FY${fy} compared with the two years before it.`}
              sourceIds={['mts9']}
              legend={<Legend items={fys.map((f, i) => ({ label: `FY${f}`, color: i === 2 ? 'var(--c-emph)' : i === 1 ? 'var(--ink-2)' : 'var(--c-deemph)', kind: 'line' as const }))} />}
            >
              <TimeChart
                label="Cumulative deficit by fiscal month"
                x={['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']}
                height={240}
                series={fys.map((f, i) => {
                  let run = 0;
                  const vals = Array.from({ length: 12 }, (_, k) => {
                    const m = budget.monthly.find((r) => r.fy === f && r.fm === k + 1);
                    if (!m) return null;
                    run += m.deficit;
                    return run;
                  });
                  return { id: 'fy' + f, label: `FY${f}`, color: i === 2 ? 'var(--c-emph)' : i === 1 ? 'var(--ink-2)' : 'var(--c-deemph)', kind: 'line' as const, values: vals };
                })}
              />
            </ChartFrame>
          </div>
        </div>
      </Section>

      <Section id="facts" eyebrow="Worth knowing" title="Four numbers to remember">
        <div className="facts">
          <div className="fact">
            <div className="fact-big">{money(interest)}</div>
            <p>went to <strong>net interest</strong> on the debt in FY{fy}, {interest > defense ? `more than the ${money(defense)} spent on national defense` : `compared with ${money(defense)} for national defense`}.</p>
          </div>
          <div className="fact">
            <div className="fact-big">{money(mi)}</div>
            <p>went to mandatory programs and interest ({bucket.short}). That is {mi > t.receipts ? 'more than' : pct(mi / t.receipts, 0) + ' of'} all the revenue the government collected, so {mi > t.receipts ? 'every dollar Congress votes on each year was effectively borrowed' : 'little revenue is left for everything Congress votes on each year'}.</p>
          </div>
          <div className="fact">
            <div className="fact-big">{money(ssAmt)}</div>
            <p>was paid out by <strong>Social Security</strong>, the single largest federal program, about {dollars(ssAmt / POP)} per person.</p>
          </div>
          <div className="fact">
            <div className="fact-big">{money((live.debt ?? debt.latest).total)}</div>
            <p>was the <Term id="gross-debt">total public debt</Term> on {(live.debt ?? debt.latest).date}, or about {dollars((live.debt ?? debt.latest).total / HH)} per household. <a href="#debt">See the debt →</a></p>
          </div>
        </div>
      </Section>
    </>
  );
}

// re-export for other pages
export { CATEGORIES, cbo };
