"use client";

import { useMemo, useState } from "react";
import type { BondRow } from "@/lib/bonds";
import { BondCards } from "./BondCards";
import { BondTable } from "./BondTable";
import { RangeSlider } from "./RangeSlider";

type NumKey = "yearsLeft" | "gainPct" | "yieldValue" | "daysHeld" | "price";
type SortKey = NumKey | "title";

/** Each filter works in "display units" (e.g. % or months) and converts to the row's raw value. */
const FILTERS: {
  key: NumKey; label: string; step: number;
  toDisplay: (raw: number) => number; toRaw: (d: number) => number; format: (d: number) => string;
}[] = [
  { key: "yearsLeft", label: "Maturity", step: 0.1, toDisplay: (r) => r, toRaw: (d) => d, format: (d) => `${d.toFixed(1)} yrs` },
  { key: "gainPct", label: "Capital gain", step: 0.5, toDisplay: (r) => r * 100, toRaw: (d) => d / 100, format: (d) => `${d.toFixed(1)}%` },
  { key: "yieldValue", label: "Yield", step: 0.05, toDisplay: (r) => r * 100, toRaw: (d) => d / 100, format: (d) => `${d.toFixed(2)}%` },
  { key: "daysHeld", label: "Time held", step: 1, toDisplay: (r) => r / 30.4375, toRaw: (d) => d * 30.4375, format: (d) => `${Math.round(d)} mo` },
  { key: "price", label: "Purchase price", step: 10_000, toDisplay: (r) => r, toRaw: (d) => d, format: (d) => d.toLocaleString("en-US") },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "title", label: "Bond" },
  { key: "yearsLeft", label: "Maturity" },
  { key: "gainPct", label: "Capital gain" },
  { key: "yieldValue", label: "Yield" },
  { key: "daysHeld", label: "Time held" },
  { key: "price", label: "Purchase price" },
];

type Bounds = Record<NumKey, { min: number; max: number }>;
type Ranges = Partial<Record<NumKey, [number, number]>>;

// Round after snapping so bounds land exactly on the step grid (avoids 8.450000000000001).
const tidy = (n: number) => Number(n.toFixed(6));
const floorTo = (n: number, s: number) => tidy(Math.floor(n / s + 1e-9) * s);
const ceilTo = (n: number, s: number) => tidy(Math.ceil(n / s - 1e-9) * s);

export function Holdings({ rows }: { rows: BondRow[] }) {
  const [q, setQ] = useState("");
  const [ranges, setRanges] = useState<Ranges>({});
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);

  // Slider bounds come from the data, snapped outward to the step.
  const bounds = useMemo<Bounds>(() => {
    const out = {} as Bounds;
    for (const f of FILTERS) {
      const vals = rows.map((r) => r[f.key]).filter((v): v is number => v !== null).map(f.toDisplay);
      out[f.key] = vals.length
        ? { min: floorTo(Math.min(...vals), f.step), max: ceilTo(Math.max(...vals), f.step) }
        : { min: 0, max: 0 };
    }
    return out;
  }, [rows]);

  const isActive = (k: NumKey) => {
    const r = ranges[k];
    return !!r && (r[0] > bounds[k].min || r[1] < bounds[k].max);
  };
  const activeFilters = FILTERS.filter((f) => isActive(f.key)).length;

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (needle && !r.isin.toLowerCase().includes(needle) && !r.title.toLowerCase().includes(needle)) return false;
      for (const f of FILTERS) {
        if (!isActive(f.key)) continue;
        const [lo, hi] = ranges[f.key]!;
        const v = r[f.key];
        if (v === null) return false;
        // small epsilon so a value sitting exactly on a snapped bound isn't dropped
        if (v < f.toRaw(lo) - 1e-9 || v > f.toRaw(hi) + 1e-9) return false;
      }
      return true;
    });
    return out.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const c = typeof av === "string" || typeof bv === "string"
        ? String(av ?? "").localeCompare(String(bv ?? ""))
        : (av ?? -Infinity) - (bv ?? -Infinity);
      return sortDir === "asc" ? c : -c;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, ranges, bounds, sortKey, sortDir]);

  const input = "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search ISIN or bond…"
          className={`${input} w-full min-w-0 sm:w-auto sm:max-w-xs sm:flex-1`}
          aria-label="Search by ISIN or bond title"
        />
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={`${input} flex-1 sm:flex-none`} aria-label="Sort by">
          {SORTS.map((s) => <option key={s.key} value={s.key}>Sort: {s.label}</option>)}
        </select>
        <button
          type="button" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className={`${input} px-3`} title={sortDir === "asc" ? "Ascending" : "Descending"}
          aria-label={`Sort ${sortDir === "asc" ? "ascending" : "descending"}`}
        >
          {sortDir === "asc" ? "↑" : "↓"}
        </button>
        <button
          type="button" onClick={() => setShowFilters((v) => !v)}
          className={`${input} ${showFilters || activeFilters ? "border-zinc-900 dark:border-zinc-100" : ""}`}
          aria-expanded={showFilters}
        >
          Filters{activeFilters ? ` (${activeFilters})` : ""}
        </button>
        <span className="ml-auto text-xs text-zinc-500">{visible.length} of {rows.length}</span>
      </div>

      {showFilters && (
        <div className="mb-4 grid gap-x-6 gap-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-2 lg:grid-cols-5">
          {FILTERS.map((f) => {
            const b = bounds[f.key];
            const flat = b.min === b.max;
            return (
              <div key={f.key}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wide text-zinc-500">{f.label}</span>
                  {isActive(f.key) && (
                    <button type="button" onClick={() => setRanges((p) => ({ ...p, [f.key]: undefined }))} className="text-[11px] text-zinc-500 underline">
                      reset
                    </button>
                  )}
                </div>
                <RangeSlider
                  min={b.min} max={b.max} step={f.step} disabled={flat}
                  value={ranges[f.key] ?? [b.min, b.max]}
                  onChange={(v) => setRanges((p) => ({ ...p, [f.key]: v }))}
                  format={f.format}
                />
              </div>
            );
          })}
          {activeFilters > 0 && (
            <button type="button" onClick={() => setRanges({})} className="text-left text-xs text-zinc-500 underline sm:col-span-2 lg:col-span-5">
              Clear all filters
            </button>
          )}
        </div>
      )}

      <div className="md:hidden"><BondCards rows={visible} /></div>
      <div className="hidden md:block"><BondTable rows={visible} /></div>
    </section>
  );
}
