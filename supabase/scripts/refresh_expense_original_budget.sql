-- Repeatable refresh + validation for the FY2026 original budget cache.
-- Safe to rerun: refresh_expense_original_budget(false) truncates and
-- rebuilds expense_original_budget_cache from transactions_raw each time.

-- Dry run: reports expected row count/total without writing to the cache.
select *
from public.refresh_expense_original_budget(true);

-- Actual refresh.
select *
from public.refresh_expense_original_budget(false);

-- 1. Row count in expense_original_budget_cache.
select count(*) as cache_row_count
from public.expense_original_budget_cache;

-- 2. Row count in expense_original_budget_public (should match #1 exactly --
--    the view is a 1:1 passthrough of the cache).
select count(*) as public_view_row_count
from public.expense_original_budget_public;

-- 3. Sample rows where year = 2026.
select year, org, object, project, amount
from public.expense_original_budget_public
where year = 2026
order by org, object, project
limit 25;

-- 4. Total amount grouped by org/object/project (sanity check against #3 --
--    should be one row per dimension combination, no further aggregation
--    needed since the cache is already grouped at this grain).
select org, object, project, sum(amount) as total_amount
from public.expense_original_budget_public
group by org, object, project
order by org, object, project;

-- 5. Confirm transactions_raw remains private: this should return zero rows.
--    Any row here means anon/authenticated has a grant on transactions_raw
--    and the lockdown has regressed.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'transactions_raw'
  and grantee in ('anon', 'authenticated');

-- 5b. Confirm RLS is enabled on transactions_raw (expect rowsecurity = true).
select relname, relrowsecurity
from pg_class
where oid = to_regclass('public.transactions_raw');
