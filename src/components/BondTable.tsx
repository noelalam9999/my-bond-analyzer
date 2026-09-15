import { annualCoupon, effectiveYield, fmtBDT, fmtDate, fmtPct, yearsToMaturity, type Bond } from "@/lib/bonds";

export function BondTable({ bonds }: { bonds: Bond[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="min-w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-3">Bond</th>
            <th className="px-4 py-3">ISIN</th>
            <th className="px-4 py-3 text-right">Purchase (BDT)</th>
            <th className="px-4 py-3 text-right">Coupon</th>
            <th className="px-4 py-3 text-right">Yield</th>
            <th className="px-4 py-3 text-right">Annual income</th>
            <th className="px-4 py-3">Maturity</th>
            <th className="px-4 py-3 text-right">Years left</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {bonds.map((b) => {
            const ytm = yearsToMaturity(b);
            return (
              <tr key={b.isin || b.title} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
                <td className="px-4 py-3 font-medium">{b.title}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">{b.isin}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtBDT(b.price)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtPct(b.couponRate)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmtPct(effectiveYield(b))}
                  {b.currentYield === null && <span className="ml-1 text-zinc-400" title="Derived: annual coupon ÷ purchase price">*</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtBDT(annualCoupon(b))}</td>
                <td className="px-4 py-3">{b.maturity ? fmtDate(b.maturity) : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{ytm === null ? "—" : ytm.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
