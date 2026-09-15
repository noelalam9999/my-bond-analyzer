import {
  annualCoupon, displayYield, fmtBDT, fmtDate, fmtPct, fmtSigned, yearsToMaturity, type PricedBond,
} from "@/lib/bonds";

const gainClass = (n: number) =>
  n > 0 ? "text-emerald-600 dark:text-emerald-400" : n < 0 ? "text-red-600 dark:text-red-400" : "";

export function BondTable({ bonds }: { bonds: PricedBond[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="min-w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-3">Bond</th>
            <th className="px-4 py-3">ISIN</th>
            <th className="px-4 py-3">Purchased</th>
            <th className="px-4 py-3 text-right">Purchase price</th>
            <th className="px-4 py-3 text-right">Coupon</th>
            <th className="px-4 py-3 text-right">Yield</th>
            <th className="px-4 py-3 text-right">Present value</th>
            <th className="px-4 py-3 text-right">Capital gain</th>
            <th className="px-4 py-3 text-right">Annual income</th>
            <th className="px-4 py-3">Maturity</th>
            <th className="px-4 py-3 text-right">Years left</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {bonds.map((b) => {
            const ytm = yearsToMaturity(b);
            const y = displayYield(b);
            return (
              <tr key={b.isin || b.title} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
                <td className="whitespace-nowrap px-4 py-3 font-medium">{b.title}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">{b.isin}</td>
                <td className="whitespace-nowrap px-4 py-3">{b.purchaseDate ? fmtDate(b.purchaseDate) : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtBDT(b.price)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtPct(b.couponRate)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {fmtPct(y.value)}
                  {y.source === "live" && (
                    <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" title="Live market yield from Bangladesh Bank" />
                  )}
                  {y.source === "derived" && <span className="ml-1 text-zinc-400" title="Derived: annual coupon ÷ purchase price">*</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {b.live ? (
                    <span title={`BB clean price ${b.live.bbCleanPrice.toFixed(4)} · includes accrued coupon ${fmtBDT(b.live.accrued)}`}>
                      {fmtBDT(b.live.presentValue)}
                    </span>
                  ) : (
                    <span className="text-zinc-400" title="No live quote for this ISIN">—</span>
                  )}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums ${b.live ? gainClass(b.live.capitalGain) : "text-zinc-400"}`}>
                  {b.live ? fmtSigned(b.live.capitalGain) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtBDT(annualCoupon(b))}</td>
                <td className="whitespace-nowrap px-4 py-3">{b.maturity ? fmtDate(b.maturity) : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{ytm === null ? "—" : ytm.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
