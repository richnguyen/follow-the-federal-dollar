import { useMemo, useState } from 'react';
import { BarList, TimeChart, Treemap, type TreeNode } from '../components/charts';
import { ChartFrame, DataTable, Legend, PageHead, Section, Seg, Term } from '../components/ui';
import { accounts, budget, programs } from '../data';
import { CATEGORIES, CATEGORY_BY_ID } from '../lib/categories';
import { benefitPrograms, categoryTotals, findNode, flattenAccounts } from '../lib/derive';
import { money, pct, signedPct } from '../lib/format';
import { useUnits } from '../lib/units';
import { UnitsToggle } from './Overview';

const TREE_COLORS = ['var(--c-ss)', 'var(--c-medicare)', 'var(--c-health)', 'var(--c-income)', 'var(--c-veterans)', 'var(--c-other)', 'var(--c-defense)', 'var(--c-interest)'];

export default function Spending() {
  const years = Object.keys(budget.functionsByFY).map(Number).sort((a, b) => b - a);
  const [fy, setFy] = useState(budget.latestFY);
  const [view, setView] = useState<'functions' | 'accounts'>('functions');
  const [sel, setSel] = useState<string | null>(null);
  const u = useUnits();
  const rows = budget.functionsByFY[String(fy)] ?? [];
  const prevRows = budget.functionsByFY[String(fy - 1)] ?? [];
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const offsets = rows.filter((r) => r.category === 'offset');
  const items = rows
    .filter((r) => r.category !== 'offset')
    .sort((a, b) => b.amount - a.amount)
    .map((r) => ({ id: r.code, label: r.name, value: r.amount, color: CATEGORY_BY_ID[r.category as keyof typeof CATEGORY_BY_ID].color }));

  return (
    <>
      <PageHead
        eyebrow="Where it goes"
        title="Every dollar, by what it buys"
        lede={<>The Treasury sorts every federal payment into about 20 <Term id="budget-function">budget functions</Term>, such as national defense, health, or transportation, and also records which agency and account the money came from. Explore both views below.</>}
      />
      <div className="toolbar">
        <div className="toolbar-item">
          <label htmlFor="sp-fy">Fiscal year</label>
          <select id="sp-fy" className="select" value={fy} onChange={(e) => { setFy(Number(e.target.value)); setSel(null); }}>
            {years.map((y) => <option key={y} value={y}>FY{y}</option>)}
          </select>
        </div>
        <div className="toolbar-item">
          <span>View</span>
          <Seg label="View" value={view} onChange={setView} options={[{ value: 'functions', label: 'By purpose' }, { value: 'accounts', label: 'By agency & account' }]} />
        </div>
        <UnitsToggle />
      </div>

      {view === 'functions' ? (
        <Section
          id="functions"
          title={`FY${fy} spending by purpose`}
          sub={`Total net outlays: ${money(total)}${u.mode !== 'total' ? ` (${u.fmt(total)}${u.suffix})` : ''}. Select any row for what it pays for and who benefits.`}
        >
          <div className="card">
            <BarList
              items={items}
              total={total}
              format={u.fmt}
              selected={sel}
              onSelect={setSel}
              renderDetail={(code) => <FunctionDetail code={code} fy={fy} amount={rows.find((r) => r.code === code)!.amount} prior={prevRows.find((r) => r.code === code)?.amount} />}
            />
            {offsets.length > 0 && (
              <p className="small muted" style={{ marginTop: 12, paddingInline: 8 }}>
                Not shown: {offsets.map((o) => `${o.name} (${money(o.amount)})`).join(', ')}. These <Term id="offsetting">offsetting receipts</Term> are
                recorded as negative spending, which is why the bars add up to more than the total.
              </p>
            )}
          </div>
          <Legend items={CATEGORIES.map((c) => ({ label: c.label, color: c.color }))} />
        </Section>
      ) : (
        <AccountsView fy={fy} />
      )}

      <DefenseVsSocial fy={fy} />
    </>
  );
}

