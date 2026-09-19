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
  /** Manually entered current yield (fraction) from the holdings table, if filled in */
  manualYield: number | null;
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

/** "15Y BGTB 16/01/2028" → { tenor: 15, maturity: 2028-01-16 } */
export function parseTitle(title: string) {
  const tenor = title.match(/(\d+)\s*Y\b/i);
  const date = title.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return {
    tenorYears: tenor ? Number(tenor[1]) : null,
    maturity: date ? new Date(Date.UTC(+date[3], +date[2] - 1, +date[1])) : null,
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

/** Human-friendly holding period since purchase, e.g. "4 mo", "1 yr 2 mo", "12 d". */
export function timeHeld(b: Bond, now = new Date()): string | null {
  if (!b.purchaseDate || b.purchaseDate.getTime() > now.getTime()) return null;
  const from = b.purchaseDate;
  let months = (now.getUTCFullYear() - from.getUTCFullYear()) * 12 + (now.getUTCMonth() - from.getUTCMonth());
  if (now.getUTCDate() < from.getUTCDate()) months--;
  if (months < 1) {
    const days = Math.floor((now.getTime() - from.getTime()) / 86_400_000);
    return `${days} d`;
  }
  const y = Math.floor(months / 12), m = months % 12;
  return [y ? `${y} yr` : "", m ? `${m} mo` : ""].filter(Boolean).join(" ");
}

export function daysHeld(b: Bond, now = new Date()): number | null {
  if (!b.purchaseDate) return null;
  return Math.max(0, Math.floor((now.getTime() - b.purchaseDate.getTime()) / 86_400_000));
}

/** Flat, JSON-serialisable view of a holding for client components. */
export interface BondRow {
  title: string;
  isin: string;
  purchaseDate: string | null;
  timeHeld: string | null;
  daysHeld: number | null;
  price: number;
  couponRate: number;
  yieldValue: number;
  yieldSource: "live" | "manual" | "derived";
  presentValue: number | null;
  capitalGain: number | null;
  gainPct: number | null;
  accrued: number | null;
  bbCleanPrice: number | null;
  annualIncome: number;
  maturity: string | null;
  yearsLeft: number | null;
}

export function toRow(b: PricedBond, now = new Date()): BondRow {
  const y = displayYield(b);
  return {
    title: b.title,
    isin: b.isin,
    purchaseDate: b.purchaseDate ? fmtDate(b.purchaseDate) : null,
    timeHeld: timeHeld(b, now),
    daysHeld: daysHeld(b, now),
    price: b.price,
    couponRate: b.couponRate,
    yieldValue: y.value,
    yieldSource: y.source,
    presentValue: b.live?.presentValue ?? null,
    capitalGain: b.live?.capitalGain ?? null,
    gainPct: b.live ? b.live.capitalGain / b.price : null,
    accrued: b.live?.accrued ?? null,
    bbCleanPrice: b.live?.bbCleanPrice ?? null,
    annualIncome: annualCoupon(b),
    maturity: b.maturity ? fmtDate(b.maturity) : null,
    yearsLeft: yearsToMaturity(b, now),
  };
}

export function annualCoupon(b: Bond): number {
  return unitsHeld(b) * FACE_VALUE * b.couponRate;
}

/** Yield to show: live market yield, else the manually entered figure, else coupon ÷ purchase price. */
export function displayYield(b: PricedBond): { value: number; source: "live" | "manual" | "derived" } {
  if (b.live) return { value: b.live.marketYield, source: "live" };
  if (b.manualYield !== null) return { value: b.manualYield, source: "manual" };
  return { value: annualCoupon(b) / b.price, source: "derived" };
}

export function summarize(bonds: PricedBond[]) {
  const invested = bonds.reduce((s, b) => s + b.price, 0);
  const income = bonds.reduce((s, b) => s + annualCoupon(b), 0);
  const priced = bonds.filter((b) => b.live !== null);
  const presentValue = priced.reduce((s, b) => s + b.live!.presentValue, 0);
  const capitalGain = priced.reduce((s, b) => s + b.live!.capitalGain, 0);
  return { invested, income, presentValue, capitalGain, count: bonds.length, pricedCount: priced.length };
}

/** Plain grouped integer, e.g. 1,080,187 — all amounts are BDT. */
export const fmtBDT = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n));
export const fmtSigned = (n: number) => (n >= 0 ? "+" : "−") + fmtBDT(Math.abs(n));
export const fmtPct = (n: number, d = 2) => `${(n * 100).toFixed(d)}%`;
export const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
