// Turns the single-file build (dist-artifact/index.html) into a claude.ai artifact page:
// the artifact host supplies <!doctype>, <html>, <head>, and <body>, so this writes only the
// title, metas, font link, styles, root element, and the inlined module script.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = await readFile(path.join(root, 'dist-artifact', 'index.html'), 'utf8');

const pick = (re) => [...html.matchAll(re)].map((m) => m[0]);
const title = pick(/<title>[\s\S]*?<\/title>/gi)[0] ?? '<title>Follow the Federal Dollar</title>';
const fontLinks = pick(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>/gi);
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/gi);
const scripts = pick(/<script[^>]*>[\s\S]*?<\/script>/gi);
if (!scripts.length) throw new Error('no inlined script found');

const out = [
  title,
  '<meta name="claude:viewport-fit-sides" content="cover">',
  '<meta name="description" content="Where U.S. federal tax dollars go, explained with official government data.">',
  ...fontLinks,
  ...styles,
  '<div id="root"></div>',
  ...scripts,
].join('\n');

const dest = path.join(root, 'dist-artifact', 'follow-the-federal-dollar.html');
await writeFile(dest, out);
console.log(`artifact page: ${dest} (${(out.length / 1024).toFixed(0)} KB)`);
