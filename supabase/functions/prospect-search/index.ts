const defaultHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

function responseHeaders(request: Request) {
  const origin = request.headers.get('Origin');
  const allowedOrigin = !origin || origin === 'null' || origin === 'https://sekyra1.github.io'
    ? (origin || 'https://sekyra1.github.io')
    : 'https://sekyra1.github.io';
  return { ...defaultHeaders, 'Access-Control-Allow-Origin': allowedOrigin };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(request),
  });
}

function finiteNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const earthRadiusKm = 6371;
  const radians = (value: number) => value * Math.PI / 180;
  const deltaLat = radians(bLat - aLat);
  const deltaLng = radians(bLng - aLng);
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(deltaLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

async function authenticate(request: Request) {
  const authorization = request.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!authorization?.startsWith('Bearer ') || !supabaseUrl || !supabaseKey) return null;

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseKey, Authorization: authorization },
  });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();
  if (!user?.id) return null;

  const profileUrl = new URL(`${supabaseUrl}/rest/v1/profiles`);
  profileUrl.searchParams.set('id', `eq.${user.id}`);
  profileUrl.searchParams.set('select', 'role,active');
  profileUrl.searchParams.set('limit', '1');
  const profileResponse = await fetch(profileUrl, {
    headers: { apikey: supabaseKey, Authorization: authorization },
  });
  if (!profileResponse.ok) return null;
  const profiles = await profileResponse.json();
  const profile = profiles?.[0];
  if (!profile?.active || !['admin', 'sales'].includes(profile.role)) return null;
  return user;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: responseHeaders(request) });
  if (request.method !== 'POST') return json(request, { error: 'Método não permitido.' }, 405);

  const user = await authenticate(request);
  if (!user) return json(request, { error: 'Acesso não autorizado.' }, 401);

  const placesKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!placesKey) {
    return json(request, {
      error: 'A integração de pesquisa ainda não foi configurada.',
      code: 'missing_google_places_key',
    }, 424);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json(request, { error: 'JSON inválido.' }, 400);
  }

  const query = String(body.query || 'dentista').trim().slice(0, 100);
  const area = String(body.area || 'Rio de Janeiro').trim().slice(0, 100);
  const latitude = Math.max(-90, Math.min(90, finiteNumber(body.latitude, -22.9068)));
  const longitude = Math.max(-180, Math.min(180, finiteNumber(body.longitude, -43.1729)));
  const radius = Math.max(500, Math.min(50000, finiteNumber(body.radius, 10000)));
  const pageSize = Math.max(1, Math.min(20, Math.round(finiteNumber(body.pageSize, 20))));
  const textQuery = `${query} em ${area}, Rio de Janeiro`;

  const placesResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': placesKey,
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.location',
        'places.googleMapsUri',
        'places.websiteUri',
        'places.nationalPhoneNumber',
        'places.businessStatus',
        'places.types',
      ].join(','),
    },
    body: JSON.stringify({
      textQuery,
      pageSize,
      locationBias: {
        circle: {
          center: { latitude, longitude },
          radius,
        },
      },
    }),
  });

  if (!placesResponse.ok) {
    console.error('Google Places error', placesResponse.status, await placesResponse.text());
    return json(request, { error: 'Não foi possível consultar o Google Maps.' }, 502);
  }

  const payload = await placesResponse.json();
  const results = (payload.places || []).map((place: Record<string, any>) => {
    const placeLatitude = Number(place.location?.latitude);
    const placeLongitude = Number(place.location?.longitude);
    const distance = Number.isFinite(placeLatitude) && Number.isFinite(placeLongitude)
      ? distanceKm(latitude, longitude, placeLatitude, placeLongitude)
      : null;
    return {
      placeId: place.id || null,
      name: place.displayName?.text || 'Empresa sem nome',
      address: place.formattedAddress || '',
      latitude: Number.isFinite(placeLatitude) ? placeLatitude : null,
      longitude: Number.isFinite(placeLongitude) ? placeLongitude : null,
      distanceKm: distance === null ? null : Number(distance.toFixed(2)),
      mapsUrl: place.googleMapsUri || '',
      website: place.websiteUri || '',
      phone: place.nationalPhoneNumber || '',
      businessStatus: place.businessStatus || '',
      types: Array.isArray(place.types) ? place.types.slice(0, 8) : [],
    };
  }).filter((place: { distanceKm: number | null }) => place.distanceKm === null || place.distanceKm <= radius / 1000)
    .sort((first: { distanceKm: number | null }, second: { distanceKm: number | null }) =>
      (first.distanceKm ?? Number.POSITIVE_INFINITY) - (second.distanceKm ?? Number.POSITIVE_INFINITY));

  return json(request, {
    userId: user.id,
    area: { query, name: area, latitude, longitude, radiusMeters: radius },
    results,
  });
});
