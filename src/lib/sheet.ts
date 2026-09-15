import type { Bond } from "./bonds";
import { parseBondRow } from "./bonds";

const DEFAULT_SHEET_ID = "10t4biyDJzNzo6s3_fU-_2HLHviVGyetz8Ab9U6Y3MY0";

/** Accepts a bare sheet ID or a full docs.google.com URL; tolerates stray quotes/whitespace. */
function resolveSheet(rawId?: string, rawGid?: string) {
  const clean = (v?: string) => (v ?? "").trim().replace(/^["']|["']$/g, "");
  const id = clean(rawId);
  const fromUrl = id.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  const gidFromUrl = id.match(/[?#&]gid=(\d+)/);
  return {
    id: fromUrl?.[1] ?? (id || DEFAULT_SHEET_ID),
    gid: clean(rawGid) || gidFromUrl?.[1] || "0",
  };
}

const { id: SHEET_ID, gid: SHEET_GID } = resolveSheet(process.env.SHEET_ID, process.env.SHEET_GID);

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
  if (!res.ok) {
    const hint = res.status === 404 ? ` (sheet ID "${SHEET_ID}" not found — check SHEET_ID)` : "";
    throw new Error(`Sheet fetch failed: ${res.status} ${res.statusText}${hint}`);
  }
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
