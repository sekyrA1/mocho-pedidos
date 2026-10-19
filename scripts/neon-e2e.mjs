import { chromium } from '@playwright/test';
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
if (process.env.NEON_BRANCH !== 'migration-check-20261019' && !(process.argv.includes('--production') && process.env.NEON_BRANCH === 'production')) throw new Error('Branch inesperada para o teste.');
const url = new URL(process.env.DATABASE_URL_UNPOOLED); url.searchParams.set('sslmode', 'verify-full');
const db = new pg.Client({ connectionString: url.href }); await db.connect();
const browser = await chromium.launch();
const page = await browser.newPage();
const failures = [];
page.setDefaultTimeout(20000);
if(process.argv.includes('--search')) page.on('console', message => { if(message.type()==='error') console.log('Browser:', message.text()); });
page.on('pageerror', error => failures.push(error.message));
const config = { authUrl: process.env.NEON_AUTH_BASE_URL, dataApiUrl: process.env.NEON_DATA_API_URL, prospectSearchUrl: process.env.NEON_PROSPECT_SEARCH_URL };
const site = process.env.MOCHO_SITE_URL || 'http://localhost:3000/';
if(!process.env.MOCHO_SITE_URL) await page.route('**/neon-config.js*', route => route.fulfill({ contentType: 'text/javascript', body: 'window.NEON_CONFIG=' + JSON.stringify(config) }));
const email = `migration-${randomBytes(5).toString('hex')}@example.invalid`;
const password = randomBytes(24).toString('base64url');
let userId, customerId, orderId;
try {
  await page.goto(new URL('pedidos.html',site).href);
  await page.waitForURL('**/admin.html**');
  if(process.env.MOCHO_SITE_URL) {
    const published=await page.evaluate(()=>window.NEON_CONFIG);
    assert.deepEqual(published,config);console.log('PASS: site público usa os endpoints Neon publicados');
  }
  console.log('PASS: acesso sem sessão redirecionado ao login');
  const signup = await page.evaluate(async credentials => {
    const result = await window.appPasswordAuth.signUp.email({ ...credentials, name: 'Teste de migração' });
    return { error: result.error?.message, id: result.data?.user?.id };
  }, { email, password });
  assert.ok(!signup.error, signup.error); userId = signup.id; assert.ok(userId);
  console.log('PASS: cadastro real Neon Auth');
  await page.evaluate(() => window.appBackend.auth.signOut());
  await page.locator('#email').fill(email); await page.locator('#password').fill(password);
  await page.locator('#submitLogin').click();
  await page.locator('#authMessage').filter({ hasText: 'perfil ativo autorizado' }).waitFor();
  console.log('PASS: conta sem perfil não acessa o painel');
  await db.query("insert into public.profiles(id,display_name,role,active) values ($1,'Teste de migração','admin',true)", [userId]);
  await page.locator('#submitLogin').click();
  await page.waitForURL('**/pedidos.html');
  await page.waitForFunction(() => !!window.currentAuth);
  assert.equal(await page.evaluate(() => window.currentAuth.profile.role), 'admin');
  console.log('PASS: login pela interface e perfil administrativo');
  if (process.argv.includes('--search')) {
    await page.evaluate(() => window.navegarDashboard('prospeccao'));
    const searchResponse = page.waitForResponse(response => response.url() === config.prospectSearchUrl && response.request().method() === 'POST', {timeout:65000});
    searchResponse.catch(()=>{});
    await page.locator('#btnBuscarProspecção').click();
    const response = await searchResponse, payload = await response.json();
    console.log('Busca externa:', response.status(), payload.error || `${payload.results?.length} resultados`);
    assert.equal(response.status(),200, payload.error);
    assert.equal(payload.provider,'openstreetmap'); assert.ok(payload.results.length>0);
    await page.locator('.prospect-card').first().waitFor();
    mkdirSync('tmp',{recursive:true});await page.screenshot({path:'tmp/neon-search.png',fullPage:true});
    await page.locator('.prospect-card').first().getByRole('button', {name:/Salvar/}).click();
    await page.locator('#prospeccaoSalvos .prospect-salvo').first().waitFor();
    await page.locator('#prospeccaoSalvos .prospect-status-select').first().selectOption('qualified');
    await page.waitForFunction(() => document.querySelector('#prospeccaoSalvosResumo')?.textContent.includes('1 qualificados'));
    console.log('PASS: busca OpenStreetMap real, exibição, salvamento e qualificação pela interface');
    const cached = await page.evaluate(() => window.searchProspects({query:'dentista',area:'Rio de Janeiro',radius:10000,pageSize:20}));
    assert.ok(cached.data?.cached); console.log('PASS: segunda busca atendida pelo cache');
    const token = await page.evaluate(async () => (await window.appBackend.auth.getSession()).data.session.access_token);
    const denied = await fetch(config.prospectSearchUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    assert.equal(denied.status,401);
    const malformed = await fetch(config.prospectSearchUrl,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'null'});
    assert.equal(malformed.status,400);
    const hostile = await fetch(config.prospectSearchUrl,{method:'POST',headers:{Origin:'https://untrusted.example',Authorization:`Bearer ${token}`},body:'{}'});
    assert.equal(hostile.status,403);
    await db.query("update public.profiles set role='viewer' where id=$1",[userId]);
    const viewer=await fetch(config.prospectSearchUrl,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}'});
    assert.equal(viewer.status,403);
    await db.query("update public.profiles set role='admin',active=false where id=$1",[userId]);
    const inactive=await fetch(config.prospectSearchUrl,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}'});
    assert.equal(inactive.status,403);
    await db.query('update public.profiles set active=true where id=$1',[userId]);
    console.log('PASS: busca rejeita anônimo, perfil viewer/inativo, origem indevida e corpo inválido');
    await page.evaluate(() => window.navegarDashboard('inicio'));
  }
  const crud = await page.evaluate(async () => {
    const c = window.appBackend, uid = window.currentAuth.session.user.id;
    const must = response => { if (response.error) throw new Error(response.error.message); return response.data; };
    const customer = must(await c.from('customers').insert({ name: 'Cliente de teste Neon', created_by: uid }).select('id').single());
    const order = must(await c.from('orders').insert({ customer_id: customer.id, created_by: uid, updated_by: uid }).select('id').single());
    must(await c.from('orders').update({ status: 'confirmed', updated_by: uid }).eq('id', order.id));
    const rows = must(await c.from('orders').select('id,status').eq('id', order.id).single());
    const audit = must(await c.from('order_status_history').select('id').eq('order_id', order.id));
    return { customerId: customer.id, orderId: order.id, status: rows.status, auditCount: audit.length };
  });
  customerId = crud.customerId; orderId = crud.orderId;
  assert.equal(crud.status, 'confirmed'); assert.equal(crud.auditCount, 2);
  console.log('PASS: cliente e pedido criados, consultados, atualizados e auditados pela Data API');
  await page.reload(); await page.waitForFunction(() => !!window.currentAuth);
  console.log('PASS: sessão restaurada após recarregar');
  await page.locator('#btnSair').click(); await page.waitForURL('**/admin.html**');
  const session = await page.evaluate(async () => (await window.appBackend.auth.getSession()).data.session);
  assert.equal(session, null);
  console.log('PASS: logout pela interface');
  assert.deepEqual(failures, []);
  mkdirSync('tmp', { recursive: true }); await page.screenshot({ path: 'tmp/neon-login.png', fullPage: true });
  console.log('PASS: nenhuma exceção JavaScript no navegador');
} catch(error) {
  console.log('Estado:', await page.locator('#prospeccaoAviso').textContent().catch(()=>''));
  mkdirSync('tmp',{recursive:true});await page.screenshot({path:'tmp/neon-e2e-failure.png'}).catch(()=>{});
  throw error;
} finally {
  if (userId) {
    await db.query('delete from public.prospects where created_by=$1',[userId]);
    await db.query('delete from public.orders where created_by=$1', [userId]);
    await db.query('delete from public.customers where created_by=$1', [userId]);
    await db.query('delete from neon_auth."user" where id=$1', [userId]);
  }
  await browser.close(); await db.end();
}
