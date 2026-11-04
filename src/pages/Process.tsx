import { useState } from 'react';
import { PageHead, Section, Term } from '../components/ui';
import { process } from '../data';
import { dateLabel } from '../lib/format';

export default function ProcessPage() {
  const years = [...process.years].sort((a, b) => a.fy - b.fy);
  const [sel, setSel] = useState<number>(years.at(-1)!.fy);
  const s = years.find((y) => y.fy === sel)!;
  const totalCRs = years.reduce((a, y) => a + y.crs, 0);
  const onTimeYears = years.filter((y) => y.onTime === 12).map((y) => y.fy);
  const noResolution = years.filter((y) => !y.resolution).length;
  const shutdowns = years.filter((y) => y.shutdownDays > 0);
  const lapseCount = years.reduce((a, y) => a + (y.lapses?.length ?? (y.shutdownDays > 0 ? 1 : 0)), 0);
  // Longest single shutdown that affected most of the government.
  const broad = years.flatMap((y) => (y.lapses ?? (y.shutdownDays > 0 ? [{ days: y.shutdownDays, broad: true, scope: '', start: '', end: '' }] : [])).filter((l) => l.broad).map((l) => ({ fy: y.fy, days: l.days })));
  const longest = broad.reduce((m, l) => (l.days > (m?.days ?? 0) ? l : m), broad[0]);
  const lastOnTime = onTimeYears.at(-1) ?? process.lastAllOnTime?.fy;
  return (
    <>
      <PageHead
        eyebrow="Infrequent use of formal budgets"
        title="How Congress budgets, on paper and in practice"
        lede={<>The Congressional Budget Act of 1974 laid out an orderly yearly process: adopt an overall budget plan, then pass 12 spending bills before the fiscal year starts on October 1. In practice Congress usually misses those deadlines, and keeps the government running with stopgap <Term id="cr">continuing resolutions</Term> and giant <Term id="omnibus">omnibus</Term> packages.</>}
      />
      <Section id="on-paper" title="On paper" sub="The legal timeline, and what usually happens instead.">
        <div className="steps">
          <div className="step">
            <div className="step-when">First Monday in February</div>
            <div className="step-title">The President proposes a budget</div>
            <p className="small">The White House Office of Management and Budget sends Congress a detailed request for the coming fiscal year.</p>
            <div className="step-real">Often late. It is a proposal only; Congress writes the actual laws.</div>
          </div>
          <div className="step">
            <div className="step-when">By April 15</div>
            <div className="step-title">Congress adopts a <Term id="budget-resolution">budget resolution</Term></div>
            <p className="small">A blueprint setting total spending, revenue, and deficit targets. It is not signed by the President and does not spend money.</p>
            <div className="step-real">Not adopted in {noResolution} of the {years.length} years shown. Several recent ones were adopted mainly to allow a <Term id="reconciliation">reconciliation</Term> bill.</div>
          </div>
          <div className="step">
            <div className="step-when">By October 1</div>
            <div className="step-title">12 <Term id="appropriations">appropriations</Term> bills become law</div>
            <p className="small">Each funds a group of agencies, from Defense to Agriculture. Together they make up <Term id="discretionary">discretionary</Term> spending.</p>
            <div className="step-real">{onTimeYears.length ? `All on time only in FY${onTimeYears.join(', FY')} in this period.` : `Not once in this period. The last time was FY${lastOnTime}.`}</div>
          </div>
          <div className="step">
            <div className="step-when">If not done</div>
            <div className="step-title">Stopgaps or a shutdown</div>
            <p className="small">A continuing resolution extends last year’s funding temporarily. With no CR, agencies without funding must shut down nonessential work.</p>
            <div className="step-real">{totalCRs} continuing resolutions and {lapseCount} funding lapses since FY{years[0].fy}.</div>
          </div>
        </div>
      </Section>

      <Section id="in-practice" title="In practice, year by year" sub="Each tile is a fiscal year. The large number counts the continuing resolutions Congress enacted for that year. Select a year for details.">
        <div className="fy-strip" role="list">
          {years.map((y) => (
            <div role="listitem" key={y.fy} style={{ display: 'contents' }}>
            <button
              type="button"
              className="fy-cell"
              data-sel={y.fy === sel}
              onClick={() => setSel(y.fy)}
              aria-pressed={y.fy === sel}
              aria-label={`FY${y.fy}: ${y.crs} continuing resolutions${y.shutdownDays ? `, ${y.shutdownDays} days of funding lapses` : ''}${y.resolution ? ', budget resolution adopted' : ', no budget resolution'}`}
              style={{ textAlign: 'left', border: 0, font: 'inherit', color: 'inherit' }}
            >
              <span className="fy">FY{y.fy}</span>
              <span className="crs">{y.crs}</span>
              <span className="dots" aria-hidden="true">{Array.from({ length: Math.min(y.crs, 21) }, (_, i) => <i key={i} />)}</span>
              {y.shutdownDays > 0 && <span className="flag flag-shutdown">{y.lapses && y.lapses.length > 1 ? `${y.lapses.length} lapses, ${y.shutdownDays}d` : `Shutdown ${y.shutdownDays}d`}</span>}
              {y.onTime === 12 && <span className="flag flag-ok">All on time</span>}
            </button>
            </div>
          ))}
        </div>
        <div className="card" aria-live="polite">
          <div className="grid-4">
            <div className="stat"><div className="stat-label">Fiscal year</div><div className="stat-value">FY{s.fy}</div></div>
            <div className="stat"><div className="stat-label">Continuing resolutions</div><div className="stat-value">{s.crs}</div></div>
            <div className="stat"><div className="stat-label">Bills on time (of 12)</div><div className="stat-value">{s.onTime}</div></div>
            <div className="stat"><div className="stat-label">Budget resolution</div><div className="stat-value">{s.resolution ? 'Yes' : 'No'}</div></div>
          </div>
          <p style={{ marginTop: 14 }}><strong>How it was finally funded:</strong> {s.final}</p>
          {s.lapses && s.lapses.length > 0 && (
            <ul className="small" style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--ink-2)' }}>
              {s.lapses.map((l) => <li key={l.start}>{dateLabel(l.start)} to {dateLabel(l.end)}: {l.days} days, {l.scope.charAt(0).toLowerCase() + l.scope.slice(1)}</li>)}
            </ul>
          )}
          {s.notes && <p className="small muted" style={{ marginTop: 6 }}>{s.notes}</p>}
        </div>
        <div className="facts">
          <div className="fact"><div className="fact-big">{totalCRs}</div><p>continuing resolutions enacted for FY{years[0].fy}–FY{years.at(-1)!.fy}, an average of {(totalCRs / years.length).toFixed(1)} a year.</p></div>
          {longest && <div className="fact"><div className="fact-big">{longest.days} days</div><p>the longest government-wide shutdown in this period, at the start of FY{longest.fy}.</p></div>}
          <div className="fact"><div className="fact-big">{lastOnTime ? `FY${lastOnTime}` : 'Never'}</div><p>the last time Congress passed all its regular appropriations bills before the fiscal year began.{process.lastAllOnTime && !onTimeYears.length ? <> {process.lastAllOnTime.note} <a href={process.lastAllOnTime.source.url} target="_blank" rel="noreferrer">Source</a></> : null}</p></div>
        </div>
      </Section>

      <Section id="now" title="Where things stand now">
        <div className="grid-2">
          {process.current.map((c) => (
            <div key={c.fy} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="eyebrow">FY{c.fy} · as of {dateLabel(c.asOf)}</div>
              <p>{c.status}</p>
              <div className="cite">Source: <a href={c.source.url} target="_blank" rel="noreferrer">{c.source.title}</a></div>
            </div>
          ))}
        </div>
        <div className="callout">
          <div className="callout-title">Why this matters for the deficit</div>
          <p>Short-term deals make it hard to weigh priorities against each other or against revenue. Big packages assembled at the deadline get little scrutiny, and the formal budget resolution, the one place Congress is supposed to set an overall deficit target, is often skipped or used only to fast-track a single bill.</p>
        </div>
        <p className="cite">
          Sources: {process.sources.map((src, i) => <span key={src.url}>{i > 0 && '; '}<a href={src.url} target="_blank" rel="noreferrer">{src.title}</a></span>)}
        </p>
      </Section>
    </>
  );
}
