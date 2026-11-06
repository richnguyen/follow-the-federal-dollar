import { type ReactNode, useEffect, useState } from 'react';
import { PageHead, Section, Stat } from '../components/ui';
import { geo } from '../data';
import { backendOn, rpc } from '../lib/backend';
import { pct } from '../lib/format';
import { useCommunity } from '../lib/community';
import { OPTIONS_DATA, PRESETS } from '../lib/planData';
import { load } from '../lib/storage';
import { useVotes } from '../lib/votes';
import { LevelIcon } from './icons';
import { LEVELS, MAX_STARS, STOPS } from './levels';
import { MEDALS } from './medals';
import { useJourney } from './state';

// "How everyone played": totals from every player's anonymous record and every ballot, shown at
// the end of the game, plus rankings of policy cards and states (never of people). Each row
// states its count, so small numbers are never mistaken for a poll.

function Row({ label, share, note, mine, icon }: { label: ReactNode; share: number; note: string; mine?: boolean; icon?: ReactNode }) {
  return (
    <li className="rrow" data-mine={mine || undefined}>
      <span className="rrow-label">{icon}{label}{mine && <span className="rrow-you">you</span>}</span>
      <span className="rrow-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%` }} /></span>
      <span className="rrow-val num">{note}</span>
    </li>
  );
}

function Split({ yes, no, mine }: { yes: number; no: number; mine?: 'support' | 'oppose' | '' }) {
  const n = yes + no;
  return (
    <span className="rsplit">
      <span className="rsplit-track" aria-label={`${yes} support, ${no} oppose`}>
        {n ? <><span className="yes" style={{ flex: `${yes} 0 0` }} /><span className="no" style={{ flex: `${no} 0 0` }} /></> : <span style={{ flex: 1 }} />}
      </span>
      <span className="small num">{n ? `${pct(yes / n, 0)} support · ${pct(no / n, 0)} oppose · ${n} vote${n === 1 ? '' : 's'}` : 'No votes yet'}{mine ? ` · you: ${mine}` : ''}</span>
    </span>
  );
}

interface CardRank { card: string; plans: number; share: number }
interface StateRank { state: string; players: number; avg_levels: number; avg_stars: number }

