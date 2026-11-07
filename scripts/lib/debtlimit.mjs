// The statutory debt limit and the debt that counts toward it, from the Daily Treasury Statement
// (Table III-C, "Debt Subject to Limit"). Amounts there are in millions of dollars.
//   subject = debt held by the public + intragovernmental holdings − debt not subject to limit
//             + other debt subject to limit
export function debtLimitFrom(rows) {
  const dates = [...new Set(rows.map((r) => r.record_date))].sort();
  for (const date of dates.reverse()) {
    const day = rows.filter((r) => r.record_date === date);
    const amt = (catg, desc) => day.filter((r) => r.debt_catg === catg && (desc == null || r.debt_catg_desc === desc)).reduce((s, r) => s + Number(r.close_today_bal) * 1e6, 0);
    const limit = amt('Statutory Debt Limit');
    if (!limit) continue;
    const subject = amt('Debt Held by the Public') + amt('Intragovernmental Holdings') - amt('Debt Not Subject to Limit') + amt('Other Debt Subject to Limit');
    if (!(subject > 0)) continue;
    return { date, limit, subject };
  }
  return null;
}
