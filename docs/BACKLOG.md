# Backlog

Estado em 2026-10-13. O que **já** é real está descrito em `CLAUDE.md`; aqui ficam só as lacunas conhecidas.
Itens marcados com **(você)** dependem de uma conta, chave ou decisão que não está no código.

## Depende de ação externa

- [ ] **(você) E-mail transacional.** O envio por Brevo está implementado (`lib/auth/email.ts`) e testado, mas só liga com `BREVO_API_KEY` e `EMAIL_FROM` no ambiente (local já configurado com `garimpou.certo@gmail.com`, pendente de confirmação no Brevo; falta levar as duas ao Vercel). Sem eles, o link de redefinição de senha só vai para o log do servidor e a tela avisa isso.
- [ ] **(você) `BETTER_AUTH_URL` / `NEXT_PUBLIC_BETTER_AUTH_URL` em produção.** Precisam apontar para o domínio real (o código avisa no log se detectar `localhost` em produção).
- [ ] **(você) `CRON_SECRET` em produção.** Sem ele a importação diária (`vercel.json`) responde 503 e o catálogo volta a envelhecer.
- [ ] **(você) Domínio.** `NEXT_PUBLIC_SITE_URL` define canonical, sitemap, Open Graph e JSON-LD. Sem ele usa o domínio de produção que a Vercel injeta.
- [ ] **(você) Contato da LGPD.** `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL` aparece na página de privacidade para pedidos que o autoatendimento (`/conta#dados`) não cobre.
- [ ] **(você) Login com Google.** O botão só aparece com `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (confirmar no ambiente de produção).

## Produto

- [ ] **Edição humana de coleções e guias.** Hoje são calculados a partir do catálogo (`lib/catalog/collections.ts`, `lib/catalog/guides.ts`) e o texto de "o que observar" está em código. Curadoria manual (escolher produtos, escrever guias) exigiria tabelas e um fluxo de edição.
- [ ] **Painel admin.** Enxuto por decisão: Visão geral, Catálogo/importação, Analytics e Funil usam dados reais. Os ~26 módulos de demonstração (CRUD em `localStorage`) ficam escondidos por `NEXT_PUBLIC_ADMIN_DEMO_MODULES`. Se algum virar produto real, ele precisa de tabela e API próprias; o admin não recebeu o redesign da vitrine e é onde mora a maior parte do `app/globals.css`.
- [ ] **Personalização.** Hoje só alimenta a aba "Para você" da home. Busca e ranking não leem os interesses.
- [ ] **Fila para pedidos de titulares.** O autoatendimento cobre acesso, portabilidade, correção e exclusão; não há fila para o que ele não resolve.
- [ ] **Avaliações, frete e crescimento.** A API de afiliados da Shopee não expõe contagem de avaliações, frete nem série de crescimento; a interface não inventa esses dados.

## Engenharia

- [ ] **Branch do Neon para testes.** O suporte existe (`TEST_DATABASE_URL`), mas ainda é preciso criar o branch no Neon e configurá-lo no CI. Sem isso, a integração roda no banco real (criando e removendo os próprios registros).
- [ ] **Monitorar a cota do otimizador de imagens** no painel da Vercel e manter `images.remotePatterns` em dia ao adicionar um provedor com outro CDN.
- [ ] **Ativar o Speed Insights** no painel da Vercel. O componente já é carregado com consentimento; sem a ativação não há dados de campo.
- [ ] **Regressão visual automática.** Não há; a limpeza de CSS foi validada por snapshot de estilos computados (script descartável).
- [ ] **Gestão de admins.** Promover papel é manual via `pnpm db:grant-role <email> <ROLE_CODE>`.

## Tabelas do schema sem código usando

`syncJobs`/`syncJobRuns`/`syncErrors`, `affiliateLinks`/`affiliatePrograms`, `offerPrices`/`offerAvailability`/`offerCommissions`, `providerAccounts`/`providerCapabilities`, `anonymousIdentities`/`identityMerges`, `dailyProductMetrics`/`hourlyProductMetrics`, `auditLogs`, `globalSettings`, `productVariants`, `consentRecords`/`privacyPreferences`/`privacyRequests` (o consentimento ainda é só `localStorage`; exportação e exclusão usam rota própria e o Better Auth).

## Referência rápida

- Banco: `pnpm db:generate` / `db:migrate` / `db:pull` / `db:studio` / `db:seed-roles` / `db:grant-role` / `db:seed-catalog` / `db:import-shopee`
- Testes: `pnpm test` (unit + integração), `pnpm test:e2e` (dev), `pnpm test:e2e:prod` (build de produção)
- Papéis RBAC: `OWNER`, `ADMIN`, `MARKETING`, `CATALOG_MANAGER`, `ANALYST`, `SUPPORT`, `READ_ONLY` (`lib/auth/rbac.ts`)
