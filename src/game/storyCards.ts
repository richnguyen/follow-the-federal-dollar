import { esc, GAME_NAME, placeSam, SITE_URL, wrapPx } from './share';

// The Budget Story cards, drawn as 1080×1920 SVG (the size of a phone story), so the card on the
// page and the image that gets shared are the same drawing.

export const STORY_W = 1080;
export const STORY_H = 1920;

export interface StoryCard {
  id: string;
  eyebrow: string;
  title: string;
  titleSize?: number;
  /** A big figure or phrase under the title. */
  big?: string;
  body?: string;
  chips?: string[];
  rows?: { label: string; value: string }[];
  chart?: { base: number[]; plan: number[]; first: number; last: number; label: string };
  note?: string;
  color: string;
  sam?: boolean;
  /** Text for screen readers and the image's alt text. */
  alt: string;
}

const SANS = 'Arial, Helvetica, sans-serif';
const COND = '"Arial Narrow", "Helvetica Neue", Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const MONO = 'Menlo, Consolas, monospace';
const X = 80, MAXW = STORY_W - 2 * X;

export function storySvg(c: StoryCard, samSvg?: string): string {
  const out: string[] = [];
  let y = 210;
  out.push(`<text x="${X}" y="${y}" font-family="${MONO}" font-size="34" letter-spacing="4" fill="#1d5a43">${esc(c.eyebrow.toUpperCase())}</text>`);
  y += 70;
  const ts = c.titleSize ?? (c.title.length > 34 ? 80 : 104);
  const tFont = `800 ${ts}px ${COND}`;
  const titleLines = wrapPx(c.title.toUpperCase(), tFont, MAXW, ts < 100 ? 5 : 4);
  for (const l of titleLines) { y += ts; out.push(`<text x="${X}" y="${y}" font-family='${COND}' font-weight="800" font-size="${ts}" fill="#111b16">${esc(l)}</text>`); y += 6; }
  if (c.big) {
    y += 40;
    // Big figures stay on one line where they can: shrink before wrapping.
    let bs = 132;
    while (bs > 92 && wrapPx(c.big, `800 ${bs}px ${SANS}`, MAXW).length > 1) bs -= 8;
    for (const l of wrapPx(c.big, `800 ${bs}px ${SANS}`, MAXW, 2)) { y += bs; out.push(`<text x="${X}" y="${y}" font-family="${SANS}" font-weight="800" font-size="${bs}" fill="${c.color}">${esc(l)}</text>`); }
  }
  if (c.body) {
    y += 50;
    const f = `46px ${SERIF}`;
    for (const l of wrapPx(c.body, f, MAXW, 8)) { y += 62; out.push(`<text x="${X}" y="${y}" font-family='${SERIF}' font-size="46" fill="#2b3530">${esc(l)}</text>`); }
  }
  if (c.chips?.length) {
    y += 60;
    let cx = X;
    const f = `600 38px ${SANS}`;
    for (const chip of c.chips) {
      const w = Math.min(MAXW, measure(chip, f) + 56);
      if (cx + w > X + MAXW) { cx = X; y += 92; }
      out.push(`<rect x="${cx}" y="${y}" width="${w}" height="72" rx="36" fill="#ffffff" stroke="#c9d1c8" stroke-width="2"/>`);
      out.push(`<text x="${cx + 28}" y="${y + 49}" font-family="${SANS}" font-weight="600" font-size="38" fill="#111b16">${esc(chip)}</text>`);
      cx += w + 18;
    }
    y += 72;
  }
  if (c.rows?.length) {
    y += 50;
    for (const r of c.rows) {
      const lf = `40px ${SANS}`;
      const labelLines = wrapPx(r.label, lf, MAXW - 300, 2);
      labelLines.forEach((l, k) => out.push(`<text x="${X}" y="${y + 48 + k * 50}" font-family="${SANS}" font-size="40" fill="#2b3530">${esc(l)}</text>`));
      out.push(`<text x="${X + MAXW}" y="${y + 48}" text-anchor="end" font-family="${SANS}" font-weight="800" font-size="44" fill="#111b16">${esc(r.value)}</text>`);
      y += 48 + labelLines.length * 50 + 14;
      out.push(`<line x1="${X}" x2="${X + MAXW}" y1="${y}" y2="${y}" stroke="#d6dbd5" stroke-width="2"/>`);
    }
  }
  if (c.chart) {
    y += 60;
    const h = 460, top = y, w = MAXW;
    const all = [...c.chart.base, ...c.chart.plan];
    const lo = Math.min(...all) - 0.03, hi = Math.max(...all) + 0.03;
    const px = (i: number, n: number) => X + (i / (n - 1)) * w;
    const py = (v: number) => top + h - ((v - lo) / (hi - lo)) * h;
    const line = (vals: number[]) => vals.map((v, i) => `${px(i, vals.length).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
    out.push(`<rect x="${X}" y="${top}" width="${w}" height="${h}" fill="#ffffff" rx="16"/>`);
    out.push(`<polyline points="${line(c.chart.base)}" fill="none" stroke="#9aa19c" stroke-width="8" stroke-dasharray="18 12" stroke-linecap="round"/>`);
    out.push(`<polyline points="${line(c.chart.plan)}" fill="none" stroke="${c.color}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`);
    const lastB = c.chart.base.at(-1)!, lastP = c.chart.plan.at(-1)!;
    out.push(`<text x="${X + w - 12}" y="${py(lastB) + (lastB > lastP ? -22 : 52)}" text-anchor="end" font-family="${SANS}" font-weight="700" font-size="36" fill="#47524c">Current law ${Math.round(lastB * 100)}%</text>`);
    out.push(`<text x="${X + w - 12}" y="${py(lastP) + (lastB > lastP ? 58 : -22)}" text-anchor="end" font-family="${SANS}" font-weight="800" font-size="40" fill="${c.color}">My plan ${Math.round(lastP * 100)}%</text>`);
    out.push(`<text x="${X}" y="${top + h + 50}" font-family="${SANS}" font-size="32" fill="#47524c">${esc(c.chart.label)} · FY${c.chart.first}–FY${c.chart.last}</text>`);
    y = top + h + 50;
  }
  if (c.note) {
    y += 60;
    const f = `32px ${SANS}`;
    for (const l of wrapPx(c.note, f, c.sam ? MAXW - 380 : MAXW, 5)) { y += 44; out.push(`<text x="${X}" y="${y}" font-family="${SANS}" font-size="32" fill="#47524c">${esc(l)}</text>`); }
  }
  const sam = c.sam ? placeSam(samSvg, STORY_W - 80 - 360, 1340, 360) : '';
  const site = SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${STORY_W}" height="${STORY_H}" viewBox="0 0 ${STORY_W} ${STORY_H}">
  <rect width="${STORY_W}" height="${STORY_H}" fill="#f2f4ef"/>
  <rect width="${STORY_W}" height="28" fill="${c.color}"/>
  ${out.join('\n  ')}
  ${sam}
  <line x1="${X}" x2="${X + MAXW}" y1="1770" y2="1770" stroke="#c9d1c8" stroke-width="2"/>
  <text x="${X}" y="1830" font-family="${SANS}" font-weight="700" font-size="34" fill="#111b16">${esc(GAME_NAME)}</text>
  <text x="${X}" y="1876" font-family="${SANS}" font-size="30" fill="#1d5a43">${esc(site)} · official U.S. government data</text>
</svg>`;
}

let ctx2: CanvasRenderingContext2D | null = null;
function measure(t: string, font: string) {
  ctx2 ??= document.createElement('canvas').getContext('2d');
  if (!ctx2) return t.length * 20;
  ctx2.font = font;
  return ctx2.measureText(t).width;
}
