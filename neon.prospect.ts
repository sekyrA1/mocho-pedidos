import { defineConfig } from '@neon/config/v1';
// Deploy with --project-id autumn-art-45470208 --branch main --no-env-pull.
// The application database and Auth stay in the primary São Paulo project.
export default defineConfig({
  functions: {
    prospectsearch: {
      name: 'Pesquisa de prospecção', source: 'functions/prospectsearch.mjs',
      env: {
        MOCHO_AUTH_BASE_URL: process.env.NEON_AUTH_BASE_URL!,
        MOCHO_AUTH_JWKS_URL: process.env.NEON_AUTH_JWKS_URL!,
        MOCHO_DATA_API_URL: process.env.NEON_DATA_API_URL!
      }
    }
  }
});
