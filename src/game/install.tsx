import { useEffect, useState } from 'react';
import { isInstalled } from './resume';

// "Download the game": add it to the home screen, where it opens like an app, works offline, and
// returns to the level in progress. Chrome, Edge and Samsung Internet offer their own install
// prompt, which this button opens; Safari on iPhone and iPad has none, so the button shows the two
// taps instead (Share, then Add to Home Screen). Public site only: the claude.ai copy has no app
// manifest.

interface InstallPrompt extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallPrompt | null = null;
let installedNow = false;
const subs = new Set<() => void>();
const tell = () => subs.forEach((f) => f());
if (typeof window !== 'undefined' && __OFFLINE__) {
  // The browser offers this once, early; keep it for the button instead of its own banner.
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallPrompt; tell(); });
  window.addEventListener('appinstalled', () => { deferred = null; installedNow = true; tell(); });
}

const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent);
export const isIOS = () => /iPad|iPhone|iPod/.test(ua()) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/** In-app browsers (Instagram, Facebook, TikTok…) can't add pages to the home screen. */
const inAppBrowser = () => /FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|Snapchat|GSA\//.test(ua());
const isAndroid = () => /Android/.test(ua());

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-3px' }}>
      <path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

export function InstallButton() {
  const [, force] = useState(0);
  const [help, setHelp] = useState(false);
  useEffect(() => { const f = () => force((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  if (!__OFFLINE__) return null;
  if (installedNow || isInstalled()) return <p className="install-done small">✓ The game is on this device’s home screen.</p>;

  const install = async () => {
    if (deferred) {
      const d = deferred;
      await d.prompt();
      const { outcome } = await d.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
      if (outcome === 'accepted') { installedNow = true; deferred = null; tell(); }
      return;
    }
    setHelp((h) => !h);
  };

  return (
    <div className="install">
      <button type="button" className="btn btn-primary install-btn" onClick={install} aria-expanded={deferred ? undefined : help}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11" /><path d="M7 10l5 5 5-5" /><path d="M5 20h14" /></svg>
        Download the game
      </button>
      <span className="small muted">Free. Adds it to your home screen: it opens like an app, works offline, and picks up where you left off.</span>
      {help && !deferred && (
        <div className="install-help small" role="note">
          {inAppBrowser() ? (
            <p>This app’s built-in browser can’t add pages to the home screen. Open this page in {isIOS() ? 'Safari' : 'your browser'} first (look for “Open in browser” in the menu), then tap Download again.</p>
          ) : isIOS() ? (
            <ol>
              <li>Tap the Share button <ShareIcon /> (at the bottom of the screen in Safari, or next to the address).</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
            </ol>
          ) : isAndroid() ? (
            <ol>
              <li>Open your browser’s menu (⋮ or ≡).</li>
              <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
            </ol>
          ) : (
            <p>In Chrome or Edge, use the install icon at the right of the address bar (or the menu: <strong>Install</strong>). In Safari on a Mac: <strong>File → Add to Dock</strong>. On a phone, open this page there and tap Download.</p>
          )}
        </div>
      )}
    </div>
  );
}
