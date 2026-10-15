# TODO — acompanhamento

Atualizado em 2026-10-14. Legenda: ✅ feito · 🔄 em andamento · ⏳ a fazer · 🙋 depende de você · 🚫 bloqueado por limitação externa · ⏸ parado de propósito.
O que já é real está em `CLAUDE.md`; a visão da IA está em `docs/ENGINE.md`; o detalhe de cada lacuna, em `docs/BACKLOG.md`.

## 1. Dinheiro e medição (base da Engine)

| | Item | Situação |
|---|---|---|
| ✅ | **Comissões reais da Shopee** (`conversionReport` → `affiliate_conversions` + itens) | Worker a cada 3 h, botão em Analytics, `pnpm db:sync-conversions`. A conta ainda não tem vendas nos últimos 90 dias, então o mapeamento foi validado com dados de teste, não com venda real. |
| ✅ | **Links com `subIds`** (`site` + categoria) nos botões de compra | Gerado na importação; guarda em `offers.affiliate_sub_ids`. Só letras e números (limite da Shopee). |
| ✅ | **Relatório de cliques por cupom** | Colunas na lista de cupons e resumo no topo (hoje/7/30 dias, mais clicados). |
| ✅ | Painel "Comissões reais" em Analytics (por situação, canal/categoria e produto) | |
| ✅ | Tipo da execução (Catálogo × Comissões) na tela Importações | |
| 🙋 | **Atualizar o worker na VPS** com o código novo | Sem isso a sincronização de comissões e a Engine não rodam sozinhas (só pelos botões do painel) e novos produtos continuam sem etiqueta. Passo a passo em `worker/README.md`. |
| ⏳ | Conferir o primeiro pedido real: `utmContent` e `netCommission` chegam como esperado | Acontece sozinho quando houver a primeira venda. |

## 2. Painel e produto

| | Item | Situação |
|---|---|---|
| ✅ | Upload de imagens no painel (campanhas, cupons e imagem de compartilhamento do SEO) | Botão “Enviar imagem” ao lado do campo de endereço. Confere o conteúdo real do arquivo; até 4 MB. A gravação no Vercel Blob usa a mesma chamada da re-hospedagem de imagens, mas não foi exercitada ao vivo nesta rodada. |
| ✅ | Regras automáticas editáveis | Painel → Regras do catálogo (limiares das coleções e filtros) e Guias de compra (checklists por categoria). Os textos acompanham os números. |
| ✅ | Convite de administradores | Painel → Usuários e papéis → "Convidar para a equipe". Gera um link de 7 dias (também enviado por e-mail quando o Brevo estiver ativo); a pessoa entra com o mesmo e-mail e aceita. |
| ✅ | MFA (verificação em duas etapas) para OWNER/ADMIN | Em Minha conta › Segurança. Por padrão só **avisa** no painel; a exigência liga com `ADMIN_REQUIRE_MFA=1` depois de você e a equipe ativarem. Perdeu o celular: `pnpm db:disable-2fa <email>`. |
| 🙋 | Ativar o MFA na sua conta e, depois, ligar `ADMIN_REQUIRE_MFA=1` na Vercel | Ative primeiro e guarde os códigos de recuperação. O login pelo Google não passa pelo segundo passo (limite do plugin). |
| 🚫 | Cupons automáticos | Confirmado em 2026-10-13 listando todas as operações da API de afiliados: nenhuma devolve cupom ou voucher. Continua manual + campanhas de categoria. |
| 🙋 | Outros provedores além da Shopee | Preciso que você escolha o provedor (Mercado Livre, Amazon, AliExpress, Magalu…) e tenha a conta de afiliado com acesso à API. Com isso eu separo o importador em um adaptador por provedor (hoje ele é só da Shopee) e ligo comissões e etiquetas do novo provedor. |
| ✅ | Fila de pedidos de titulares (LGPD) e consentimento gravado no banco | Formulário em `/privacidade#pedido`; fila em Painel → LGPD; escolhas de cookies em `consent_records`. Falta aviso ao time quando chega pedido novo. |
| 🙋 | Redesign de identidade autoral do site (`docs/PROXIMOS-PASSOS.md`, seção 3) | É decisão de gosto, e o site já está no ar: preciso que você diga a direção (referências, o que manter, o que mudar) antes de eu mexer. Posso preparar 2 ou 3 propostas lado a lado para você escolher. |
| ✅ | CMS visual (porte do modelo do nextrotta para o Garimpo) | Home, páginas criadas no painel (`/paginas/<endereço>`) e "Aparência do site" (cor de ação, cantos, fonte, aviso do topo e rodapé), cada um com rascunho, publicar e 30 versões. Desfazer/refazer, arrastar e soltar (lista e biblioteca), biblioteca com busca, zoom, clique na seção dentro da prévia, seções arquivadas, aparência por seção (fundo, texto, espaçamento, largura), blocos novos (texto e imagem, perguntas, produtos de uma coleção), recuperação local e aviso ao sair. **Fora, de propósito ou por falta de fonte:** agendar publicação, arrastar direto na página, prévia ao vivo enquanto digita, paleta com mais de uma cor de ação (o Garimpo usa uma cor por papel) e textos legais no editor (seguem em Painel → Páginas, em Markdown). |
| ✅ | Alertas operacionais no painel (importação, comissões, tarefas, prazo da LGPD) | Bloco no topo de `/admin`. `/api/v1/health` responde 503 quando está crítico. |
| 🙋 | Cadastrar um monitor externo em `/api/v1/health` (UptimeRobot, Better Stack…) | É o jeito mais barato de receber aviso no celular enquanto o bot do Telegram não existe. |
| ✅ | Alerta de queda de preço para o visitante (no site) | Em Favoritos e no atalho de Minha conta: "ficou mais barato desde que você salvou" (referência guardada no navegador). **Aviso por e-mail ainda não existe** (depende do Brevo). |
| ✅ | Teste A/B de verdade (texto do topo da home) | Painel → Testes A/B: variante B, divisão de tráfego, medição por visita, veredito só com 200+ visitas por variante e botão para aplicar o vencedor ao rascunho da home. Só mede quem permitiu a medição de uso. |
| ⏸ | Segmentação que direciona conteúdo | Parada de propósito: com a personalização no aparelho, a home já se adapta a cada pessoa sem guardar perfil no servidor. Segmentos continuam como análise de cliques (Painel → Segmentos). Retomo se você quiser direcionar banners ou coleções por perfil. |

