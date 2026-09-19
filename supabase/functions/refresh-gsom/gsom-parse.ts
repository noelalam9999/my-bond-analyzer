/**
 * Parser for Bangladesh Bank's GSOM T-bond page (https://gsom.bb.org.bd/index.php/tbond).
 * Dependency-free so it runs unchanged in the Supabase Edge Function (Deno) and in Next.js.
 */
export const BB_TBOND_URL = "https://gsom.bb.org.bd/index.php/tbond";

export interface BBQuote {
  isin: string;
  name: string;
  /** Annual coupon rate, fraction */
  couponRate: number;
  /** Coupons per year (HFLY = 2) */
  couponsPerYear: number;
  lastCoupon: Date | null;
  nextCoupon: Date | null;
  maturity: Date | null;
  /** Market yield, fraction (bond-equivalent, compounded per coupon period) */
  marketYield: number;
  /** BB's clean market price per 100 face */
  marketPrice: number;
}

export interface BBSnapshot {
  asOf: Date | null;
  quotes: Map<string, BBQuote>;
}

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

/** "16-JAN-2027" or "16-SEP-26" → UTC date */
export function parseBBDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (!m) return null;
  const mon = MONTHS[m[2].toUpperCase()];
  if (mon === undefined) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return new Date(Date.UTC(year, mon, Number(m[1])));
}

const num = (s: string) => Number(s.replace(/,/g, ""));
const strip = (h: string) =>
  h.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();

export function parseBBPage(htmlText: string): BBSnapshot {
  const asOfMatch = htmlText.match(/Date:\s*(\d{1,2}-[A-Za-z]{3}-\d{2,4})/);
  const asOf = asOfMatch ? parseBBDate(asOfMatch[1]) : null;

  const start = htmlText.indexOf("<table");
  const end = htmlText.indexOf("</table>", start);
  const table = start >= 0 && end >= 0 ? htmlText.slice(start, end) : "";

  const headers = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => strip(m[1]).toLowerCase());
  const col = (name: string) => headers.findIndex((h) => h.replace(/\s/g, "").startsWith(name.toLowerCase()));
  const idx = {
    isin: col("isin"),
    name: col("securitiesname"),
    coupon: col("couponrate"),
    freq: col("couponfreq"),
    last: col("lastcoupon"),
    next: col("nextcoupon"),
    maturity: col("maturity"),
    yld: col("marketyield"),
    price: col("marketprice"),
  };

  const quotes = new Map<string, BBQuote>();
  for (const row of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => strip(m[1]));
    if (!cells.length) continue;
    const isin = cells[idx.isin];
    if (!/^BD[0-9A-Z]{10}$/.test(isin ?? "")) continue;
    const marketYield = num(cells[idx.yld] ?? "");
    const marketPrice = num(cells[idx.price] ?? "");
    const couponRate = num(cells[idx.coupon] ?? "");
    if (![marketYield, marketPrice, couponRate].every(Number.isFinite)) continue;
    const freq = (cells[idx.freq] ?? "").toUpperCase();
    quotes.set(isin, {
      isin,
      name: cells[idx.name] ?? "",
      couponRate: couponRate / 100,
      couponsPerYear: freq.startsWith("Q") ? 4 : freq.startsWith("A") || freq.startsWith("Y") ? 1 : 2,
      lastCoupon: parseBBDate(cells[idx.last] ?? ""),
      nextCoupon: parseBBDate(cells[idx.next] ?? ""),
      maturity: parseBBDate(cells[idx.maturity] ?? ""),
      marketYield: marketYield / 100,
      marketPrice,
    });
  }
  return { asOf, quotes };
}

/** Fetch and parse the live GSOM page. Throws if unreachable or if no bond rows were found. */
export async function scrapeGSOM(timeoutMs = 20_000): Promise<BBSnapshot> {
  const res = await fetch(BB_TBOND_URL, {
    cache: "no-store",
    headers: { "user-agent": "Mozilla/5.0 (bond-analyzer)" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Bangladesh Bank fetch failed: ${res.status} ${res.statusText}`);
  const snap = parseBBPage(await res.text());
  if (snap.quotes.size === 0) throw new Error("Bangladesh Bank page returned no bond rows");
  return snap;
}
