# Deploy e operação

## Gates

A promoção exige `pnpm typecheck`, `pnpm test` (unit + integração), `pnpm test:e2e:prod` (desktop e mobile, inclui axe com contraste) e `pnpm build`. Metas de campo: LCP abaixo de 2,5 s, CLS abaixo de 0,1.
Medição de laboratório de referência (Pixel 5, CPU 4x, 1,6 Mbps/150 ms, build de produção): home 1,8 s, busca 1,6 s, categoria 1,4 s, produto 2,2 a 2,7 s, CLS 0.

## Variáveis de ambiente

| Variável | Obrigatória | Para quê |
|---|---|---|
| `DATABASE_URL` (+ variantes Neon) | sim | Banco |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL` | sim | Sessão e links de e-mail; as URLs devem ser as de produção |
| `SHOPEE_AFFILIATE_APP_ID`, `SHOPEE_AFFILIATE_APP_SECRET` | sim | Importação do catálogo |
| `CRON_SECRET` | sim | Autoriza chamadas agendadas como Bearer: o worker da VPS usa em `POST /api/v1/cron/revalidate` (e a rota `GET /api/v1/cron/shopee-import` fica disponível para disparo manual) |
| `BLOB_READ_WRITE_TOKEN` | sim | Re-hospedagem de imagens |
| `BREVO_API_KEY`, `EMAIL_FROM` | para e-mail | Redefinição de senha (Brevo; `EMAIL_FROM` = remetente verificado no Brevo) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | opcional | Login com Google (o botão some sem elas) |
| `NEXT_PUBLIC_SITE_URL` | recomendada | Domínio canônico; sem ela vale o domínio de produção da Vercel |
| `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL` | recomendada | Contato LGPD na página de privacidade |
| `ADMIN_REQUIRE_MFA` | opcional | `1` exige verificação em duas etapas de OWNER/ADMIN no painel. Ative só depois de a equipe ativar o MFA em Minha conta |
| `SHOPEE_TAGGED_LINKS` | opcional | `0` desliga as etiquetas de origem nos links de afiliado |
| `NEXT_BUILD_CPUS` | só em build local | Limita os workers do `next build` (ex.: `3`) quando a máquina tem pouca memória/disco livre |
| `TEST_DATABASE_URL` | só em testes | Banco usado por `pnpm test` (ex.: branch do Neon); sem ele, usa `DATABASE_URL` |
| `NEXT_IMAGE_UNOPTIMIZED` | opcional | `1` desliga o otimizador de imagens |

## Agendamento

A importação diária roda na **VPS** (`worker/`, imagem Docker `garimpo-importer`, 06:00 de Brasília): grava direto no banco e depois chama `POST /api/v1/cron/revalidate` no site. Não há cron na Vercel (`vercel.json` sem `crons`). Passo a passo em `worker/README.md`. A importação seleciona por faixa de preço (até R$ 99, R$ 100–499 e a partir de R$ 500) em 11 categorias, cerca de 264 produtos, e leva de 2 a 4 min, arquiva produtos fora da seleção só se cobrir >=70% do catálogo atual e invalida o cache do catálogo. Para rodar à mão: `pnpm db:import-shopee [--prune]`.

## Imagens

`next/image` otimiza (WebP, cache de 7 dias) apenas hosts em `images.remotePatterns` (Shopee, Vercel Blob, Unsplash). Um host novo falha com 400 até ser adicionado em `next.config.mjs`. Monitore a cota de otimização no painel da Vercel.

## Estratégia

Preview valida migrations e contratos antes do tráfego. Em produção, migrations compatíveis são aplicadas antes da aplicação; mudanças destrutivas usam expand/contract. Rollback aponta para a versão anterior.

## Observabilidade

**Saúde do sistema:** `GET /api/v1/health` devolve `{ status, checkedAt }` (`ok`, `warning` ou `critical`) e responde **503** quando algo está crítico (importação ou comissões sem sucesso por muito tempo, prazo da LGPD vencido). Cadastre esse endereço em um monitor externo e alerte em qualquer 5xx. O detalhe de cada verificação está na visão geral do painel.

Requests propagam `request_id` e `trace_id` (`proxy.ts`). A importação agendada registra o resultado nos logs da função. Core Web Vitals de campo vêm do Vercel Speed Insights, carregado só com o consentimento de medição; ative-o em *Project → Speed Insights* no painel da Vercel. Alertas ainda não existem (ver `docs/BACKLOG.md`).

O script `load-tests/core-journeys.js` cobre navegação, recomendação e ingestão com k6.
