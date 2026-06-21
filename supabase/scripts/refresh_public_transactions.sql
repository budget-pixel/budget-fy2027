-- Repeatable cleanup run for public transaction detail.
-- Safe to rerun: public.refresh_public_transactions(false) upserts by the
-- deterministic raw_transaction_id conflict key, so changed cleaned rows update
-- without creating duplicates.

-- Dry run: reports expected inserts, updates, skips, and duplicate source hashes
-- without writing to public.public_transactions.
select *
from public.refresh_public_transactions(true);

-- Actual refresh.
select *
from public.refresh_public_transactions(false);

select
  cleanup_status,
  count(*) as row_count,
  round(avg(cleanup_confidence), 2) as avg_cleanup_confidence
from public.public_transactions
group by cleanup_status
order by cleanup_status;

-- Verification: duplicate raw_transaction_id count should be zero.
select count(*) as duplicate_raw_transaction_id_count
from (
  select raw_transaction_id
  from public.public_transactions
  group by raw_transaction_id
  having count(*) > 1
) duplicates;
