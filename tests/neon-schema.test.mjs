import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('fresh migration and database-enforced staff permissions', async () => {
  const db = new PGlite();
  try {
    // The production Neon Data API provides these roles and auth.user_id().
    await db.exec(`create role authenticated; create role anonymous;
      create schema auth; create schema neon_auth;
      create table neon_auth."user"(id uuid primary key, name text, email text);
      create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('test.subject', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anonymous;
      grant execute on function auth.uid() to authenticated, anonymous;`);
    const ids = Object.fromEntries(['admin', 'sales', 'viewer', 'inactive', 'stranger'].map((name, i) => [name, `00000000-0000-0000-0000-00000000000${i + 1}`]));
    const identities = sql => sql.replace(/'(admin|sales|viewer|inactive|stranger)'/g, (match, name) => `'${ids[name]}'`);
    await db.exec(identities(`insert into neon_auth."user"(id) values ('admin'), ('sales'), ('viewer'), ('inactive'), ('stranger');`));
    await db.exec(readFileSync('neon/migrations/001_initial.sql', 'utf8'));
    const tables = await db.query("select tablename from pg_tables where schemaname='public' and rowsecurity");
    assert.equal(tables.rows.length, 8);
    for (const [name, role, active] of [['admin','admin',true],['sales','sales',true],['viewer','viewer',true],['inactive','admin',false]]) {
      await db.query('insert into public.profiles(id,role,active) values ($1,$2,$3)', [ids[name], role, active]);
    }
    const as = async (id, sql) => {
      await db.exec(`reset role; select set_config('test.subject','${ids[id]}', false); set role authenticated;`);
      return db.query(identities(sql));
    };
    await as('admin', "insert into customers(name,created_by) values ('Cliente','admin')");
    await as('sales', "insert into orders(created_by,updated_by) values ('sales','sales')");
    assert.equal((await as('admin', 'select * from order_status_history')).rows.length, 1);
    assert.equal((await as('viewer', 'select * from orders')).rows.length, 1);
    await assert.rejects(as('viewer', "insert into orders(created_by,updated_by) values ('viewer','viewer')"));
    assert.equal((await as('sales', "update profiles set role=concat('ad','min') where id='sales' returning *")).rows.length, 0);
    await as('admin', "insert into finance_transactions(type,category,description,amount,created_by) values ('entry','Venda','Teste',10,'admin')");
    assert.equal((await as('sales', 'select * from finance_transactions')).rows.length, 0);
    assert.equal((await as('sales', 'delete from orders returning id')).rows.length, 0);
    await assert.rejects(as('sales', "insert into orders(created_by,updated_by) values ('admin','sales')"));
    assert.equal((await as('inactive', 'select * from orders')).rows.length, 0);
    assert.equal((await as('stranger', 'select * from customers')).rows.length, 0);
    await db.exec('reset role; set role anonymous');
    await assert.rejects(db.query('select * from orders'));
    await db.exec('reset role');
    await as('admin', 'delete from orders');
    assert.equal((await as('admin', 'select * from order_status_history')).rows.length, 0);
  } finally { await db.close(); }
});
