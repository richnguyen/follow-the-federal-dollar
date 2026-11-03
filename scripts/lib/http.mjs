// Shared HTTP helpers for the data pipeline.
// Every response is cached under data/raw/ so the build is reproducible and auditable:
// each cache file records the exact URL, request body, and retrieval timestamp.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
export const RAW = path.join(ROOT, 'data', 'raw');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REFRESH = process.argv.includes('--refresh');

function cacheName(group, url, body) {
  const h = createHash('sha1').update(url + (body ? JSON.stringify(body) : '')).digest('hex').slice(0, 12);
  return path.join(RAW, group, h + '.json');
}

/**
 * Fetch JSON (GET, or POST when body is given) with retries and an on-disk cache.
 * Returns { data, url, retrieved }.
 */
export async function getJSON(group, url, { body, retries = 4, label } = {}) {
  const file = cacheName(group, url, body);
  if (!REFRESH) {
    try {
      const cached = JSON.parse(await readFile(file, 'utf8'));
      return cached;
    } catch {}
  }
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        method: body ? 'POST' : 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'follow-the-dollar-data-pipeline/1.0 (civic education project)',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) {
        const text = await res.text();
        throw Object.assign(new Error(`HTTP ${res.status} for ${url}: ${text.slice(0, 300)}`), { fatal: true });
      }
      const data = await res.json();
      const out = { url, body: body ?? null, retrieved: new Date().toISOString(), label: label ?? null, data };
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify(out));
      return out;
    } catch (e) {
      lastErr = e;
      if (e.fatal) break;
      await sleep(2000 * 2 ** i);
    }
  }
  throw lastErr;
}

/** Fetch a binary/text file to data/raw/<group>/<name>, cached. */
export async function getFile(group, url, name) {
  const file = path.join(RAW, group, name);
  if (!REFRESH) {
    try { await readFile(file); return file; } catch {}
  }
  let lastErr;
  for (let i = 0; i <= 4; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'follow-the-dollar-data-pipeline/1.0 (civic education project)' } });
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} for ${url}`), { fatal: res.status < 500 && res.status !== 429 });
      const buf = Buffer.from(await res.arrayBuffer());
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, buf);
      await writeFile(file + '.meta.json', JSON.stringify({ url, retrieved: new Date().toISOString(), bytes: buf.length }));
      return file;
    } catch (e) {
      lastErr = e;
      if (e.fatal) break;
      await sleep(2000 * 2 ** i);
    }
  }
  throw lastErr;
}

/** Run async tasks with limited concurrency. */
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function writeJSON(rel, obj) {
  const file = path.join(ROOT, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(obj, null, 1));
  return file;
}

export async function readJSON(rel) {
  return JSON.parse(await readFile(path.join(ROOT, rel), 'utf8'));
}
