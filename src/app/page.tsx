import { BondTable } from "@/components/BondTable";
import { Stat } from "@/components/Stat";
import { BB_TBOND_URL, fetchBBQuotes, type BBSnapshot } from "@/lib/bb";
import { fmtBDT, fmtDate, fmtPct, fmtSigned, priceBonds, summarize, type PricedBond } from "@/lib/bonds";
import { fetchBonds, sheetUrl } from "@/lib/sheet";

// Live BB quotes are fetched on every request.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [sheetResult, bbResult] = await Promise.allSettled([fetchBonds(), fetchBBQuotes()]);

  const sheetError = sheetResult.status === "rejected" ? String(sheetResult.reason?.message ?? sheetResult.reason) : null;
  const bbError = bbResult.status === "rejected" ? String(bbResult.reason?.message ?? bbResult.reason) : null;
  const snapshot: BBSnapshot = bbResult.status === "fulfilled" ? bbResult.value : { asOf: null, quotes: new Map() };

  const bonds: PricedBond[] =
    sheetResult.status === "fulfilled" ? priceBonds(sheetResult.value, snapshot.quotes) : [];
  const s = summarize(bonds);
  const unpriced = s.count - s.pricedCount;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Bond Portfolio</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Holdings from{" "}
            <a href={sheetUrl} target="_blank" rel="noreferrer" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">
              Google Sheet
            </a>
            {" · "}live yields from{" "}
            <a href={BB_TBOND_URL} target="_blank" rel="noreferrer" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">
              Bangladesh Bank
            </a>
            {snapshot.asOf && <> (as of {fmtDate(snapshot.asOf)})</>}
          </p>
        </div>
        <div className="text-xs text-zinc-500">{s.count} holding{s.count === 1 ? "" : "s"}</div>
      </header>

      {sheetError ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          Couldn&apos;t load the sheet: {sheetError}. Make sure it&apos;s shared as &quot;Anyone with the link&quot;.
        </div>
      ) : (
        <>
          {bbError && (
            <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Live yields unavailable ({bbError}). Showing sheet data only; present value and capital gain need a live quote.
            </div>
          )}
          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Invested" value={fmtBDT(s.invested)} />
            <Stat
              label="Present value"
              value={s.pricedCount ? fmtBDT(s.presentValue) : "—"}
              hint={unpriced > 0 ? `${unpriced} holding${unpriced === 1 ? "" : "s"} without live quote` : "at live market yields"}
            />
            <Stat
              label="Capital gain"
              value={s.pricedCount ? fmtSigned(s.capitalGain) : "—"}
              hint={s.pricedCount && s.invested ? fmtPct(s.capitalGain / s.invested) + " of invested" : undefined}
              tone={s.pricedCount ? (s.capitalGain >= 0 ? "up" : "down") : undefined}
            />
            <Stat label="Annual coupon income" value={fmtBDT(s.income)} hint={`≈ ${fmtBDT(s.income / 12)} / month`} />
            <Stat label="Weighted years left" value={s.weightedYears.toFixed(1)} hint={s.longest !== null ? `longest ${s.longest.toFixed(1)} yrs` : undefined} />
          </section>
          <BondTable bonds={bonds} />
          <p className="mt-3 text-xs text-zinc-500">
            All amounts in BDT. Present value discounts each remaining coupon and the principal at Bangladesh Bank&apos;s market yield (semi-annual
            compounding) and includes accrued coupon; hover a value for the clean price. Capital gain = present value − purchase price.
            Coupon income assumes 100,000 face value per unit. * = yield derived as coupon ÷ purchase price (no live quote).
          </p>
        </>
      )}
    </main>
  );
}
