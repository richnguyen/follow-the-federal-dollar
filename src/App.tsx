import { useEffect, useRef, useState, type JSX } from 'react';
import { BrandMark } from './components/Guilloche';
import { TooltipProvider } from './components/ui';
import { budget } from './data';
import { type Route, useHashRoute } from './lib/router';
import { UnitsProvider } from './lib/units';
import { LiveProvider } from './lib/live';
import Overview from './pages/Overview';
import Spending from './pages/Spending';
import Revenue from './pages/Revenue';
import Gap from './pages/Gap';
import Debt from './pages/Debt';
import Laws from './pages/Laws';
import ProcessPage from './pages/Process';
import StatePage from './pages/State';
import SocialSecurity from './pages/SocialSecurity';
import Receipt from './pages/Receipt';
import Sandbox from './pages/Sandbox';
import Glossary from './pages/Glossary';
import Sources from './pages/Sources';
import { VotesProvider } from './lib/votes';
import { CommunityProvider } from './lib/community';
import Results from './game/Results';
import { JourneyProvider, useJourney } from './game/state';
import Journey from './game/Journey';
import LevelPage from './game/LevelPage';
import { DESK, isUnlocked, LEVELS, STOP_BY_ID, STOPS } from './game/levels';
import { FIELD_GUIDE, REFERENCE } from './game/nav';
import { ReadingSettings } from './game/Settings';
import { StatusBar } from './game/StatusBar';
import { LevelIcon, LockIcon } from './game/icons';
import { NarrationProvider, prefetchVoice, useNarrator } from './game/voice';
import { earnedMedals, MEDALS } from './game/medals';
import { useHaptics } from './game/haptics';
import { Toasts, useToasts } from './components/game';

const FIELD_GUIDE_ROUTES = ['overview', 'spending', 'revenue', 'receipt', 'state', 'gap', 'debt', 'process', 'laws', 'social-security'];


