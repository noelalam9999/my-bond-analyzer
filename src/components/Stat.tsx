export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "up" | "down" }) {
  const toneClass =
    tone === "up" ? "text-emerald-600 dark:text-emerald-400" : tone === "down" ? "text-red-600 dark:text-red-400" : "";
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}