## 3. Engine (IA)

Detalhes em `docs/ENGINE.md`. Ordem sugerida: medição → fila de aprovação → Telegram → tendências → IA → personalização.

| | Item | Situação |
|---|---|---|
| ✅ | Medição (comissões reais e `sub_id` por canal) | Ver seção 1. |
| 🙋 | Chave do DeepSeek na Vercel e na VPS | O código lê `DEEPSEEK_API_KEY` e, se faltar, `deep_seek`. No `.env` local já existe; crie a mesma variável na Vercel (botão do painel) e na VPS (postagens agendadas). |
| ✅ | Tabela de propostas da Engine + Painel → Engine com fila de aprovação e modo "sombra" | Modos: desligada, sombra (padrão), com aprovação e automático (só o reversível). Cada sugestão traz o motivo e os números. |
| ✅ | Faxina do catálogo (sugere tirar o que ninguém vê/clica) | Só age com tráfego suficiente (500 visitas a produtos em 30 dias, ajustável). Hoje o site mede 0 visitas, então ela espera dados; isso é proposital. |
| ✅ | Radar de tendências por calendário comercial | Sugere termos de busca perto de Dia das Mães, Black Friday, Natal etc.; aprovado, entra na próxima importação até a data. Clima e notícias ficam para depois. |
| 🙋 | Canal e bot do Telegram | Criar o bot no @BotFather, adicioná-lo como administrador do canal e definir `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` na Vercel e na VPS. Depois: Painel → Postagens → "Conferir conexão" e ligar as postagens. |
| ✅ | Fila de postagens + publicação no Telegram (3–5 ofertas/dia, com aprovação) | Painel → Postagens. Pronta e testada com envio simulado; só publica quando `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` existirem. Desligada por padrão. |
| ✅ | IA para redação (DeepSeek) nas postagens | Opcional ("Usar IA para variar o texto" em Postagens → Ajustes, ou o botão "Reescrever com IA"). Só vê dados públicos da oferta; texto que inventar número, desconto ou urgência é descartado. Testado com a API real. |
| ✅ | Personalização por visitante (no aparelho) | A aba "Para você" aprende com o que a pessoa viu, favoritou e comparou, além dos interesses salvos; só com a personalização permitida e calculado no navegador, sem enviar nada. Personalização com perfil no servidor não foi feita de propósito (LGPD). |
| ✅ | **Central da Engine** (Painel → Engine: visão geral, aprovações, resumo da semana, importação, aprendizado, modo e regras, histórico) | Mostra o que a Engine faz, quando rodou, o que vem a seguir e o que espera você. Tudo com dado real do banco. |
| ✅ | **Aprender com os cliques** | Categorias que rendem acima da média pedem +10 produtos na importação (com seu OK) e ganham prioridade suave nas postagens. Só age com 50+ cliques em 30 dias; hoje o site mede 0, então espera dados. |
| ✅ | **Números da importação no painel** (por categoria, nota, vendas, por loja, liga/desliga) | Engine → Importação. O worker lê do banco a cada importação. |
| ✅ | **Resumo da semana** (7 dias contra os 7 anteriores, o que a Engine fez, comissão por canal) | Aba "Resumo da semana". Ainda não é enviado por e-mail/Telegram: só aparece no painel. |
| ✅ | Sinal de vida do worker no painel | Online / atrasado / parado. |
| 🙋 | **Reconstruir e trocar o worker na VPS** (`worker/README.md`) | Sem isso o painel mostra "worker sem sinal", o liga/desliga da importação não vale e as comissões/Engine só rodam pelos botões. |
| ⏳ | **Resumo semanal enviado** (e-mail pelo Brevo e/ou Telegram) | Hoje só no painel. Falta decidir o canal: o Brevo precisa do remetente confirmado; o bot do Telegram, do token. |
| ⏳ | **Medir cada decisão** (antes × depois de cada sugestão aplicada) | Fechar o ciclo de aprendizado: cliques da categoria nas semanas depois de uma cota, vendas por termo sazonal. |
| ⏳ | **Ações editoriais**: sugerir coleções, destaques da home e textos a partir dos números | Entra na fila de aprovação (nunca publica sozinha). Reaproveita `curated_collections`. |
| ⏳ | **Radar por clima, notícias e buscas** | Hoje só calendário comercial. Clima (Open-Meteo, sem chave) é o próximo candidato; notícias e Trends exigem fonte confiável. |
| ⏳ | **Conteúdo para Instagram/TikTok/WhatsApp** (legenda, roteiro e imagem prontos na fila, um humano publica) | Reaproveita o compositor de postagens e a validação anti-invenção. |
| ⏳ | **Comportamento do público agregado** (faixa de preço, horário, dispositivo, origem) | Para a Engine decidir por faixa de preço e não só por categoria. Usa `analytics_events`; rollups ainda não existem. |
| ⏳ | **Alerta de queda de preço por e-mail/Telegram** | Depende do Brevo ou do bot. A queda já aparece no site (favoritos). |
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
| ✅ | Testes do painel com login real | `tests/e2e/admin-modules.spec.ts`: cria um proprietário de verdade (Better Auth + papel no banco), abre os 35 módulos no desktop e no celular e confere erro de execução, estado de falha e rolagem horizontal. 70 testes passando; as contas de teste são apagadas ao fim. |
| ✅ | Layout do admin no celular (sem quebras) | Nenhum módulo cria rolagem horizontal na largura de um Pixel 5 (verificado automaticamente). A revisão visual do desenho, com você olhando, continua útil. |
| ✅ | Vigiar o worker da VPS | Se o worker parar, a importação e as comissões envelhecem e o painel mostra o alerta; `/api/v1/health` responde 503 para o monitor externo. Atualizar o código na VPS continua manual (ver `worker/README.md`). |
| 🙋 | Monitorar a cota do otimizador de imagens | Só o painel da Vercel mostra o uso; o código não consegue ler. Se estourar, `NEXT_IMAGE_UNOPTIMIZED=1` serve as imagens originais. |
| ⏸ | Regressão visual automática | Parada de propósito: as capturas dependem de fonte e sistema e o catálogo muda todo dia, então gerariam alarme falso. A checagem automática de erro e de estouro de largura em todo o painel (feita) cobre o que mais quebra. |
| 🙋 | ~22 tabelas do schema sem uso: remover exige migração destrutiva e sua decisão |
