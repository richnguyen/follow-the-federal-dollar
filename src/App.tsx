import { useEffect, useState, type JSX } from 'react';
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
import { JourneyProvider, useJourney } from './game/state';
import Journey from './game/Journey';
import LevelPage from './game/LevelPage';
import { DESK, isUnlocked, LEVELS, STOP_BY_ID, STOPS } from './game/levels';
import { ReadingSettings } from './game/Settings';
import { StatusBar } from './game/StatusBar';
import { LevelIcon, LockIcon } from './game/icons';
import { NarrationProvider, useNarrator } from './game/voice';


type NavItem = { route: Route; label: string; game?: boolean };
const NAV: { group: string; items: NavItem[]; fold?: boolean }[] = [
  { group: 'The game', items: [{ route: 'journey', label: 'Your journey' }] },
  { group: 'Levels', items: STOPS.map((l) => ({ route: l.id as Route, label: l.title, game: true })) },
  { group: 'Practice', items: [{ route: 'sandbox', label: 'Budget desk: free play' }] },
  { group: 'Field guide', fold: true, items: [
    { route: 'overview', label: 'The big picture' },
    { route: 'spending', label: 'Where it goes' },
    { route: 'revenue', label: 'Where it comes from' },
    { route: 'receipt', label: 'Your tax receipt' },
    { route: 'state', label: 'Your state & district' },
    { route: 'gap', label: 'Deficits & the structural gap' },
    { route: 'debt', label: 'Debt & interest' },
    { route: 'process', label: 'How Congress budgets' },
    { route: 'laws', label: 'Laws that moved the needle' },
    { route: 'social-security', label: 'Social Security’s future' },
  ] },
  { group: 'Reference', items: [
    { route: 'glossary', label: 'Glossary' },
    { route: 'sources', label: 'Sources & methods' },
  ] },
];

const LABEL: Record<Route, string> = Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i.route, i.label]))) as Record<Route, string>;
STOPS.forEach((l) => { LABEL[l.id as Route] = `Level ${l.n}: ${l.title}`; });

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
  sandbox: () => <Sandbox />,
  glossary: () => <Glossary />,
  sources: () => <Sources />,
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
        <p className="small">Finish level {prev.n}, {prev.title}, to open this level. You can also unlock everything with free roam, or practice at the budget desk in free play.</p>
        <div className="sb-actions">
          <a className="btn btn-primary" href={'#' + prev.id}>Go to level {prev.n}</a>
          <button type="button" className="btn" onClick={() => j.setSettings({ freeRoam: true })}>Unlock every level (free roam)</button>
          <a className="btn" href="#sandbox">Free play</a>
        </div>
      </div>
    </div>
  );
}

function NavLinks({ route }: { route: Route }) {
  const j = useJourney();
  return (
    <>
      {NAV.map((g) => {
        const links = g.items.map((it) => {
          const done = j.done.includes(it.route);
          const locked = it.game && !isUnlocked(it.route, j.done, j.settings.freeRoam);
          return (
            <a key={it.route} className="nav-link" href={'#' + it.route} aria-current={route === it.route ? 'page' : undefined} data-locked={locked || undefined}>
              <span>{it.game && <span className="nav-n num">{STOP_BY_ID[it.route]?.n}</span>}{it.label}</span>
              {it.game && <span className="nav-status" aria-label={done ? 'done' : locked ? 'locked' : 'open'}>{done ? '✓' : locked ? <LockIcon /> : ''}</span>}
            </a>
          );
        });
        if (g.fold) {
          const inside = g.items.some((it) => it.route === route);
          return (
            <details className="nav-group nav-fold" key={g.group} open={inside || undefined}>
              <summary className="nav-label">{g.group}</summary>
              {links}
            </details>
          );
        }
        return (
          <div className="nav-group" key={g.group}>
            <div className="nav-label">{g.group}</div>
            {links}
          </div>
        );
      })}
      <details className="nav-group nav-fold nav-settings">
        <summary className="nav-label">Reading settings</summary>
        <ReadingSettings compact />
      </details>
    </>
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
                <Shell />
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
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
    narrator.stop();
    window.scrollTo({ top: 0 });
    document.title = route === 'journey' ? 'Follow the Federal Dollar' : `${LABEL[route]} · Follow the Federal Dollar`;
  }, [route]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  const Page = PAGES[route];
  return (
    <>
          <div className="topbar">
            <button className="icon-btn" aria-label="Open menu" aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen(true)}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
            <a className="brand" href="#journey"><BrandMark /><span className="brand-name">Follow the<br />Federal Dollar</span></a>
            <StatusBar route={route} compact />
          </div>
          <div className="shell">
            {open && <div className="scrim" onClick={() => setOpen(false)} />}
            <nav className="sidebar" id="sidebar" data-open={open} aria-label="Sections">
              <a className="brand" href="#journey"><BrandMark /><span className="brand-name">Follow the<br />Federal Dollar</span></a>
              <NavLinks route={route} />
              <div className="sidebar-foot">
                <span>Official data from the U.S. Treasury, OMB, the Census Bureau, the IRS, and USAspending.gov.</span>
                <span className="mono" style={{ fontSize: '0.6875rem' }}>Treasury data through {budget.mtsLatestDate}</span>
              </div>
            </nav>
            <main className="main" id="main">
              <div className="statusbar-wrap"><StatusBar route={route} /></div>
              <div className="page" key={route}>
                <ChapterBanner route={route} />
                <Page param={param} />
                <footer className="footer">
                  <span>Figures are nominal dollars for federal fiscal years (October 1 – September 30) unless noted. Every chart links to the official dataset it was drawn from; see <a href="#sources">Sources & methods</a>.</span>
                  <span>Independent civic education project. Not affiliated with any government agency.</span>
                </footer>
              </div>
            </main>
          </div>
    </>
  );
}
