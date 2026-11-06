import { useState } from 'react';
import { PageHead, Section, Seg, Term } from '../components/ui';
import { type Method, TaxReceipt, useWages, WageControls } from '../components/TaxReceipt';
import { budget, tax } from '../data';
import { dollars, pct } from '../lib/format';
import { estimateTaxes } from '../lib/tax';

export default function Receipt() {
  const w = useWages();
  const { wages, status } = w;
  const [method, setMethod] = useState<Method>('dedicated');
  const fy = budget.latestFY;
  const r = estimateTaxes(wages, status, tax);

  return (
    <>
      <PageHead
        eyebrow="Your tax receipt"
        title="Where your tax dollars went"
        lede={<>Enter a yearly salary to estimate the federal income and payroll taxes withheld from it, then see how those dollars were divided up based on FY{fy} spending.</>}
      />
      <div className="split">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <WageControls id="wages" {...w} />
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
          <TaxReceipt wages={wages} status={status} method={method} />
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
