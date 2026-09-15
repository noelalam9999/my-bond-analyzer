export interface Bond {
  title: string;
  isin: string;
  /** Purchase price in BDT */
  price: number;
  /** Annual coupon rate as a fraction, e.g. 0.122 */
  couponRate: number;
  /** Current yield from the sheet (fraction) or, if blank, derived as coupon / price on par */
  currentYield: number | null;
  /** Tenor in years parsed from the title, e.g. "15Y" → 15 */
  tenorYears: number | null;
  maturity: Date | null;
}

const FACE_VALUE = 100_000; // BGTB face value per unit, BDT

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
  title: string; isin: string; price: string; coupon: string; currentYield: string;
}): Bond | null {
  if (!r.title.trim()) return null;
  const price = parseNumber(r.price);
  const couponRate = parseRate(r.coupon);
  if (!Number.isFinite(price) || !Number.isFinite(couponRate)) return null;
  const cy = parseRate(r.currentYield);
  return {
    title: r.title.trim(),
    isin: r.isin.trim(),
    price,
    couponRate,
    currentYield: Number.isFinite(cy) ? cy : null,
    ...parseTitle(r.title),
  };
}

export function yearsToMaturity(b: Bond, now = new Date()): number | null {
  if (!b.maturity) return null;
  return (b.maturity.getTime() - now.getTime()) / (365.25 * 24 * 3600 * 1000);
}

/** Annual coupon income assuming price ≈ face value held (BGTBs are issued in 100k lots). */
export function annualCoupon(b: Bond): number {
  const units = Math.round(b.price / FACE_VALUE) || b.price / FACE_VALUE;
  return units * FACE_VALUE * b.couponRate;
}

export function effectiveYield(b: Bond): number {
  return b.currentYield ?? annualCoupon(b) / b.price;
}

export function summarize(bonds: Bond[]) {
  const invested = bonds.reduce((s, b) => s + b.price, 0);
  const income = bonds.reduce((s, b) => s + annualCoupon(b), 0);
  const weightedCoupon = invested ? bonds.reduce((s, b) => s + b.couponRate * b.price, 0) / invested : 0;
  const ytms = bonds.map((b) => yearsToMaturity(b)).filter((y): y is number => y !== null);
  const weightedYears = invested
    ? bonds.reduce((s, b) => s + (yearsToMaturity(b) ?? 0) * b.price, 0) / invested
    : 0;
  return { invested, income, weightedCoupon, weightedYears, count: bonds.length, longest: ytms.length ? Math.max(...ytms) : null };
}

export const fmtBDT = (n: number) =>
  new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 0 }).format(n);
export const fmtPct = (n: number, d = 2) => `${(n * 100).toFixed(d)}%`;
export const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
