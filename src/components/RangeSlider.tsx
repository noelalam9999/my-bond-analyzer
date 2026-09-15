"use client";

/** Dual-thumb range slider built from two overlaid native range inputs. */
export function RangeSlider({
  min, max, step, value, onChange, format, disabled,
}: {
  min: number; max: number; step: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  format: (n: number) => string;
  disabled?: boolean;
}) {
  const [lo, hi] = value;
  const span = max - min || 1;
  const pct = (n: number) => `${((n - min) / span) * 100}%`;
  const thumb =
    "pointer-events-none absolute inset-x-0 top-0 h-6 w-full appearance-none bg-transparent " +
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 " +
    "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 " +
    "[&::-webkit-slider-thumb]:border-zinc-900 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow " +
    "dark:[&::-webkit-slider-thumb]:border-zinc-100 dark:[&::-webkit-slider-thumb]:bg-zinc-900 " +
    "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full " +
    "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-zinc-900 [&::-moz-range-thumb]:bg-white " +
    "dark:[&::-moz-range-thumb]:border-zinc-100 dark:[&::-moz-range-thumb]:bg-zinc-900 " +
    "disabled:opacity-40";

  return (
    <div className={disabled ? "opacity-50" : ""}>
      <div className="mb-1 flex justify-between text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
        <span>{format(lo)}</span>
        <span>{format(hi)}</span>
      </div>
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-zinc-900 dark:bg-zinc-100"
          style={{ left: pct(lo), right: `calc(100% - ${pct(hi)})` }}
        />
        <input
          type="range" min={min} max={max} step={step} value={lo} disabled={disabled}
          onChange={(e) => onChange([Math.min(Number(e.target.value), hi), hi])}
          className={thumb} aria-label="Minimum"
        />
        <input
          type="range" min={min} max={max} step={step} value={hi} disabled={disabled}
          onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo)])}
          className={thumb} aria-label="Maximum"
        />
      </div>
    </div>
  );
}
