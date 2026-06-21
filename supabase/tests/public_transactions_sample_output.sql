-- Sample QA output for comparing internal raw rows to public-facing rows.
-- Run after the migration and refresh_public_transactions().

select
  raw_sample.org as raw_org,
  raw_sample.object as raw_object,
  raw_sample.project as raw_project,
  raw_sample.year as raw_year,
  raw_sample.eff_date as raw_effective_date,
  raw_sample.vdr_name_item_desc as raw_vendor_payee,
  raw_sample.description as raw_description,
  raw_sample.comments as raw_comments,
  raw_sample.reference as raw_reference,
  raw_sample.amount as raw_amount,
  public_sample.raw_transaction_id,
  public_sample.fiscal_year,
  public_sample.transaction_date,
  public_sample.fund_code,
  public_sample.department_code,
  public_sample.program_code,
  public_sample.object_code,
  public_sample.vendor_payee_public,
  public_sample.description_public,
  public_sample.document_number_public,
  public_sample.amount as public_amount,
  public_sample.cleanup_status,
  public_sample.cleanup_confidence
from (
  select *
  from public.transactions_raw
  order by year desc nulls last, eff_date desc nulls last
  limit 25
) raw_sample
join public.public_transactions public_sample
  on public_sample.raw_transaction_id = md5(concat_ws('|',
    coalesce(raw_sample.org::text, ''),
    coalesce(raw_sample.object::text, ''),
    coalesce(raw_sample.project::text, ''),
    coalesce(raw_sample.year::text, ''),
    coalesce(raw_sample.eff_date::text, ''),
    coalesce(raw_sample.post_date::text, ''),
    coalesce(raw_sample.journal::text, ''),
    coalesce(raw_sample.ref1::text, ''),
    coalesce(raw_sample.reference::text, ''),
    coalesce(raw_sample.amount::text, '')
  ));

-- Verification: duplicate raw_transaction_id count should be zero.
select count(*) as duplicate_raw_transaction_id_count
from (
  select raw_transaction_id
  from public.public_transactions
  group by raw_transaction_id
  having count(*) > 1
) duplicates;

select
  fiscal_year,
  department_code,
  object_code,
  count(*) as transaction_count,
  sum(amount) as transaction_total
from public.public_transactions
group by fiscal_year, department_code, object_code
order by fiscal_year desc, transaction_count desc
limit 25;
