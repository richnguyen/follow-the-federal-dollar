import { useMemo, useState } from 'react';
import { DivergingBar } from '../components/charts';
import { PageHead, Section, Seg, Term } from '../components/ui';
import { laws } from '../data';
import type { Law } from '../data/types';
import { dateLabel, money } from '../lib/format';

const KIND: Record<Law['kind'], string> = {
  tax: 'Tax law',
  emergency: 'Emergency package',
  spending: 'Spending law',
  reduction: 'Deficit reduction',
  mixed: 'Taxes and spending',
};

type Filter = 'all' | Law['kind'];
type Sort = 'date' | 'size';

const bn = (v: number) => {
  const s = v > 0 ? '+' : v < 0 ? '−' : '';
  const a = Math.abs(v);
  return a >= 1000 ? `${s}$${(a / 1000).toFixed(a >= 10000 ? 0 : 2)}T` : `${s}$${Math.round(a)}B`;
};

export default function Laws() {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('date');
  const list = useMemo(() => {
    const l = laws.filter((x) => filter === 'all' || x.kind === filter);
    return [...l].sort((a, b) => (sort === 'date' ? b.signed.localeCompare(a.signed) : Math.abs(b.deficitEffect) - Math.abs(a.deficitEffect)));
  }, [filter, sort]);
  const max = Math.max(...laws.map((l) => Math.abs(l.deficitEffect)));
  const added = laws.filter((l) => l.deficitEffect > 0).reduce((s, l) => s + l.deficitEffect, 0);
  const cut = laws.filter((l) => l.deficitEffect < 0).reduce((s, l) => s + l.deficitEffect, 0);
  const kinds = [...new Set(laws.map((l) => l.kind))];
  return (
    <>
      <PageHead
        eyebrow="Policy & legislative impact"
        title="Laws that moved the needle"
        lede={<>Deficits don’t just happen. They are written into law. Before major bills pass, the Congressional Budget Office (CBO) and the Joint Committee on Taxation (JCT) estimate how much each will change deficits over the next ten years. Here are the biggest of the past quarter century.</>}
      />
      <div className="facts">
        <div className="fact"><div className="fact-big">{bn(added)}</div><p>in larger deficits from the {laws.filter((l) => l.deficitEffect > 0).length} deficit-increasing laws listed here, as officially estimated when each was enacted.</p></div>
        <div className="fact"><div className="fact-big">{bn(cut)}</div><p>in smaller deficits from the {laws.filter((l) => l.deficitEffect < 0).length} deficit-reducing laws listed.</p></div>
        <div className="fact"><div className="fact-big">Bipartisan</div><p>Both parties have passed laws that added to deficits: tax cuts, emergency relief, and spending-cap increases, under presidents of both parties.</p></div>
      </div>
      <div className="toolbar">
        <div className="toolbar-item">
          <span>Show</span>
          <div className="chips" role="group" aria-label="Filter laws by type">
            <button type="button" className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
            {kinds.map((k) => (
              <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{KIND[k]}</button>
            ))}
          </div>
        </div>
        <div className="toolbar-item">
          <span>Sort</span>
          <Seg<Sort> label="Sort" value={sort} onChange={setSort} options={[{ value: 'date', label: 'Newest first' }, { value: 'size', label: 'Largest effect' }]} />
        </div>
      </div>
      <Section id="list" title="Ten-year effect on deficits, as estimated at enactment" sub={<>Bars to the right <span style={{ color: 'var(--ink)' }}>added to deficits</span>; bars to the left reduced them. Most estimates cover the ten years after the law passed and exclude the extra <Term id="net-interest">interest</Term> on the added debt, unless noted.</>}>
        <div className="card" style={{ paddingBlock: 6 }}>
          <div className="law-list">
            {list.map((l) => (
              <article key={l.id} className="law">
                <div className="law-year">{l.signed.slice(0, 4)}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="law-name">{l.name}</div>
                  <div className="law-meta">
                    <span className="pill">{KIND[l.kind]}</span>
                    <span>Signed {dateLabel(l.signed)} by President {l.president}</span>
                    <span>{l.publicLaw}</span>
                  </div>
                  <p className="law-summary">{l.summary}</p>
                  <div className="cite" style={{ marginTop: 6 }}>
                    Estimate: <a href={l.source.url} target="_blank" rel="noreferrer">{l.source.title}</a> · {l.window}{l.includesInterest ? ', including added interest costs' : ''}
                  </div>
                </div>
                <DivergingBar value={l.deficitEffect} max={max} format={bn} />
              </article>
            ))}
          </div>
        </div>
        <p className="small muted">
          How to read these numbers: estimates are made before a law takes effect, so actual costs can differ, for example when an emergency program is used more or less than expected. Totals are not strictly additive, because later laws sometimes extended or repealed earlier ones. A law’s cost stated as “{money(1e12)}” means deficits over the window are projected to be that much higher than if the law had not passed.
        </p>
      </Section>
    </>
  );
}
