export class SearchError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}
export function parseSearch(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SearchError('Envie um objeto de busca.', 400);
  const query = typeof input.query === 'string' ? input.query.trim() : '';
  const area = typeof input.area === 'string' ? input.area.trim() : '';
  const radius = Number(input.radius ?? 10000), pageSize = Number(input.pageSize ?? 20);
  if (!query || query.length > 100 || !area || area.length > 100 || !Number.isFinite(radius) || radius < 500 || radius > 50000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 20) throw new SearchError('Informe uma busca e área de até 100 caracteres e um raio entre 500 m e 50 km.', 400);
  return { query, area, radius, pageSize };
}
export function distanceKm(a, b, c, d) {
  const rad = n => n * Math.PI / 180;
  const h = Math.sin(rad(c-a)/2)**2 + Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(rad(d-b)/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1-h)));
}
const normalized = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function categorySearchTerm(query) {
  const term = normalized(query);
  if (/dent|odont/.test(term)) return 'dentist';
  if (/fisio/.test(term)) return 'physiotherapist';
  if (/veterin/.test(term)) return 'veterinary';
  if (/hospit/.test(term)) return 'hospital';
  if (/clin|medic|saude/.test(term)) return 'clinic';
  return query;
}
export async function fetchJSON(url, options = {}, timeout = 12000) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeout), headers: {
    'User-Agent': 'MochoPedidos/1.0 (https://sekyra1.github.io/mocho-pedidos/)', ...options.headers
  } });
  if (!response.ok) throw new SearchError(response.status === 429 ? 'O serviço de mapas está ocupado. Aguarde antes de tentar novamente.' : 'O serviço de mapas está indisponível. Tente novamente mais tarde.', response.status === 429 ? 429 : 502);
  return response.json();
}
export async function geocode(area) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  const location = /rio de janeiro/i.test(area) ? `${area}, Brasil` : `${area}, Rio de Janeiro, Brasil`;
  url.search = new URLSearchParams({ q: location, format: 'jsonv2', limit: '1', countrycodes: 'br', addressdetails: '1' }).toString();
  const rows = await fetchJSON(url);
  if (!rows.length) throw new SearchError('Área não encontrada. Use um bairro ou cidade do Rio de Janeiro.', 404);
  const row = rows[0], latitude = Number(row.lat), longitude = Number(row.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new SearchError('O mapa retornou coordenadas inválidas.');
  return { latitude, longitude, label: row.display_name, city: row.address?.city || row.address?.town || row.address?.municipality || 'Rio de Janeiro', state: 'RJ' };
}
const safeWebsite = value => {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
};
export function mapElements(elements, center, radius, limit) {
  const unique = new Map();
  for (const item of elements) {
    const tags = item.tags || {}, latitude = Number(item.lat ?? item.center?.lat), longitude = Number(item.lon ?? item.center?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const distance = distanceKm(center.latitude, center.longitude, latitude, longitude);
    if (distance > radius / 1000) continue;
    const name = tags.name || tags.operator;
    if (!name) continue;
    const key = `${normalized(name)}:${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
    if (unique.has(key)) continue;
    const city = tags['addr:city'] || center.city;
    const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(', ');
    unique.set(key, {
      placeId: `osm:${item.type}:${item.id}`, provider: 'openstreetmap', name,
      address: [street, tags['addr:suburb'], city].filter(Boolean).join(' · '), city, state: center.state,
      latitude, longitude, distanceKm: Math.round(distance*100)/100,
      mapsUrl: `https://www.openstreetmap.org/${item.type}/${item.id}`,
      website: safeWebsite(tags.website || tags['contact:website']),
      phone: tags.phone || tags['contact:phone'] || '',
      cnpj: (tags['ref:cnpj'] || '').replace(/\D/g, '').slice(0,14),
      types: [tags.healthcare || tags.amenity || 'estabelecimento']
    });
  }
  return [...unique.values()].sort((a,b) => a.distanceKm-b.distanceKm).slice(0,limit);
}
export async function searchOSM(search, center) {
  // Interactive, user-triggered best-match search only: no paging, crawling or bulk POI download.
  const url = new URL('https://nominatim.openstreetmap.org/search');
  const dy=search.radius/111320, dx=dy/Math.cos(center.latitude*Math.PI/180);
  const area=/rio de janeiro/i.test(search.area)?search.area:`${search.area}, Rio de Janeiro`;
  url.search=new URLSearchParams({q:`${categorySearchTerm(search.query)} in ${area}`,format:'jsonv2',limit:String(search.pageSize),addressdetails:'1',extratags:'1',countrycodes:'br',layer:'poi',
    viewbox:`${center.longitude-dx},${center.latitude+dy},${center.longitude+dx},${center.latitude-dy}`,bounded:'1','accept-language':'pt-BR,en'}).toString();
  const rows = await fetchJSON(url, {}, 15000);
  if(!Array.isArray(rows))throw new SearchError('O serviço de busca retornou uma resposta inválida.');
  const elements=rows.map(row=>({type:row.osm_type,id:row.osm_id,lat:row.lat,lon:row.lon,tags:{...row.extratags,name:row.name,
    amenity:row.type,'addr:street':row.address?.road,'addr:housenumber':row.address?.house_number,'addr:suburb':row.address?.suburb,'addr:city':row.address?.city || row.address?.town || center.city}}));
  return { provider: 'openstreetmap', attribution: '© OpenStreetMap contributors', attributionUrl: 'https://www.openstreetmap.org/copyright',
    area: { ...center, radiusMeters: search.radius }, results: mapElements(elements, center, search.radius, search.pageSize),
    notice:'Seleção dos melhores resultados do OpenStreetMap; não é uma lista completa de estabelecimentos.' };
}
