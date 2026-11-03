import { useMemo } from 'react';

// Engraved-banknote rosette (guilloché) generated from layered hypotrochoids.
// Decorative only; aria-hidden.
function rosette(R: number, r: number, d: number, turns: number, cx: number, cy: number, steps = 2400) {
  let s = '';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 * turns;
    const x = cx + (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
    const y = cy + (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
    s += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
  }
  return s;
}

export function Guilloche({ className = 'guilloche', size = 560 }: { className?: string; size?: number }) {
  const paths = useMemo(() => {
    const c = size / 2;
    return [
      rosette(c * 0.92, c * 0.092, c * 0.21, 10, c, c),
      rosette(c * 0.74, c * 0.074, c * 0.17, 10, c, c),
      rosette(c * 0.56, c * 0.07, c * 0.13, 8, c, c, 1800),
    ];
  }, [size]);
  return (
    <svg className={className} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--gold)" strokeWidth={0.6} opacity={0.5 - i * 0.1} />
      ))}
    </svg>
  );
}

export function BrandMark() {
  const d = useMemo(() => rosette(15, 2.5, 5.2, 5, 17, 17, 600), []);
  return (
    <svg className="brand-mark" viewBox="0 0 34 34" aria-hidden="true">
      <circle cx="17" cy="17" r="16" fill="var(--accent)" />
      <path d={d} fill="none" stroke="var(--accent-ink)" strokeWidth={0.7} opacity={0.85} />
      <text x="17" y="22.5" textAnchor="middle" fontFamily="var(--font-display)" fontWeight={800} fontSize={16} fill="var(--accent-ink)">$</text>
    </svg>
  );
}
