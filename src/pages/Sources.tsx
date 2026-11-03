import { PageHead, Section } from '../components/ui';
import { budget, cbo, geo, SOURCES, ssa } from '../data';
import { dateLabel } from '../lib/format';

export default function Sources() {
  const groups = [...new Set(SOURCES.map((s) => s.publisher))];
  return (
    <>
      <PageHead
        eyebrow="Reference"
        title="Sources & methods"
        lede="Every number on this site comes from an official U.S. government source. Data were downloaded from each agency’s published API or files by a reproducible script; the date each was retrieved is listed below."
      />
      <Section id="list" title="Datasets and documents">
        {groups.map((g) => (
          <div key={g} className="card" style={{ paddingBlock: 6 }}>
            <div className="eyebrow" style={{ paddingTop: 12 }}>{g}</div>
            <div className="source-list">
              {SOURCES.filter((s) => s.publisher === g).map((s) => (
                <div className="source" key={s.id}>
                  <div>
                    <div className="source-title"><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></div>
                    {s.note && <div className="source-meta">{s.note}</div>}
                  </div>
                  <div className="source-meta">{s.retrieved ? `Retrieved ${dateLabel(s.retrieved)}` : ''}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>
      <Section id="methods" title="Methods and definitions">
        <div className="prose">
          <p><strong>Fiscal years.</strong> The federal fiscal year runs from October 1 to September 30 and is named for the year it ends. FY{budget.latestFY} ran from October 1, {budget.latestFY - 1}, to September 30, {budget.latestFY}.</p>
          <p><strong>Spending, revenue, and deficits</strong> are the Treasury’s official totals from the Monthly Treasury Statement (MTS). Each fiscal year’s figures come from the September statement, whose fiscal-year-to-date column covers the full year. Spending is “net outlays”: payments minus offsetting collections such as Medicare premiums.</p>
          <p><strong>Categories.</strong> Spending categories group the Treasury’s budget functions: Social Security (650), Medicare (570), Medicaid & other health (550), Income security (600), Veterans (700), National defense (050), Net interest (900), and everything else, including undistributed offsetting receipts (950).</p>
          <p><strong>Mandatory, discretionary, and interest</strong> splits and the long-run history (FY{cbo.history[0]?.fy}–FY{cbo.history.at(-1)?.fy}) come from CBO’s historical budget data; projections are CBO’s {cbo.vintage}, which assume current law stays unchanged.</p>
          <p><strong>Per person and per household</strong> figures divide national totals by the U.S. resident population ({budget.population.label}) and number of households ({budget.households.label}).</p>
          <p><strong>State and district figures</strong> are federal award obligations in FY{geo.fy} from USAspending.gov, by place of performance. Obligations are commitments to spend and differ from outlays; not all federal spending is recorded as an award.</p>
          <p><strong>Social Security</strong> projections are from the {ssa.report} (intermediate assumptions), released {ssa.released}.</p>
          <p><strong>Laws.</strong> Deficit effects are the official CBO or JCT estimates published when each law was enacted, as linked on each entry.</p>
          <p><strong>Rounding.</strong> Figures are rounded for readability; totals may not add because of rounding.</p>
        </div>
      </Section>
    </>
  );
}
