# Backlog

Estado em 2026-10-13. O que **já** é real está descrito em `CLAUDE.md`; aqui ficam só as lacunas conhecidas.
Itens marcados com **(você)** dependem de uma conta, chave ou decisão que não está no código.

## Depende de ação externa

- [x] ~~**`CRON_SECRET` na Vercel (Production).**~~ Feito pelo dono. Para conferir: `docker exec garimpo-importer node importer.mjs --once` deve registrar `site_notified` com status 200.
- [ ] **(você) E-mail transacional.** Envio por Brevo implementado (`lib/auth/email.ts`) e testado. Falta: (1) confirmar o remetente `garimpou.certo@gmail.com` no e-mail que o Brevo enviou (hoje o Brevo rejeita todo envio); (2) conferir o valor de `EMAIL_FROM` na Vercel, que apareceu com sublinhados no lugar dos espaços (o certo é `Garimpo certo <garimpou.certo@gmail.com>`); (3) para sair do "via brevosend.com", usar um domínio próprio autenticado (DKIM/DMARC) no Brevo.
- [ ] **(você) `BETTER_AUTH_URL` / `NEXT_PUBLIC_BETTER_AUTH_URL` em produção.** Precisam apontar para o domínio real (o código avisa no log se detectar `localhost` em produção). Atenção: variáveis `NEXT_PUBLIC_*` entram no build, então exigem redeploy.
- [ ] **(você) Domínio.** `NEXT_PUBLIC_SITE_URL` define canonical, sitemap, Open Graph e JSON-LD. Hoje o site está em `garimpo-certo-coral.vercel.app`; sem a variável usa o domínio que a Vercel injeta.
- [ ] **(você) Contato da LGPD.** `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL` aparece na página de privacidade para pedidos que o autoatendimento (`/conta#dados`) não cobre.
- [ ] **(você) Login com Google.** O botão só aparece com `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (confirmar no ambiente de produção).
- [ ] **(você) Redeploy depois de mexer em variáveis.** A Vercel só aplica variável nova a deploys feitos depois; a tela Integrações do painel mostra "Faltando" enquanto o deploy no ar não as tem.

## Produto

- [x] ~~**CMS visual estilo Shopify (editor de páginas e seções).**~~ Primeira versão em 2026-10-13, só para a **home**: seções internas e blocos livres (banner, texto, cartões, imagem, chamada, espaço), prévia com o rascunho real, salvamento automático, publicar/descartar e 15 versões. Falta: outras páginas (coleções, guias, páginas de conteúdo), agendar publicação, tema por página e arrastar para reordenar (hoje são botões).
- [ ] **Engine (IA do Garimpo) — o que ainda falta.** Feitos: fila de propostas, faxina do catálogo, radar por calendário, postagens no Telegram, IA de redação, personalização no aparelho (ver `docs/ENGINE.md`). Faltam: radar por clima/notícias, sugestões editoriais por IA (coleções e textos), postagens para Instagram/TikTok/WhatsApp e a extensão de navegador (parada).
- [x] ~~**Comissões reais.**~~ Feito em 2026-10-13: `conversionReport` é importado para `affiliate_conversions` (worker a cada 3 h, botão em Analytics). `validatedReport` não entra: exige um `validationId` que só o painel de pagamentos da Shopee fornece. Falta ver o primeiro pedido real para confirmar `utmContent`/`netCommission`.
- [ ] **Alertas operacionais.** Primeira parte feita em 2026-10-13: o painel mostra no topo da visão geral o que precisa de atenção (importação, comissões, tarefas, prazo da LGPD) e `/api/v1/health` responde 503 quando algo está crítico, para um monitor externo avisar. Falta o **aviso ativo** (e-mail ou Telegram). O alerta de queda de preço do visitante aparece em Favoritos (2026-10-13); falta o aviso por e-mail e guardar a referência no servidor para valer em outro aparelho.
- [x] ~~**Upload de imagens no painel.**~~ Feito em 2026-10-13 (campanhas, cupons e SEO). Artigos em Markdown ainda recebem imagem por URL.
- [x] ~~**Regras automáticas editáveis.**~~ Feito em 2026-10-13: Painel → Regras do catálogo e Guias de compra. Continuam no código: os tetos das coleções por faixa (`ate-20/50/100`, que fazem parte do endereço) e a lista de categorias dos guias.
- [x] ~~**Teste A/B de verdade.**~~ Primeira versão em 2026-10-13, para o texto do topo da home (Painel → Testes A/B). Falta testar outras partes (coleções, ordem das seções, cartões) e medir venda real quando houver comissões suficientes.
- [ ] **Segmentação na vitrine.** Parada de propósito (2026-10-13): a personalização no aparelho já adapta a home. Segmentos seguem como análise de cliques; retomar só se for preciso direcionar banners ou coleções por perfil.
- [x] ~~**Proteção de administradores (MFA).**~~ Feito em 2026-10-13: verificação em duas etapas (TOTP + códigos de recuperação) em Minha conta › Segurança, e `ADMIN_REQUIRE_MFA=1` para exigir de OWNER/ADMIN. Falta: ligar a exigência (depois de a equipe ativar) e decidir o que fazer com o login do Google, que não passa pelo segundo passo.
- [ ] **Cupons automáticos.** Confirmado por introspecção da API em 2026-10-13: as únicas consultas são `shopOfferV2`, `shopeeOfferV2`, `productOfferV2`, `conversionReport`, `validatedReport`, `partnerOrderReport`, `listItemFeeds` e `getItemFeedData`, e as mutações `generateShortLink`/`generateBatchShortLink`; nenhuma traz cupom ou voucher. Hoje: cadastro manual + campanhas de categoria (`shopeeOfferV2`). O relatório de cliques por cupom já existe no painel.
- [ ] **Outros provedores.** Só a Shopee; a tela de provedores não cria novos e o importador é específico dela.
- [x] ~~**Fila para pedidos de titulares (LGPD).**~~ Feito em 2026-10-13: formulário público em `/privacidade#pedido`, fila em Painel → LGPD e consentimento gravado em `consent_records`. Falta aviso ao time quando chega pedido novo e tela do histórico de consentimento de um titular.
- [ ] **Avaliações, frete e crescimento.** A API de afiliados da Shopee não expõe contagem de avaliações, frete nem série de crescimento; a interface não inventa esses dados.

