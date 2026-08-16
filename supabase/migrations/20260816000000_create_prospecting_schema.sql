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
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prospect_interactions (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  interaction_type text not null check (interaction_type in ('note', 'call', 'message', 'meeting', 'email')),
  note text not null,
  happened_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
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

revoke all on table public.prospects, public.prospect_interactions from anon;
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
