import pg from 'pg';
import { attachDatabasePool } from '@neon/functions';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createHash } from 'node:crypto';
import { SearchError, parseSearch, geocode, searchOSM } from './prospect-provider.mjs';

const connection = new URL(process.env.DATABASE_URL); connection.searchParams.set('sslmode', 'verify-full');
const pool = new pg.Pool({ connectionString: connection.href, max: 3, connectionTimeoutMillis: 8000, statement_timeout: 8000 });
attachDatabasePool(pool);
const jwks = createRemoteJWKSet(new URL(process.env.MOCHO_AUTH_JWKS_URL));
const issuer = new URL(process.env.MOCHO_AUTH_BASE_URL).origin;
const origins = new Set(['https://sekyra1.github.io', 'http://localhost:3000', 'http://127.0.0.1:3000']);
const digest = value => createHash('sha256').update(value).digest('hex');
async function cacheGet(key) {
  const { rows } = await pool.query('select payload from search_private.cache where key=$1 and expires_at>now()', [key]);
  return rows[0]?.payload;
}
async function cacheSet(key, payload, hours) {
  await pool.query("insert into search_private.cache(key,payload,expires_at) values($1,$2,now()+($3*interval '1 hour')) on conflict(key) do update set payload=excluded.payload,expires_at=excluded.expires_at", [key, payload, hours]);
}
async function quota(key, limit, seconds) {
  const window = Math.floor(Date.now()/(seconds*1000));
  const { rows } = await pool.query(`insert into search_private.quotas(key,bucket,count,expires_at) values($1,$2,1,now()+($4*interval '1 second'))
    on conflict(key,bucket) do update set count=search_private.quotas.count+1 where search_private.quotas.count<$3 returning count`, [key,window,limit,seconds]);
  if (!rows.length) throw new SearchError('Limite temporário de buscas atingido. Aguarde antes de tentar novamente.', 429);
}
async function providerSlot(provider, intervalMs) {
  const { rows } = await pool.query(`insert into search_private.provider_slots(provider,next_at) values($1,now()+($2*interval '1 millisecond'))
    on conflict(provider) do update set next_at=excluded.next_at where search_private.provider_slots.next_at<=now() returning provider`, [provider,intervalMs]);
  if (!rows.length) throw new SearchError('Outra busca está em andamento. Aguarde alguns segundos.', 429);
}
export default {
  async fetch(request) {
    const origin = request.headers.get('origin');
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Search-Version': 'osm-20261019-5', Vary: 'Origin',
      ...(origins.has(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS' } : {}) };
    const respond = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, ...(status === 429 ? { 'Retry-After': '60' } : {}) } });
    if (origin && !origins.has(origin)) return respond({ error: 'Origem não autorizada.' },403);
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
    if (request.method !== 'POST') return respond({error:'Método não permitido.'},405);
    let stage='authorization';
    try {
      const authorization = request.headers.get('authorization');
      if (!authorization?.startsWith('Bearer ')) return respond({error:'Entre no painel para buscar oportunidades.'},401);
      let subject;
      try { const { payload } = await jwtVerify(authorization.slice(7), jwks, { issuer, algorithms:['EdDSA'] }); subject=payload.sub; }
      catch { return respond({error:'Sua sessão expirou. Entre novamente.'},401); }
      if (!subject) return respond({error:'Sessão inválida.'},401);
      const profileUrl = new URL(process.env.MOCHO_DATA_API_URL.replace(/\/$/,'')+'/profiles');
      profileUrl.search = new URLSearchParams({id:`eq.${subject}`,select:'role,active',limit:'1'}).toString();
      const profileResponse = await fetch(profileUrl,{headers:{Authorization:authorization},signal:AbortSignal.timeout(8000)});
      if (!profileResponse.ok) return respond({error:'Não foi possível validar suas permissões.'},503);
      const [profile] = await profileResponse.json();
      if (!profile?.active || !['admin','sales'].includes(profile.role)) return respond({error:'A busca exige perfil de vendas ou administrador ativo.'},403);
      stage='quota';
      await quota(`user-minute:${subject}`,10,60);
      await quota(`user-day:${subject}`,100,86400);
      if (Number(request.headers.get('content-length')||0)>4096) return respond({error:'Busca muito grande.'},413);
      const reader=request.body?.getReader(); let content='';
      if (!reader) return respond({error:'Informe a busca.'},400);
      const decoder=new TextDecoder(); let size=0;
      while(true) { const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return respond({error:'Busca muito grande.'},413);}content+=decoder.decode(value,{stream:true}); }
      let input;try{input=JSON.parse(content);}catch{return respond({error:'JSON inválido.'},400);}
      const search=parseSearch(input), key='search:'+digest(JSON.stringify(search));
      stage='cache';
      const cached=await cacheGet(key);if(cached)return respond({...cached,cached:true});
      let center=await cacheGet('geo:'+digest(search.area.toLowerCase()));
      if(!center){await providerSlot('nominatim',1100);stage='geocode';center=await geocode(search.area);await cacheSet('geo:'+digest(search.area.toLowerCase()),center,168);}
      await providerSlot('overpass',5000);await quota('provider-day',100,86400);
      stage='overpass';
      const result=await searchOSM(search,center);await cacheSet(key,result,24);
      // Keep quota/cache storage bounded without storing auth tokens or private customer data.
      await pool.query('delete from search_private.quotas where expires_at<now()');
      await pool.query('delete from search_private.cache where expires_at<now()');
      return respond({...result,cached:false});
    } catch(error) {
      if(error instanceof SearchError)return respond({error:error.message},error.status);
      console.error('prospect_search_failed',stage,error.name,error.code || '');
      return respond({error:'A pesquisa está indisponível no momento. Tente novamente em instantes.'},503);
    }
  }
};
