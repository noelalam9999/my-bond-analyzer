import { fmtBDT, fmtPct, fmtSigned, type BondRow } from "@/lib/bonds";

export const gainClass = (n: number) =>
  n > 0 ? "text-emerald-600 dark:text-emerald-400" : n < 0 ? "text-red-600 dark:text-red-400" : "";

export function YieldCell({ r }: { r: BondRow }) {
  return (
    <>
      {fmtPct(r.yieldValue)}
      {r.yieldSource === "live" && (
        <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" title="Live market yield from Bangladesh Bank" />
      )}
      {r.yieldSource === "derived" && <span className="ml-1 text-zinc-400" title="Derived: annual coupon ÷ purchase price">*</span>}
    </>
  );
}

export function GainCell({ r }: { r: BondRow }) {
  if (r.capitalGain === null || r.gainPct === null) return <span className="text-zinc-400">—</span>;
  return (
    <span className={gainClass(r.capitalGain)}>
      {fmtSigned(r.capitalGain)}
      <span className="mx-1.5 text-zinc-300 dark:text-zinc-700">|</span>
      {fmtPct(r.gainPct, 0)}
    </span>
  );
}

export function PVCell({ r }: { r: BondRow }) {
  if (r.presentValue === null) return <span className="text-zinc-400" title="No live quote for this ISIN">—</span>;
  return (
    <span title={`BB clean price ${r.bbCleanPrice?.toFixed(4)} · includes accrued coupon ${fmtBDT(r.accrued ?? 0)}`}>
      {fmtBDT(r.presentValue)}
    </span>
  );
}

export function BondTable({ rows }: { rows: BondRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="min-w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-3">Bond</th>
            <th className="px-4 py-3">ISIN</th>
            <th className="px-4 py-3">Purchased</th>
            <th className="px-4 py-3">Time held</th>
            <th className="px-4 py-3 text-right">Purchase price</th>
            <th className="px-4 py-3 text-right">Coupon</th>
            <th className="px-4 py-3 text-right">Yield</th>
            <th className="px-4 py-3 text-right">Present value</th>
            <th className="px-4 py-3 text-right">Capital gain</th>
            <th className="px-4 py-3 text-right">Annual income</th>
            <th className="px-4 py-3 text-right">Years left</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((r) => (
            <tr key={r.isin || r.title} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
              <td className="whitespace-nowrap px-4 py-3 font-medium">{r.title}</td>
              <td className="px-4 py-3 font-mono text-xs text-zinc-500">{r.isin}</td>
              <td className="whitespace-nowrap px-4 py-3">{r.purchaseDate ?? "—"}</td>
              <td className="whitespace-nowrap px-4 py-3">{r.timeHeld ?? "—"}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtBDT(r.price)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtPct(r.couponRate)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums"><YieldCell r={r} /></td>
              <td className="px-4 py-3 text-right tabular-nums"><PVCell r={r} /></td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums"><GainCell r={r} /></td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtBDT(r.annualIncome)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.yearsLeft === null ? "—" : r.yearsLeft.toFixed(1)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={11} className="px-4 py-8 text-center text-zinc-500">No holdings match.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
