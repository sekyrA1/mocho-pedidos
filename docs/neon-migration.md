# Migração para Neon

Projeto: `mocho-pedidos` (`restless-cell-69985201`), organização `org-round-sound-50374504`, branch `production`, região São Paulo (`aws-sa-east-1`).

## Arquitetura

O site continua estático. `@neondatabase/neon-js@0.8.0-beta` agrupa Neon Auth e Data API. O adaptador oficial conserva os métodos de autenticação já utilizados pelo aplicativo; consultas PostgREST continuam usando as oito tabelas e suas regras de acesso. O bundle é local, sem carregar o SDK do Supabase por CDN.

`neon.ts` declara Auth e Data API. `neon deploy` provisiona os serviços e baixa as conexões para `.env.local`, ignorado pelo Git. O build publica somente `NEON_AUTH_BASE_URL` e `NEON_DATA_API_URL` em `neon-config.js`. Nenhuma conexão PostgreSQL, senha, segredo de sessão ou chave administrativa pode aparecer nesse arquivo.

Os identificadores de Neon Auth foram inspecionados no banco real: `neon_auth."user".id` é UUID neste projeto. A migração conserva UUID nas referências e usa `auth.uid()` fornecido pela Data API. Cadastro não concede permissão: somente perfis provisionados explicitamente entram no painel. Papéis vêm de `public.profiles`, nunca de metadados editáveis pelo usuário.

## Comandos no diretório do projeto

```powershell
neon deploy
npm run db:migrate
neon data-api refresh-schema --branch production
npm run build
npm test
npm start
```

Abra `http://localhost:3000/admin.html`. O servidor local não disponibiliza arquivos `.env`, scripts administrativos ou SQL.

Migrações usam `DATABASE_URL_UNPOOLED`, transação, trava de concorrência e checksum. A migração inicial serve somente para um banco novo e não modifica o Supabase antigo. `supabase/migrations` permanece como histórico da estrutura anterior.

## Acesso administrativo

Crie a conta no Neon Auth e autorize-a no terminal:

```powershell
npm run db:grant -- seu@email.com admin
```

O comando exige que a identidade já exista em `neon_auth."user"`. Ele não define nem imprime senhas. O sistema não importa as contas ou senhas do Supabase. Use uma senha nova.

Login, sessão e logout passam pelo Neon Auth. Recuperação usa `resetPasswordForEmail` e `resetPassword({ token, newPassword })`; o token sai imediatamente da barra de endereço e fica em memória. A entrega e o recebimento do e-mail de recuperação ainda precisam ser verificados com o endereço do administrador.

O domínio `https://sekyra1.github.io` está autorizado no Neon Auth; localhost também está habilitado. Um novo domínio precisa ser adicionado à allowlist antes da publicação.

## Validação

`tests/neon-schema.test.mjs` executa a migração num Postgres embarcado e verifica RLS, autoria, histórico, bloqueio de perfil inativo, restrições de finanças e impedimento de escalada de privilégios.

`scripts/neon-e2e.mjs` abre Chromium, cadastra uma identidade temporária no Neon real, verifica o bloqueio sem perfil, autoriza o perfil de teste, entra pela interface, cria/atualiza/consulta registros pela Data API, verifica auditoria, restaura a sessão após reload e sai pela interface. Remove todos os registros e a identidade temporária ao terminar.

```powershell
node --env-file=.env.neon-test scripts/neon-e2e.mjs
# Teste explícito na branch de produção, somente com dados temporários removidos ao final:
node --env-file=.env.local scripts/neon-e2e.mjs --production
```

## Pesquisa externa de prospecção

A pesquisa usa OpenStreetMap, escolhido pelo proprietário, sem Google Places ou chave paga. A função `prospectsearch` fica no projeto `mocho-prospeccao` (`autumn-art-45470208`), região Ohio, pois São Paulo ainda não oferece Functions. O banco e o login principais continuam em São Paulo.

O backend verifica JWT do Neon Auth principal e perfil ativo `admin`/`sales`, limita entradas a 4 KiB, aplica quotas atômicas e guarda cache privado. Não envia clientes nem pedidos aos serviços de mapas: envia somente área, categoria, raio e coordenadas. Geocodificação: Nominatim; estabelecimentos: Overpass/Private.coffee. Cache de geocodificação: 7 dias; resultados: 24 horas. Limites: 10 buscas/minuto e 100/dia por usuário, até 100 consultas externas/dia na aplicação, um acesso ao Nominatim a cada 1,1 s e ao Overpass a cada 5 s. Serviços comunitários podem estar indisponíveis; resultados, telefones e CNPJ dependem do cadastro na base. A interface atribui os dados ao OpenStreetMap/ODbL e oferece o Google Maps como link alternativo.

O identificador `osm:tipo:id` é guardado na coluna histórica `google_place_id` para aproveitar sua unicidade; `source_provider` registra `openstreetmap`. Nenhum dado OSM é apresentado como Google Places.

```powershell
# Somente na conexão do projeto mocho-prospeccao: aplicar neon/prospect-backend.sql.
neon deploy --config neon.prospect.ts --project-id autumn-art-45470208 --branch main --env .env.local --no-env-pull
```

Não executar `neon env pull` desse projeto sobre `.env.local`; use `.env.prospect-backend`. Os endpoints principais são passados como `MOCHO_AUTH_BASE_URL`, `MOCHO_AUTH_JWKS_URL` e `MOCHO_DATA_API_URL`. A conexão de cache é injetada pelo runtime e permanece no servidor.

## Publicação

`.github/workflows/pages.yml` executa instalação, testes, build e empacotamento antes de publicar no GitHub Pages. O artefato contém somente HTML, CSS, JS e assets; exclui conexões `.env`, SQL e código administrativo/backend. O host continua `https://sekyra1.github.io/mocho-pedidos/`.
