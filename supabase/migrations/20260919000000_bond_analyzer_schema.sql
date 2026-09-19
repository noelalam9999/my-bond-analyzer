-- Holdings: what used to live in the Google Sheet.
create table public.holdings (
  id             bigint generated always as identity primary key,
  title          text        not null,
  isin           text        not null,
  purchase_date  date,
  purchase_price numeric(18,2) not null check (purchase_price > 0),
  coupon_rate    numeric(8,6)  not null check (coupon_rate >= 0 and coupon_rate < 1), -- fraction, 0.122 = 12.20%
  current_yield  numeric(8,6)  check (current_yield is null or (current_yield >= 0 and current_yield < 1)),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.holdings is 'Bond holdings (was the Google Sheet). Rates are fractions, prices in BDT.';
create index holdings_isin_idx on public.holdings (isin);

-- Latest Bangladesh Bank GSOM T-bond quote per ISIN (replaced on every refresh).
create table public.gsom_quotes (
  isin             text primary key check (isin ~ '^BD[0-9A-Z]{10}$'),
  name             text not null,
  coupon_rate      numeric(8,6) not null,   -- fraction
  coupons_per_year smallint not null default 2,
  last_coupon      date,
  next_coupon      date,
  maturity         date,
  market_yield     numeric(8,6) not null,   -- fraction
  market_price     numeric(12,4) not null,  -- clean price per 100 face
  as_of            date,                    -- "Date:" printed on the GSOM page
  fetched_at       timestamptz not null default now()
);
comment on table public.gsom_quotes is 'Latest quote per ISIN from https://gsom.bb.org.bd/index.php/tbond. Stale after 24h.';
create index gsom_quotes_fetched_at_idx on public.gsom_quotes (fetched_at desc);

-- One row per refresh attempt (scheduler or on-demand), for observability.
create table public.gsom_refreshes (
  id          bigint generated always as identity primary key,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  source      text not null check (source in ('cron', 'app', 'manual')),
  status      text not null default 'running' check (status in ('running', 'ok', 'error')),
  as_of       date,
  quote_count integer,
  error       text
);
create index gsom_refreshes_started_at_idx on public.gsom_refreshes (started_at desc);

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger holdings_set_updated_at before update on public.holdings
  for each row execute function public.set_updated_at();

-- RLS: the app reads with the anon key; only the service role (edge function) writes.
alter table public.holdings       enable row level security;
alter table public.gsom_quotes    enable row level security;
alter table public.gsom_refreshes enable row level security;

create policy "public read holdings"  on public.holdings       for select to anon, authenticated using (true);
create policy "public read quotes"    on public.gsom_quotes    for select to anon, authenticated using (true);
create policy "public read refreshes" on public.gsom_refreshes for select to anon, authenticated using (true);
