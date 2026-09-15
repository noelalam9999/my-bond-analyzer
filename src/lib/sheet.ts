import type { Bond } from "./bonds";
import { parseBondRow } from "./bonds";

const SHEET_ID = process.env.SHEET_ID ?? "10t4biyDJzNzo6s3_fU-_2HLHviVGyetz8Ab9U6Y3MY0";
const SHEET_GID = process.env.SHEET_GID ?? "0";

export const sheetUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${SHEET_GID}`;
const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

/** Minimal RFC-4180 CSV parser (handles quoted fields, embedded commas/newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

export async function fetchBonds(): Promise<Bond[]> {
  const res = await fetch(csvUrl, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status} ${res.statusText}`);
  const [header, ...rows] = parseCsv(await res.text());
  const col = (name: string) =>
    header.findIndex((h) => h.trim().toLowerCase().startsWith(name.toLowerCase()));
  const idx = {
    title: col("Bond Title"),
    isin: col("ISIN"),
    price: col("Purchase Price"),
    coupon: col("Coupon Rate"),
    yieldCol: col("Current Yield"),
  };
  return rows
    .map((r) =>
      parseBondRow({
        title: r[idx.title] ?? "",
        isin: r[idx.isin] ?? "",
        price: r[idx.price] ?? "",
        coupon: r[idx.coupon] ?? "",
        currentYield: r[idx.yieldCol] ?? "",
      })
    )
    .filter((b): b is Bond => b !== null);
}
