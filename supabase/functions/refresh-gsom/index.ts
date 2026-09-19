/**
 * refresh-gsom — scrapes Bangladesh Bank's GSOM T-bond page and replaces `gsom_quotes`.
 *
 * Called by pg_cron once a day and by the Next.js app when the cached quotes are >24h old.
 * The only writer of GSOM data; the app itself is read-only.
 *
 * POST body (optional): { "source": "cron" | "app" | "manual", "force": boolean }
 * Runs are skipped (200, skipped:true) if the last successful refresh was under MIN_INTERVAL_MIN ago,
 * unless force is set — this keeps a misbehaving client from hammering GSOM.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { scrapeGSOM, type BBQuote } from "./gsom-parse.ts";

const MIN_INTERVAL_MIN = 10;
const SOURCES = new Set(["cron", "app", "manual"]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const toRow = (q: BBQuote) => ({
  isin: q.isin,
  name: q.name,
  coupon_rate: q.couponRate,
  coupons_per_year: q.couponsPerYear,
  last_coupon: isoDate(q.lastCoupon),
  next_coupon: isoDate(q.nextCoupon),
  maturity: isoDate(q.maturity),
  market_yield: q.marketYield,
  market_price: q.marketPrice,
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: { source?: string; force?: boolean } = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }
  const source = SOURCES.has(body.source ?? "") ? body.source! : "manual";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Throttle: skip if a successful refresh finished recently.
  if (!body.force) {
    const { data: last } = await supabase
      .from("gsom_refreshes")
      .select("finished_at")
      .eq("status", "ok")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const ageMin = last?.finished_at ? (Date.now() - new Date(last.finished_at).getTime()) / 60_000 : Infinity;
    if (ageMin < MIN_INTERVAL_MIN) {
      return json({ skipped: true, reason: `refreshed ${ageMin.toFixed(1)} min ago`, lastRefresh: last!.finished_at });
    }
  }

  const { data: run, error: logErr } = await supabase
    .from("gsom_refreshes")
    .insert({ source })
    .select("id")
    .single();
  if (logErr) return json({ error: `could not log run: ${logErr.message}` }, 500);

  const finish = (patch: Record<string, unknown>) =>
    supabase.from("gsom_refreshes").update({ finished_at: new Date().toISOString(), ...patch }).eq("id", run.id);

  try {
    const snap = await scrapeGSOM();
    const asOf = isoDate(snap.asOf);
    const { data: count, error } = await supabase.rpc("replace_gsom_quotes", {
      p_quotes: [...snap.quotes.values()].map(toRow),
      p_as_of: asOf,
    });
    if (error) throw new Error(`replace_gsom_quotes: ${error.message}`);

    await finish({ status: "ok", as_of: asOf, quote_count: count });
    return json({ ok: true, runId: run.id, source, asOf, quoteCount: count });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await finish({ status: "error", error: message });
    return json({ ok: false, runId: run.id, source, error: message }, 502);
  }
});
