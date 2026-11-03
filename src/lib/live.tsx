import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { budget, debt } from '../data';

// Standalone build only: refresh the headline numbers straight from the Treasury Fiscal Data API
// in the visitor's browser. The artifact build ships with the data baked in (its sandbox blocks
// outside requests), so this provider stays idle there.
const API = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';

export interface LiveState {
  status: 'off' | 'loading' | 'live' | 'error';
  debt?: { date: string; total: number; public: number; intragov: number };
  mts?: { date: string; fy: number; receiptsFYTD: number; outlaysFYTD: number; deficitFYTD: number };
}

const Ctx = createContext<LiveState>({ status: 'off' });

async function getJSON(path: string) {
  const r = await fetch(API + path, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

export function LiveProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LiveState>({ status: __ARTIFACT__ ? 'off' : 'loading' });
  useEffect(() => {
    if (__ARTIFACT__) return;
    let cancelled = false;
    (async () => {
      try {
        const [penny, mts] = await Promise.all([
          getJSON('/v2/accounting/od/debt_to_penny?sort=-record_date&page%5Bsize%5D=1'),
          getJSON('/v1/accounting/mts/mts_table_9?sort=-record_date,src_line_nbr&page%5Bsize%5D=80'),
        ]);
        const p = penny.data[0];
        const out: LiveState = { status: 'live' };
        if (p && p.record_date > debt.latest.date) {
          out.debt = { date: p.record_date, total: +p.tot_pub_debt_out_amt, public: +p.debt_held_public_amt, intragov: +p.intragov_hold_amt };
        }
        const rows: Record<string, string>[] = mts.data;
        const date = rows[0]?.record_date;
        if (date && date > budget.mtsLatestDate) {
          const latestRows = rows.filter((r) => r.record_date === date);
          const find = (re: RegExp) => latestRows.find((r) => re.test(r.classification_desc));
          const rec = find(/^Total Receipts$/i);
          const out_ = find(/^Total Outlays$/i);
          const scale = (v: string) => +v * (Math.abs(+v) < 1e10 ? 1e6 : 1);
          if (rec && out_) {
            const fy = Number(date.slice(0, 4)) + (Number(date.slice(5, 7)) >= 10 ? 1 : 0);
            const r = scale(rec.current_fytd_rcpt_outly_amt);
            const o = scale(out_.current_fytd_rcpt_outly_amt);
            out.mts = { date, fy, receiptsFYTD: r, outlaysFYTD: o, deficitFYTD: o - r };
          }
        }
        if (!cancelled) setState(out);
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useLive = () => useContext(Ctx);