function FunctionDetail({ code, fy, amount, prior }: { code: string; fy: number; amount: number; prior?: number }) {
  const info = programs[code];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {prior != null && prior !== 0 && (
        <div className="small muted">FY{fy - 1}: {money(prior)} · change {signedPct(amount / prior - 1)}</div>
      )}
      {info ? (
        <>
          <p><strong>What it pays for.</strong> {info.plain}</p>
          <p><strong>Who benefits.</strong> {info.benefits}</p>
          {info.examples.length > 0 && <p className="small"><strong>Biggest pieces:</strong> {info.examples.join(' · ')}</p>}
          {info.stats.length > 0 && (
            <div className="grid-3" style={{ marginTop: 4 }}>
              {info.stats.map((s, i) => (
                <div key={i} className="stat">
                  <div className="stat-value" style={{ fontSize: '1.4rem' }}>{s.value}</div>
                  <div className="stat-note">{s.label} <a href={s.source.url} target="_blank" rel="noreferrer">({s.source.title})</a></div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="muted">No description available.</p>
      )}
    </div>
  );
}

function AccountsView({ fy }: { fy: number }) {
  const [path, setPath] = useState<TreeNode[]>([]);
  const [q, setQ] = useState('');
  const u = useUnits();
  const available = accounts.fy === fy;
  const root = accounts.root as TreeNode;
  const node = path.at(-1) ?? root;
  const flat = useMemo(() => flattenAccounts(accounts.root), []);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? flat.filter((f) => f.path.join(' ').toLowerCase().includes(s)) : flat;
    return [...list].sort((a, b) => b.node.amount - a.node.amount).slice(0, 60);
  }, [q, flat]);
  if (!available) {
    return <div className="empty">Agency and account detail is available for FY{accounts.fy}. Switch the fiscal year to FY{accounts.fy} to explore it.</div>;
  }
  const colorIdx = (n: TreeNode) => {
    const top = path[0] ?? n;
    const i = (root.children ?? []).findIndex((c) => c.name === top.name);
    return TREE_COLORS[(i < 0 ? 0 : i) % TREE_COLORS.length];
  };
  return (
    <Section
      id="accounts"
      title={`FY${fy}: every agency and account`}
      sub={<>Box size is proportional to net outlays. Click a box to open it. Totals are <Term id="net-outlays">net outlays</Term> from the Monthly Treasury Statement, Table 5.</>}
    >
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <nav className="crumbs" aria-label="Treemap level">
          <button type="button" onClick={() => setPath([])}>All agencies</button>
          {path.map((p, i) => (
            <span key={i} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <span>›</span>
              <button type="button" onClick={() => setPath(path.slice(0, i + 1))}>{p.name}</button>
            </span>
          ))}
          <span style={{ marginLeft: 'auto' }}>{node.name === root.name ? 'Total' : node.name}: <strong>{u.fmt(node.amount)}</strong>{u.suffix}</span>
        </nav>
        <ChartFrame title={node === root ? 'All agencies' : node.name} sourceIds={['mts5']}
          table={{
            columns: [{ key: 'n', label: 'Name', wrap: true }, { key: 'a', label: 'Net outlays', align: 'r' }, { key: 's', label: 'Share of all spending', align: 'r' }],
            rows: [...(node.children ?? [])].sort((a, b) => b.amount - a.amount).map((c) => ({ n: c.name, a: u.fmt(c.amount), s: pct(c.amount / root.amount, 2) })),
          }}
        >
          <Treemap
            root={node}
            total={root.amount}
            format={u.fmt}
            colorFor={(n, i) => (path.length === 0 ? TREE_COLORS[i % TREE_COLORS.length] : colorIdx(n))}
            onDrill={(n) => setPath([...path, n])}
          />
        </ChartFrame>
      </div>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="field" style={{ maxWidth: 420 }}>
          <label htmlFor="acct-q">Search every account (for example “Medicaid”, “FEMA”, “Pell”, “highway”)</label>
          <input id="acct-q" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a program, agency, or account" />
        </div>
        <DataTable
          spec={{
            columns: [{ key: 'n', label: 'Account', wrap: true }, { key: 'p', label: 'Agency', wrap: true }, { key: 'a', label: 'Net outlays', align: 'r' }, { key: 's', label: 'Share', align: 'r' }, { key: 'c', label: 'vs prior year', align: 'r' }],
            rows: matches.map((m) => ({
              n: m.node.name,
              p: m.path.slice(0, -1).join(' › '),
              a: u.fmt(m.node.amount),
              s: pct(m.node.amount / root.amount, 3),
              c: m.node.prior ? signedPct(m.node.amount / m.node.prior - 1) : '—',
            })),
          }}
        />
        <p className="small muted">Showing the {matches.length} largest of {flat.length.toLocaleString()} matching accounts. Negative amounts are accounts that took in more (fees, premiums, loan repayments) than they paid out.</p>
      </div>
    </Section>
  );
}

function DefenseVsSocial({ fy }: { fy: number }) {
  const u = useUnits();
  const cats = categoryTotals(fy);
  const get = (id: string) => cats.find((c) => c.id === id)!.amount;
  const total = cats.reduce((s, c) => s + c.amount, 0);
  const defense = get('defense');
  const social = get('ss') + get('medicare') + get('health') + get('income');
  const years = Object.keys(budget.functionsByFY).map(Number).sort((a, b) => a - b);
  const series = ['ss', 'medicare', 'health', 'income', 'defense', 'interest'].map((id) => {
    const c = CATEGORY_BY_ID[id as keyof typeof CATEGORY_BY_ID];
    return { id, label: c.label, color: c.color, kind: 'line' as const, values: years.map((y) => categoryTotals(y).find((x) => x.id === id)!.amount) };
  });
  const dod = accounts.fy === fy ? findNode(accounts.root, /Department of Defense.*Military/i, 1) : null;
  const ssa = accounts.fy === fy ? findNode(accounts.root, /^Social Security Administration/i, 1) : null;
  const hhs = accounts.fy === fy ? findNode(accounts.root, /Department of Health and Human Services/i, 1) : null;
  const toItems = (n: typeof dod, color: string) =>
    (n?.children ?? []).filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 7).map((c) => ({ id: c.name, label: c.name, value: c.amount, color }));
  return (
    <Section
      id="defense-social"
      eyebrow="Defense vs. social spending"
      title="Guns, butter, and the bill for both"
      sub={`In FY${fy}, the four big social categories (Social Security, Medicare, Medicaid and other health, and income security) cost ${(social / defense).toFixed(1)} times as much as national defense.`}
    >
      <div className="compare">
        <div className="card">
          <div className="stat">
            <div className="stat-label"><span className="swatch" style={{ background: 'var(--c-defense)' }} />National defense</div>
            <div className="stat-value">{u.fmt(defense)}<span className="small muted">{u.suffix}</span></div>
            <div className="stat-note">{pct(defense / total)} of all spending. Military pay and benefits, operations and maintenance, weapons, research, bases, and nuclear weapons programs at the Energy Department.</div>
          </div>
        </div>
        <div className="vs">vs</div>
        <div className="card">
          <div className="stat">
            <div className="stat-label"><span className="swatch" style={{ background: 'var(--c-ss)' }} />Social programs</div>
            <div className="stat-value">{u.fmt(social)}<span className="small muted">{u.suffix}</span></div>
            <div className="stat-note">{pct(social / total)} of all spending. Social Security, Medicare, Medicaid and other health programs, and income security such as SNAP, SSI, and refundable tax credits.</div>
          </div>
        </div>
      </div>
      <div className="card">
        <ChartFrame
          title="The biggest categories over time"
          sub="Net outlays by fiscal year. Social Security and health programs grow with an aging population; interest has grown with the debt and higher rates."
          legend={<Legend items={series.map((s) => ({ label: s.label, color: s.color, kind: 'line' as const }))} />}
          sourceIds={['mts9']}
          table={{
            columns: [{ key: 'fy', label: 'Fiscal year' }, ...series.map((s) => ({ key: s.id, label: s.label, align: 'r' as const }))],
            rows: years.map((y, i) => ({ fy: `FY${y}`, ...Object.fromEntries(series.map((s) => [s.id, money(s.values[i] ?? 0)])) })),
          }}
        >
          <TimeChart label="Major spending categories by fiscal year" x={years} xLabel={(y) => `’${String(y).slice(2)}`} tipTitle={(y) => `FY${y}`} height={300} series={series} />
        </ChartFrame>
      </div>
      {(dod || ssa || hhs) && (
        <div className="grid-2">
          {dod && (
            <div className="card">
              <ChartFrame title="Inside the Pentagon’s budget" sub={`${dod.name}, FY${fy}`} sourceIds={['mts5']}>
                <BarList items={toItems(dod, 'var(--c-defense)')} format={u.fmt} total={dod.amount} />
              </ChartFrame>
            </div>
          )}
          {(ssa || hhs) && (
            <div className="card">
              <ChartFrame title="The biggest benefit programs" sub={`Benefit payments from individual Treasury accounts, FY${fy}`} sourceIds={['mts5']}>
                <BarList items={benefitPrograms().slice(0, 10)} format={u.fmt} />
              </ChartFrame>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
