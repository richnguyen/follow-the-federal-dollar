import { useEffect, useRef, useState } from 'react';
import { PageHead } from '../components/ui';
import { ActionBar } from '../components/ActionBar';
import { budget, debt, HH, POP } from '../data';
import { bucketYear } from '../lib/derive';
import { dateLabel, dollars, money, moneyWords } from '../lib/format';
import { useLive } from '../lib/live';
import { shareCard, SITE_URL } from './share';
import { ShareButton, SocialShare } from './ShareButton';
import { CLOCK_LINES } from './script';
import { SamSays } from './UncleSam';

// The debt clock: the national debt, ticking. It starts from the Treasury's own count (Debt to
// the Penny, posted each business day) and adds the average pace of the past twelve months, second
// by second, until the next count arrives. Every figure says where it comes from, and the ticking
// part is labeled as an estimate. The debt limit comes from the Daily Treasury Statement.

const YEAR = 365 * 24 * 3600;
// The Treasury's count is as of the end of its record date (Eastern time).
const endOfDay = (date: string) => Date.parse(`${date}T23:59:59-05:00`);

/** The debt about a year before `date`, from the month-end series baked into the site. */
function yearAgoFromSeries(date: string) {
  const target = Date.parse(date) - YEAR * 1000;
  let best = debt.series[0];
  for (const p of debt.series) if (Math.abs(Date.parse(p.date) - target) < Math.abs(Date.parse(best.date) - target)) best = p;
  return { date: best.date, total: best.total };
}

export function useDebtClock() {
  const live = useLive();
  const base = live.debt ?? debt.latest;
  const ago = live.debtYearAgo ?? yearAgoFromSeries(base.date);
  const span = (Date.parse(base.date) - Date.parse(ago.date)) / 1000;
  const perSecond = span > 0 ? (base.total - ago.total) / span : 0;
  const limit = live.limit ?? debt.limit ?? null;
  const interestPerSecond = bucketYear(budget.latestFY).y.netInterest / YEAR;
  const t0 = endOfDay(base.date);
  const at = (now: number) => base.total + perSecond * Math.max(0, (now - t0) / 1000);
  const room = limit ? limit.limit - limit.subject : null;
  const monthsLeft = room != null && perSecond > 0 ? room / perSecond / (30.44 * 86400) : null;
  return { base, ago, perSecond, interestPerSecond, limit, room, monthsLeft, at, live: !!live.debt, interestFY: budget.latestFY };
}
export type DebtClockModel = ReturnType<typeof useDebtClock>;

/** A number that ticks on its own (written straight into the page, ten times a second). */
function Tick({ value, digits = 0, prefix = '$' }: { value: (now: number) => number; digits?: number; prefix?: string }) {
  const el = useRef<HTMLSpanElement>(null);
  const fn = useRef(value);
  fn.current = value;
  useEffect(() => {
    const fmt = (v: number) => prefix + v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    const draw = () => { if (el.current) el.current.textContent = fmt(fn.current(Date.now())); };
    draw();
    const iv = setInterval(draw, 100);
    return () => clearInterval(iv);
  }, [digits, prefix]);
  return <span ref={el} className="num" />;
}

const months = (m: number) => (m < 1 ? 'less than a month' : m < 1.5 ? 'about a month' : `about ${Math.round(m)} months`);

export function clockShareText(c: DebtClockModel) {
  const now = c.at(Date.now());
  return `Uncle Sam’s debt just passed ${moneyWords(Math.floor(now / 1e11) * 1e11, 1)}: about ${dollars(now / POP)} for every person in America. It grows about ${dollars(c.perSecond)} a second. Watch it tick:`;
}

/**
 * The clock. `compact`: the number, each person's share, and what has happened since the page
 * opened, with a link to the full clock.
 */
