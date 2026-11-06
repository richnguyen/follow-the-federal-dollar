import { useEffect, useState } from 'react';
import { PageHead, Section, Seg, Stat } from '../components/ui';
import { backendOn, CHANNELS, LINK_KINDS, type LinkKind, rpc } from '../lib/backend';
import { pct } from '../lib/format';
import { PUBLIC_SITE } from './share';

// #stats: how sharing turns into new players, from anonymous counts (supabase/migrations/…_share_stats.sql):
// shares made, shared links opened, and new players whose first visit came through a shared link,
// by channel and by kind of link. Not linked from the game's main menus.

type ByKind = Record<string, Record<string, number>>;
interface Stats { window_days: number; since: string; shares: ByKind; arrivals: ByKind; players: ByKind; players_all: number; daily: { day: string; shares: number; arrivals: number }[] }

const CHANNEL_NAME: Record<string, string> = {
  x: 'X', fa: 'Facebook', li: 'LinkedIn', re: 'Reddit', bl: 'Bluesky', th: 'Threads', wh: 'WhatsApp', em: 'Email',
  sh: 'Phone share sheet', cp: 'Copied link', direct: 'No shared link',
};
const KIND_NAME: Record<LinkKind, string> = {
  plan: 'Plan challenges', story: 'Budget Story', clip: '10-second clip', daily: 'The Daily Dollar', peoples: 'The People’s Budget',
  room: 'Rooms', chain: 'Pass the budget', level: 'Level and fact cards', site: 'The game in general',
};
const WINDOWS = [{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }, { value: '3650', label: 'All time' }];

const sumAll = (b: ByKind, keep: (ch: string) => boolean = () => true) => Object.values(b).reduce((s, ch) => s + Object.entries(ch).filter(([c]) => keep(c)).reduce((x, [, n]) => x + n, 0), 0);
const byChannel = (b: ByKind, ch: string) => Object.values(b).reduce((s, c) => s + (c[ch] ?? 0), 0);
const byKind = (b: ByKind, k: string, keep: (ch: string) => boolean = () => true) => Object.entries(b[k] ?? {}).filter(([c]) => keep(c)).reduce((s, [, n]) => s + n, 0);
const shared = (ch: string) => ch !== 'direct';
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const fmt = (v: number | null, digits = 2) => (v == null ? '—' : v.toFixed(digits));

