create index finance_transactions_created_by_idx on public.finance_transactions (created_by) where created_by is not null;
create index finance_transactions_updated_by_idx on public.finance_transactions (updated_by) where updated_by is not null;
