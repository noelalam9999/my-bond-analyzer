import type { Bond } from "./bonds";
import { parseTitle } from "./bonds";
import { supabase } from "./supabase";

interface HoldingRow {
  title: string;
  isin: string;
  purchase_date: string | null;
  purchase_price: number | string;
  coupon_rate: number | string;
  current_yield: number | string | null;
}

const isoToDate = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`) : null);

/** Holdings from the `holdings` table (rates stored as fractions, prices in BDT). */
export async function fetchBonds(): Promise<Bond[]> {
  const { data, error } = await supabase()
    .from("holdings")
    .select("title, isin, purchase_date, purchase_price, coupon_rate, current_yield")
    .order("purchase_date", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(`Holdings query failed: ${error.message}`);
  return ((data ?? []) as HoldingRow[]).map((r) => ({
    title: r.title,
    isin: r.isin,
    purchaseDate: isoToDate(r.purchase_date),
    price: Number(r.purchase_price),
    couponRate: Number(r.coupon_rate),
    manualYield: r.current_yield === null ? null : Number(r.current_yield),
    ...parseTitle(r.title),
  }));
}
