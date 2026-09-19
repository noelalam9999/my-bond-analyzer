-- Atomically replace the GSOM quote table with a fresh snapshot (called by the refresh-gsom edge function).
-- p_quotes: jsonb array of {isin,name,coupon_rate,coupons_per_year,last_coupon,next_coupon,maturity,market_yield,market_price}
create or replace function public.replace_gsom_quotes(p_quotes jsonb, p_as_of date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_now timestamptz := now();
begin
  create temp table _incoming on commit drop as
  select
    q.isin, q.name, q.coupon_rate, q.coupons_per_year,
    q.last_coupon, q.next_coupon, q.maturity, q.market_yield, q.market_price
  from jsonb_to_recordset(p_quotes) as q(
    isin text, name text, coupon_rate numeric, coupons_per_year smallint,
    last_coupon date, next_coupon date, maturity date, market_yield numeric, market_price numeric
  );

  select count(*) into v_count from _incoming;
  if v_count = 0 then
    raise exception 'refusing to replace gsom_quotes with an empty snapshot';
  end if;

  delete from public.gsom_quotes where isin not in (select isin from _incoming);

  insert into public.gsom_quotes as g
    (isin, name, coupon_rate, coupons_per_year, last_coupon, next_coupon, maturity, market_yield, market_price, as_of, fetched_at)
  select isin, name, coupon_rate, coupons_per_year, last_coupon, next_coupon, maturity, market_yield, market_price, p_as_of, v_now
  from _incoming
  on conflict (isin) do update set
    name = excluded.name, coupon_rate = excluded.coupon_rate, coupons_per_year = excluded.coupons_per_year,
    last_coupon = excluded.last_coupon, next_coupon = excluded.next_coupon, maturity = excluded.maturity,
    market_yield = excluded.market_yield, market_price = excluded.market_price,
    as_of = excluded.as_of, fetched_at = excluded.fetched_at;

  return v_count;
end $$;

revoke all on function public.replace_gsom_quotes(jsonb, date) from public, anon, authenticated;
grant execute on function public.replace_gsom_quotes(jsonb, date) to service_role;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net  with schema extensions;
