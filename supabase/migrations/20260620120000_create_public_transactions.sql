-- Public transaction detail for budget drill-through.
-- This migration does not alter raw finance-system rows. It creates a cleaned
-- public-facing table and a repeatable refresh function that derives rows from
-- the internal raw transaction source.

create table if not exists public.public_transactions (
  id bigint generated always as identity primary key,
  raw_transaction_id text not null unique,
  fiscal_year integer not null,
  transaction_date date,
  fund_code text,
  fund_name text,
  department_code text,
  department_name text,
  program_code text,
  program_name text,
  category text,
  object_code text,
  object_name text,
  vendor_payee_public text not null default 'Not available',
  description_public text not null default 'No description provided',
  document_number_public text,
  amount numeric(14, 2) not null default 0,
  cleanup_status text not null default 'cleaned',
  cleanup_confidence numeric(4, 2) not null default 0.80,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotent for environments where the table was created before is_public existed.
alter table public.public_transactions
  add column if not exists is_public boolean not null default true;

comment on column public.public_transactions.raw_transaction_id is
  'Stable deterministic hash from raw source fields only: org, object, project, year, eff_date, post_date, journal, ref1, reference, and amount. Cleaned public fields are intentionally excluded so future cleanup-rule changes do not change row identity.';

comment on column public.public_transactions.is_public is
  'Gates default public visibility independent of table-level grants. False for needs_review rows, low-confidence rows, and rows where no real vendor/description text survived cleanup (object-name fallback only). The public RLS select policy filters on this column.';

create unique index if not exists public_transactions_raw_transaction_id_uidx
  on public.public_transactions (raw_transaction_id);

create index if not exists public_transactions_lookup_idx
  on public.public_transactions (fiscal_year, department_code, object_code, program_code);

create index if not exists public_transactions_date_idx
  on public.public_transactions (transaction_date);

create index if not exists public_transactions_is_public_idx
  on public.public_transactions (is_public);

alter table public.public_transactions enable row level security;

drop policy if exists "Public can read cleaned transactions" on public.public_transactions;
create policy "Public can read cleaned transactions"
  on public.public_transactions
  for select
  to anon, authenticated
  using (is_public = true);

grant usage on schema public to anon, authenticated;
grant select on public.public_transactions to anon, authenticated;

-- Keep raw transaction sources private to browser roles if those tables exist.
-- Defense-in-depth: beyond revoking grants, enable RLS with no anon/authenticated
-- policies, so restoring a grant later does not silently reopen public read access.
-- Authenticated (non-public) access to raw data, if ever needed, requires a separate
-- admin-scoped policy added explicitly later -- none is created here.
do $$
begin
  if to_regclass('public.raw_transactions') is not null then
    revoke all on table public.raw_transactions from anon, authenticated;
    execute 'alter table public.raw_transactions enable row level security';
  end if;

  if to_regclass('public.transactions_raw') is not null then
    revoke all on table public.transactions_raw from anon, authenticated;
    execute 'alter table public.transactions_raw enable row level security';
  end if;
end $$;

create or replace function public.set_public_transactions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_public_transactions_updated_at on public.public_transactions;
create trigger set_public_transactions_updated_at
before update on public.public_transactions
for each row
execute function public.set_public_transactions_updated_at();

-- Identifies raw-field text that is a reference/voucher/invoice-style code rather
-- than a real description, so such values are routed to document_number_public
-- instead of being shown to the public as a description.
create or replace function public.is_reference_like_text(value text)
returns boolean
language sql
immutable
as $$
  select
    value is null
    or trim(value) = ''
    -- pure numeric strings, e.g. "182573"
    or trim(value) ~ '^[0-9]{3,}$'
    -- common reference/voucher/invoice/PO/check prefixes followed by a number,
    -- e.g. "INV 12345", "INVOICE 12345", "PO 25005392", "REF 182573",
    -- "CHECK 500028917", "VOUCHER 12345"
    or trim(value) ~* '^(inv|invoice|po|p\.o\.?|ref|reference|chk|check|vch|voucher|wo|warrant|jrnl|journal)[.:#\s-]*[0-9][0-9-]*$'
    -- short code-like tokens: 8 chars or fewer, alphanumeric/dash, containing a digit
    or (
      length(trim(value)) <= 8
      and trim(value) ~ '^[A-Za-z0-9-]+$'
      and trim(value) ~ '[0-9]'
    )
    -- mostly numeric: at least 70% of non-space characters are digits
    or (
      length(regexp_replace(trim(value), '\s', '', 'g')) > 0
      and length(regexp_replace(trim(value), '[^0-9]', '', 'g'))::numeric
          / length(regexp_replace(trim(value), '\s', '', 'g'))::numeric >= 0.7
    )
$$;

comment on function public.is_reference_like_text(text) is
  'Returns true when a raw text field looks like a reference/voucher/invoice/check/PO code rather than a real description. Used by refresh_public_transactions to keep such values out of description_public.';

drop function if exists public.refresh_public_transactions();
drop function if exists public.refresh_public_transactions(boolean);

create or replace function public.refresh_public_transactions(_dry_run boolean default false, _limit integer default null)
returns table(
  dry_run boolean,
  source_table text,
  rows_processed integer,
  rows_inserted integer,
  rows_updated integer,
  rows_skipped integer,
  duplicate_raw_transaction_id_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  source_reg regclass;
  source_name text;
  source_expr text;
  cleaned_cte text;
begin
  -- transactions_raw is the canonical raw source. raw_transactions is checked
  -- only as a temporary migration fallback while older environments catch up.
  source_reg := coalesce(to_regclass('public.transactions_raw'), to_regclass('public.raw_transactions'));

  if source_reg is null then
    raise exception 'No raw transaction source found. Expected public.transactions_raw.';
  end if;

  if _limit is not null and _limit <= 0 then
    raise exception '_limit must be a positive integer when provided.';
  end if;

  source_name := source_reg::text;

  -- When _limit is set, process only the most recent N raw rows so a refresh
  -- can be smoke-tested (e.g. 100 rows) before running against the full table.
  if _limit is not null then
    source_expr := format(
      '(select * from %s order by year desc nulls last, eff_date desc nulls last limit %s) as limited_source',
      source_reg, _limit
    );
  else
    source_expr := source_name;
  end if;

  cleaned_cte := format($sql$
    with raw_normalized as (
      select
        *,
        -- Stable row identity hash. Only raw source fields are included:
        -- org, object, project, year, eff_date, post_date, journal, ref1,
        -- reference, and amount. Do not add cleaned public fields here.
        -- That keeps raw_transaction_id stable if cleanup rules improve later.
        md5(concat_ws('|',
          coalesce(org::text, ''),
          coalesce(object::text, ''),
          coalesce(project::text, ''),
          coalesce(year::text, ''),
          coalesce(eff_date::text, ''),
          coalesce(post_date::text, ''),
          coalesce(journal::text, ''),
          coalesce(ref1::text, ''),
          coalesce(reference::text, ''),
          coalesce(amount::text, '')
        )) as raw_transaction_id,
        nullif(trim(comments::text), '') as comments_clean,
        nullif(trim(description::text), '') as description_clean,
        nullif(trim(reference::text), '') as reference_clean,
        nullif(trim(vdr_name_item_desc::text), '') as vendor_clean,
        nullif(object::text, '') as object_code_clean
      from %s
    ),
    described as (
      -- (raw_normalized may be reading from a row-limited subquery above when
      -- _limit is set; column shape is identical either way.)
      select
        *,
        (comments_clean is not null and not public.is_reference_like_text(comments_clean)) as comments_meaningful,
        (reference_clean is not null and not public.is_reference_like_text(reference_clean)) as reference_meaningful
      from raw_normalized
    ),
    cleaned_all as (
      select
        raw_transaction_id,
        nullif(regexp_replace(coalesce(year::text, ''), '[^0-9]', '', 'g'), '')::integer as fiscal_year,
        coalesce(eff_date::date, post_date::date) as transaction_date,
        nullif(substr(coalesce(org::text, ''), 1, 3), '') as fund_code,
        null::text as fund_name,
        nullif(org::text, '') as department_code,
        null::text as department_name,
        nullif(project::text, '') as program_code,
        nullif(coalesce(project_string::text, ''), '') as program_name,
        null::text as category,
        object_code_clean as object_code,
        -- The raw DESCRIPTION field is the chart-of-accounts object/account name
        -- tied to object_code (e.g. "Office Supplies"), not a transaction-specific
        -- note. Always populate it when the source has a value.
        description_clean as object_name,
        coalesce(vendor_clean, 'Not available') as vendor_payee_public,
        -- description_public is based primarily on COMMENTS, then REFERENCE (when
        -- not reference-like junk such as invoice/PO/voucher/check codes). The
        -- object/account name (object_name, sourced from DESCRIPTION) is only used
        -- as a last resort when no real transaction-specific text exists, since it
        -- describes the account/category rather than this specific transaction.
        case
          when comments_meaningful then comments_clean
          when reference_meaningful then reference_clean
          when description_clean is not null then description_clean
          when object_code_clean is not null then 'Object ' || object_code_clean
          else 'No description provided'
        end as description_public,
        nullif(coalesce(
          case when comments_clean is not null and not comments_meaningful then comments_clean end,
          case when reference_clean is not null and not reference_meaningful then reference_clean end,
          nullif(trim(voucher::text), ''),
          nullif(trim(warrant::text), ''),
          nullif(trim(check_no::text), ''),
          nullif(trim(ref1::text), ''),
          nullif(trim(journal::text), '')
        ), '') as document_number_public,
        coalesce(amount, 0)::numeric(14, 2) as amount,
        case
          when year is null or object is null or amount is null then 'needs_review'
          else 'cleaned'
        end as cleanup_status,
        case
          when year is null or object is null or amount is null then 0.45
          when (comments_meaningful or reference_meaningful) and vendor_clean is not null then 0.95
          when (comments_meaningful or reference_meaningful) and vendor_clean is null then 0.70
          when vendor_clean is not null then 0.65
          else 0.40
        end::numeric(4, 2) as cleanup_confidence,
        -- Public by default only when real transaction-specific text (comments or
        -- a non-reference-like reference) survived cleanup and the row did not
        -- need review. Rows that only have the object/account name or a synthetic
        -- "Object <code>" fallback stay private until an editor confirms them.
        case
          when year is null or object is null or amount is null then false
          when not (comments_meaningful or reference_meaningful) then false
          else true
        end as is_public
      from described
    ),
    valid_deduped as (
      select distinct on (raw_transaction_id) *
      from cleaned_all
      where fiscal_year is not null
        and object_code is not null
      order by raw_transaction_id, transaction_date nulls last
    ),
    duplicate_counts as (
      select coalesce(sum(source_count - 1), 0)::integer as duplicate_extra_count
      from (
        select raw_transaction_id, count(*) as source_count
        from cleaned_all
        where fiscal_year is not null
          and object_code is not null
        group by raw_transaction_id
        having count(*) > 1
      ) duplicates
    ),
    source_counts as (
      select
        count(*)::integer as processed_count,
        (
          count(*) filter (
            where fiscal_year is null
              or object_code is null
          )
        )::integer as invalid_count
      from cleaned_all
    )
  $sql$, source_expr);

  execute cleaned_cte || $sql$
    select
      processed_count,
      invalid_count + duplicate_extra_count,
      duplicate_extra_count
    from source_counts, duplicate_counts;
  $sql$
  into rows_processed, rows_skipped, duplicate_raw_transaction_id_count;

  if _dry_run then
    execute cleaned_cte || $sql$
      select
        count(*) filter (where existing.raw_transaction_id is null)::integer as insert_count,
        count(*) filter (where existing.raw_transaction_id is not null)::integer as update_count
      from valid_deduped source
      left join public.public_transactions existing
        on existing.raw_transaction_id = source.raw_transaction_id;
    $sql$
    into rows_inserted, rows_updated;
  else
    execute cleaned_cte || $sql$
      ,
      upserted as (
        insert into public.public_transactions (
          raw_transaction_id,
          fiscal_year,
          transaction_date,
          fund_code,
          fund_name,
          department_code,
          department_name,
          program_code,
          program_name,
          category,
          object_code,
          object_name,
          vendor_payee_public,
          description_public,
          document_number_public,
          amount,
          cleanup_status,
          cleanup_confidence,
          is_public
        )
        select
          raw_transaction_id,
          fiscal_year,
          transaction_date,
          fund_code,
          fund_name,
          department_code,
          department_name,
          program_code,
          program_name,
          category,
          object_code,
          object_name,
          vendor_payee_public,
          description_public,
          document_number_public,
          amount,
          cleanup_status,
          cleanup_confidence,
          is_public
        from valid_deduped
        on conflict (raw_transaction_id) do update
        set
          fiscal_year = excluded.fiscal_year,
          transaction_date = excluded.transaction_date,
          fund_code = excluded.fund_code,
          fund_name = excluded.fund_name,
          department_code = excluded.department_code,
          department_name = excluded.department_name,
          program_code = excluded.program_code,
          program_name = excluded.program_name,
          category = excluded.category,
          object_code = excluded.object_code,
          object_name = excluded.object_name,
          vendor_payee_public = excluded.vendor_payee_public,
          description_public = excluded.description_public,
          document_number_public = excluded.document_number_public,
          amount = excluded.amount,
          cleanup_status = excluded.cleanup_status,
          cleanup_confidence = excluded.cleanup_confidence,
          is_public = excluded.is_public,
          updated_at = now()
        returning (xmax = 0) as inserted
      )
      select
        count(*) filter (where inserted)::integer as insert_count,
        count(*) filter (where not inserted)::integer as update_count
      from upserted;
    $sql$
    into rows_inserted, rows_updated;
  end if;

  dry_run := _dry_run;
  source_table := source_name;
  return next;
end;
$$;

revoke all on function public.refresh_public_transactions(boolean, integer) from public;
grant execute on function public.refresh_public_transactions(boolean, integer) to service_role;

comment on function public.refresh_public_transactions(boolean, integer) is
  'Idempotently refreshes public_transactions from transactions_raw using a stable raw-field hash and upserts on raw_transaction_id. Sets is_public based on cleanup_status/confidence/description quality. Pass _dry_run=true for dry-run counts without writes. Pass _limit to cap how many of the most recent raw rows are processed, for smoke-testing before a full-table run.';

comment on table public.public_transactions is
  'Cleaned, resident-friendly public transaction rows for budget actual drill-through. Raw finance-system fields stay internal. Only is_public = true rows are visible to anon/authenticated readers via RLS.';

/*
Quick duplicate verification after a refresh:

select count(*) as duplicate_raw_transaction_id_count
from (
  select raw_transaction_id
  from public.public_transactions
  group by raw_transaction_id
  having count(*) > 1
) duplicates;
*/
