-- =============================================================================
-- Zefinoro :: 0005 :: Denormalised attachment counter
--
-- The billing table shows an attachment indicator and supports a "has
-- attachment" filter. Doing that through an embedded join forces PostgREST into
-- an inner join, which breaks the "no attachments" case and makes accurate
-- pagination counts awkward. A trigger-maintained counter on `transactions` is
-- cheap to keep correct and trivially indexable.
-- =============================================================================

alter table public.transactions
  add column if not exists attachment_count int not null default 0;

create index if not exists transactions_attachment_count_idx
  on public.transactions (workspace_id, attachment_count);

create or replace function public.sync_attachment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'INSERT' then
    update public.transactions
       set attachment_count = attachment_count + 1
     where id = new.transaction_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.transactions
       set attachment_count = greatest(0, attachment_count - 1)
     where id = old.transaction_id;
    return old;
  end if;

  -- An attachment moving between transactions: decrement the old, increment the new.
  if tg_op = 'UPDATE' and new.transaction_id is distinct from old.transaction_id then
    update public.transactions
       set attachment_count = greatest(0, attachment_count - 1)
     where id = old.transaction_id;
    update public.transactions
       set attachment_count = attachment_count + 1
     where id = new.transaction_id;
  end if;

  return new;
end;
$fn$;

drop trigger if exists attachments_sync_count on public.transaction_attachments;
create trigger attachments_sync_count
  after insert or update or delete on public.transaction_attachments
  for each row execute function public.sync_attachment_count();

-- Backfill anything created before this migration ran.
update public.transactions t
   set attachment_count = coalesce(a.n, 0)
  from (
    select transaction_id, count(*) as n
      from public.transaction_attachments
     group by transaction_id
  ) a
 where a.transaction_id = t.id
   and t.attachment_count is distinct from a.n;
