import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSearch, categoryFilters, mapElements, distanceKm } from '../functions/prospect-provider.mjs';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

test('invalid bodies and unbounded searches are rejected', () => {
  for(const input of [null, [], {}, {query:'dentista',area:'Rio',radius:Infinity}, {query:'dentista',area:'Rio',radius:50001}, {query:'dentista',area:'Rio',pageSize:1000}]) assert.throws(()=>parseSearch(input));
  assert.equal(parseSearch({query:'dentista',area:'Rio'}).radius,10000);
  assert.ok(categoryFilters('clínica odontológica').includes('["amenity"="dentist"]'));
  const attack='x"];out;["name"~".*';
  assert.ok(categoryFilters(attack)[0].includes('\\"'));
});
test('results have stable identities, real distances and safe links', () => {
  const center={latitude:-22.9,longitude:-43.2,city:'Rio',state:'RJ'};
  const result=mapElements([
    {type:'node',id:12,lat:-22.9,lon:-43.2,tags:{name:'Dentista',website:'javascript:alert(1)'}},
    {type:'way',id:13,center:{lat:-22.9,lon:-43.2},tags:{name:'Dentista'}},
    {type:'node',id:14,lat:0,lon:0,tags:{name:'Fora do raio'}}
  ],center,1000,20);
  assert.equal(result.length,1);assert.equal(result[0].placeId,'osm:node:12');assert.equal(result[0].website,'');assert.equal(result[0].distanceKm,0);
  assert.equal(distanceKm(0,0,0,0),0);
});
test('backend quotas and provider throttling are atomic', async () => {
  const db=new PGlite();
  try {
    await db.exec(readFileSync('neon/prospect-backend.sql','utf8'));
    const quota=`insert into search_private.quotas(key,bucket,count,expires_at) values('test',1,1,now()+interval '1 minute') on conflict(key,bucket) do update set count=search_private.quotas.count+1 where search_private.quotas.count<2 returning count`;
    assert.equal((await db.query(quota)).rows[0].count,1);assert.equal((await db.query(quota)).rows[0].count,2);assert.equal((await db.query(quota)).rows.length,0);
    const slot=`insert into search_private.provider_slots(provider,next_at) values('nominatim',now()+interval '1 second') on conflict(provider) do update set next_at=excluded.next_at where search_private.provider_slots.next_at<=now() returning provider`;
    assert.equal((await db.query(slot)).rows.length,1);assert.equal((await db.query(slot)).rows.length,0);
  } finally {await db.close();}
});
