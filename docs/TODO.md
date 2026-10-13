# TODO — acompanhamento

Atualizado em 2026-10-13. Legenda: ✅ feito · 🔄 em andamento · ⏳ a fazer · 🙋 depende de você · 🚫 bloqueado por limitação externa · ⏸ parado de propósito.
O que já é real está em `CLAUDE.md`; a visão da IA está em `docs/ENGINE.md`; o detalhe de cada lacuna, em `docs/BACKLOG.md`.

## 1. Dinheiro e medição (base da Engine)

| | Item | Situação |
|---|---|---|
| ✅ | **Comissões reais da Shopee** (`conversionReport` → `affiliate_conversions` + itens) | Worker a cada 3 h, botão em Analytics, `pnpm db:sync-conversions`. A conta ainda não tem vendas nos últimos 90 dias, então o mapeamento foi validado com dados de teste, não com venda real. |
| ✅ | **Links com `subIds`** (`site` + categoria) nos botões de compra | Gerado na importação; guarda em `offers.affiliate_sub_ids`. Só letras e números (limite da Shopee). |
| ✅ | **Relatório de cliques por cupom** | Colunas na lista de cupons e resumo no topo (hoje/7/30 dias, mais clicados). |
| ✅ | Painel "Comissões reais" em Analytics (por situação, canal/categoria e produto) | |
| ✅ | Tipo da execução (Catálogo × Comissões) na tela Importações | |
| 🙋 | **Atualizar o worker na VPS** com o código novo | Sem isso a sincronização de comissões não roda sozinha (só pelo botão) e novos produtos continuam sem etiqueta. Passo a passo em `worker/README.md`. |
| ⏳ | Conferir o primeiro pedido real: `utmContent` e `netCommission` chegam como esperado | Acontece sozinho quando houver a primeira venda. |

## 2. Painel e produto

| | Item | Situação |
|---|---|---|
| ✅ | Upload de imagens no painel (campanhas, cupons e imagem de compartilhamento do SEO) | Botão “Enviar imagem” ao lado do campo de endereço. Confere o conteúdo real do arquivo; até 4 MB. A gravação no Vercel Blob usa a mesma chamada da re-hospedagem de imagens, mas não foi exercitada ao vivo nesta rodada. |
| ✅ | Regras automáticas editáveis | Painel → Regras do catálogo (limiares das coleções e filtros) e Guias de compra (checklists por categoria). Os textos acompanham os números. |
| ⏳ | Convite e proteção de administradores (convite por e-mail + MFA para OWNER/ADMIN) | Depende do e-mail do Brevo funcionando (item 4). |
| 🚫 | Cupons automáticos | A API de afiliados da Shopee não expõe cupons. Continua manual + campanhas de categoria. |
| 🙋 | Outros provedores além da Shopee | Precisa de credenciais e da API do provedor escolhido. |
| ⏳ | Fila de pedidos de titulares (LGPD) e consentimento gravado no banco | |
| ⏳ | Redesign de identidade autoral do site (`docs/PROXIMOS-PASSOS.md`, seção 3) | Precisa de direção visual sua. |
| ⏳ | CMS visual estilo Shopify (portar do nextrotta) | Próxima grande frente. |
| ⏳ | Alertas operacionais (importação falhou, catálogo velho) | |
| ⏳ | Alerta de queda de preço para o visitante | |
| ⏳ | Teste A/B de verdade | |
| ⏳ | Segmentação que direciona conteúdo | |

## 3. Engine (IA)

Detalhes em `docs/ENGINE.md`. Ordem sugerida: medição → fila de aprovação → Telegram → tendências → IA → personalização.

| | Item | Situação |
|---|---|---|
| ✅ | Medição (comissões reais e `sub_id` por canal) | Ver seção 1. |
| 🙋 | Chave do DeepSeek | Já está no `.env` com o nome `deep_seek` (minúsculo). Na hora de usar eu leio `DEEPSEEK_API_KEY` e, se faltar, `deep_seek`. Na Vercel/VPS crie a mesma variável. |
| ⏳ | Tabela de propostas da Engine + `/admin/engine` com fila de aprovação e modo "sombra" | |
| ⏳ | Faxina do catálogo (arquivar o que ninguém vê/clica) | |
| ⏳ | Radar de tendências (calendário comercial primeiro) | |
| 🙋 | Canal e bot do Telegram | Criar o bot no @BotFather e me passar `TELEGRAM_BOT_TOKEN` e o ID do canal. |
| ⏳ | Fila de postagens + publicação no Telegram (3–5 ofertas/dia, com aprovação) | Depende do bot. |
| ⏳ | IA para redação (DeepSeek) com dados anonimizados | |
| ⏳ | Personalização por visitante | |
| ⏸ | Extensão de navegador | Parada por decisão sua. |
| 🙋 | WhatsApp: decidir entre grupo manual com aprovação ou API não oficial | Recomendação: manual com aprovação. |
| 🙋 | Confirmar com o programa de afiliados o enquadramento de "site de ofertas" e as regras sobre extensões | Não encontrei os termos completos nem regra sobre extensões; veja `docs/ENGINE.md`. |

## 4. Configuração (só você)

| | Item |
|---|---|
| ✅ | `CRON_SECRET` na Vercel |
| 🙋 | `BETTER_AUTH_URL` e `NEXT_PUBLIC_BETTER_AUTH_URL` com o domínio real + redeploy |
| 🙋 | `NEXT_PUBLIC_SITE_URL` (domínio próprio) |
| 🙋 | `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL` |
| 🙋 | Conferir `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` em produção |
| 🙋 | Brevo: confirmar remetente, conferir `EMAIL_FROM` na Vercel, levar `BREVO_API_KEY`, domínio próprio com DKIM/DMARC |
| 🙋 | Ativar o Speed Insights na Vercel |
| 🙋 | Preencher a coleção "Virais do TikTok" em Painel → Coleções manuais (o arquivo `lib/catalog/curated.ts` citado em `PROXIMOS-PASSOS.md` não existe mais) |
| 🙋 | Revisar o texto dos guias em Painel → Guias de compra (já editável; os textos originais continuam valendo até você mudar) |
| 🙋 | (Opcional) Branch do Neon para testes + `TEST_DATABASE_URL` no CI |

## 5. Engenharia

| | Item |
|---|---|
| ⏳ | Testes do painel com login real |
| ⏳ | Layout do admin no celular |
| ⏳ | Versionar e vigiar o worker da VPS (aviso se o container parar) |
| ⏳ | Monitorar cota do otimizador de imagens |
| ⏳ | Regressão visual automática |
| 🙋 | ~22 tabelas do schema sem uso: remover exige migração destrutiva e sua decisão |
