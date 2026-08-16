create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('entry', 'exit')),
  status text not null default 'paid' check (status in ('paid', 'pending', 'canceled')),
  transaction_date date not null default current_date,
  due_date date,
  category text not null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text,
  counterparty text,
  order_id uuid references public.orders(id) on delete set null,
  material_name text,
  material_quantity numeric(12,3) check (material_quantity is null or material_quantity >= 0),
  material_unit text,
  material_unit_cost numeric(12,2) check (material_unit_cost is null or material_unit_cost >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_transaction_due_date_check check (due_date is null or due_date >= transaction_date),
  constraint finance_transaction_material_check check (
    type = 'exit'
    or (material_name is null and material_quantity is null and material_unit is null and material_unit_cost is null)
  )
);

create index finance_transactions_date_idx on public.finance_transactions (transaction_date desc);
create index finance_transactions_type_status_idx on public.finance_transactions (type, status);
create index finance_transactions_category_idx on public.finance_transactions (category);
create index finance_transactions_order_idx on public.finance_transactions (order_id) where order_id is not null;

create trigger finance_transactions_updated_at
before update on public.finance_transactions
for each row execute function private.touch_updated_at();

alter table public.finance_transactions enable row level security;

create policy finance_transactions_select_admin on public.finance_transactions
for select to authenticated
using (private.current_user_has_role(array['admin']));

create policy finance_transactions_insert_admin on public.finance_transactions
for insert to authenticated
with check (private.current_user_has_role(array['admin']) and (created_by is null or created_by = (select auth.uid())));

create policy finance_transactions_update_admin on public.finance_transactions
for update to authenticated
using (private.current_user_has_role(array['admin']))
with check (private.current_user_has_role(array['admin']));

create policy finance_transactions_delete_admin on public.finance_transactions
for delete to authenticated
using (private.current_user_has_role(array['admin']));

revoke all on public.finance_transactions from anon;
grant select, insert, update, delete on public.finance_transactions to authenticated;
