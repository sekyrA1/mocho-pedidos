import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';

function publicEndpoint(value, suffix) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.pathname.endsWith(suffix)) {
    throw new Error('URL pública do Neon inválida.');
  }
  return url.href.replace(/\/$/, '');
}

try {
  const config = window.NEON_CONFIG || {};
  if (!config.authUrl || !config.dataApiUrl) throw new Error('Configure as URLs públicas do Neon em neon-config.js.');
  const client = createClient({
    auth: { url: publicEndpoint(config.authUrl, '/auth'), adapter: SupabaseAuthAdapter() },
    dataApi: { url: publicEndpoint(config.dataApiUrl, '/rest/v1') }
  });
  window.appBackend = client;
  window.appPasswordAuth = client.auth.getBetterAuthInstance();
  window.searchProspects = async body => {
    if (!config.prospectSearchUrl) return { error: { message: 'Pesquisa externa ainda não configurada.' } };
    const endpoint = new URL(config.prospectSearchUrl);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) throw new Error('Endpoint de pesquisa inválido.');
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session) return { error: error || { message: 'Sessão expirada.' } };
    // Neon injects the signed JWT into the compatibility session's access_token.
    const token = session.access_token;
    if (!token || token.split('.').length !== 3) return { error: { message: 'Sessão inválida. Entre novamente.' } };
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body), signal: AbortSignal.timeout(55000)
    });
    const data = await response.json();
    return response.ok ? { data, error: null } : { data: null, error: data };
  };
} catch (error) {
  window.backendConfigurationError = error.message;
  console.error('Não foi possível inicializar o Neon:', error.message);
}
