import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_PROJECT_REF = "juutwixhxutrqetzjryc";
/** Dashboard table editor — this is where holdings are edited now (no in-app editing). */
export const holdingsEditorUrl = `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/editor`;

let client: SupabaseClient | null = null;

/** Server-side Supabase client (anon key; RLS grants read-only access — all writes go through the edge function). */
export function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set (see .env.example)");
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Defeat Next's per-render fetch memoization (keyed on URL + options): the quote table can change
    // mid-render after an on-demand refresh, so the re-read must really hit PostgREST again.
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: "no-store",
          headers: { ...Object.fromEntries(new Headers(init?.headers).entries()), "x-request-id": crypto.randomUUID() },
        }),
    },
  });
  return client;
}
