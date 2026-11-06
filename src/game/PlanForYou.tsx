import { useWages, WageControls } from '../components/TaxReceipt';
import { LAST_FY } from '../lib/assess';
import { dollars } from '../lib/format';
import { personalEffect } from '../lib/personal';
import type { Levers } from '../lib/sandbox';

// "Your own tax receipt under this plan", on the budget desk. The salary is the one set on level 1
// and the tax receipt page, kept in this browser.

const signed = (v: number) => `${v >= 0 ? '+' : '−'}${dollars(Math.abs(v))}`;

export function PlanForYou({ ids, lv, gradual }: { ids: string[]; lv: Levers; gradual: boolean }) {
  const w = useWages();
  const pe = personalEffect(ids, lv, gradual, w.wages, w.status);
  if (!ids.length && !Object.values(lv).some(Boolean)) return null;
  return (
    <section className="card planforyou" aria-labelledby="pfy-t">
      <div className="eyebrow">What this plan means for you</div>
      <h2 className="section-title" id="pfy-t">Your own tax receipt: {Math.abs(pe.direct) < 1 ? 'no change' : `${signed(pe.direct)} a year`}</h2>
      <div className="pfy-grid">
        <div>
          <WageControls id="pfy" {...w} />
        </div>
        <div>
          {pe.lines.length ? (
            <ul className="pfy-lines">{pe.lines.map((l) => <li key={l.id}><span>{l.label}</span><strong className="num">{signed(l.amount)}</strong></li>)}</ul>
          ) : <p className="small">None of your cards changes your own income or payroll taxes at this salary.</p>}
          {pe.prices.perHousehold > 0 && (
            <p className="small"><strong>Through prices:</strong> {pe.prices.names.join('; ')}. Spread across every household, about {dollars(pe.prices.perHousehold)} a year by FY{LAST_FY}; what you pay depends on what you buy.</p>
          )}
          {pe.breaks.length > 0 && <p className="small"><strong>Tax breaks:</strong> {pe.breaks.join('; ')}.</p>}
          {pe.benefits.length > 0 && <p className="small"><strong>Programs and benefits:</strong> {pe.benefits.join('; ')}. These reach people through benefits and services rather than taxes.</p>}
          <p className="small muted">A wage earner with no other income taking the standard deduction, under current tax rules. Employers pay a matching share of payroll taxes, not shown.</p>
        </div>
      </div>
    </section>
  );
}
