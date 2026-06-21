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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.public_transactions.raw_transaction_id is
  'Stable deterministic hash from raw source fields only: org, object, project, year, eff_date, post_date, journal, ref1, reference, and amount. Cleaned public fields are intentionally excluded so future cleanup-rule changes do not change row identity.';

create unique index if not exists public_transactions_raw_transaction_id_uidx
  on public.public_transactions (raw_transaction_id);

create index if not exists public_transactions_lookup_idx
  on public.public_transactions (fiscal_year, department_code, object_code, program_code);

create index if not exists public_transactions_date_idx
  on public.public_transactions (transaction_date);

alter table public.public_transactions enable row level security;

drop policy if exists "Public can read cleaned transactions" on public.public_transactions;
create policy "Public can read cleaned transactions"
  on public.public_transactions
  for select
  to anon, authenticated
  using (true);

grant usage on schema public to anon, authenticated;
grant select on public.public_transactions to anon, authenticated;

-- Keep raw transaction sources private to browser roles if those tables exist.
do $$
begin
  if to_regclass('public.raw_transactions') is not null then
    revoke all on table public.raw_transactions from anon, authenticated;
  end if;

  if to_regclass('public.transactions_raw') is not null then
    revoke all on table public.transactions_raw from anon, authenticated;
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

drop function if exists public.refresh_public_transactions();

create or replace function public.refresh_public_transactions(_dry_run boolean default false)
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
  cleaned_cte text;
begin
  -- transactions_raw is the canonical raw source. raw_transactions is checked
  -- only as a temporary migration fallback while older environments catch up.
  source_reg := coalesce(to_regclass('public.transactions_raw'), to_regclass('public.raw_transactions'));

  if source_reg is null then
    raise exception 'No raw transaction source found. Expected public.transactions_raw.';
  end if;

  source_name := source_reg::text;

  cleaned_cte := format($sql$
    with cleaned_all as (
      select
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
        nullif(regexp_replace(coalesce(year::text, ''), '[^0-9]', '', 'g'), '')::integer as fiscal_year,
        coalesce(eff_date::date, post_date::date) as transaction_date,
        nullif(substr(coalesce(org::text, ''), 1, 3), '') as fund_code,
        null::text as fund_name,
        nullif(org::text, '') as department_code,
        null::text as department_name,
        nullif(project::text, '') as program_code,
        nullif(coalesce(project_string::text, ''), '') as program_name,
        null::text as category,
        nullif(object::text, '') as object_code,
        null::text as object_name,
        coalesce(nullif(trim(vdr_name_item_desc::text), ''), 'Not available') as vendor_payee_public,
        case
          when nullif(trim(comments::text), '') is not null and trim(comments::text) !~ '^[0-9]{3,}$' then trim(comments::text)
          when nullif(trim(description::text), '') is not null and trim(description::text) !~ '^[0-9]{3,}$' then trim(description::text)
          when nullif(trim(reference::text), '') is not null and trim(reference::text) !~ '^[0-9]{3,}$' then trim(reference::text)
          else 'No description provided'
        end as description_public,
        nullif(coalesce(
          case when trim(comments::text) ~ '^[0-9]{3,}$' then trim(comments::text) end,
          case when trim(description::text) ~ '^[0-9]{3,}$' then trim(description::text) end,
          nullif(trim(voucher::text), ''),
          nullif(trim(warrant::text), ''),
          nullif(trim(check_no::text), ''),
          nullif(trim(ref1::text), ''),
          nullif(trim(reference::text), ''),
          nullif(trim(journal::text), '')
        ), '') as document_number_public,
        coalesce(amount, 0)::numeric(14, 2) as amount,
        case
          when year is null or object is null or amount is null then 'needs_review'
          else 'cleaned'
        end as cleanup_status,
        case
          when year is null or object is null or amount is null then 0.45
          when nullif(trim(vdr_name_item_desc::text), '') is null
            or (
              nullif(trim(comments::text), '') is null
              and nullif(trim(description::text), '') is null
              and nullif(trim(reference::text), '') is null
            ) then 0.70
          else 0.95
        end::numeric(4, 2) as cleanup_confidence
      from %s
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
  $sql$, source_reg);

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
          cleanup_confidence
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
          cleanup_confidence
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

revoke all on function public.refresh_public_transactions(boolean) from public;
grant execute on function public.refresh_public_transactions(boolean) to service_role;

comment on function public.refresh_public_transactions(boolean) is
  'Idempotently refreshes public_transactions from transactions_raw using a stable raw-field hash and upserts on raw_transaction_id. Pass true for dry-run counts without writes.';

comment on table public.public_transactions is
  'Cleaned, resident-friendly public transaction rows for budget actual drill-through. Raw finance-system fields stay internal.';

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
