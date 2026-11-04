import { geoPath } from 'd3-geo';
import { scaleQuantile } from 'd3-scale';
import { feature } from 'topojson-client';
import { useMemo } from 'react';
import topo from 'us-atlas/states-albers-10m.json';
import { focusPoint, TipRow, TipTitle, useTooltip } from './ui';

// Sequential (one hue, light → dark) choropleth of a per-capita value. Territories outside the
// Albers USA projection are drawn as tiles so every jurisdiction stays selectable.
const RAMP = ['var(--seq-100)', 'var(--seq-200)', 'var(--seq-300)', 'var(--seq-400)', 'var(--seq-500)', 'var(--seq-600)', 'var(--seq-700)'];
const INK = [0, 1, 2, 3, 4, 5, 6].map((i) => `var(--seq-ink-${i})`);
const TERRITORIES = ['11', '72', '78', '66', '60', '69'];

export interface MapDatum { fips: string; abbr: string; name: string; value: number; extra?: string }

export function USMap({
  data, selected, onSelect, format, valueLabel,
}: { data: MapDatum[]; selected: string | null; onSelect: (abbr: string) => void; format: (v: number) => string; valueLabel: string }) {
  const { show, hide } = useTooltip();
  const byFips = useMemo(() => Object.fromEntries(data.map((d) => [d.fips, d])), [data]);
  const features = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fc = feature(topo as any, (topo as any).objects.states) as any;
    return fc.features as { id: string; properties: { name: string } }[];
  }, []);
  const path = useMemo(() => geoPath(), []);
  const stateVals = useMemo(() => data.filter((d) => d.fips !== '11' && Number(d.fips) < 60).map((d) => d.value), [data]);
  const q = useMemo(() => scaleQuantile<number>().domain(stateVals).range([0, 1, 2, 3, 4, 5, 6]), [stateVals]);
  const thresholds = q.quantiles();
  const tip = (d: MapDatum) => (
    <>
      <TipTitle>{d.name}</TipTitle>
      <TipRow label={valueLabel} value={format(d.value)} />
      {d.extra && <div className="tooltip-note">{d.extra}</div>}
      <div className="tooltip-note">Click for details</div>
    </>
  );
  const bin = (v: number) => q(v);
  return (
    <div className="map-wrap">
      <svg viewBox="-58 12 1016 596" width="100%" role="img" aria-label={`Map of ${valueLabel} by state`} style={{ maxHeight: 520 }}>
        {features.filter((f) => f.id !== '11').map((f) => {
          const d = byFips[f.id];
          if (!d) return null;
          const b = bin(d.value);
          return (
            <path
              key={f.id}
              className="state"
              d={path(f as never) ?? ''}
              fill={RAMP[b]}
              data-sel={selected === d.abbr}
              tabIndex={0}
              role="button"
              aria-label={`${d.name}: ${format(d.value)}`}
              onPointerMove={(e) => show(tip(d), e.clientX, e.clientY)}
              onPointerLeave={hide}
              onFocus={(e) => { const pt = focusPoint(e.currentTarget); show(tip(d), pt.x, pt.y); }}
              onBlur={hide}
              onClick={() => { hide(); onSelect(d.abbr); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(d.abbr); } }}
            />
          );
        })}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }} aria-label="District of Columbia and territories">
        {TERRITORIES.map((f) => byFips[f]).filter(Boolean).map((d) => {
          const b = bin(d.value);
          return (
            <button
              key={d.fips}
              type="button"
              className="chip"
              aria-pressed={selected === d.abbr}
              onClick={() => onSelect(d.abbr)}
              onPointerMove={(e) => show(tip(d), e.clientX, e.clientY)}
              onPointerLeave={hide}
              style={selected === d.abbr ? undefined : { background: RAMP[Math.min(6, Math.max(0, b))], color: INK[Math.min(6, Math.max(0, b))], borderColor: 'transparent' }}
            >
              {d.abbr}
            </button>
          );
        })}
      </div>
      <div className="scale-legend" style={{ marginTop: 10 }}>
        <span>Lower</span>
        <span className="ramp" aria-hidden="true">{RAMP.map((c) => <span key={c} style={{ background: c }} />)}</span>
        <span>Higher {valueLabel.toLowerCase()}</span>
        <span className="muted">(50 states range from {format(Math.min(...stateVals))} to {format(Math.max(...stateVals))}, shaded in 7 equal-size groups; DC and territories use the same scale)</span>
      </div>
    </div>
  );
}
