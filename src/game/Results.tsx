import type { ReactNode } from 'react';
import { PageHead, Section, Stat } from '../components/ui';
import { pct } from '../lib/format';
import { useCommunity } from '../lib/community';
import { OPTIONS_DATA, PRESETS } from '../lib/planData';
import { useVotes } from '../lib/votes';
import { LevelIcon } from './icons';
import { LEVELS, MAX_STARS, STOPS } from './levels';
import { MEDALS } from './medals';
import { useJourney } from './state';

// "How everyone played": totals from every player's anonymous record and every ballot, shown at
// the end of the game. Each row states its count, so small numbers are never mistaken for a poll.

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

export default function Results() {
  const j = useJourney();
  const c = useCommunity();
  const v = useVotes();
  const ps = c.players;
  const n = ps.length;
  const share = (k: number) => (n ? k / n : 0);
  const finishedAll = ps.filter((p) => STOPS.every((s) => p.done.includes(s.id))).length;
  const avgStars = n ? ps.reduce((a, p) => a + Object.values(p.stars).reduce((x, y) => x + y, 0), 0) / n : 0;
  const shared = c.available;

  // Votes: shared tallies on the artifact; otherwise just this player's own choices.
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
          ? <>Results from everyone who has played this shared copy of the game, updated live. Records are anonymous: no names, only levels, stars, first-try answers, medals, and votes.</>
          : <>Your own results. Results from other players are collected only on the shared copy of this game on claude.ai, which has a shared database; a page on its own cannot see what other visitors did.</>}
      />
      {shared && c.canWrite === false && <div className="callout small">You can see everyone’s results, but adding your own needs Contributor access to this page; ask the person who shared it.</div>}
      {(c.error || v.error) && <div className="callout small">{c.error ?? v.error}</div>}
      {c.loading && shared && <p className="small muted">Loading results…</p>}

      <div className="grid-4">
        <Stat label={shared ? 'Players' : 'Players counted here'} value={`${n}`} note={shared ? 'who finished a level or answered a question' : 'just you, in this browser'} />
        <Stat label="Finished all 10 levels" value={`${finishedAll}`} note={n ? `${pct(share(finishedAll), 0)} of players` : '—'} />
        <Stat label="Average stars" value={n ? avgStars.toFixed(1) : '—'} note={`out of ${MAX_STARS}`} />
        <Stat label="Ballots cast" value={`${v.available ? v.voters : Object.keys(j.choices).filter((k) => j.choices[k]).length ? 1 : 0}`} note={v.available ? 'one per person' : 'yours, in this browser'} />
      </div>

      <Section id="levels" title="How far players got" sub="Share of players who finished each level, and their average stars on it.">
        <ol className="rlist">
          {STOPS.map((s) => {
            const fin = ps.filter((p) => p.done.includes(s.id));
            const avg = fin.length ? fin.reduce((a, p) => a + (p.stars[s.id] ?? 0), 0) / fin.length : 0;
            return <Row key={s.id} icon={<span className="rrow-icon"><LevelIcon id={s.icon} size={14} /></span>} label={`${s.n}. ${s.title}`} share={share(fin.length)} note={`${pct(share(fin.length), 0)} · ★ ${fin.length ? avg.toFixed(1) : '—'}`} mine={j.done.includes(s.id)} />;
          })}
        </ol>
      </Section>

      <Section id="quiz" title="Quick checks: right on the first try" sub="Of the players who answered each question.">
        <ol className="rlist">
          {LEVELS.flatMap((l) => l.steps.filter((st) => st.quiz).map((st) => {
            const q = st.quiz!;
            const answered = ps.filter((p) => q.id in p.firstTry);
            const right = answered.filter((p) => p.firstTry[q.id]).length;
            const me = j.quiz[q.id];
            return <Row key={q.id} label={<><span className="muted">L{l.n}</span> {q.question}</>} share={answered.length ? right / answered.length : 0} note={answered.length ? `${pct(right / answered.length, 0)} of ${answered.length}` : 'no answers yet'} mine={!!(me?.correct && me.tries === 1)} />;
          }))}
        </ol>
      </Section>

      <Section id="medals" title="Medals" sub="Share of players who earned each one.">
        <ol className="rlist">
          {MEDALS.map((m) => {
            const k = ps.filter((p) => p.medals.includes(m.id)).length;
            return <Row key={m.id} label={m.name} share={share(k)} note={`${pct(share(k), 0)} · ${k}`} mine={j.medals.includes(m.id)} />;
          })}
        </ol>
      </Section>

      <Section id="level-votes" title="How everyone voted on each level’s question" sub={v.available ? `${v.voters} ${v.voters === 1 ? 'ballot' : 'ballots'} so far.` : 'Your votes. Shared totals appear on the claude.ai copy of the game.'}>
        <div className="rvotes">
          {levelVotes.map(({ level, vote }) => {
            if (vote.kind === 'option') {
              const o = OPTIONS_DATA.options.find((x) => x.id === vote.optionId)!;
              const t = optionTally(o.id);
              return (
                <article key={o.id} className="card rvote">
                  <div className="stat-label">Level {level.n} · policy option</div>
                  <h3 className="rvote-q">{o.name}</h3>
                  <Split yes={t.support} no={t.oppose} mine={myOption(o.id)} />
                </article>
              );
            }
            const t = issueTally(vote.id);
            const tot = Object.values(t).reduce((a, b) => a + b, 0);
            const mineV = myIssue(vote.id);
            return (
              <article key={vote.id} className="card rvote">
                <div className="stat-label">Level {level.n} · question</div>
                <h3 className="rvote-q">{vote.question}</h3>
                <ol className="rlist">
                  {vote.choices.map((ch) => <Row key={ch.value} label={ch.label} share={tot ? (t[ch.value] ?? 0) / tot : 0} note={tot ? `${pct((t[ch.value] ?? 0) / tot, 0)} · ${t[ch.value] ?? 0}` : '0'} mine={mineV === ch.value} />)}
                </ol>
              </article>
            );
          })}
        </div>
      </Section>

      <Section id="cards" title="Every policy card" sub="Support and opposition for each option CBO has priced, most supported first.">
        <ol className="rcards">
          {cards.map(({ o, t }) => (
            <li key={o.id} className="rcard">
              <span className="rcard-name"><span className="rcard-kind" data-side={o.side}>{o.side === 'revenue' ? 'Tax' : 'Cut'}</span>{o.name}</span>
              <Split yes={t.support} no={t.oppose} mine={myOption(o.id)} />
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

      <p className="small muted">This is an informal tally of the people who opened this copy of the game, not a scientific survey: they chose to play, and each counts once. Percentages of a handful of players move a lot with each new one.</p>
    </div>
  );
}
