import pg from 'pg';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) throw new Error('Defina DATABASE_URL em .env.local (conexão PostgreSQL do Neon).');
const url = new URL(connectionString);
if (!url.hostname.endsWith('.neon.tech') && !url.hostname.endsWith('.neon.build')) throw new Error('A conexão deve apontar para o projeto Neon.');
url.searchParams.set('sslmode', 'verify-full');
const client = new pg.Client({ connectionString: url.href });
await client.connect();
try {
  if (process.argv[2] === 'migrate') {
    const sql = readFileSync('neon/migrations/001_initial.sql', 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');
    await client.query('begin');
    await client.query("select pg_advisory_xact_lock(hashtext('mocho-neon-migrations'))");
    await client.query('create schema if not exists mocho_migrations');
    await client.query('revoke all on schema mocho_migrations from public');
    await client.query('create table if not exists mocho_migrations.applied (name text primary key, hash text not null, applied_at timestamptz not null default now())');
    const previous = await client.query('select hash from mocho_migrations.applied where name = $1', ['001_initial']);
    if (previous.rowCount) {
      if (previous.rows[0].hash !== hash) throw new Error('A migração já aplicada foi alterada. Crie uma nova migração.');
      console.log('Migração Neon já aplicada; nenhuma alteração.');
    } else {
      await client.query(sql);
      await client.query('insert into mocho_migrations.applied(name, hash) values ($1, $2)', ['001_initial', hash]);
      console.log('Migração Neon aplicada: 8 tabelas, índices e permissões.');
    }
    await client.query('commit');
  } else if (process.argv[2] === 'grant') {
    const email = process.argv[3], role = process.argv[4] || 'admin';
    if (!email || !['admin', 'sales', 'factory', 'viewer'].includes(role)) throw new Error('Uso: npm run db:grant -- email papel');
    const result = await client.query(`insert into public.profiles(id, display_name, role, active)
      select id, name, $2, true from neon_auth."user" where lower(email) = lower($1)
      on conflict(id) do update set role = excluded.role, active = true returning id, role`, [email, role]);
    if (result.rowCount !== 1) throw new Error('Crie primeiro a conta no Neon Auth. Nenhum perfil foi liberado.');
    console.log(`Perfil autorizado com papel ${role}.`);
  } else throw new Error('Comando esperado: migrate ou grant.');
} catch (error) {
  await client.query('rollback').catch(() => {});
  console.error('Operação Neon falhou:', error.code || '', error.message.replaceAll(connectionString, '[conexão omitida]'));
  process.exitCode = 1;
} finally { await client.end(); }
