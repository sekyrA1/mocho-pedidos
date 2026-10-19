import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

// Preserve the existing business schema and policy history, adapting only identity.
const files = [
  '20260815214914_create_order_management_schema.sql',
  '20260815214935_add_order_audit_indexes.sql',
  '20260815225000_allow_sales_order_deletion.sql',
  '20260815225001_harden_security_and_privileges.sql',
  '20260816000000_create_prospecting_schema.sql',
  '20260816000500_add_prospect_fk_indexes.sql',
  '20260816010000_create_finance_transactions.sql',
  '20260816011000_add_finance_transaction_audit_indexes.sql',
  '20260820005155_allow_order_item_deletes_for_editing.sql',
  '20260820013354_remove_structure_from_orders.sql',
];
let sql = files.map(file => readFileSync(`supabase/migrations/${file}`, 'utf8')).join('\n');
sql = sql
  .replace(/create or replace function private\.handle_new_user\(\)[\s\S]*?\$\$;/, '')
  .replace(/^create trigger auth_user_profile[^;]+;\s*/m, '')
  .replace(/^revoke execute on function private\.handle_new_user\(\)[^;]+;\s*/m, '')
  .replaceAll('references auth.users(id)', 'references neon_auth."user"(id)')
  .replace(/from anon, authenticated/g, 'from anonymous, authenticated')
  .replace(/from public, anon/g, 'from public, anonymous')
  .replace(/\banon\b/g, 'anonymous')
  .replace(/for role postgres /g, '');
// Sign-up alone never creates an active staff profile. Provision staff explicitly.
sql += `
-- Every new account is denied application access until an administrator provisions it.
-- Role checks stay in a private SECURITY DEFINER helper to avoid recursive profile RLS.
create index if not exists profiles_role_active_idx on public.profiles(role) where active;
grant usage on schema public to authenticated;
revoke all on all tables in schema public from anonymous;
`;
mkdirSync('neon/migrations', { recursive: true });
writeFileSync('neon/migrations/001_initial.sql', '-- Fresh Neon database only. Enable Neon Auth and Data API first.\n' + sql);
