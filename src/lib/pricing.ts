import type { BBQuote } from "./bb";

export interface Valuation {
  /** Full (dirty) price per 100 face: PV of all remaining cashflows at the market yield */
  dirtyPrice: number;
  /** Accrued coupon per 100 face since the last coupon date */
  accrued: number;
  /** Clean price per 100 face (dirty − accrued) */
  cleanPrice: number;
  /** Number of coupons still to be paid, including the one at maturity */
  couponsLeft: number;
}

function addMonths(d: Date, months: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
}

/**
 * Prices a fixed-coupon bond per 100 face by discounting each remaining coupon
 * (and principal at maturity) at the market yield, compounded per coupon period.
 * Fractional first period uses actual-day accrual between the last and next coupon dates.
 */
export function valueBond(q: BBQuote, now = new Date()): Valuation | null {
  const { nextCoupon, lastCoupon, maturity, couponsPerYear } = q;
  if (!nextCoupon || !maturity) return null;
  const c = (100 * q.couponRate) / couponsPerYear;
  const y = q.marketYield / couponsPerYear;
  const step = 12 / couponsPerYear;

  const prev = lastCoupon ?? addMonths(nextCoupon, -step);
  const periodMs = nextCoupon.getTime() - prev.getTime();
  const elapsed = Math.min(Math.max((now.getTime() - prev.getTime()) / periodMs, 0), 1);

  let dirty = 0;
  let k = 0;
  for (let d = nextCoupon; d.getTime() <= maturity.getTime() + 86_400_000; d = addMonths(d, step)) {
    k++;
    const isLast = addMonths(d, step).getTime() > maturity.getTime() + 86_400_000;
    const cf = c + (isLast ? 100 : 0);
    dirty += cf / Math.pow(1 + y, k - elapsed);
    if (isLast) break;
  }
  const accrued = c * elapsed;
  return { dirtyPrice: dirty, accrued, cleanPrice: dirty - accrued, couponsLeft: k };
}