## Engenharia

- [ ] **Branch do Neon para testes.** O suporte existe (`TEST_DATABASE_URL`), mas ainda é preciso criar o branch no Neon e configurá-lo no CI. Sem isso, a integração roda no banco real (criando e removendo os próprios dados).
- [x] ~~**Testes do painel com login real.**~~ Feito (`tests/e2e/admin-modules.spec.ts`): proprietário real percorrendo os 35 módulos no desktop e no celular.
- [x] ~~**Layout do admin no celular.**~~ Nenhum módulo estoura a largura de um Pixel 5 (checado automaticamente). Falta só a revisão visual do desenho, com alguém olhando.
- [x] ~~**Worker da VPS: vigilância.**~~ Se o worker parar, o painel alerta e `/api/v1/health` responde 503. Atualizar o código na VPS segue manual (`worker/README.md`).
- [ ] **Monitorar a cota do otimizador de imagens** no painel da Vercel e manter `images.remotePatterns` em dia ao adicionar um provedor com outro CDN.
- [ ] **Ativar o Speed Insights** no painel da Vercel. O componente já é carregado com consentimento; sem a ativação não há dados de campo.
- [ ] **Regressão visual automática.** Parada de propósito: capturas dependem de fonte/sistema e o catálogo muda todo dia (alarme falso).
- [ ] **Disco do ambiente local.** O C: oscila em GBs e já derrubou builds; ver a memória do projeto (`dev-environment-gotchas`).

## Tabelas do schema sem código usando

`affiliateLinks`/`affiliatePrograms`, `offerPrices`/`offerAvailability`/`offerCommissions`, `providerAccounts`/`providerCapabilities`, `anonymousIdentities`/`identityMerges`, `dailyProductMetrics`/`hourlyProductMetrics`, `productVariants`, `privacyPreferences` (o consentimento agora também é gravado em `consent_records`; exportação e exclusão usam rota própria e o Better Auth).

Já usadas pelo painel: `auditLogs`, `globalSettings`, `featureFlags`, `syncJobs`/`syncJobRuns`/`syncErrors`, `privacyRequests`, `sessions`/`roles`/`userRoles`.

## Referência rápida

- Banco: `pnpm db:generate` / `db:migrate` / `db:pull` / `db:studio` / `db:seed-roles` / `db:grant-role` / `db:seed-catalog` / `db:import-shopee`
- Testes: `pnpm test` (unit + integração), `pnpm test:e2e` (dev), `pnpm test:e2e:prod` (build de produção)
- Papéis RBAC: `OWNER`, `ADMIN`, `MARKETING`, `CATALOG_MANAGER`, `ANALYST`, `SUPPORT`, `READ_ONLY` (`lib/auth/rbac.ts`)
- Importação diária: worker na VPS (`worker/`, container `garimpo-importer`), 06:00 de Brasília

> A lista de acompanhamento atualizada está em `docs/TODO.md`; este arquivo guarda o detalhe de cada lacuna.
