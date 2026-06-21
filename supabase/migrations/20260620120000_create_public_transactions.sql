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
  'Marks rows that are safe for public display after cleanup. Valid cleaned rows are public so transaction detail totals reconcile to budget-line actuals; invalid needs_review rows remain non-public.';

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

-- Converts ALL-CAPS finance-system export text into readable case for public
-- display. Mixed-case input (most vendor names) is left untouched. Known
-- acronyms are kept uppercase; INC/CO are normalized to the conventional
-- "Inc."/"Co." form to match how they read in real vendor names. A small
-- set of deterministic abbreviation expansions runs first, so e.g. "MAINT"
-- becomes "Maintenance" before the rest of the string is title-cased.
-- This is intentionally conservative: it does not infer meaning from unclear
-- or truncated abbreviations, only mechanical case/whitespace/abbreviation
-- cleanup. Numbers and document codes (no letters) pass through unchanged.
create or replace function public.to_public_title_case(value text)
returns text
language plpgsql
immutable
as $$
declare
  force_upper_acronyms text[] := array['OMB','FY','PO','ID','IT','HVAC','AED','GPS','LLC','USA'];
  minor_words text[] := array['and','of','the','for','in','on','to'];
  result text;
  words text[];
  bare text;
  bare_upper text;
  i integer;
begin
  if value is null then
    return null;
  end if;

  result := trim(regexp_replace(value, '\s+', ' ', 'g'));
  if result = '' then
    return result;
  end if;

  -- Leave mixed-case text (most vendor names) and pure numbers/codes alone.
  if result <> upper(result) or result = lower(result) then
    return result;
  end if;

  -- Deterministic abbreviation expansions, applied while text is still
  -- all-uppercase so word-boundary matching stays simple.
  result := regexp_replace(result, '\bJUL-SEPT25\b', 'July-September 2025', 'g');
  result := regexp_replace(result, '\bP&R\b', 'Parks and Recreation', 'g');
  result := regexp_replace(result, '\bMAINT\b', 'Maintenance', 'g');
  result := regexp_replace(result, '\bEQUIP\b', 'Equipment', 'g');
  result := regexp_replace(result, '\bSUPPL\b', 'Supplies', 'g');
  result := regexp_replace(result, '\bREPR\b', 'Repair', 'g');
  result := regexp_replace(result, '\bADMIN\b', 'Administration', 'g');
  result := regexp_replace(result, '\bDEPT\b', 'Department', 'g');
  result := regexp_replace(result, '\bBLDG\b', 'Building', 'g');

  -- Slash-separated item lists read better as comma-separated text.
  result := regexp_replace(result, '([A-Za-z0-9])\s*/\s*([A-Za-z0-9])', '\1, \2', 'g');

  words := regexp_split_to_array(result, '\s+');
  for i in 1..coalesce(array_length(words, 1), 0) loop
    -- Words already converted by an expansion above (e.g. "Maintenance",
    -- "and") are no longer all-uppercase, so leave them exactly as-is.
    if words[i] <> upper(words[i]) then
      continue;
    end if;

    bare := regexp_replace(words[i], '[^A-Za-z0-9]', '', 'g');
    bare_upper := upper(bare);

    if bare_upper = any(force_upper_acronyms) then
      -- Already uppercase; nothing to do.
      continue;
    elsif bare_upper = 'INC' then
      words[i] := regexp_replace(words[i], 'INC', 'Inc', 'g');
    elsif bare_upper = 'CO' then
      words[i] := regexp_replace(words[i], 'CO', 'Co', 'g');
    elsif i > 1 and lower(bare) = any(minor_words) then
      words[i] := lower(words[i]);
    else
      words[i] := initcap(words[i]);
    end if;
  end loop;

  -- Mechanical cleanup of stray leading/trailing separators left over from
  -- truncated source fields (e.g. a trailing "-" with nothing after it).
  -- Periods are left alone since they're meaningful (e.g. "Inc.").
  return trim(both ' ,-' from array_to_string(words, ' '));
end;
$$;

comment on function public.to_public_title_case(text) is
  'Converts ALL-CAPS finance-system export text to readable case for public display, preserving known acronyms (OMB, FY, PO, ID, IT, HVAC, AED, GPS, LLC, USA), normalizing INC/CO to Inc./Co., and applying a small deterministic abbreviation dictionary (MAINT, EQUIP, SUPPL, REPR, ADMIN, DEPT, BLDG, P&R, JUL-SEPT25). Mixed-case input and pure numbers/codes pass through unchanged.';

drop function if exists public.refresh_public_transactions();
drop function if exists public.refresh_public_transactions(boolean);
drop function if exists public.refresh_public_transactions(boolean, integer);

