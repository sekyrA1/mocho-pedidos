-- Private cache and quotas in mocho-prospeccao only. Not exposed through Data API.
create schema if not exists search_private;
revoke all on schema search_private from public;
create table if not exists search_private.cache (
  key text primary key, payload jsonb not null, expires_at timestamptz not null
);
create index if not exists cache_expiry on search_private.cache(expires_at);
create table if not exists search_private.quotas (
  key text not null, bucket bigint not null, count integer not null check(count>0), expires_at timestamptz not null,
  primary key(key,bucket)
);
create index if not exists quota_expiry on search_private.quotas(expires_at);
create table if not exists search_private.provider_slots (
  provider text primary key, next_at timestamptz not null
);
revoke all on all tables in schema search_private from public;
