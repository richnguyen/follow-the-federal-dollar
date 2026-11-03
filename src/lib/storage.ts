// Per-viewer conveniences only (remembered units, chosen state). Storage can be unavailable.
export function load<T>(key: string, fallback: T): T {
  try {
    const v = window.localStorage.getItem('ftd:' + key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    window.localStorage.setItem('ftd:' + key, JSON.stringify(value));
  } catch {
    /* storage blocked: keep working without it */
  }
}