create or replace function public.refresh_public_transactions(
  _dry_run boolean default false,
  _limit integer default null,
  _batch_size integer default null,
  _after_raw_transaction_id text default null
)
returns table(
  dry_run boolean,
  source_table text,
  rows_processed integer,
  rows_inserted integer,
  rows_updated integer,
  rows_skipped integer,
  duplicate_raw_transaction_id_count integer,
  next_after_raw_transaction_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  source_reg regclass;
  source_name text;
  source_expr text;
  batch_where text;
  batch_order_limit text;
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

  if _batch_size is not null and _batch_size <= 0 then
    raise exception '_batch_size must be a positive integer when provided.';
  end if;

  if _after_raw_transaction_id is not null and _batch_size is null then
    raise exception '_after_raw_transaction_id requires _batch_size to be set.';
  end if;

  if _limit is not null and _batch_size is not null then
    raise exception '_limit and _batch_size are mutually exclusive. Use _limit for a one-off smoke test, or _batch_size/_after_raw_transaction_id for a full keyset-batched refresh.';
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

  -- Keyset batching: raw_transaction_id is a derived hash, not a stored/indexed
  -- column on the raw source, so each batch still scans the source table to
  -- compute it. The benefit over OFFSET is correctness under concurrent inserts
  -- (no skipped/duplicated rows as the table changes between batches) and
  -- avoiding repeated row-skipping cost as later batches run.
  if _batch_size is not null then
    batch_where := case
      when _after_raw_transaction_id is not null
        then format('where raw_transaction_id > %L', _after_raw_transaction_id)
      else ''
    end;
    batch_order_limit := format('order by raw_transaction_id limit %s', _batch_size);
  else
    batch_where := '';
    batch_order_limit := '';
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
    windowed as (
      -- Keyset page over raw_normalized when _batch_size is set; a no-op
      -- passthrough otherwise. raw_transaction_id is computed above, so this
      -- filter/order/limit always runs against the full raw_normalized result.
      select *
      from raw_normalized
      %s
      %s
    ),
    described as (
      select
        *,
        (comments_clean is not null and not public.is_reference_like_text(comments_clean)) as comments_meaningful,
        (reference_clean is not null and not public.is_reference_like_text(reference_clean)) as reference_meaningful
      from windowed
    ),
    cleaned_all as (
      select
        raw_transaction_id,
        nullif(regexp_replace(coalesce(year::text, ''), '[^0-9]', '', 'g'), '')::integer as fiscal_year,
        coalesce(eff_date::date, post_date::date) as transaction_date,
        nullif(substr(coalesce(org::text, ''), 1, 3), '') as fund_code,
        -- No source lookup for fund_name/department_name yet. When one is
        -- added, wrap it with public.to_public_title_case(...) like the
        -- other public text fields below.
        null::text as fund_name,
        nullif(org::text, '') as department_code,
        null::text as department_name,
        nullif(project::text, '') as program_code,
        public.to_public_title_case(nullif(coalesce(project_string::text, ''), '')) as program_name,
        null::text as category,
        object_code_clean as object_code,
        -- The raw DESCRIPTION field is the chart-of-accounts object/account name
        -- tied to object_code (e.g. "Office Supplies"), not a transaction-specific
        -- note. Always populate it when the source has a value.
        public.to_public_title_case(description_clean) as object_name,
        coalesce(public.to_public_title_case(vendor_clean), 'Not available') as vendor_payee_public,
        -- description_public is based primarily on COMMENTS, then REFERENCE (when
        -- not reference-like junk such as invoice/PO/voucher/check codes). The
        -- object/account name (object_name, sourced from DESCRIPTION) is only used
        -- as a last resort when no real transaction-specific text exists, since it
        -- describes the account/category rather than this specific transaction.
        -- Casing cleanup (to_public_title_case) is applied here at display time
        -- only, never to the reference-detection logic above or to
        -- document_number_public below, so document codes stay byte-for-byte
        -- as found in the source.
        case
          when comments_meaningful then public.to_public_title_case(comments_clean)
          when reference_meaningful then public.to_public_title_case(reference_clean)
          when description_clean is not null then public.to_public_title_case(description_clean)
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
        -- Public by default for valid cleaned rows so drill-through transaction
        -- totals reconcile to the budget-line actuals. Rows with weak text still
        -- receive safe public placeholders/fallbacks above, so raw finance-system
        -- wording is not exposed. Only structurally invalid rows stay private.
        case
          when year is null or object is null or amount is null then false
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
    ),
    cursor_counts as (
      select max(raw_transaction_id) as max_raw_transaction_id
      from windowed
    )
  $sql$, source_expr, batch_where, batch_order_limit);

  execute cleaned_cte || $sql$
    select
      processed_count,
      invalid_count + duplicate_extra_count,
      duplicate_extra_count,
      max_raw_transaction_id
    from source_counts, duplicate_counts, cursor_counts;
  $sql$
  into rows_processed, rows_skipped, duplicate_raw_transaction_id_count, next_after_raw_transaction_id;

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

revoke all on function public.refresh_public_transactions(boolean, integer, integer, text) from public;
grant execute on function public.refresh_public_transactions(boolean, integer, integer, text) to service_role;

comment on function public.refresh_public_transactions(boolean, integer, integer, text) is
  'Idempotently refreshes public_transactions from transactions_raw using a stable raw-field hash and upserts on raw_transaction_id. Sets valid cleaned rows as public so transaction totals reconcile to budget-line actuals. Pass _dry_run=true for dry-run counts without writes. Pass _limit to cap how many of the most recent raw rows are processed, for a one-off smoke test. Pass _batch_size (optionally with _after_raw_transaction_id from a prior call''s next_after_raw_transaction_id) for keyset-paginated full-table refreshes; continue until rows_processed = 0. _limit and _batch_size are mutually exclusive.';

comment on table public.public_transactions is
  'Cleaned, resident-friendly public transaction rows for budget actual drill-through. Raw finance-system fields stay internal. Valid cleaned rows are visible to anon/authenticated readers via RLS.';

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
