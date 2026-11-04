// Sharing: the system share sheet where the browser has one, otherwise the clipboard, otherwise a
// box of text to copy by hand. Links always point at the public site.

export const SITE_URL = 'https://richnguyen.github.io/follow-the-federal-dollar/';
export const GAME_NAME = 'Help Uncle Sam balance the budget';

export type ShareResult = 'shared' | 'copied' | 'manual' | 'cancelled';

export async function shareText(o: { title?: string; text: string; url?: string; files?: File[] }): Promise<ShareResult> {
  const url = o.url ?? SITE_URL;
  if (typeof navigator.share === 'function') {
    const data: ShareData = { title: o.title ?? GAME_NAME, text: o.text, url };
    if (o.files?.length && typeof navigator.canShare === 'function' && navigator.canShare({ files: o.files })) data.files = o.files;
    try {
      await navigator.share(data);
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
      // Not allowed here (for example inside a frame): fall through to the clipboard.
    }
  }
  try {
    await navigator.clipboard.writeText(`${o.text} ${url}`);
    return 'copied';
  } catch {
    return 'manual';
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function wrap(text: string, max: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) { if (cur) lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * A 1200×630 share card (the size social sites preview) drawn as SVG and turned into a PNG:
 * the level, its stars, one fact, and Uncle Sam. `samSvg` is his drawing taken from the page.
 */
export async function shareCard(o: { eyebrow: string; title: string; stars: number; fact: string; samSvg?: string; color: string }): Promise<Blob | null> {
  const W = 1200, H = 630;
  const factLines = wrap(o.fact, 52).slice(0, 5);
  const titleLines = wrap(o.title, 28).slice(0, 2);
  const sam = o.samSvg ? o.samSvg.replace(/<svg[^>]*>/, '<svg x="840" y="150" width="300" height="375" viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg">').replace(/var\(--[^)]+\)/g, '#9aa19c') : '';
  const starRow = [0, 1, 2].map((k) => `<text x="${80 + k * 64}" y="${titleLines.length > 1 ? 320 : 262}" font-size="56" fill="${k < o.stars ? '#c9a645' : '#d6dbd5'}">★</text>`).join('');
  const factY = titleLines.length > 1 ? 380 : 322;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#f2f4ef"/>
  <rect width="${W}" height="16" fill="${o.color}"/>
  <text x="80" y="104" font-family="Menlo, Consolas, monospace" font-size="24" letter-spacing="3" fill="#1d5a43">${esc(o.eyebrow.toUpperCase())}</text>
  ${titleLines.map((l, k) => `<text x="80" y="${178 + k * 64}" font-family="Arial Narrow, Arial, Helvetica, sans-serif" font-weight="800" font-size="62" fill="#111b16">${esc(l.toUpperCase())}</text>`).join('')}
  ${starRow}
  ${factLines.map((l, k) => `<text x="80" y="${factY + k * 40}" font-family="Georgia, serif" font-size="30" fill="#2b3530">${esc(l)}</text>`).join('')}
  <text x="80" y="580" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#47524c">${esc(GAME_NAME)} · official U.S. government data</text>
  <text x="80" y="610" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#1d5a43">${esc(SITE_URL.replace(/^https:\/\//, ''))}</text>
  ${sam}
</svg>`;
  const img = new Image();
  const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('card')); img.src = src; });
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}
