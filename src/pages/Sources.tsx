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
        lede="Every number on this site comes from an official U.S. government source. Most data were downloaded by a reproducible script from each agency’s API or published files, with the retrieval date listed below. A few figures (the Social Security trustees’ projections, the cost estimates for major laws, and the budget-process record) come from agencies whose websites block automated downloads; those were read from the agencies’ own pages, and each one links to its page."
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
          <p><strong>Mandatory, discretionary, and interest</strong> splits and the long-run history (FY{cbo.history[0]?.fy}–FY{cbo.history.at(-1)?.fy}) come from the OMB Historical Tables published with the FY2027 budget (Tables 1.1, 2.1, 7.1, 8.1, 10.1). Projections are the {cbo.vintage}, {cbo.projAssumes}.</p>
          <p><strong>Per person and per household</strong> figures divide national totals by the U.S. resident population ({budget.population.label}) and number of households ({budget.households.label}).</p>
          <p><strong>State and district figures</strong> are federal award obligations in FY{geo.fy} from USAspending.gov, by place of performance. Obligations are commitments to spend and differ from outlays; not all federal spending is recorded as an award.</p>
          <p><strong>Social Security</strong> trust fund history (income, cost, and reserves by fiscal year) comes from the Treasury’s Monthly Treasury Statement, Table 8. Depletion dates, the share of benefits payable afterward, and the changes needed to close the gap are from the {ssa.report} (intermediate assumptions), released {dateLabel(ssa.released)}, and the 2026 Medicare Trustees Report.</p>
          <p><strong>Laws.</strong> Deficit effects are the official CBO or JCT estimates published when each law was enacted, as linked on each entry.</p>
          <p><strong>Rounding.</strong> Figures are rounded for readability; totals may not add because of rounding.</p>
        </div>
      </Section>
    </>
  );
}
