import { useMemo, useState } from 'react';
import { PageHead } from '../components/ui';
import { glossary } from '../data';

export default function Glossary() {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...glossary].sort((a, b) => a.term.localeCompare(b.term)).filter((g) => !s || (g.term + ' ' + g.def).toLowerCase().includes(s));
  }, [q]);
  return (
    <>
      <PageHead eyebrow="Reference" title="Budget words, in plain English" lede="The terms used across this site. Dotted-underlined words on other pages show these definitions when you point at or tap them." />
      <div className="field" style={{ maxWidth: 380 }}>
        <label htmlFor="gq">Search the glossary</label>
        <input id="gq" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="For example: reconciliation" />
      </div>
      <dl className="gloss">
        {list.map((g) => (
          <div className="gloss-item" key={g.id} id={'g-' + g.id}>
            <dt>{g.term}</dt>
            <dd>{g.def}</dd>
          </div>
        ))}
      </dl>
      {list.length === 0 && <div className="empty">No terms match “{q}”.</div>}
    </>
  );
}
