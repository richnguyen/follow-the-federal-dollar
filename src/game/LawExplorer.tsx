import { useRef, useState } from 'react';
import { laws } from '../data';
import { dateLabel, money } from '../lib/format';

// Level 7's tour of the laws that moved deficits: tap a law to see what it did, why the official
// estimate came out so large, and a link to that estimate. Nothing opens until the player taps.

const byMagnitude = [...laws].sort((a, b) => Math.abs(b.deficitEffect) - Math.abs(a.deficitEffect));
const max = Math.abs(byMagnitude[0]?.deficitEffect ?? 1);

export function LawExplorer({ initial = 8 }: { initial?: number }) {
  const [all, setAll] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const detail = useRef<HTMLElement>(null);
  const pick = (id: string) => {
    setSel(id);
    // On narrow screens the details sit below the list, so bring them into view.
    if (window.matchMedia('(max-width: 820px)').matches) requestAnimationFrame(() => detail.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const list = all ? byMagnitude : byMagnitude.slice(0, initial);
  const l = sel ? laws.find((x) => x.id === sel) ?? null : null;
  const saved = !!l && l.deficitEffect < 0;
  return (
    <div className="lawx">
      <div className="lawx-head">
        <div className="chart-title">Ten-year effect on deficits, as estimated when each law passed</div>
        <div className="legend">
          <span className="legend-item"><span className="swatch" style={{ background: 'var(--div-pos)' }} />Added to deficits</span>
          <span className="legend-item"><span className="swatch" style={{ background: 'var(--div-neg)' }} />Reduced deficits</span>
        </div>
      </div>
      <div className="lawx-grid">
        <div className="lawx-list" role="listbox" aria-label="Laws" aria-activedescendant={l ? 'law-' + l.id : undefined}>
          {list.map((x) => (
            <button key={x.id} id={'law-' + x.id} type="button" role="option" aria-selected={x.id === l?.id} className="lawx-row" onClick={() => pick(x.id)}>
              <span className="lawx-name">{x.shortName} <span className="muted">({x.signed.slice(0, 4)})</span></span>
              <span className="lawx-track"><span style={{ width: `${(Math.abs(x.deficitEffect) / max) * 100}%`, background: x.deficitEffect > 0 ? 'var(--div-pos)' : 'var(--div-neg)' }} /></span>
              <span className="lawx-val num">{x.deficitEffect < 0 ? '−' : '+'}{money(Math.abs(x.deficitEffect) * 1e9)}</span>
            </button>
          ))}
          {byMagnitude.length > initial && (
            <button type="button" className="link-btn small" style={{ marginTop: 6, alignSelf: 'flex-start' }} onClick={() => setAll(!all)}>
              {all ? 'Show the biggest only' : `Show all ${byMagnitude.length} laws`}
            </button>
          )}
        </div>
        <article className="lawx-detail" aria-live="polite" ref={detail} data-empty={!l || undefined}>
          {!l ? <p className="small muted">Tap a law to see what it did and why it cost (or saved) that much.</p> : <>
          <div className="eyebrow">{l.publicLaw} · signed {dateLabel(l.signed)} by President {l.president}</div>
          <h3 className="lawx-title">{l.name}</h3>
          <div className="lawx-effect" data-saved={saved}>
            <span className="num">{saved ? '−' : '+'}{money(Math.abs(l.deficitEffect) * 1e9)}</span>
            <span className="small">{saved ? 'less' : 'more'} in deficits over {l.window}{l.includesInterest ? ', counting interest' : ''}</span>
          </div>
          <div className="lawx-sec">
            <div className="stat-label">What it did</div>
            <p>{l.summary}</p>
          </div>
          {l.why && (
            <div className="lawx-sec">
              <div className="stat-label">{saved ? 'Why it saved that much' : 'Why it cost that much'}</div>
              <p>{l.why}</p>
            </div>
          )}
          <p className="small"><a href={l.source.url} target="_blank" rel="noreferrer">The official estimate: {l.source.title}</a></p>
          </>}
        </article>
      </div>
    </div>
  );
}
