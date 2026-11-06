// Runs the Supabase migration in PGlite (Postgres in WebAssembly) with stand-ins for Supabase's
// auth schema and roles, then checks row-level security and the public totals. npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../migrations/20261106000000_init.sql', import.meta.url), 'utf8');
const db = new PGlite();
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
await db.exec(sql);
// Supabase grants table privileges to these roles by default; RLS decides the rows.
await db.exec(`
  grant usage on schema public to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to anon, authenticated;
`);
// Re-running the migration must be safe.
await db.exec(sql);
ok(true, 'migration runs twice');

const U = Array.from({ length: 7 }, (_, i) => `00000000-0000-0000-0000-00000000000${i + 1}`);
for (const u of U) await db.query('insert into auth.users (id) values ($1)', [u]);
const as = async (u, q, params = []) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${u ?? ''}', false); set role ${u ? 'authenticated' : 'anon'};`);
  try { return await db.query(q, params); } finally { await db.exec('reset role;'); }
};
const fails = async (fn) => { try { await fn(); return false; } catch { return true; } };

// Ballots
const ballot = (o) => JSON.stringify({ options: o.options ?? {}, plan: o.plan ?? null, issues: o.issues ?? {}, updated: '2026-11-06T00:00:00Z' });
await as(U[0], 'insert into public.ballots (ballot) values ($1)', [ballot({ options: { 'cut-defense-budget': 1, 'vat-5pct': -1 }, plan: 'economists', issues: { goal: 'stabilize', mix: 'even' } })]);
await as(U[1], 'insert into public.ballots (ballot) values ($1)', [ballot({ options: { 'cut-defense-budget': -1 }, plan: 'economists', issues: { goal: 'balance' } })]);
await as(U[2], 'insert into public.ballots (ballot) values ($1)', [ballot({ options: { 'cut-defense-budget': 1 }, issues: { goal: 'stabilize' } })]);
ok((await as(U[0], 'select * from public.ballots')).rows.length === 1, 'a player sees only their own ballot');
ok(await fails(() => as(U[0], 'insert into public.ballots (user_id, ballot) values ($1, $2)', [U[3], ballot({})])), 'cannot write a ballot for someone else');
ok(await fails(() => as(null, 'insert into public.ballots (user_id, ballot) values ($1, $2)', [U[3], ballot({})])), 'signed-out visitors cannot write');
ok((await as(null, 'select * from public.ballots')).rows.length === 0, 'signed-out visitors cannot read ballots');
await as(U[0], `update public.ballots set ballot = jsonb_set(ballot, '{plan}', '"protect"')`);
const upd = await as(U[1], `update public.ballots set ballot = '{}'::jsonb where user_id = $1`, [U[0]]);
ok(upd.affectedRows === 0, 'cannot change someone else’s ballot');
ok(await fails(() => as(U[3], 'insert into public.ballots (ballot) values ($1)', ['{"options": []}'])), 'ballot shape is checked');
const bt = (await as(null, 'select public.ballot_totals() as t')).rows[0].t;
console.log('  ballot_totals:', JSON.stringify(bt));
ok(bt.voters === 3 && bt.options['cut-defense-budget'].support === 2 && bt.options['cut-defense-budget'].oppose === 1, 'option totals');
ok(bt.plans.economists === 1 && bt.plans.protect === 1, 'plan totals (after a change of mind)');
ok(bt.issues.goal.stabilize === 2 && bt.issues.goal.balance === 1 && bt.issues.mix.even === 1, 'issue totals');

// Players
const rec = (done, stars) => JSON.stringify({ v: 1, done, stars, firstTry: { l1q1: true }, medals: ['first-steps'], updated: '2026-11-06T00:00:00Z' });
for (let i = 0; i < 6; i++) await as(U[i], 'insert into public.players (record, state, channel) values ($1, $2, $3)', [rec(i < 5 ? ['level-1', 'level-2'] : ['level-1'], { 'level-1': 3, 'level-2': 2 }), i < 5 ? 'OH' : 'TX', 'wh']);
ok((await as(U[0], 'select * from public.players')).rows.length === 1, 'a player sees only their own record');
ok(await fails(() => as(U[6], `insert into public.players (record, state) values ($1, 'Ohio')`, [rec([], {})])), 'state must be a two-letter code');
const pt = (await as(null, 'select public.player_totals() as t')).rows[0].t;
console.log('  player_totals:', JSON.stringify(pt));
ok(pt.players === 6 && pt.done['level-1'] === 6 && pt.done['level-2'] === 5 && pt.stars['level-1'].sum === 18, 'player totals');
const sr = (await as(null, 'select * from public.state_rankings()')).rows;
console.log('  state_rankings:', JSON.stringify(sr));
ok(sr.length === 1 && sr[0].state === 'OH', 'state ranking leaves out states with fewer than 5 players');

// Plans
const ins = await as(U[0], `insert into public.plans (level, code, cards, stars, revenue_share, by_name) values (10, 'p=10.acg&lv=r5.d-5', '{income-tax-rates-1pt,ss-tax-earnings-over-250k,limit-itemized-15pct}', 2, 0.6, 'Rich') returning id`);
const id = ins.rows[0].id;
ok(/^[0-9a-f]{12}$/.test(id), 'short link id: ' + id);
await as(U[1], `insert into public.plans (level, code, cards, stars) values (10, 'p=10.ar', '{income-tax-rates-1pt,cut-defense-budget}', 1)`);
ok((await as(U[1], 'select * from public.plans')).rows.length === 1, 'players cannot list other people’s plans');
ok((await as(null, 'select * from public.plans')).rows.length === 0, 'signed-out visitors cannot list plans');
const gp = (await as(null, 'select public.get_plan($1) as p', [id])).rows[0].p;
ok(gp && gp.code === 'p=10.acg&lv=r5.d-5' && gp.by === 'Rich', 'anyone with the link can open the plan');
ok(await fails(() => as(U[2], `insert into public.plans (level, code, stars) values (10, 'p=10.a<script>', 1)`)), 'plan code is checked');
ok(await fails(() => as(U[2], `insert into public.plans (level, code, stars) values (7, 'p=7.a', 1)`)), 'only budget-desk levels');
const cr = (await as(null, 'select * from public.card_rankings(10::smallint)')).rows;
console.log('  card_rankings:', JSON.stringify(cr));
ok(cr[0].card === 'income-tax-rates-1pt' && Number(cr[0].share) === 1, 'card ranking');
let capped = false;
for (let k = 0; k < 31; k++) { try { await as(U[3], `insert into public.plans (level, code, stars) values (5, 'p=5.a', 1)`); } catch (e) { capped = /Too many/.test(e.message); break; } }
ok(capped, 'daily cap on shared plans');
// Deleting a user removes their data.
await db.query('delete from auth.users where id = $1', [U[0]]);
ok((await as(null, 'select public.ballot_totals() as t')).rows[0].t.voters === 2, 'deleting a user removes their ballot');
