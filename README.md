# my-bond-analyzer

Next.js app that shows a Bangladesh T-bond portfolio: invested capital, present value at live
market yields, capital gain and coupon income.

## Data

Everything is served from the Supabase project **bond-analyzer** (`juutwixhxutrqetzjryc`, ap-south-1):

| Table            | What                                                                        | Written by                    |
| ---------------- | --------------------------------------------------------------------------- | ----------------------------- |
| `holdings`       | Your bonds (title, ISIN, purchase date/price, coupon rate). Was the Google Sheet. | You, in the Supabase table editor |
| `gsom_quotes`    | Latest Bangladesh Bank GSOM quote per ISIN (yield, clean price, coupon dates) | `refresh-gsom` edge function  |
| `gsom_refreshes` | One row per refresh attempt (source, status, quote count, error)            | `refresh-gsom` edge function  |

Bond titles like `15Y BGTB 16/01/2028` are parsed for tenor and maturity date. Rates are stored as
fractions (`0.122` = 12.20%), prices in BDT.

### How quotes stay fresh

The app **never scrapes GSOM directly**. It reads `gsom_quotes` and:

- if the newest `fetched_at` is under 24 h old → serves it as-is (a page load is ~2 small reads);
- otherwise → invokes the `refresh-gsom` edge function, which scrapes
  <https://gsom.bb.org.bd/index.php/tbond>, atomically replaces `gsom_quotes` via `replace_gsom_quotes()`,
  logs the run, and the app re-reads. If that fails, the last cached quotes are shown with a warning.

A **pg_cron job** (`refresh-gsom-daily`, `0 11 * * *` = 17:00 Dhaka, after the trading day) calls the same
function through `pg_net`, so in normal operation the on-demand path is never taken. The function refuses
to re-scrape within 10 minutes of the last successful run unless `{"force":true}` is passed.

Edge function source: `supabase/functions/refresh-gsom/` — `gsom-parse.ts` is the HTML parser and is
also imported by the Next app (`src/lib/bb.ts`), so there is a single parser. SQL applied to the project
lives in `supabase/migrations/`.

### Editing holdings

Open the table editor (the "Supabase" link in the app header) and edit `public.holdings`. Columns:
`title`, `isin`, `purchase_date`, `purchase_price` (BDT), `coupon_rate` (fraction), optional `current_yield`.

### Access model

RLS is on for all three tables. The anon key (used by the app) can only `SELECT`; the edge function runs
with the service role and is the only writer. `replace_gsom_quotes()` is executable by `service_role` only.

## Run

```bash
cp .env.example .env.local   # then paste the project's anon key into SUPABASE_ANON_KEY
npm install
npm run dev
```

## Useful queries

```sql
-- last few refreshes
select * from public.gsom_refreshes order by id desc limit 10;
-- scheduler status / history
select * from cron.job;  select * from cron.job_run_details order by start_time desc limit 10;
-- force a refresh right now
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'refresh_gsom_url'),
  headers := jsonb_build_object('Content-Type','application/json',
    'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key')),
  body := '{"source":"manual","force":true}'::jsonb, timeout_milliseconds := 60000);
```

Present value discounts each remaining semi-annual coupon and the principal at BB's market yield
(matches BB's published clean prices), includes accrued coupon; capital gain = present value − purchase price.
