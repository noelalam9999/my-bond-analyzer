"use client";

import { useMemo, useState } from "react";
import type { BondRow } from "@/lib/bonds";
import { BondCards } from "./BondCards";
import { BondTable } from "./BondTable";

type NumKey = "yearsLeft" | "gainPct" | "yieldValue" | "daysHeld" | "price";
type SortKey = NumKey | "title";

const FILTERS: { key: NumKey; label: string; unit: string; toValue: (n: number) => number; step?: string }[] = [
  { key: "yearsLeft", label: "Maturity", unit: "yrs left", toValue: (n) => n },
  { key: "gainPct", label: "Capital gain", unit: "%", toValue: (n) => n / 100, step: "0.1" },
  { key: "yieldValue", label: "Yield", unit: "%", toValue: (n) => n / 100, step: "0.01" },
  { key: "daysHeld", label: "Time held", unit: "months", toValue: (n) => n * 30.4375 },
  { key: "price", label: "Purchase price", unit: "BDT", toValue: (n) => n, step: "1000" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "title", label: "Bond" },
  { key: "yearsLeft", label: "Maturity" },
  { key: "gainPct", label: "Capital gain" },
  { key: "yieldValue", label: "Yield" },
  { key: "daysHeld", label: "Time held" },
  { key: "price", label: "Purchase price" },
];

type Range = { min: string; max: string };
const emptyRanges = () => Object.fromEntries(FILTERS.map((f) => [f.key, { min: "", max: "" }])) as Record<NumKey, Range>;

export function Holdings({ rows }: { rows: BondRow[] }) {
  const [q, setQ] = useState("");
  const [ranges, setRanges] = useState<Record<NumKey, Range>>(emptyRanges);
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);

  const activeFilters = FILTERS.filter((f) => ranges[f.key].min !== "" || ranges[f.key].max !== "").length;

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (needle && !r.isin.toLowerCase().includes(needle) && !r.title.toLowerCase().includes(needle)) return false;
      for (const f of FILTERS) {
        const { min, max } = ranges[f.key];
        if (min === "" && max === "") continue;
        const v = r[f.key];
        if (v === null) return false;
        if (min !== "" && v < f.toValue(Number(min))) return false;
        if (max !== "" && v > f.toValue(Number(max))) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      let c: number;
      if (typeof av === "string" || typeof bv === "string") c = String(av ?? "").localeCompare(String(bv ?? ""));
      else c = (av ?? -Infinity) - (bv ?? -Infinity);
      return sortDir === "asc" ? c : -c;
    });
    return out;
  }, [rows, q, ranges, sortKey, sortDir]);

  const setRange = (key: NumKey, side: keyof Range, value: string) =>
    setRanges((prev) => ({ ...prev, [key]: { ...prev[key], [side]: value } }));

  const input = "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search ISIN or bond…"
          className={`${input} w-full min-w-0 sm:w-auto sm:flex-1 sm:max-w-xs`}
          aria-label="Search by ISIN or bond title"
        />
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={`${input} flex-1 sm:flex-none`} aria-label="Sort by">
          {SORTS.map((s) => <option key={s.key} value={s.key}>Sort: {s.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className={`${input} px-3`}
          aria-label={`Sort ${sortDir === "asc" ? "ascending" : "descending"}`}
          title={sortDir === "asc" ? "Ascending" : "Descending"}
        >
          {sortDir === "asc" ? "↑" : "↓"}
        </button>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={`${input} ${showFilters || activeFilters ? "border-zinc-900 dark:border-zinc-100" : ""}`}
          aria-expanded={showFilters}
        >
          Filters{activeFilters ? ` (${activeFilters})` : ""}
        </button>
        <span className="ml-auto text-xs text-zinc-500">{visible.length} of {rows.length}</span>
      </div>

      {showFilters && (
        <div className="mb-4 grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-2 lg:grid-cols-5">
          {FILTERS.map((f) => (
            <div key={f.key}>
              <label className="text-[11px] uppercase tracking-wide text-zinc-500">
                {f.label} <span className="normal-case">({f.unit})</span>
              </label>
              <div className="mt-1 flex items-center gap-1.5">
                <input type="number" inputMode="decimal" step={f.step} placeholder="min" value={ranges[f.key].min}
                  onChange={(e) => setRange(f.key, "min", e.target.value)} className={`${input} w-full min-w-0 px-2 py-1.5`} aria-label={`${f.label} minimum`} />
                <span className="text-zinc-400">–</span>
                <input type="number" inputMode="decimal" step={f.step} placeholder="max" value={ranges[f.key].max}
                  onChange={(e) => setRange(f.key, "max", e.target.value)} className={`${input} w-full min-w-0 px-2 py-1.5`} aria-label={`${f.label} maximum`} />
              </div>
            </div>
          ))}
          {activeFilters > 0 && (
            <button type="button" onClick={() => setRanges(emptyRanges())} className="text-left text-xs text-zinc-500 underline sm:col-span-2 lg:col-span-5">
              Clear filters
            </button>
          )}
        </div>
      )}

      <div className="md:hidden"><BondCards rows={visible} /></div>
      <div className="hidden md:block"><BondTable rows={visible} /></div>
    </section>
  );
}