/** Rankings of cards and states, from the site's shared database. */
function useRankings() {
  const [r, setR] = useState<{ cards: CardRank[]; states: StateRank[] } | null>(null);
  useEffect(() => {
    if (!backendOn()) return;
    let alive = true;
    Promise.all([rpc<CardRank[]>('card_rankings', { lvl: 10 }), rpc<StateRank[]>('state_rankings')])
      .then(([cards, states]) => { if (alive) setR({ cards: cards ?? [], states: states ?? [] }); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return r;
}

const CARD_NAME = Object.fromEntries(OPTIONS_DATA.options.map((o) => [o.id, o]));
const STATE_NAME = Object.fromEntries(geo.states.map((s) => [s.abbr, s.name]));

export default function Results() {
  const j = useJourney();
  const c = useCommunity();
  const v = useVotes();
  const ranks = useRankings();
  // Totals can be minutes old in a long visit; fetch the latest when this page opens.
  useEffect(() => { c.refresh(); v.refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const t = c.totals;
  const n = t.players;
  const share = (k: number) => (n ? k / n : 0);
  const last = STOPS[STOPS.length - 1];
  const finishedAll = t.finishedAll ?? t.done[last.id] ?? 0;
  const avgStars = n ? t.starsTotal / n : 0;
  const shared = c.available;
  const where = c.source === 'site' ? 'at balancethebudget.us' : 'on this shared copy of the game';
  const myPlan = j.plans?.[last.id];
  const myState = load<boolean>('state-picked', false) ? load<string>('state', '') : '';

  // Votes: shared tallies where there is a shared database; otherwise just this player's own choices.
  const myOption = (id: string): 'support' | 'oppose' | '' => {
    const m = v.available ? v.mine.options[id] : undefined;
    const local = j.choices['option:' + id];
    return m === 1 ? 'support' : m === -1 ? 'oppose' : local === 'support' || local === 'oppose' ? local : '';
  };
  const optionTally = (id: string) => {
    if (v.available) return v.options[id] ?? { support: 0, oppose: 0 };
    const m = myOption(id);
    return { support: m === 'support' ? 1 : 0, oppose: m === 'oppose' ? 1 : 0 };
  };
  const myIssue = (id: string) => (v.available ? v.mine.issues[id] : undefined) ?? j.choices[id] ?? '';
  const issueTally = (id: string): Record<string, number> => {
    if (v.available) return v.issues[id] ?? {};
    const m = myIssue(id);
    return m ? { [m]: 1 } : {};
  };
  const levelVotes = LEVELS.flatMap((l) => l.steps.filter((s) => s.vote).map((s) => ({ level: l, vote: s.vote! })));
  const cards = [...OPTIONS_DATA.options].map((o) => ({ o, t: optionTally(o.id) })).sort((a, b) => {
    const sa = a.t.support + a.t.oppose ? a.t.support / (a.t.support + a.t.oppose) : -1;
    const sb = b.t.support + b.t.oppose ? b.t.support / (b.t.support + b.t.oppose) : -1;
    return sb - sa;
  });
  const planTotal = v.available ? Object.values(v.plans).reduce((a, b) => a + b, 0) : v.mine.plan ? 1 : 0;

  return (
    <div className="results">
      <PageHead
        eyebrow="The game · results"
        title="How everyone played"
        lede={shared
          ? <>Results from everyone who has played {where}. Records are anonymous: no names, only levels, stars, first-try answers, medals, and votes.</>
          : <>Your own results. Results from other players are collected on the public site, balancethebudget.us, and on the shared copy of this game on claude.ai; a page on its own cannot see what other visitors did.</>}
      />
      {shared && c.canWrite === false && <div className="callout small">You can see everyone’s results, but adding your own needs Contributor access to this page; ask the person who shared it.</div>}
      {(c.error || v.error) && <div className="callout small">{c.error ?? v.error}</div>}
      {c.loading && shared && <p className="small muted">Loading results…</p>}
      {c.source === 'site' && <div className="callout small">Build one budget with everyone: <a href="#peoples">the People’s Budget</a> takes one move a day.</div>}

      <div className="grid-4">
        <Stat label={shared ? 'Players' : 'Players counted here'} value={`${n}`} note={shared ? 'who finished a level or answered a question' : 'just you, in this browser'} />
        <Stat label={t.finishedAll != null ? `Finished all ${STOPS.length} levels` : `Finished level ${last.n}`} value={`${finishedAll}`} note={n ? `${pct(share(finishedAll), 0)} of players` : '—'} />
        <Stat label="Average stars" value={n ? avgStars.toFixed(1) : '—'} note={`out of ${MAX_STARS}`} />
        <Stat label="Ballots cast" value={`${v.available ? v.voters : Object.keys(j.choices).filter((k) => j.choices[k]).length ? 1 : 0}`} note={v.available ? 'one per person' : 'yours, in this browser'} />
      </div>

      <Section id="levels" title="How far players got" sub="Share of players who finished each level, and their average stars on it.">
        <ol className="rlist">
          {STOPS.map((s) => {
            const fin = t.done[s.id] ?? 0;
            const st = t.stars[s.id];
            const avg = st && st.n ? st.sum / st.n : 0;
            return <Row key={s.id} icon={<span className="rrow-icon"><LevelIcon id={s.icon} size={14} /></span>} label={`${s.n}. ${s.title}`} share={share(fin)} note={`${pct(share(fin), 0)} · ★ ${fin && st?.n ? avg.toFixed(1) : '—'}`} mine={j.done.includes(s.id)} />;
          })}
        </ol>
      </Section>

      {ranks && ranks.cards.length > 0 && (
        <Section id="card-ranks" title={`The cards players reach for on level ${last.n}`} sub={`Share of players’ level ${last.n} plans that use each card (each player’s latest plan counts once).`}>
          <ol className="rlist">
            {ranks.cards.slice(0, 12).map((r) => {
              const o = CARD_NAME[r.card];
              if (!o) return null;
              return <Row key={r.card} label={<><span className="rcard-kind" data-side={o.side}>{o.side === 'revenue' ? 'Tax' : 'Cut'}</span>{o.name}</>} share={Number(r.share)} note={`${pct(Number(r.share), 0)} · ${r.plans}`} mine={!!myPlan?.ids.includes(r.card)} />;
            })}
          </ol>
        </Section>
      )}

      {ranks && (
        <Section id="state-ranks" title="States as teams" sub="Average levels finished by the players in each state who picked one. A state appears once it has 5 players.">
          {ranks.states.length ? (
            <ol className="rlist">
              {ranks.states.map((r) => <Row key={r.state} label={STATE_NAME[r.state] ?? r.state} share={Number(r.avg_levels) / STOPS.length} note={`${Number(r.avg_levels).toFixed(1)} levels · ${r.players} players`} mine={r.state === myState} />)}
            </ol>
          ) : <p className="small muted">No state has 5 players yet. Pick your state on level 3 to put yours on the board.</p>}
        </Section>
      )}

      <Section id="quiz" title="Quick checks: right on the first try" sub="Of the players who answered each question.">
        <ol className="rlist">
          {LEVELS.flatMap((l) => l.steps.filter((st) => st.quiz).map((st) => {
            const q = st.quiz!;
            const f = t.firstTry[q.id] ?? { right: 0, n: 0 };
            const me = j.quiz[q.id];
            return <Row key={q.id} label={<><span className="muted">L{l.n}</span> {q.question}</>} share={f.n ? f.right / f.n : 0} note={f.n ? `${pct(f.right / f.n, 0)} of ${f.n}` : 'no answers yet'} mine={!!(me?.correct && me.tries === 1)} />;
          }))}
        </ol>
      </Section>

      <Section id="medals" title="Medals" sub="Share of players who earned each one.">
        <ol className="rlist">
          {MEDALS.map((m) => {
            const k = t.medals[m.id] ?? 0;
            return <Row key={m.id} label={m.name} share={share(k)} note={`${pct(share(k), 0)} · ${k}`} mine={j.medals.includes(m.id)} />;
          })}
        </ol>
      </Section>

      <Section id="level-votes" title="How everyone voted on each level’s question" sub={v.available ? `${v.voters} ${v.voters === 1 ? 'ballot' : 'ballots'} so far.` : 'Your votes, in this browser.'}>
        <div className="rvotes">
          {levelVotes.map(({ level, vote }) => {
            if (vote.kind === 'option') {
              const o = OPTIONS_DATA.options.find((x) => x.id === vote.optionId)!;
              const tl = optionTally(o.id);
              return (
                <article key={o.id} className="card rvote">
                  <div className="stat-label">Level {level.n} · policy option</div>
                  <h3 className="rvote-q">{o.name}</h3>
                  <Split yes={tl.support} no={tl.oppose} mine={myOption(o.id)} />
                </article>
              );
            }
            const tl = issueTally(vote.id);
            const tot = Object.values(tl).reduce((a, b) => a + b, 0);
            const mineV = myIssue(vote.id);
            return (
              <article key={vote.id} className="card rvote">
                <div className="stat-label">Level {level.n} · question</div>
                <h3 className="rvote-q">{vote.question}</h3>
                <ol className="rlist">
                  {vote.choices.map((ch) => <Row key={ch.value} label={ch.label} share={tot ? (tl[ch.value] ?? 0) / tot : 0} note={tot ? `${pct((tl[ch.value] ?? 0) / tot, 0)} · ${tl[ch.value] ?? 0}` : '0'} mine={mineV === ch.value} />)}
                </ol>
              </article>
            );
          })}
        </div>
      </Section>

      <Section id="cards" title="Every policy card" sub="Support and opposition for each option CBO has priced, most supported first.">
        <ol className="rcards">
          {cards.map(({ o, t: tl }) => (
            <li key={o.id} className="rcard">
              <span className="rcard-name"><span className="rcard-kind" data-side={o.side}>{o.side === 'revenue' ? 'Tax' : 'Cut'}</span>{o.name}</span>
              <Split yes={tl.support} no={tl.oppose} mine={myOption(o.id)} />
            </li>
          ))}
        </ol>
      </Section>

      <Section id="plans" title="Ready-made plans" sub="Which plan players picked as their favorite.">
        <ol className="rlist">
          {PRESETS.map((p) => {
            const k = v.available ? v.plans[p.id] ?? 0 : v.mine.plan === p.id ? 1 : 0;
            return <Row key={p.id} label={p.name} share={planTotal ? k / planTotal : 0} note={planTotal ? `${pct(k / planTotal, 0)} · ${k}` : '0'} mine={v.mine.plan === p.id} />;
          })}
        </ol>
      </Section>

      {c.source === 'site' && <p className="small"><a href="#stats">Share stats: how sharing brings in new players</a></p>}
      <p className="small muted">This is an informal tally of the people who played {where}, not a scientific survey: they chose to play, and each counts once. Percentages of a handful of players move a lot with each new one.</p>
    </div>
  );
}
