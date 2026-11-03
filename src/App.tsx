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


const NAV: { group: string; items: { route: Route; label: string }[] }[] = [
  { group: 'The money', items: [
    { route: 'overview', label: 'The big picture' },
    { route: 'spending', label: 'Where it goes' },
    { route: 'revenue', label: 'Where it comes from' },
  ] },
  { group: 'The gap', items: [
    { route: 'gap', label: 'Deficits & the structural gap' },
    { route: 'debt', label: 'Debt & interest' },
  ] },
  { group: 'How it happens', items: [
    { route: 'laws', label: 'Laws that moved the needle' },
    { route: 'process', label: 'How Congress budgets' },
  ] },
  { group: 'Close to home', items: [
    { route: 'state', label: 'Your state & district' },
    { route: 'social-security', label: 'Social Security’s future' },
  ] },
  { group: 'Try it', items: [
    { route: 'receipt', label: 'Your tax receipt' },
    { route: 'sandbox', label: 'Balance the budget' },
  ] },
  { group: 'Reference', items: [
    { route: 'glossary', label: 'Glossary' },
    { route: 'sources', label: 'Sources & methods' },
  ] },
];

const LABEL: Record<Route, string> = Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i.route, i.label]))) as Record<Route, string>;

const PAGES: Record<Route, (p: { param: string | null }) => JSX.Element> = {
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

export default function App() {
  const { route, param } = useHashRoute();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0 });
    document.title = route === 'overview' ? 'Follow the Federal Dollar' : `${LABEL[route]} · Follow the Federal Dollar`;
  }, [route]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  const Page = PAGES[route];
  return (
    <LiveProvider>
      <UnitsProvider>
        <TooltipProvider>
          <div className="topbar">
            <button className="icon-btn" aria-label="Open menu" aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen(true)}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
            <a className="brand" href="#overview"><BrandMark /><span className="brand-name">Follow the<br />Federal Dollar</span></a>
            <span className="topbar-title">{LABEL[route]}</span>
          </div>
          <div className="shell">
            {open && <div className="scrim" onClick={() => setOpen(false)} />}
            <nav className="sidebar" id="sidebar" data-open={open} aria-label="Sections">
              <a className="brand" href="#overview"><BrandMark /><span className="brand-name">Follow the<br />Federal Dollar</span></a>
              {NAV.map((g) => (
                <div className="nav-group" key={g.group}>
                  <div className="nav-label">{g.group}</div>
                  {g.items.map((it) => (
                    <a key={it.route} className="nav-link" href={'#' + it.route} aria-current={route === it.route ? 'page' : undefined}>
                      {it.label}
                    </a>
                  ))}
                </div>
              ))}
              <div className="sidebar-foot">
                <span>Official data from the U.S. Treasury, CBO, SSA, and USAspending.gov.</span>
                <span className="mono" style={{ fontSize: '0.6875rem' }}>Treasury data through {budget.mtsLatestDate}</span>
              </div>
            </nav>
            <main className="main" id="main">
              <div className="page" key={route}>
                <Page param={param} />
                <footer className="footer">
                  <span>Figures are nominal dollars for federal fiscal years (October 1 – September 30) unless noted. Every chart links to the official dataset it was drawn from; see <a href="#sources">Sources & methods</a>.</span>
                  <span>Independent civic education project. Not affiliated with any government agency.</span>
                </footer>
              </div>
            </main>
          </div>
        </TooltipProvider>
      </UnitsProvider>
    </LiveProvider>
  );
}
