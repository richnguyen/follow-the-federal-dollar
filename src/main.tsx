import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { takeLinkFromSearch } from './game/challenge';
import { resumeInstalledApp } from './game/resume';
import './styles/app.css';

// A shared link (?p=… for a friend's plan, ?daily for the daily puzzle) becomes a page route.
takeLinkFromSearch();

// Opened from the home screen with no page asked for: back to the level the player was in.
resumeInstalledApp();

// The public site works offline and reopens fast (public/sw.js). Not in the claude.ai artifact,
// and not on the dev server.
if (__OFFLINE__ && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
