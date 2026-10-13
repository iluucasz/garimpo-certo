# Backlog

Estado em 2026-10-13. O que **já** é real está descrito em `CLAUDE.md`; aqui ficam só as lacunas conhecidas.
Itens marcados com **(você)** dependem de uma conta, chave ou decisão que não está no código.

## Depende de ação externa

- [ ] **(você) `CRON_SECRET` na Vercel (Production) + redeploy.** O valor foi gerado e está no `.env` local (linha `CRON_SECRET=`) e no worker da VPS; falta o **mesmo valor** na Vercel. Sem isso o site responde 503 a `POST /api/v1/cron/revalidate` e o worker não consegue avisar que o catálogo mudou (o cache só expira sozinho em até 5 min). Depois: `docker exec garimpo-importer node importer.mjs --once` deve registrar `site_notified` com status 200.
- [ ] **(você) E-mail transacional.** Envio por Brevo implementado (`lib/auth/email.ts`) e testado. Falta: (1) confirmar o remetente `garimpou.certo@gmail.com` no e-mail que o Brevo enviou (hoje o Brevo rejeita todo envio); (2) conferir o valor de `EMAIL_FROM` na Vercel, que apareceu com sublinhados no lugar dos espaços (o certo é `Garimpo certo <garimpou.certo@gmail.com>`); (3) para sair do "via brevosend.com", usar um domínio próprio autenticado (DKIM/DMARC) no Brevo.
- [ ] **(você) `BETTER_AUTH_URL` / `NEXT_PUBLIC_BETTER_AUTH_URL` em produção.** Precisam apontar para o domínio real (o código avisa no log se detectar `localhost` em produção). Atenção: variáveis `NEXT_PUBLIC_*` entram no build, então exigem redeploy.
- [ ] **(você) Domínio.** `NEXT_PUBLIC_SITE_URL` define canonical, sitemap, Open Graph e JSON-LD. Hoje o site está em `garimpo-certo-coral.vercel.app`; sem a variável usa o domínio que a Vercel injeta.
- [ ] **(você) Contato da LGPD.** `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL` aparece na página de privacidade para pedidos que o autoatendimento (`/conta#dados`) não cobre.
- [ ] **(você) Login com Google.** O botão só aparece com `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (confirmar no ambiente de produção).
- [ ] **(você) Redeploy depois de mexer em variáveis.** A Vercel só aplica variável nova a deploys feitos depois; a tela Integrações do painel mostra "Faltando" enquanto o deploy no ar não as tem.

## Produto

- [ ] **CMS visual estilo Shopify (editor de páginas e seções).** Hoje o painel edita por formulários: textos e ordem das seções da home, campanhas, artigos e páginas em Markdown. Falta um editor de **seções e blocos** com pré-visualização ao vivo, rascunho/publicação e versões, para montar a home, páginas e coleções sem código. Referência: o projeto **nextrotta** (no PC do dono) tem um CMS nesse estilo que pode ser copiado e adaptado. Caminho: `C:\Users\iluuc\Documents\sistema-operacional`. Ao portar, observar:
  - modelo de dados: páginas → seções → blocos, com JSON validado por tipo de seção, rascunho e versão publicada (hoje só `content_pages.body` em Markdown e `global_settings.home`);
  - a vitrine precisa renderizar as seções por um registro de componentes (`hero`, `categorias`, `vitrine`, `campanha`, `guias`...), mantendo SSR/ISR e a invalidação por tag (`lib/db/invalidate.ts`);
  - substituir gradualmente o módulo **Home** (`settings.home`) pelo editor, sem perder o comportamento atual como padrão;
  - permissões (`content:write`), trilha de auditoria (`recordAudit`) e imagens (upload via Vercel Blob, ver abaixo) reaproveitados.
- [ ] **Comissões reais.** `conversionReport`/`validatedReport` da API de afiliados trazem as comissões de fato; ainda não são importadas para `affiliate_conversions`. Os números de conversão e comissão do painel dependem disso.
- [ ] **Alertas operacionais.** Nada avisa quando a importação falha ou o catálogo envelhece (só aparece em Logs). Também não há alerta de queda de preço para o visitante.
- [ ] **Upload de imagens no painel.** Campanhas, cupons e artigos pedem URL de imagem. O Vercel Blob já existe (`lib/storage/blob.ts`); falta o upload no painel.
- [ ] **Regras automáticas editáveis.** Limiares de coleções (`viralizou`, `achadinhos`, descontos) e as listas de verificação dos guias por categoria estão no código (`lib/catalog/collections.ts`, `lib/catalog/guides.ts`).
- [ ] **Teste A/B de verdade.** "Recursos e experimentos" só liga e desliga partes do site (a liberação por porcentagem foi retirada por não haver bucketing estável). Falta variantes, atribuição fixa por visitante e medição por variante.
- [ ] **Segmentação na vitrine.** Segmentos (`segments`) calculam alcance sobre os cliques medidos, mas não direcionam conteúdo. A personalização real é só a aba "Para você" da home; busca e ranking não leem interesses.
- [ ] **Convite e proteção de administradores.** A pessoa precisa criar a conta antes de receber um papel; não há convite por e-mail nem MFA para OWNER/ADMIN.
- [ ] **Cupons automáticos.** A API de afiliados não expõe cupons (limitação da Shopee). Hoje: cadastro manual + campanhas de categoria (`shopeeOfferV2`). Relatório de cliques por cupom no painel ainda não existe (o clique é gravado como `coupon_click`).
- [ ] **Outros provedores.** Só a Shopee; a tela de provedores não cria novos e o importador é específico dela.
- [ ] **Fila para pedidos de titulares (LGPD).** O autoatendimento cobre acesso, portabilidade, correção e exclusão; não há canal humano para o que ele não resolve, e o consentimento não é gravado no banco (só no navegador; `consent_records` sem uso).
- [ ] **Avaliações, frete e crescimento.** A API de afiliados da Shopee não expõe contagem de avaliações, frete nem série de crescimento; a interface não inventa esses dados.

## Engenharia

- [ ] **Branch do Neon para testes.** O suporte existe (`TEST_DATABASE_URL`), mas ainda é preciso criar o branch no Neon e configurá-lo no CI. Sem isso, a integração roda no banco real (criando e removendo os próprios dados).
- [ ] **Testes do painel com login real.** Os e2e do admin usam sessão simulada; o fluxo completo (cupom, artigo, campanha, tema, produto) foi verificado à mão.
- [ ] **Layout do admin.** Não recebeu o redesign da vitrine e não foi testado em celular; é onde mora a maior parte do `app/globals.css`.
- [ ] **Worker da VPS: versionamento e vigilância.** Imagem `garimpo-importer:<tag>` (ver `worker/README.md`). Falta decidir como atualizar o código na VPS (hoje `git archive` manual) e como ser avisado se o container parar.
- [ ] **Monitorar a cota do otimizador de imagens** no painel da Vercel e manter `images.remotePatterns` em dia ao adicionar um provedor com outro CDN.
- [ ] **Ativar o Speed Insights** no painel da Vercel. O componente já é carregado com consentimento; sem a ativação não há dados de campo.
- [ ] **Regressão visual automática.** Não há.
- [ ] **Disco do ambiente local.** O C: oscila em GBs e já derrubou builds; ver a memória do projeto (`dev-environment-gotchas`).

## Tabelas do schema sem código usando

`affiliateLinks`/`affiliatePrograms`, `offerPrices`/`offerAvailability`/`offerCommissions`, `providerAccounts`/`providerCapabilities`, `anonymousIdentities`/`identityMerges`, `dailyProductMetrics`/`hourlyProductMetrics`, `productVariants`, `consentRecords`/`privacyPreferences` (o consentimento ainda é só `localStorage`; exportação e exclusão usam rota própria e o Better Auth).

Já usadas pelo painel: `auditLogs`, `globalSettings`, `featureFlags`, `syncJobs`/`syncJobRuns`/`syncErrors`, `privacyRequests`, `sessions`/`roles`/`userRoles`.

## Referência rápida

- Banco: `pnpm db:generate` / `db:migrate` / `db:pull` / `db:studio` / `db:seed-roles` / `db:grant-role` / `db:seed-catalog` / `db:import-shopee`
- Testes: `pnpm test` (unit + integração), `pnpm test:e2e` (dev), `pnpm test:e2e:prod` (build de produção)
- Papéis RBAC: `OWNER`, `ADMIN`, `MARKETING`, `CATALOG_MANAGER`, `ANALYST`, `SUPPORT`, `READ_ONLY` (`lib/auth/rbac.ts`)
- Importação diária: worker na VPS (`worker/`, container `garimpo-importer`), 06:00 de Brasília