/** Announces each medal once, the moment it is earned, wherever the player is. */
function MedalWatcher() {
  const j = useJourney();
  const buzz = useHaptics();
  const toasts = useToasts();
  const fresh = earnedMedals(j).filter((id) => !j.medals.includes(id));
  const key = fresh.join();
  const told = useRef(new Set<string>());
  useEffect(() => {
    const news = fresh.filter((id) => !told.current.has(id));
    news.forEach((id) => told.current.add(id));
    if (!fresh.length) return;
    j.award(fresh);
    if (!news.length) return;
    const names = news.map((id) => MEDALS.find((m) => m.id === id)!.name);
    toasts.push(names.length === 1 ? `Medal earned: ${names[0]}` : `${names.length} medals earned: ${names.join(', ')}`);
    buzz('medal');
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Toasts items={toasts.items} />;
}


// Page titles, for the browser tab.
const TITLE: Partial<Record<Route, string>> = Object.fromEntries([
  ...FIELD_GUIDE.map((g) => [g.route, g.label]),
  ...REFERENCE.map((g) => [g.route, g.label]),
  ['results', 'How everyone played'],
  ...STOPS.map((l) => [l.id, `Level ${l.n}: ${l.title}`]),
]);

// Each field-guide chapter belongs to a level, so readers can jump into the game from any page.
const CHAPTER_LEVEL: Partial<Record<Route, string>> = {
  revenue: 'level-1', receipt: 'level-1', overview: 'level-2', spending: 'level-2', state: 'level-3',
  gap: 'level-4', debt: 'level-6', process: 'level-7', laws: 'level-7', 'social-security': 'level-9',
};

const PAGES: Record<Route, (p: { param: string | null }) => JSX.Element> = {
  journey: () => <Journey />,
  'level-1': () => <LevelPage id="level-1" />,
  'level-2': () => <LevelPage id="level-2" />,
  'level-3': () => <LevelPage id="level-3" />,
  'level-4': () => <LevelPage id="level-4" />,
  'level-5': () => <DeskPage id="level-5" />,
  'level-6': () => <LevelPage id="level-6" />,
  'level-7': () => <LevelPage id="level-7" />,
  'level-8': () => <DeskPage id="level-8" />,
  'level-9': () => <LevelPage id="level-9" />,
  'level-10': () => <DeskPage id="level-10" />,
  overview: () => <Overview />,
  spending: () => <Spending />,
  revenue: () => <Revenue />,
  gap: () => <Gap />,
  debt: () => <Debt />,
  laws: () => <Laws />,
  process: () => <ProcessPage />,
  state: ({ param }) => <StatePage param={param} />,
  'social-security': () => <SocialSecurity />,
  receipt: () => <Receipt />,
  glossary: () => <Glossary />,
  sources: ({ param }) => <Sources param={param} />,
  results: () => <Results />,
};

function DeskPage({ id }: { id: string }) {
  const j = useJourney();
  const d = DESK.find((x) => x.id === id)!;
  if (!isUnlocked(id, j.done, j.settings.freeRoam)) return <DeskLocked id={id} />;
  return <Sandbox key={id} desk={d} />;
}

function DeskLocked({ id }: { id: string }) {
  const j = useJourney();
  const d = STOP_BY_ID[id];
  const prev = STOPS[d.n - 2];
  return (
    <div className="level">
      <header className="level-head">
        <div className="eyebrow level-eyebrow"><LevelIcon id={d.icon} size={16} /> Level {d.n} of {STOPS.length} · {d.difficulty} level</div>
        <h1 className="page-title">{d.title}</h1>
      </header>
      <div className="callout">
        <div className="callout-title">Locked for now</div>
        <p className="small">Finish level {prev.n}, {prev.title}, to open this level. You can also unlock everything with free roam in settings.</p>
        <div className="sb-actions">
          <a className="btn btn-primary" href={'#' + prev.id}>Go to level {prev.n}</a>
          <button type="button" className="btn" onClick={() => j.setSettings({ freeRoam: true })}>Unlock every level (free roam)</button>
        </div>
      </div>
    </div>
  );
}

function ChapterBanner({ route }: { route: Route }) {
  const id = CHAPTER_LEVEL[route];
  const j = useJourney();
  if (!id) return null;
  const l = LEVELS.find((x) => x.id === id)!;
  return (
    <div className="chapter-banner">
      <span className="small">Field guide for <strong>Level {l.n}: {l.title}</strong>{j.done.includes(id) ? ' (complete)' : ''}</span>
      <a className="small" href={'#' + id}>{j.done.includes(id) ? 'Replay the level' : 'Play the level'}</a>
    </div>
  );
}

export default function App() {
  return (
    <LiveProvider>
      <UnitsProvider>
        <TooltipProvider>
          <JourneyProvider>
            <NarrationProvider>
              <VotesProvider>
                <CommunityProvider>
                  <Shell />
                </CommunityProvider>
              </VotesProvider>
            </NarrationProvider>
          </JourneyProvider>
        </TooltipProvider>
      </UnitsProvider>
    </LiveProvider>
  );
}

function Shell() {
  const { route, param } = useHashRoute();
  const narrator = useNarrator();
  const journey = useJourney();
  useEffect(() => {
    narrator.stop();
    if (FIELD_GUIDE_ROUTES.includes(route)) journey.mark('page:' + route);
    if (journey.settings.narration) prefetchVoice(route);
    window.scrollTo({ top: 0 });
    document.title = route === 'journey' ? 'Help Uncle Sam Balance the Budget' : `${TITLE[route] ?? ''} · Help Uncle Sam Balance the Budget`;
  }, [route]);
  const Page = PAGES[route];
  return (
    <>
      <StatusBar route={route} />
      <main className="main" id="main">
        <div className="page" key={route}>
          <ChapterBanner route={route} />
          <Page param={param} />
          <footer className="footer">
            <nav className="footer-nav" aria-label="Field guide">
              <span className="stat-label">Field guide</span>
              {FIELD_GUIDE.map((g) => <a key={g.route} href={'#' + g.route}>{g.label}</a>)}
            </nav>
            <span>Figures are nominal dollars for federal fiscal years (October 1 – September 30) unless noted. Every chart links to the official dataset it was drawn from; see <a href="#sources">Sources & methods</a>. Official data from the U.S. Treasury, OMB, the Census Bureau, the IRS, and USAspending.gov; Treasury data through {budget.mtsLatestDate}.</span>
            <span>Independent civic education project. Not affiliated with any government agency.</span>
          </footer>
        </div>
      </main>
      <MedalWatcher />
    </>
  );
}
