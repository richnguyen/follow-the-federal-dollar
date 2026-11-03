import { useMemo, useState } from 'react';
import { PageHead, Section, Seg, Term } from '../components/ui';
import { budget, debt, fyTotals, POP, tax } from '../data';
import type { FilingStatus } from '../data/types';
import { categoryTotals } from '../lib/derive';
import { dollars, pct } from '../lib/format';
import { load, save } from '../lib/storage';
import { estimateTaxes } from '../lib/tax';

type Method = 'simple' | 'dedicated';

const STATUS: { value: FilingStatus; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married filing jointly' },
  { value: 'head', label: 'Head of household' },
];

const cents = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Receipt() {
  const [wages, setWages] = useState<number>(() => load('wages', 65000));
  const [status, setStatus] = useState<FilingStatus>(() => load('status', 'single' as FilingStatus));
  const [method, setMethod] = useState<Method>('dedicated');
  const fy = budget.latestFY;
  const t = fyTotals(fy);
  const cats = useMemo(() => categoryTotals(fy), [fy]);
  const r = estimateTaxes(wages, status, tax);
  const totalOut = cats.reduce((s, c) => s + c.amount, 0);

  // Allocation. "simple": every tax dollar is split like total spending.
  // "dedicated": payroll taxes go to their trust-fund programs; income tax is split across the rest.
  const lines = useMemo(() => {
    if (method === 'simple') return cats.map((c) => ({ ...c, mine: (r.total * c.amount) / totalOut }));
    // Payroll taxes dedicated to each program's trust funds (MTS Table 4) pay part of that program;
    // income tax is split across what remains of each category's spending.
    const dedicated: Record<string, number> = {
      ss: budget.payroll.filter((p) => /OASI|\(DI\)/.test(p.name)).reduce((s, p) => s + p.amount, 0),
      medicare: budget.payroll.filter((p) => /\(HI\)/.test(p.name)).reduce((s, p) => s + p.amount, 0),
    };
    const remaining = cats.map((c) => Math.max(0, c.amount - (dedicated[c.id] ?? 0)));
    const remTotal = remaining.reduce((s, v) => s + v, 0);
    return cats.map((c, i) => ({
      ...c,
      mine: (c.id === 'ss' ? r.ssTax : c.id === 'medicare' ? r.medicareTax : 0) + (r.incomeTax * remaining[i]) / remTotal,
    }));
  }, [method, cats, r.total, r.ssTax, r.medicareTax, r.incomeTax, totalOut]);
  const borrowedOnTop = r.total * (t.deficit / t.receipts);
  const debtShare = debt.latest.total / POP;

  const setW = (v: number) => {
    const x = Math.max(0, Math.min(10_000_000, Math.round(v)));
    setWages(x);
    save('wages', x);
  };

  return (
    <>
      <PageHead
        eyebrow="Your tax receipt"
        title="Where your tax dollars went"
        lede={<>Enter a yearly salary to estimate the federal income and payroll taxes withheld from it, then see how those dollars were divided up based on FY{fy} spending.</>}
      />
      <div className="split">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <label htmlFor="wages">Yearly wages or salary</label>
            <input id="wages" className="input" type="number" inputMode="numeric" min={0} step={1000} value={wages} onChange={(e) => setW(Number(e.target.value))} />
            <input aria-label="Wages slider" type="range" min={0} max={400000} step={1000} value={Math.min(wages, 400000)} onChange={(e) => setW(Number(e.target.value))} />
          </div>
          <div className="field">
            <label htmlFor="status">Filing status</label>
            <select id="status" className="select" value={status} onChange={(e) => { setStatus(e.target.value as FilingStatus); save('status', e.target.value); }}>
              {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="field">
            <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--ink-2)' }}>How to split your taxes</span>
            <Seg<Method> label="Allocation method" value={method} onChange={setMethod} options={[{ value: 'dedicated', label: 'Follow payroll taxes' }, { value: 'simple', label: 'Split evenly' }]} />
            <p className="small muted">
              {method === 'dedicated'
                ? 'Your Social Security and Medicare payroll taxes go to those programs’ trust funds. Your income tax is split across the spending that payroll taxes don’t cover, including the large share of Medicare paid from general revenue.'
                : 'Every tax dollar is split in proportion to total federal spending, the way the White House’s old “taxpayer receipt” worked.'}
            </p>
          </div>
          <div className="prose small">
            <p><strong>What this estimate assumes:</strong> {tax.year} tax rates, wages are your only income, you take the <Term id="standard-deduction">standard deduction</Term>, and you claim no credits (such as the Child Tax Credit). For married couples the wages are treated as one earner’s. Only your own share of payroll taxes is counted; your employer pays an equal amount.</p>
            <p>Your taxable income: {dollars(r.taxable)} · top bracket: {pct(r.marginal, 0)} · total federal tax as a share of wages: {pct(r.effective)}.</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="receipt" role="table" aria-label="Your federal tax receipt">
            <h3>Federal tax receipt</h3>
            <div className="small muted" style={{ textAlign: 'center', marginTop: 4 }}>Based on FY{fy} spending · {STATUS.find((s) => s.value === status)!.label}</div>
            <div className="rule" />
            <div className="receipt-row"><span /><span>Federal income tax</span><span className="v">{cents(r.incomeTax)}</span></div>
            <div className="receipt-row"><span /><span>Social Security tax (6.2%)</span><span className="v">{cents(r.ssTax)}</span></div>
            <div className="receipt-row"><span /><span>Medicare tax (1.45%{r.wages > tax.addlMedicareThreshold[status] ? ' + 0.9%' : ''})</span><span className="v">{cents(r.medicareTax)}</span></div>
            <div className="rule" />
            <div className="receipt-row receipt-total"><span /><span>You paid</span><span className="v">{cents(r.total)}</span></div>
            <div className="rule" />
            <div className="small muted" style={{ margin: '4px 0 6px' }}>WHERE IT WENT</div>
            {[...lines].sort((a, b) => b.mine - a.mine).map((l) => (
              <div className="receipt-row" key={l.id}>
                <span className="swatch" style={{ background: l.color }} />
                <span>{l.label}</span>
                <span className="v">{cents(l.mine)}</span>
              </div>
            ))}
            <div className="rule" />
            <div className="receipt-row"><span className="swatch" style={{ background: 'repeating-linear-gradient(135deg, var(--c-borrow-ink) 0 2px, transparent 2px 4px)' }} /><span>Also borrowed on your behalf</span><span className="v">{cents(borrowedOnTop)}</span></div>
            <p className="small muted" style={{ marginTop: 8 }}>
              In FY{fy} the government spent {pct(t.outlays / t.receipts - 1, 0)} more than it collected. For every dollar you paid, it borrowed about {Math.round((t.deficit / t.receipts) * 100)}¢ more to cover the gap. Your per-person share of the total debt: {dollars(debtShare)}.
            </p>
          </div>
        </div>
      </div>

      <Section id="receipt-note" title="Reading your receipt">
        <div className="prose">
          <p>Your taxes don’t literally go into labeled jars. Except for payroll taxes, which are legally dedicated to Social Security and Medicare, federal money is pooled in the Treasury’s general fund. This receipt shows your share of each category if your taxes were divided the same way the government spent its money.</p>
          <p>Spending categories and amounts come from the Monthly Treasury Statement for FY{fy}. Tax rates, the Social Security wage base, and Medicare tax thresholds come from IRS publications for {tax.year} (see <a href="#sources">Sources</a>).</p>
        </div>
      </Section>
    </>
  );
}
