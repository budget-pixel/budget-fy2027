-- FY2026 Original Budget public cache + view.
-- transactions_raw also carries the FY2026 original budget load (src = 'BUC'),
-- alongside actual transaction rows. This migration aggregates only those
-- rows into a public-safe summary cache, never exposing transactions_raw
-- itself to browser roles. Pattern mirrors expense_actuals_public /
-- revenue_actuals_public: a cache table (Option 3 -- RLS-enabled, directly
-- selectable because it only ever contains safe summary fields) plus a thin
-- security_invoker view on top, so frontend code keeps querying a "_public"
-- suffixed name consistently with the other actuals views.

create table if not exists public.expense_original_budget_cache (
  id bigint generated always as identity primary key,
  year integer not null,
  org text,
  object text,
  project text not null default '',
  amount numeric(14, 2) not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.expense_original_budget_cache is
  'Public-safe FY2026 original budget summary, aggregated from transactions_raw (year = 2026, src = ''BUC'') by org/object/project. Contains only summary fields -- no vendor/description/document text -- so it is directly selectable by anon/authenticated (Option 3 pattern), unlike transactions_raw which stays private.';

create unique index if not exists expense_original_budget_cache_dim_uidx
  on public.expense_original_budget_cache (year, org, object, project);

alter table public.expense_original_budget_cache enable row level security;

drop policy if exists "Public can read original budget cache" on public.expense_original_budget_cache;
create policy "Public can read original budget cache"
  on public.expense_original_budget_cache
  for select
  to anon, authenticated
  using (true);

grant usage on schema public to anon, authenticated;
grant select on public.expense_original_budget_cache to anon, authenticated;

-- Public view: same shape/contract as expense_actuals_public and
-- revenue_actuals_public, so existing frontend loadSummaryRows(viewName)
-- works unchanged against this new view name.
drop view if exists public.expense_original_budget_public;
create view public.expense_original_budget_public
with (security_invoker = true)
as
select
  year,
  org,
  object,
  project,
  amount
from public.expense_original_budget_cache;

comment on view public.expense_original_budget_public is
  'Public FY2026 original budget summary (year, org, object, project, amount). security_invoker = true so it runs with the querying role''s own permissions/RLS rather than the view owner''s.';

grant select on public.expense_original_budget_public to anon, authenticated;

-- Defense in depth: transactions_raw must never be reachable by browser
-- roles, regardless of which migration created it or ran first.
do $$
begin
  if to_regclass('public.transactions_raw') is not null then
    revoke all on table public.transactions_raw from anon, authenticated;
    execute 'alter table public.transactions_raw enable row level security';
  end if;
end $$;

drop function if exists public.refresh_expense_original_budget(boolean);

create or replace function public.refresh_expense_original_budget(
  _dry_run boolean default false
)
returns table(
  dry_run boolean,
  rows_in_cache_before integer,
  rows_in_cache_after integer,
  total_amount numeric(14, 2)
)
language plpgsql
security definer
set search_path = public
as $$
declare
  source_reg regclass;
  before_count integer;
  after_count integer;
  total numeric(14, 2);
begin
  source_reg := to_regclass('public.transactions_raw');
  if source_reg is null then
    raise exception 'No raw transaction source found. Expected public.transactions_raw.';
  end if;

  select count(*) into before_count from public.expense_original_budget_cache;

  if _dry_run then
    select
      count(*)::integer,
      coalesce(sum(agg.amount), 0)::numeric(14, 2)
    into after_count, total
    from (
      select
        2026 as year,
        coalesce(trim(t.org::text), '') as org,
        coalesce(trim(t.object::text), '') as object,
        coalesce(trim(t.project::text), '') as project,
        sum(coalesce(t.amount, 0)) as amount
      from public.transactions_raw t
      where nullif(regexp_replace(coalesce(t.year::text, ''), '[^0-9]', '', 'g'), '')::integer = 2026
        and trim(t.src::text) = 'BUC'
      group by
        coalesce(trim(t.org::text), ''),
        coalesce(trim(t.object::text), ''),
        coalesce(trim(t.project::text), '')
    ) agg;

    dry_run := true;
    rows_in_cache_before := before_count;
    rows_in_cache_after := after_count;
    total_amount := total;
    return next;
    return;
  end if;

  truncate table public.expense_original_budget_cache;

  insert into public.expense_original_budget_cache (year, org, object, project, amount)
  select
    2026 as year,
    coalesce(trim(t.org::text), '') as org,
    coalesce(trim(t.object::text), '') as object,
    coalesce(trim(t.project::text), '') as project,
    sum(coalesce(t.amount, 0))::numeric(14, 2) as amount
  from public.transactions_raw t
  where nullif(regexp_replace(coalesce(t.year::text, ''), '[^0-9]', '', 'g'), '')::integer = 2026
    and trim(t.src::text) = 'BUC'
  group by
    coalesce(trim(t.org::text), ''),
    coalesce(trim(t.object::text), ''),
    coalesce(trim(t.project::text), '');

  select count(*), coalesce(sum(amount), 0)
  into after_count, total
  from public.expense_original_budget_cache;

  dry_run := false;
  rows_in_cache_before := before_count;
  rows_in_cache_after := after_count;
  total_amount := total;
  return next;
end;
$$;

revoke all on function public.refresh_expense_original_budget(boolean) from public;
grant execute on function public.refresh_expense_original_budget(boolean) to service_role;

comment on function public.refresh_expense_original_budget(boolean) is
  'Idempotently rebuilds expense_original_budget_cache from transactions_raw (year = 2026, src = ''BUC''), aggregated by org/object/project. Truncates and reinserts on each run (safe to rerun any time the BUC load changes). Pass _dry_run = true to see expected row count/total without writing.';