export function DebtClock({ compact = false }: { compact?: boolean }) {
  const c = useDebtClock();
  const [opened] = useState(() => Date.now());
  const since = (now: number) => c.perSecond * (now - opened) / 1000;
  const interestSince = (now: number) => c.interestPerSecond * (now - opened) / 1000;
  const text = clockShareText(c);
  const url = SITE_URL + (SITE_URL.includes('#') ? '' : '#clock');
  const card = () => {
    const now = c.at(Date.now());
    return shareCard({ eyebrow: 'The national debt, right now', title: moneyWords(now, 2), fact: `That’s about ${dollars(now / POP)} for every person in America, and it grows about ${dollars(c.perSecond)} every second. Treasury’s count, ticking at the past year’s pace.`, color: '#b8372f' });
  };
  return (
    <section className={'card clock' + (compact ? ' clock-compact' : '')} aria-label="The debt clock">
      <div className="clock-head">
        <span className="clock-label"><span className="clock-dot" aria-hidden="true" /> The national debt, right now</span>
        {compact && <a className="small" href="#clock">Open the debt clock</a>}
      </div>
      <div className="clock-num" aria-hidden="true"><Tick value={c.at} /></div>
      <p className="sr-only">The national debt is about {moneyWords(c.at(opened), 2)}.</p>
      <p className="small muted clock-src">
        Treasury’s count on {dateLabel(c.base.date)}: {money(c.base.total)}{c.live ? ' (fetched live)' : ''}. Since then, an estimate at the pace of the past 12 months.
      </p>
      <div className="clock-grid">
        <div className="clock-stat"><span className="stat-label">Every person’s share</span><strong><Tick value={(n) => c.at(n) / POP} /></strong></div>
        {!compact && <div className="clock-stat"><span className="stat-label">Every household’s share</span><strong><Tick value={(n) => c.at(n) / HH} /></strong></div>}
        <div className="clock-stat"><span className="stat-label">Growing by</span><strong>{dollars(c.perSecond)}</strong><span className="small muted">a second, on average</span></div>
        {!compact && <div className="clock-stat"><span className="stat-label">Interest costs</span><strong>{dollars(c.interestPerSecond)}</strong><span className="small muted">a second (FY{c.interestFY} net interest)</span></div>}
      </div>
      <p className="clock-since">Since you opened this page, the debt grew <strong><Tick value={since} /></strong>{!compact && <>, and interest cost <strong><Tick value={interestSince} /></strong></>}.</p>
      {!compact && c.limit && c.room != null && (
        <div className="clock-limit">
          <div className="clock-limit-head">
            <span className="stat-label">The legal debt limit</span>
            <strong>{moneyWords(c.limit.limit, 3)}</strong>
          </div>
          <div className="clock-meter" role="img" aria-label={`${Math.round((c.limit.subject / c.limit.limit) * 100)}% of the debt limit used`}>
            <span style={{ width: `${Math.min(100, (c.limit.subject / c.limit.limit) * 100)}%` }} />
          </div>
          <p className="small">
            {c.room > 0
              ? <>Debt that counts toward the limit: {moneyWords(c.limit.subject, 3)} on {dateLabel(c.limit.date)}. Room left: <strong>{moneyWords(c.room, 0)}</strong>{c.monthsLeft != null ? <>, {months(c.monthsLeft)} at this pace</> : null}. After that, the Treasury can shuffle accounts for a while (“extraordinary measures”), and then Congress must raise or suspend the limit.</>
              : <>The debt has reached the limit ({dateLabel(c.limit.date)}). The Treasury is using “extraordinary measures” until Congress raises or suspends it.</>}
          </p>
        </div>
      )}
      <div className="sb-actions">
        <ShareButton text={text} url={url} card={card} label="Share this number" className={compact ? 'btn' : 'btn btn-primary'} kind="site" />
      </div>
      {!compact && <SocialShare text={text} url={url} kind="site" />}
    </section>
  );
}

/** #clock: the debt clock on its own page. */
export default function ClockPage() {
  return (
    <>
      <PageHead eyebrow="Live, from the Treasury" title="The debt clock" lede="Uncle Sam’s debt, ticking: the Treasury’s own count, carried forward second by second at the pace of the past year, with the legal limit on how much he can borrow." />
      <SamSays mood="worried" auto>{CLOCK_LINES.intro}</SamSays>
      <DebtClock />
      <section className="card clock-how">
        <h2 className="section-title">How this clock works</h2>
        <ul className="small">
          <li><strong>The starting point</strong> is the Treasury’s Debt to the Penny: total public debt outstanding, posted for each business day. The site fetches the latest count when it opens and every half hour after that.</li>
          <li><strong>The ticking</strong> is an estimate: the change over the past twelve months, spread evenly over every second. Real borrowing comes in lumps (auctions, tax days, benefit payments), so the next official count can land a little above or below.</li>
          <li><strong>The debt limit</strong> comes from the Daily Treasury Statement (Table III-C), which counts slightly less debt than the total: a few kinds of debt don’t count toward the limit.</li>
          <li><strong>Interest</strong> is the government’s net interest for FY{budget.latestFY}, spread evenly over the year.</li>
        </ul>
        <p className="small">Other debt clocks use their own estimates and formulas. This one uses the Treasury’s published figures only; the sources are in <a href="#sources">Sources &amp; methods</a>.</p>
      </section>
      <ActionBar label="Next step"><a className="btn btn-primary" href="#level-6">Play level 6: the credit card</a><a className="btn" href="#debt">Read the debt chapter</a></ActionBar>
    </>
  );
}
