export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "up" | "down" }) {
  const toneClass =
    tone === "up" ? "text-emerald-600 dark:text-emerald-400" : tone === "down" ? "text-red-600 dark:text-red-400" : "";
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500 sm:text-xs">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums sm:text-2xl ${toneClass}`}>{value}</div>
      {hint && <div className="mt-1 text-[11px] text-zinc-500 sm:text-xs">{hint}</div>}
    </div>
  );
}
