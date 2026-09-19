import { Holdings } from "@/components/Holdings";
import { Stat } from "@/components/Stat";
import { BB_TBOND_URL, fetchBBQuotes, type CachedSnapshot } from "@/lib/bb";
import { fmtBDT, fmtDate, fmtPct, fmtSigned, priceBonds, summarize, toRow, type PricedBond } from "@/lib/bonds";
import { fetchBonds } from "@/lib/holdings";
import { holdingsEditorUrl } from "@/lib/supabase";

// Reads Supabase on every request; quotes there are refreshed daily (or on demand once >24h old).
export const dynamic = "force-dynamic";

const EMPTY: CachedSnapshot = { asOf: null, quotes: new Map(), fetchedAt: null, stale: true, refreshError: null };

/** "3 h ago", "2 d ago" */
function ago(d: Date, now = Date.now()) {
  const mins = Math.max(0, Math.round((now - d.getTime()) / 60_000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export default async function Home() {
  const [holdingsResult, bbResult] = await Promise.allSettled([fetchBonds(), fetchBBQuotes()]);

  const holdingsError = holdingsResult.status === "rejected" ? String(holdingsResult.reason?.message ?? holdingsResult.reason) : null;
  const snapshot = bbResult.status === "fulfilled" ? bbResult.value : EMPTY;
  const bbError =
    bbResult.status === "rejected"
      ? String(bbResult.reason?.message ?? bbResult.reason)
      : snapshot.quotes.size === 0
        ? (snapshot.refreshError ?? "no quotes cached yet")
        : null;

  const bonds: PricedBond[] =
    holdingsResult.status === "fulfilled" ? priceBonds(holdingsResult.value, snapshot.quotes) : [];
  const s = summarize(bonds);
  const rows = bonds.map((b) => toRow(b));
  const unpriced = s.count - s.pricedCount;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Bond Portfolio</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Holdings from{" "}
            <a href={holdingsEditorUrl} target="_blank" rel="noreferrer" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">
              Supabase
            </a>
            {" · "}yields from{" "}
            <a href={BB_TBOND_URL} target="_blank" rel="noreferrer" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">
              Bangladesh Bank
            </a>
            {snapshot.asOf && <> (as of {fmtDate(snapshot.asOf)}</>}
            {snapshot.fetchedAt && <>, refreshed {ago(snapshot.fetchedAt)}</>}
            {snapshot.asOf && ")"}
          </p>
        </div>
        <div className="text-xs text-zinc-500">{s.count} holding{s.count === 1 ? "" : "s"}</div>
      </header>

      {holdingsError ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          Couldn&apos;t load holdings: {holdingsError}. Check SUPABASE_URL / SUPABASE_ANON_KEY.
        </div>
      ) : (
        <>
          {bbError ? (
            <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Market yields unavailable ({bbError}). Showing holdings only; present value and capital gain need a quote.
            </div>
          ) : snapshot.stale && snapshot.fetchedAt ? (
            <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Yields are {ago(snapshot.fetchedAt)} old — the refresh from Bangladesh Bank failed
              {snapshot.refreshError ? ` (${snapshot.refreshError})` : ""}. Values below use the last cached quotes.
            </div>
          ) : null}
          <section className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
          </section>
          <Holdings rows={rows} />
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
