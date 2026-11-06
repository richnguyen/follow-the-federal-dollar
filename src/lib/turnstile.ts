// Cloudflare Turnstile: a privacy-preserving check that a visitor is a person, run once, right
// before a player's first anonymous sign-in (their first saved vote or finished level). The token
// goes with that sign-in request, and Supabase Auth verifies it with Cloudflare's siteverify on the
// server (Authentication → Attack Protection → CAPTCHA, which holds the secret key). The browser
// never calls siteverify and this code never sees the secret.
//
// Most visitors see nothing: the widget appears only if Cloudflare needs an interaction.

export const TURNSTILE_SITE_KEY = '0x4AAAAAAF1rV7BXsS9-nG51';
/** Cloudflare's documented test key (always passes), for copies that are not on the real domain. */
const TEST_SITE_KEY = '1x00000000000000000000AA';
export const TURNSTILE_ACTION = 'signin';

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
}
declare global { interface Window { turnstile?: TurnstileApi } }

const PRODUCTION = new Set(['balancethebudget.us', 'www.balancethebudget.us']);
const siteKey = () => (PRODUCTION.has(location.hostname) ? TURNSTILE_SITE_KEY : TEST_SITE_KEY);

let api: Promise<TurnstileApi> | null = null;
function loadApi(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  api ??= new Promise<TurnstileApi>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile unavailable')));
    s.onerror = () => { api = null; reject(new Error('turnstile unavailable')); };
    document.head.appendChild(s);
  });
  return api;
}

/**
 * A fresh, single-use Turnstile token, or null if the check could not run (blocked script,
 * network error, or no answer within two minutes). Each call renders its own widget and removes
 * it afterwards, so a retry always gets a new token.
 */
export async function turnstileToken(action = TURNSTILE_ACTION): Promise<string | null> {
  let ts: TurnstileApi;
  try { ts = await loadApi(); } catch { return null; }
  const box = document.createElement('div');
  box.className = 'ts-box';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Quick check');
  const label = document.createElement('p');
  label.className = 'ts-label';
  label.textContent = 'One quick check that you’re a person, so the shared counts stay honest.';
  const holder = document.createElement('div');
  box.append(label, holder);
  document.body.appendChild(box);
  return new Promise<string | null>((resolve) => {
    let id: string | null = null;
    let settled = false;
    const done = (token: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(giveUp);
      try { if (id) ts.remove(id); } catch { /* already gone */ }
      box.remove();
      resolve(token);
    };
    const giveUp = setTimeout(() => done(null), 120000);
    try {
      id = ts.render(holder, {
        sitekey: siteKey(),
        action,
        appearance: 'interaction-only',
        callback: (token: string) => done(token),
        'error-callback': () => { done(null); return true; },
        'expired-callback': () => done(null),
        'timeout-callback': () => done(null),
        'unsupported-callback': () => done(null),
        'before-interactive-callback': () => { box.dataset.show = 'true'; },
        'after-interactive-callback': () => { delete box.dataset.show; },
      });
    } catch {
      done(null);
    }
  });
}
