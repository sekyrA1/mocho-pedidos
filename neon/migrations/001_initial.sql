-- Fresh Neon database only. Enable Neon Auth and Data API first.
create schema if not exists private;

create table public.profiles (
  id uuid primary key references neon_auth."user"(id) on delete cascade,
  display_name text,
  role text not null default 'viewer' check (role in ('admin', 'sales', 'factory', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  cpf text,
  cnpj text,
  birth_date date,
  profession text,
  address_line text,
  address_number text,
  address_complement text,
  neighborhood text,
  city text,
  state text check (state is null or char_length(state) = 2),
  postal_code text,
  height text,
  weight text,
  event_code text,
  created_by uuid references neon_auth."user"(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique check (order_number is null or order_number ~ '^PED-[0-9]{4}-[0-9]{3,}$'),
  customer_id uuid references public.customers(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'in_production', 'quality_check', 'ready', 'delivered', 'canceled')),
  issue_date date not null default current_date,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount_pct numeric(5,2) not null default 0 check (discount_pct >= 0 and discount_pct <= 100),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  freight numeric(12,2) not null default 0 check (freight >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  amount_received numeric(12,2) not null default 0 check (amount_received >= 0),
  installments integer not null default 1 check (installments >= 1),
  installment_amount numeric(12,2) not null default 0 check (installment_amount >= 0),
  representative text,
  signature_city text,
  notes text,
  customer_snapshot jsonb not null default '{}'::jsonb,
  order_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references neon_auth."user"(id) on delete set null,
  updated_by uuid references neon_auth."user"(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_name text not null default 'Mocho Sela',
  quantity integer not null default 1 check (quantity > 0),
  foam_line text not null check (foam_line in ('3 cm', '5 cm')),
  piston text check (piston is null or piston in ('P', 'M')),
  saddle_model text not null default 'Mocho sela',
  saddle_size text not null default 'Padrão' check (saddle_size in ('Padrão', 'Soft', 'Soft Plus')),
  seat_color text not null default 'Preto' check (seat_color in ('Preto', 'Azul Marinho', 'Caramelo', 'Marrom', 'Creme', 'Vermelho', 'Verde Musgo')),
  frame_finish text not null default 'Metal cromado prata' check (frame_finish = 'Metal cromado prata'),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  manufacturing_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  previous_status text,
  new_status text not null check (new_status in ('draft', 'confirmed', 'in_production', 'quality_check', 'ready', 'delivered', 'canceled')),
  note text,
  changed_by uuid references neon_auth."user"(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index customers_email_idx on public.customers (lower(email)) where email is not null;
create index customers_phone_idx on public.customers (phone) where phone is not null;
create index orders_status_idx on public.orders (status);
create index orders_issue_date_idx on public.orders (issue_date desc);
create index orders_customer_idx on public.orders (customer_id);
create index order_items_order_idx on public.order_items (order_id);
create index order_status_history_order_idx on public.order_status_history (order_id, changed_at desc);

create or replace function private.current_user_has_role(required_roles text[])
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role = any(required_roles));
$$;

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp
as $$ begin new.updated_at = now(); return new; end; $$;



create or replace function private.record_order_status_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, previous_status, new_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif old.status is distinct from new.status then
    insert into public.order_status_history (order_id, previous_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function private.touch_updated_at();
create trigger customers_updated_at before update on public.customers for each row execute function private.touch_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function private.touch_updated_at();
create trigger order_items_updated_at before update on public.order_items for each row execute function private.touch_updated_at();
create trigger order_status_audit after insert or update of status on public.orders for each row execute function private.record_order_status_change();

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;

create policy profiles_select_self_or_admin on public.profiles for select to authenticated
  using ((select auth.uid()) = id or private.current_user_has_role(array['admin']));
create policy profiles_update_admin on public.profiles for update to authenticated
  using (private.current_user_has_role(array['admin']))
  with check (private.current_user_has_role(array['admin']));

create policy customers_select_active_staff on public.customers for select to authenticated
  using (private.current_user_has_role(array['admin', 'sales', 'factory', 'viewer']));
create policy customers_insert_sales on public.customers for insert to authenticated
  with check (private.current_user_has_role(array['admin', 'sales']) and (created_by is null or created_by = (select auth.uid())));
create policy customers_update_sales on public.customers for update to authenticated
  using (private.current_user_has_role(array['admin', 'sales']))
  with check (private.current_user_has_role(array['admin', 'sales']));
create policy customers_delete_admin on public.customers for delete to authenticated
  using (private.current_user_has_role(array['admin']));

create policy orders_select_active_staff on public.orders for select to authenticated
  using (private.current_user_has_role(array['admin', 'sales', 'factory', 'viewer']));
create policy orders_insert_sales on public.orders for insert to authenticated
  with check (private.current_user_has_role(array['admin', 'sales']) and (created_by is null or created_by = (select auth.uid())));
create policy orders_update_sales on public.orders for update to authenticated
  using (private.current_user_has_role(array['admin', 'sales']))
  with check (private.current_user_has_role(array['admin', 'sales']));

create policy order_items_select_active_staff on public.order_items for select to authenticated
  using (private.current_user_has_role(array['admin', 'sales', 'factory', 'viewer']));
create policy order_items_insert_sales on public.order_items for insert to authenticated
  with check (private.current_user_has_role(array['admin', 'sales']));
create policy order_items_update_sales on public.order_items for update to authenticated
  using (private.current_user_has_role(array['admin', 'sales']))
  with check (private.current_user_has_role(array['admin', 'sales']));

create policy order_status_history_select_active_staff on public.order_status_history for select to authenticated
  using (private.current_user_has_role(array['admin', 'sales', 'factory', 'viewer']));

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke execute on function private.current_user_has_role(text[]) from public, anonymous;
grant execute on function private.current_user_has_role(text[]) to authenticated;
revoke execute on function private.touch_updated_at() from public, anonymous, authenticated;
revoke execute on function private.record_order_status_change() from public, anonymous, authenticated;

revoke all on all tables in schema public from anonymous;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update on public.orders to authenticated;
grant select, insert, update on public.order_items to authenticated;
grant select on public.order_status_history to authenticated;

create index customers_created_by_idx on public.customers (created_by);
create index orders_created_by_idx on public.orders (created_by);
create index orders_updated_by_idx on public.orders (updated_by);
create index order_status_history_changed_by_idx on public.order_status_history (changed_by);

create policy orders_delete_sales on public.orders for delete to authenticated
  using (private.current_user_has_role(array['admin', 'sales']));

grant delete on public.orders to authenticated;

-- Restrict the Data API roles to the operations used by the application.
revoke all privileges on table
  public.profiles,
  public.customers,
  public.orders,
  public.order_items,
  public.order_status_history
from anonymous, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, role, active) on table public.profiles to authenticated;

grant select on table public.customers to authenticated;
grant insert (
  name, contact_name, email, phone, cpf, cnpj, birth_date, profession,
  address_line, address_number, address_complement, neighborhood, city,
  state, postal_code, height, weight, event_code, created_by
) on table public.customers to authenticated;
grant update (
  name, contact_name, email, phone, cpf, cnpj, birth_date, profession,
  address_line, address_number, address_complement, neighborhood, city,
  state, postal_code, height, weight, event_code
) on table public.customers to authenticated;
grant delete on table public.customers to authenticated;

grant select on table public.orders to authenticated;
grant insert (
  order_number, customer_id, status, issue_date, subtotal, discount_pct,
  discount_amount, freight, total, amount_received, installments,
  installment_amount, representative, signature_city, notes,
  customer_snapshot, order_snapshot, created_by, updated_by
) on table public.orders to authenticated;
grant update (
  order_number, customer_id, status, issue_date, subtotal, discount_pct,
  discount_amount, freight, total, amount_received, installments,
  installment_amount, representative, signature_city, notes,
  customer_snapshot, order_snapshot, updated_by
) on table public.orders to authenticated;
grant delete on table public.orders to authenticated;

grant select on table public.order_items to authenticated;
grant insert (
  order_id, product_name, quantity, foam_line, piston, saddle_model,
  saddle_size, seat_color, frame_finish, unit_price, manufacturing_notes
) on table public.order_items to authenticated;
grant update (
  product_name, quantity, foam_line, piston, saddle_model, saddle_size,
  seat_color, frame_finish, unit_price, manufacturing_notes
) on table public.order_items to authenticated;

grant select on table public.order_status_history to authenticated;

-- New objects created by the application owner are private until explicitly exposed.
alter default privileges in schema public
  revoke all privileges on tables from anonymous, authenticated;
alter default privileges in schema public
  revoke all privileges on sequences from anonymous, authenticated;
alter default privileges in schema public
  revoke execute on functions from public, anonymous, authenticated;

-- Creation must always carry the authenticated user's identifier.
drop policy if exists customers_insert_sales on public.customers;
create policy customers_insert_sales on public.customers for insert to authenticated
  with check (
    private.current_user_has_role(array['admin', 'sales'])
    and created_by = (select auth.uid())
  );

drop policy if exists orders_insert_sales on public.orders;
create policy orders_insert_sales on public.orders for insert to authenticated
  with check (
    private.current_user_has_role(array['admin', 'sales'])
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

-- Permanent deletion is an administrative action. Sales can cancel an order instead.
drop policy if exists orders_delete_sales on public.orders;
drop policy if exists orders_delete_admin on public.orders;
create policy orders_delete_admin on public.orders for delete to authenticated
  using (private.current_user_has_role(array['admin']));

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  google_place_id text unique,
  business_name text not null,
  contact_name text,
  category text,
  phone text,
  email text,
  website text,
  address_line text,
  neighborhood text,
  city text not null default 'Rio de Janeiro',
  state text not null default 'RJ' check (char_length(state) = 2),
  postal_code text,
  cnpj text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  source_provider text not null default 'manual',
  source_url text,
  status text not null default 'new' check (status in ('new', 'in_contact', 'qualified', 'converted', 'archived')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  notes text,
  last_checked_at timestamptz,
  created_by uuid references neon_auth."user"(id) on delete set null,
  updated_by uuid references neon_auth."user"(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prospect_interactions (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  interaction_type text not null check (interaction_type in ('note', 'call', 'message', 'meeting', 'email')),
  note text not null,
  happened_at timestamptz not null default now(),
  created_by uuid references neon_auth."user"(id) on delete set null,
  created_at timestamptz not null default now()
);

create index prospects_status_idx on public.prospects (status);
create index prospects_priority_idx on public.prospects (priority);
create index prospects_city_idx on public.prospects (lower(city));
create index prospects_business_name_idx on public.prospects (lower(business_name));
create index prospects_phone_idx on public.prospects (phone) where phone is not null;
create index prospects_cnpj_idx on public.prospects (cnpj) where cnpj is not null;
create index prospects_location_idx on public.prospects (latitude, longitude) where latitude is not null and longitude is not null;
create index prospect_interactions_prospect_idx on public.prospect_interactions (prospect_id, happened_at desc);

create trigger prospects_updated_at before update on public.prospects
for each row execute function private.touch_updated_at();

alter table public.prospects enable row level security;
alter table public.prospect_interactions enable row level security;

create policy prospects_select_sales_admin on public.prospects for select to authenticated
  using (private.current_user_has_role(array['admin', 'sales']));
create policy prospects_insert_sales_admin on public.prospects for insert to authenticated
  with check (
    private.current_user_has_role(array['admin', 'sales'])
    and (created_by is null or created_by = (select auth.uid()))
  );
create policy prospects_update_sales_admin on public.prospects for update to authenticated
  using (private.current_user_has_role(array['admin', 'sales']))
  with check (private.current_user_has_role(array['admin', 'sales']));
create policy prospects_delete_admin on public.prospects for delete to authenticated
  using (private.current_user_has_role(array['admin']));

create policy prospect_interactions_select_sales_admin on public.prospect_interactions for select to authenticated
  using (private.current_user_has_role(array['admin', 'sales']));
create policy prospect_interactions_insert_sales_admin on public.prospect_interactions for insert to authenticated
  with check (
    private.current_user_has_role(array['admin', 'sales'])
    and (created_by is null or created_by = (select auth.uid()))
  );

revoke all on table public.prospects, public.prospect_interactions from anonymous;
grant select on table public.prospects, public.prospect_interactions to authenticated;
grant insert (
  google_place_id, business_name, contact_name, category, phone, email, website,
  address_line, neighborhood, city, state, postal_code, cnpj, latitude, longitude,
  source_provider, source_url, status, priority, notes, last_checked_at, created_by, updated_by
) on table public.prospects to authenticated;
grant update (
  business_name, contact_name, category, phone, email, website, address_line, neighborhood,
  city, state, postal_code, cnpj, latitude, longitude, source_provider, source_url,
  status, priority, notes, last_checked_at, updated_by
) on table public.prospects to authenticated;
grant delete on table public.prospects to authenticated;
grant insert (prospect_id, interaction_type, note, happened_at, created_by) on table public.prospect_interactions to authenticated;

create index prospects_created_by_idx on public.prospects (created_by);
create index prospects_updated_by_idx on public.prospects (updated_by);
create index prospect_interactions_created_by_idx on public.prospect_interactions (created_by);

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
  created_by uuid references neon_auth."user"(id) on delete set null,
  updated_by uuid references neon_auth."user"(id) on delete set null,
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

revoke all on public.finance_transactions from anonymous;
grant select, insert, update, delete on public.finance_transactions to authenticated;

create index finance_transactions_created_by_idx on public.finance_transactions (created_by) where created_by is not null;
create index finance_transactions_updated_by_idx on public.finance_transactions (updated_by) where updated_by is not null;

-- Editing an existing order can remove line items before the new item set is saved.
-- Keep this limited to the same staff roles that can update orders and order_items.
drop policy if exists order_items_delete_sales on public.order_items;
create policy order_items_delete_sales on public.order_items for delete to authenticated
  using (private.current_user_has_role(array['admin', 'sales']));

grant delete on table public.order_items to authenticated;

-- Remove the legacy structure/finish attribute from order records.
update public.orders
set order_snapshot = replace(
  regexp_replace(
    order_snapshot::text,
    'estrutura\s*:?\s*metal\s+cromado\s+prata',
    '',
    'gi'
  ),
  'metal cromado prata', ''
)::jsonb
where order_snapshot::text ilike any (array[
  '%estrutura: metal cromado prata%',
  '%estrutura metal cromado prata%',
  '%metal cromado prata%'
]);

update public.orders
set order_snapshot = order_snapshot - 'corEstrutura'
where order_snapshot ? 'corEstrutura';

update public.orders
set order_snapshot = jsonb_set(
  order_snapshot,
  '{items}',
  (
    select coalesce(jsonb_agg(item - 'corEstrutura'), '[]'::jsonb)
    from jsonb_array_elements(order_snapshot->'items') as item
  ),
  true
)
where jsonb_typeof(order_snapshot->'items') = 'array';

update public.order_items
set manufacturing_notes = nullif(
  btrim(regexp_replace(
    manufacturing_notes,
    'estrutura\s*:?\s*metal\s+cromado\s+prata',
    '',
    'gi'
  )),
  ''
)
where manufacturing_notes ilike any (array[
  '%estrutura: metal cromado prata%',
  '%estrutura metal cromado prata%'
]);

alter table public.order_items
  drop column if exists frame_finish;

-- Every new account is denied application access until an administrator provisions it.
-- Role checks stay in a private SECURITY DEFINER helper to avoid recursive profile RLS.
create index if not exists profiles_role_active_idx on public.profiles(role) where active;
grant usage on schema public to authenticated;
revoke all on all tables in schema public from anonymous;
