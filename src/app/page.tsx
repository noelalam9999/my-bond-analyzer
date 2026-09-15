import { BondTable } from "@/components/BondTable";
import { Stat } from "@/components/Stat";
import { fmtBDT, fmtPct, summarize } from "@/lib/bonds";
import { fetchBonds, sheetUrl } from "@/lib/sheet";

export const revalidate = 300;

export default async function Home() {
  let bonds: Awaited<ReturnType<typeof fetchBonds>> = [];
  let error: string | null = null;
  try {
    bonds = await fetchBonds();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const s = summarize(bonds);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Bond Portfolio</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Live from{" "}
            <a href={sheetUrl} target="_blank" rel="noreferrer" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">
              Google Sheet
            </a>{" "}
            · refreshes every 5 min
          </p>
        </div>
        <div className="text-xs text-zinc-500">{bonds.length} holding{bonds.length === 1 ? "" : "s"}</div>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          Couldn&apos;t load the sheet: {error}. Make sure it&apos;s shared as &quot;Anyone with the link&quot;.
        </div>
      ) : (
        <>
          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Invested" value={fmtBDT(s.invested)} />
            <Stat label="Annual coupon income" value={fmtBDT(s.income)} hint={`≈ ${fmtBDT(s.income / 12)} / month`} />
            <Stat label="Weighted coupon" value={fmtPct(s.weightedCoupon)} hint="by purchase value" />
            <Stat label="Weighted years left" value={s.weightedYears.toFixed(1)} hint={s.longest !== null ? `longest ${s.longest.toFixed(1)} yrs` : undefined} />
          </section>
          <BondTable bonds={bonds} />
          <p className="mt-3 text-xs text-zinc-500">
            * Yield derived as annual coupon ÷ purchase price when the sheet&apos;s “Current Yield” is blank. Coupon income assumes BDT 100,000 face value per unit.
          </p>
        </>
      )}
    </main>
  );
}
