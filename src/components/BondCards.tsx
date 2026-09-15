import { fmtBDT, fmtPct, type BondRow } from "@/lib/bonds";
import { GainCell, PVCell, YieldCell } from "./BondTable";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-0.5 tabular-nums">{children}</div>
    </div>
  );
}

export function BondCards({ rows }: { rows: BondRow[] }) {
  if (rows.length === 0)
    return <div className="rounded-xl border border-zinc-200 p-8 text-center text-sm text-zinc-500 dark:border-zinc-800">No holdings match.</div>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.isin || r.title} className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">{r.title}</div>
              <div className="font-mono text-xs text-zinc-500">{r.isin}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">Capital gain</div>
              <div className="font-semibold tabular-nums"><GainCell r={r} /></div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Field label="Present value"><PVCell r={r} /></Field>
            <Field label="Purchase price">{fmtBDT(r.price)}</Field>
            <Field label="Yield"><YieldCell r={r} /></Field>
            <Field label="Coupon">{fmtPct(r.couponRate)}</Field>
            <Field label="Purchased">{r.purchaseDate ?? "—"}</Field>
            <Field label="Time held">{r.timeHeld ?? "—"}</Field>
            <Field label="Annual income">{fmtBDT(r.annualIncome)}</Field>
            <Field label="Years left">{r.yearsLeft === null ? "—" : r.yearsLeft.toFixed(1)}</Field>
          </div>
        </li>
      ))}
    </ul>
  );
}
