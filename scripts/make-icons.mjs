// Draws the home-screen app icons from the game's own Uncle Sam, with the dev server up:
//   npx vite --port 5173 &  node scripts/make-icons.mjs http://localhost:5173/
// Writes public/icons/: icon-192.png, icon-512.png, maskable-512.png (extra margin for Android's
// shaped icons) and apple-touch-icon.png (180 px, square; iOS rounds the corners itself).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://localhost:5173/';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 600, height: 600 } });
await p.goto(base + '#journey');
await p.waitForSelector('svg.sam');
const sam = await p.evaluate(() => document.querySelector('svg.sam').outerHTML);
const page = (size, scale) => `<!doctype html><html><body style="margin:0">
  <div style="width:${size}px;height:${size}px;background:radial-gradient(circle at 50% 38%, #2a7a5c 0%, #1d5a43 62%, #154533 100%);display:grid;place-items:end center;overflow:hidden">
    <div style="width:${Math.round(size * scale)}px;margin-bottom:-${Math.round(size * 0.02)}px">${sam.replace('<svg', '<svg style="width:100%;height:auto;display:block"')}</div>
  </div></body></html>`;
for (const [name, size, scale] of [['icon-192.png', 192, 0.8], ['icon-512.png', 512, 0.8], ['maskable-512.png', 512, 0.7], ['apple-touch-icon.png', 180, 0.8]]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(page(size, scale));
  await p.screenshot({ path: path.join(dir, name), clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', name);
}
await b.close();
