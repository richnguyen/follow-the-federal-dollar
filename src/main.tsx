import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { takeLinkFromSearch } from './game/challenge';
import './styles/app.css';

// A shared link (?p=… for a friend's plan, ?daily for the daily puzzle) becomes a page route.
takeLinkFromSearch();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