export default function StatsPage() {
  const on = backendOn();
  const [win, setWin] = useState('30');
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!on) return;
    let alive = true;
    setError('');
    rpc<Stats>('share_stats', { window_days: Number(win) })
      .then((r) => { if (alive) setS(r); })
      .catch(() => { if (alive) setError('Share stats can’t be loaded right now. If the share-stats SQL hasn’t been run yet, run it in Supabase first.'); });
    return () => { alive = false; };
  }, [on, win]);

  if (!on) {
    return (
      <>
        <PageHead eyebrow="How the game spreads" title="Share stats" lede="Shares, opened links, and the new players they bring, by channel." />
        <p className="small">Share stats come from the public site’s database. <a href={`${PUBLIC_SITE}#stats`} target="_blank" rel="noreferrer">Open them on balancethebudget.us</a>.</p>
      </>
    );
  }

  const S = s ? sumAll(s.shares) : 0;
  const A = s ? sumAll(s.arrivals) : 0;
  const N = s ? sumAll(s.players) : 0;
  const Nc = s ? sumAll(s.players, shared) : 0;
  const sharesPerPlayer = ratio(S, N);
  const playersPerShare = ratio(Nc, S);
  const k = sharesPerPlayer != null && playersPerShare != null ? sharesPerPlayer * playersPerShare : null;
  const channels = [...CHANNELS, 'direct'];

  return (
    <div className="results stats">
      <PageHead eyebrow="How the game spreads" title="Share stats" lede={<>Shares, opened links, and the new players they bring, by channel and by kind of link. All counts are anonymous.{s ? ` Since ${s.since} (UTC).` : ''}</>} />
      <Seg<string> label="Period" value={win} onChange={setWin} options={WINDOWS} />
      {error && <div className="callout small" role="status">{error}</div>}
      {!s && !error && <p className="small muted" role="status">Loading…</p>}
      {s && (
        <>
          <div className="grid-4" style={{ marginTop: 14 }}>
            <Stat label="Shares" value={`${S}`} note="share buttons and network links pressed" />
            <Stat label="Shared links opened" value={`${A}`} note={`${fmt(ratio(A, S), 1)} per share`} />
            <Stat label="New players" value={`${N}`} note={`${Nc} came through a shared link`} />
            <Stat label="Viral coefficient (K)" value={fmt(k)} note="new players each player brings in" />
          </div>
          <div className="callout small stats-k">
            <strong>K = shares per player × new players per share = {fmt(sharesPerPlayer)} × {fmt(playersPerShare)}{k != null ? ` = ${fmt(k)}` : ''}.</strong>{' '}
            Above 1, each player brings in more than one new player and the game grows by itself; below 1, it needs other ways in. {k != null && k < 1 ? `Raising either factor helps: more players sharing, or more of the people who open a link going on to play (${pct(ratio(Nc, A) ?? 0, 0)} now).` : ''}
          </div>

          <Section id="channels" title="By channel" sub="Where links were shared, how often they were opened, and how many new players they brought.">
            <div className="table-wrap">
              <table className="data stats-table">
                <thead><tr><th scope="col">Channel</th><th scope="col" className="r">Shares</th><th scope="col" className="r">Opened</th><th scope="col" className="r">New players</th><th scope="col" className="r">Opened → played</th></tr></thead>
                <tbody>
                  {channels.map((ch) => {
                    const sh = byChannel(s.shares, ch), ar = byChannel(s.arrivals, ch), pl = byChannel(s.players, ch);
                    if (!sh && !ar && !pl) return null;
                    const conv = ratio(pl, ar);
                    return <tr key={ch}><th scope="row">{CHANNEL_NAME[ch] ?? ch}</th><td className="r num">{ch === 'direct' ? '—' : sh}</td><td className="r num">{ch === 'direct' ? '—' : ar}</td><td className="r num">{pl}</td><td className="r num">{ch === 'direct' || conv == null ? '—' : pct(Math.min(1, conv), 0)}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="kinds" title="By kind of link" sub="What the shared link opened.">
            <div className="table-wrap">
              <table className="data stats-table">
                <thead><tr><th scope="col">Link</th><th scope="col" className="r">Shares</th><th scope="col" className="r">Opened</th><th scope="col" className="r">New players from it</th></tr></thead>
                <tbody>
                  {LINK_KINDS.map((kd) => {
                    const sh = byKind(s.shares, kd), ar = byKind(s.arrivals, kd), pl = byKind(s.players, kd, shared);
                    if (!sh && !ar && !pl) return null;
                    return <tr key={kd}><th scope="row">{KIND_NAME[kd]}</th><td className="r num">{sh}</td><td className="r num">{ar}</td><td className="r num">{pl}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          {s.daily.length > 0 && (
            <Section id="daily" title="Day by day" sub="Shares and opened links per day (UTC).">
              <div className="table-wrap">
                <table className="data stats-table">
                  <thead><tr><th scope="col">Day</th><th scope="col" className="r">Shares</th><th scope="col" className="r">Opened</th></tr></thead>
                  <tbody>{[...s.daily].reverse().map((d) => <tr key={d.day}><th scope="row" className="num">{d.day}</th><td className="r num">{d.shares}</td><td className="r num">{d.arrivals}</td></tr>)}</tbody>
                </table>
              </div>
            </Section>
          )}

          <p className="small muted">
            How these are counted: a share is a press of a share button or a social network link (whether or not the post was sent). An opened link is counted once per browser per day for each kind and channel. A new player is someone whose record (a finished level or an answered quick check) was first saved in this period; their channel is the shared link that first brought them, kept in their browser. Links copied by hand, or forwarded without their tag, count as “No shared link”. Share and open counts are anonymous tallies that any browser can add to, so treat small numbers loosely. {s.players_all} players in all.
          </p>
        </>
      )}
    </div>
  );
}
