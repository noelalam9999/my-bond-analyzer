/**
 * Bangladesh Bank GSOM quotes, served from Supabase.
 *
 * The `gsom_quotes` table is refreshed once a day by pg_cron → the `refresh-gsom` edge function.
 * If the app finds the cached quotes older than MAX_AGE_MS (or empty), it asks that same function to
 * refresh on demand, then re-reads. GSOM is never scraped from here directly.
 */
import type { BBQuote, BBSnapshot } from "../../supabase/functions/refresh-gsom/gsom-parse";
import { supabase } from "./supabase";

export { BB_TBOND_URL } from "../../supabase/functions/refresh-gsom/gsom-parse";
export type { BBQuote, BBSnapshot };

export const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface CachedSnapshot extends BBSnapshot {
  /** When the quotes were last pulled from GSOM (null when the table is empty) */
  fetchedAt: Date | null;
  /** True when quotes are older than MAX_AGE_MS and the on-demand refresh didn't succeed */
  stale: boolean;
  /** Error from the on-demand refresh, if one was attempted and failed */
  refreshError: string | null;
}

interface QuoteRow {
  isin: string;
  name: string;
  coupon_rate: number | string;
  coupons_per_year: number;
  last_coupon: string | null;
  next_coupon: string | null;
  maturity: string | null;
  market_yield: number | string;
  market_price: number | string;
  as_of: string | null;
  fetched_at: string;
}

const isoToDate = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`) : null);

async function readQuotes(): Promise<Omit<CachedSnapshot, "stale" | "refreshError">> {
  const { data, error } = await supabase().from("gsom_quotes").select("*");
  if (error) throw new Error(`Quotes query failed: ${error.message}`);
  const rows = (data ?? []) as QuoteRow[];
  const quotes = new Map<string, BBQuote>();
  let asOf: Date | null = null;
  let fetchedAt: Date | null = null;
  for (const r of rows) {
    quotes.set(r.isin, {
      isin: r.isin,
      name: r.name,
      couponRate: Number(r.coupon_rate),
      couponsPerYear: r.coupons_per_year,
      lastCoupon: isoToDate(r.last_coupon),
      nextCoupon: isoToDate(r.next_coupon),
      maturity: isoToDate(r.maturity),
      marketYield: Number(r.market_yield),
      marketPrice: Number(r.market_price),
    });
    const f = new Date(r.fetched_at);
    if (!fetchedAt || f > fetchedAt) { fetchedAt = f; asOf = isoToDate(r.as_of); }
  }
  return { asOf, quotes, fetchedAt };
}

/** Ask the edge function to re-scrape GSOM now. Resolves to an error message, or null on success/skip. */
async function requestRefresh(): Promise<string | null> {
  const { data, error } = await supabase().functions.invoke("refresh-gsom", { body: { source: "app" } });
  if (error) return error.message;
  if (data && data.ok === false) return String(data.error ?? "refresh failed");
  return null;
}

export const isFresh = (fetchedAt: Date | null, now = Date.now()) =>
  fetchedAt !== null && now - fetchedAt.getTime() < MAX_AGE_MS;

export async function fetchBBQuotes(): Promise<CachedSnapshot> {
  let snap = await readQuotes();
  if (isFresh(snap.fetchedAt)) return { ...snap, stale: false, refreshError: null };

  const refreshError = await requestRefresh();
  if (!refreshError) snap = await readQuotes();
  return { ...snap, stale: !isFresh(snap.fetchedAt), refreshError };
}
