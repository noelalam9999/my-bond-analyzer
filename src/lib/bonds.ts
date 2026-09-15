import type { BBQuote } from "./bb";
import { valueBond } from "./pricing";

export interface Bond {
  title: string;
  isin: string;
  purchaseDate: Date | null;
  /** Purchase price in BDT */
  price: number;
  /** Annual coupon rate as a fraction, e.g. 0.122 */
  couponRate: number;
  /** Current yield from the sheet (fraction), if filled in */
  sheetYield: number | null;
  /** Tenor in years parsed from the title, e.g. "15Y" → 15 */
  tenorYears: number | null;
  maturity: Date | null;
}

/** Live mark-to-market for a holding, from Bangladesh Bank */
export interface LiveValuation {
  marketYield: number;
  /** Present value of the holding in BDT (all remaining cashflows discounted at market yield) */
  presentValue: number;
  /** presentValue − purchase price */
  capitalGain: number;
  /** Accrued coupon included in presentValue, BDT */
  accrued: number;
  /** BB's clean price per 100 face, for reference */
  bbCleanPrice: number;
}

export interface PricedBond extends Bond {
  live: LiveValuation | null;
}

export const FACE_VALUE = 100_000; // BGTB face value per unit, BDT

/** Units held, assuming purchase price ≈ face value in 100k lots. */
export function unitsHeld(b: Bond): number {
  return Math.round(b.price / FACE_VALUE) || b.price / FACE_VALUE;
}

function parseNumber(s: string): number {
  const n = Number(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

/** "12.20%" → 0.122; "0.122" → 0.122 */
function parseRate(s: string): number {
  const t = s.trim();
  if (!t) return NaN;
  const n = parseNumber(t);
  return t.includes("%") || n > 1 ? n / 100 : n;
}

/** Accepts ISO (2026-08-18), dd/mm/yyyy or dd-mm-yyyy. */
function parseDate(s: string): Date | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "15Y BGTB 16/01/2028" → { tenor: 15, maturity: 2028-01-16 } */
function parseTitle(title: string) {
  const tenor = title.match(/(\d+)\s*Y\b/i);
  const date = title.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return {
    tenorYears: tenor ? Number(tenor[1]) : null,
    maturity: date ? new Date(Date.UTC(+date[3], +date[2] - 1, +date[1])) : null,
  };
}

export function parseBondRow(r: {
  title: string; isin: string; purchaseDate: string; price: string; coupon: string; currentYield: string;
}): Bond | null {
  if (!r.title.trim()) return null;
  const price = parseNumber(r.price);
  const couponRate = parseRate(r.coupon);
  if (!Number.isFinite(price) || !Number.isFinite(couponRate)) return null;
  const cy = parseRate(r.currentYield);
  return {
    title: r.title.trim(),
    isin: r.isin.trim(),
    purchaseDate: parseDate(r.purchaseDate),
    price,
    couponRate,
    sheetYield: Number.isFinite(cy) ? cy : null,
    ...parseTitle(r.title),
  };
}

/** Attach live BB valuation to each holding (null when BB has no quote for that ISIN). */
export function priceBonds(bonds: Bond[], quotes: Map<string, BBQuote>, now = new Date()): PricedBond[] {
  return bonds.map((b) => {
    const q = quotes.get(b.isin);
    const v = q ? valueBond(q, now) : null;
    if (!q || !v) return { ...b, live: null };
    const face = unitsHeld(b) * FACE_VALUE;
    const presentValue = (face * v.dirtyPrice) / 100;
    return {
      ...b,
      live: {
        marketYield: q.marketYield,
        presentValue,
        capitalGain: presentValue - b.price,
        accrued: (face * v.accrued) / 100,
        bbCleanPrice: q.marketPrice,
      },
    };
  });
}

export function yearsToMaturity(b: Bond, now = new Date()): number | null {
  if (!b.maturity) return null;
  return (b.maturity.getTime() - now.getTime()) / (365.25 * 24 * 3600 * 1000);
}

export function annualCoupon(b: Bond): number {
  return unitsHeld(b) * FACE_VALUE * b.couponRate;
}

/** Yield to show: live market yield, else the sheet's figure, else coupon ÷ purchase price. */
export function displayYield(b: PricedBond): { value: number; source: "live" | "sheet" | "derived" } {
  if (b.live) return { value: b.live.marketYield, source: "live" };
  if (b.sheetYield !== null) return { value: b.sheetYield, source: "sheet" };
  return { value: annualCoupon(b) / b.price, source: "derived" };
}

export function summarize(bonds: PricedBond[]) {
  const invested = bonds.reduce((s, b) => s + b.price, 0);
  const income = bonds.reduce((s, b) => s + annualCoupon(b), 0);
  const priced = bonds.filter((b) => b.live !== null);
  const presentValue = priced.reduce((s, b) => s + b.live!.presentValue, 0);
  const capitalGain = priced.reduce((s, b) => s + b.live!.capitalGain, 0);
  const ytms = bonds.map((b) => yearsToMaturity(b)).filter((y): y is number => y !== null);
  const weightedYears = invested
    ? bonds.reduce((s, b) => s + (yearsToMaturity(b) ?? 0) * b.price, 0) / invested
    : 0;
  return {
    invested, income, presentValue, capitalGain, weightedYears,
    count: bonds.length, pricedCount: priced.length,
    longest: ytms.length ? Math.max(...ytms) : null,
  };
}

/** Plain grouped integer, e.g. 1,080,187 — all amounts are BDT. */
export const fmtBDT = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n));
export const fmtSigned = (n: number) => (n >= 0 ? "+" : "−") + fmtBDT(Math.abs(n));
export const fmtPct = (n: number, d = 2) => `${(n * 100).toFixed(d)}%`;
export const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
