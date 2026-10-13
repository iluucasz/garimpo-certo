# Engine — a IA do Garimpo

Anotação de visão, registrada em 2026-10-13 a pedido do dono. **Nada aqui está implementado.** É o rascunho do que a Engine deve ser, para virar tarefas mais adiante. O estado real do código está em `CLAUDE.md`; as lacunas de engenharia, em `docs/BACKLOG.md`.

## Estado atual (2026-10-13)

| Parte | Situação |
|---|---|
| Fila de propostas, modos (desligada, sombra, aprovação, automático), auditoria | ✅ feito (Painel → Engine) |
| Faxina do catálogo | ✅ regra pronta; só age com tráfego suficiente |
| Radar de tendências por calendário comercial | ✅ feito; termos aprovados alimentam o importador |
| Radar por clima, notícias e buscas | ⏳ |
| IA (DeepSeek) para redação e sugestões | ⏳ |
| Personalização por visitante | ⏳ |
| Postagens no Telegram | ⏳ (depende do bot) |
| Extensão de navegador | ⏸ parada |

## Em uma frase

A Engine é o cérebro do negócio: observa o que o público faz, decide o que entra e o que sai do catálogo, o que aparece nas vitrines e o que é divulgado fora do site, e tudo isso com o objetivo de gerar **cliques que viram compras na Shopee**.

## Os três pilares

1. **IA como cérebro.** Identifica oportunidades, seleciona produtos, escreve textos e decide o que divulgar.
2. **Site como central.** Organiza os achadinhos, permite pesquisar e leva o comprador para a Shopee.
3. **Redes e comunidades como distribuição.** Telegram, WhatsApp, Instagram, TikTok e a extensão do navegador trazem visitantes e geram cliques nos links de afiliado.

Fluxo desejado:

```
VPS (importação periódica) → Neon (produtos, histórico, métricas)
   → Engine (filtra, pontua, recomenda, gera texto)
   → Site / Telegram / WhatsApp / Instagram / TikTok / extensão
   → cliques com sub_id por canal → comissões validadas → volta para a Engine
```

O ponto mais importante: **não basta ter milhares de produtos; é preciso gente clicando e comprando**. A Engine não deve publicar tudo o que encontra, e sim escolher pouco e bem.

## Princípio de projeto

A Engine **propõe e executa dentro de limites**; o dono continua no controle.

- Cada ação da Engine fica registrada em `audit_logs` (com `actor = engine`), com o motivo e os números que a justificaram.
- Ações de baixo risco (reordenar vitrine, arquivar produto sem tráfego) podem ser automáticas; ações visíveis ao público fora do site (postagens, textos novos, categorias novas) começam com **aprovação humana** e só passam a automáticas quando o dono liberar, por tipo de ação.
- Nada é apagado: a Engine **arquiva** (`status = removed`), como já faz a importação. Respeita `editorial_locked`: o que o dono editou à mão não é sobrescrito.
- A IA nunca inventa desconto, avaliação, depoimento, frete ou escassez. Só publica valores que vieram da API e foram conferidos (ver "Dados que a API da Shopee não dá" no `CLAUDE.md`).

## Módulos da Engine

### 1. Personalização por visitante

Aprender o que cada pessoa mais curte no site e montar vitrines e página inicial sob medida, para ela comprar.

- Sinais: categorias e produtos vistos, buscas, favoritos, comparações, cliques de compra, tempo na página. Já existem os eventos (`analytics_events`, `affiliate_clicks`) e a aba "Para você".
- Hoje a personalização é estreita (`VisitorState.preferencesSaved`); busca e ranking não leem interesses. A Engine amplia isso: vitrines ordenadas por afinidade, textos e destaques por perfil.
- **Só com consentimento** (`cookiePreferences.personalization`), como já é. Sem consentimento, vitrine geral.
- O resultado da personalização é **pré-calculado** (perfil → lista de itens) e lido do banco; a IA não entra no caminho de renderização da página.

### 2. Comportamento do público (agregado)

- Entender o que o público como um todo procura, ignora e compra: funil por categoria, faixa de preço, horário, dispositivo, origem do clique.
- Alimenta o ranking (`lib/recommendation/engine.ts`) e as decisões dos outros módulos.
- Reaproveita `getProductMetrics()`; as tabelas de rollup (`dailyProductMetrics`/`hourlyProductMetrics`) hoje sem uso são candidatas naturais a guardar isso pré-calculado.

### 3. Faxina do catálogo (o que sai e o que entra)

- Guardar os produtos **menos vistos, clicados e buscados**. Passado um prazo sem desempenho, o produto sai (arquivado) e abre vaga para outro.
- Regras a decidir: janela (ex.: 30/60 dias), exposição mínima antes de julgar (produto que quase não foi mostrado não pode ser punido), e proteção para itens com bom histórico de comissão.
- Integra com a seleção por faixa de preço da importação (`lib/providers/shopee/selection.ts`): a Engine passa a informar **quais vagas abrir e em que categoria/faixa**, em vez de a cota ser só estática.

### 4. Radar de tendências ("pensando no futuro")

Antecipar o que está em alta ou vai estar, com base em tempo, calendário e notícias.

Fontes candidatas (verificar disponibilidade, custo e termos de cada uma antes de usar):

- **Calendário comercial brasileiro**, que é a fonte mais segura e barata: Dia das Mães, Dia dos Namorados (12/6), Dia dos Pais, Dia das Crianças, Black Friday, 11.11, 12.12, Natal, volta às aulas, férias.
- **Sazonalidade e clima**: calor/frio/chuva (ex.: Open-Meteo, INMET) puxam ventilador, aquecedor, guarda-chuva.
- **Interesse de busca**: Google Trends (não há API oficial estável; avaliar alternativas) e termos em alta dentro da própria Shopee.
- **Notícias e eventos**: feeds RSS, GDELT/NewsAPI, lançamentos de produtos, eventos esportivos e culturais.
- **Histórico próprio**: o que já subiu nas mesmas épocas nos anos anteriores, quando houver dados.

A saída do radar não é uma opinião solta: é uma lista de **termos e categorias a importar** com prazo e confiança, que alimenta `categoryGroups`/`premiumKeywords` do importador.

### 5. Ações editoriais automáticas

A Engine ajuda a vender mexendo no próprio site:

- importar produtos novos a partir de termos que ela mesma sugere;
- criar categorias e **coleções** (já há `curated_collections` e regras em `lib/catalog/collections.ts`);
- ajustar textos da home, banners e campanhas (`global_settings`, `campaigns`), respeitando as regras de não inventar dado;
- sugerir cupons e campanhas de categoria vindos de `shopeeOfferV2`.

Tudo entra primeiro como **sugestão na fila de aprovação** do painel.

### 6. Divulgação fora do site

Ver seção própria abaixo.

### 7. Extensão de navegador

Ideia: uma extensão (Chrome/Edge, depois Firefox) que, ao abrir um produto na Shopee, mostra o **histórico de preço** que o Garimpo guarda, a nota do Índice Garimpo e avisa se há oferta melhor ou queda de preço.

- Consulta a API do Garimpo pelo ID/URL do produto; não deve raspar a Shopee.
- Dá ao visitante um motivo para instalar e voltar (alerta de queda de preço, que também está no BACKLOG).
- Atribuição: o clique que sai da extensão deve usar link de afiliado do Garimpo com `sub_id` próprio (`ext`). Verificar as regras do programa de afiliados sobre extensões antes de construir.

## Divulgação: Telegram, WhatsApp e redes

### Telegram (começar por aqui)

- Canal/grupo próprio, bot pela API oficial do Telegram com permissão de publicar texto, imagem e link.
- A Engine monta uma **fila central de ofertas**; o Telegram publica automaticamente a partir dela.
- Links gerados por `generateShortLink` (`lib/providers/shopee/client.ts`, já aceita `subIds`) com `sub_id` por canal e por campanha, para medir qual canal e qual mensagem rendem.
- Exemplo de formato: título curto da categoria, 1–2 linhas sobre o produto, preço, nota e nº de vendas **reais**, link.

### WhatsApp

- Grupo/comunidade de entrada voluntária, com administradores controlando as publicações e frequência previsível.
- Segundo a pesquisa que originou esta nota, a API oficial de grupos é muito restrita (limite pequeno de participantes) e não serve para um grupo grande; integrações não oficiais (ex.: Evolution API) funcionam, mas **têm risco de bloqueio** em uso comercial. **Verificar esses pontos nas políticas atuais da Meta antes de decidir.**
- Caminho recomendado: a Engine entrega o conteúdo pronto na fila e um humano publica/aprova, no início.
- Consentimento de quem recebe e saída fácil do canal, conforme a política do WhatsApp Business.

### Instagram e TikTok

- Conteúdo gerado pela Engine (roteiro curto, legenda, imagem) para o dono ou um editor publicar; automação de publicação direta só depois de validar a política de cada plataforma.

### "Não parecer robô"

- Variar estrutura, abertura e tom; textos curtos; sem frases repetidas; horários distribuídos ao longo do dia.
- Poucas ofertas por dia: **começar com 3 a 5 boas ofertas distribuídas**, medir o que gera clique e ajustar. Não disparar 50 produtos.
- Aprender com o retorno: cada postagem registra canal, texto, horário e cliques, para a Engine repetir o que funciona.
- Manter honestidade: variar o jeito de falar **não** significa esconder que é divulgação. Identificar claramente que são links de afiliado/publicidade, como exigem a boa prática de publicidade no Brasil e as regras do programa.

## Pontuação de produto (proposta)

Para decidir o que divulgar, cada produto recebe uma nota que combine:

- queda **real** de preço (histórico em `price_history`, nunca "de/por" inventado);
- nota e volume de vendas (a API não traz contagem de avaliações);
- histórico de interesse no site (cliques, favoritos);
- disponibilidade e, quando houver, prazo de entrega;
- comissão estimada (`commissionRate`).

Atenção: o **Índice Garimpo exibido ao visitante nunca usa comissão** (regra já registrada no `CLAUDE.md`). A nota interna de divulgação pode considerar comissão, mas é um número separado e nunca aparece como mérito do produto.

Exemplo ilustrativo do funil: importar milhares → regras eliminam os de dados insuficientes, preço ruim ou baixa qualidade → algoritmo ranqueia o resto → a IA prepara só as melhores (poucas) ofertas do dia.

## Como a Shopee paga (para calibrar a Engine)

Resumo da documentação consultada pelo dono; **conferir os números no programa antes de depender deles**:

- Atribuição de até 7 dias após o clique; vale o último clique elegível (outro afiliado pode "roubar" a venda).
- Comissão padrão em torno de 3%, com comissões extras que podem chegar a 30% conforme a oferta.
- Cancelamentos e devoluções não geram comissão validada; o valor é sobre a base líquida elegível, não o preço cheio.
- Sites de ofertas/cupons/tecnologia podem ter taxas sob consulta: vale confirmar o enquadramento do Garimpo junto ao programa.
- Simulação da pesquisa original: 10 pedidos/dia × R$ 80 elegíveis = 300 pedidos e R$ 24.000 em 30 dias. Comissão efetiva de **3% ≈ R$ 720**, **8% ≈ R$ 1.920**, **15% ≈ R$ 3.600** (cenários hipotéticos, antes de custos, impostos e pedidos invalidados). Em R$ 80 a 3% são só R$ 2,40 por pedido: **poucos itens com boa conversão e comissão extra valem mais que centenas aleatórios.**

> A simulação é só ordem de grandeza e deve ser refeita com os dados de `conversionReport` quando as comissões reais forem importadas (item "Comissões reais" do BACKLOG).

### Vitrine do Afiliado (Shopee)

Recurso do aplicativo da Shopee para montar uma página de recomendações dentro da própria Shopee, com categorias próprias (ex.: Achadinhos para Casa, Tecnologia, Ofertas do Dia). Serve como **segunda vitrine** para quem prefere continuar no app. A documentação consultada confirma inclusão manual e por link, **mas não uma API pública** para a Engine atualizá-la; portanto, a Engine só pode gerar a lista a ser colada manualmente.

## O que a API da Shopee oferece de fato (verificado em 2026-10-13)

Consultas: `shopOfferV2`, `shopeeOfferV2`, `productOfferV2`, `conversionReport`, `validatedReport`, `partnerOrderReport`, `listItemFeeds`, `getItemFeedData`. Mutações: `generateShortLink` e `generateBatchShortLink`.

- **Sem cupom/voucher**: nada na API traz cupons; por isso a Engine não pode "descobrir cupons".
- **`generateBatchShortLink`** gera vários links por chamada: é o caminho certo quando a Engine precisar gerar links para uma leva de postagens (hoje o importador usa o unitário, porque só gera links para produtos novos).
- **`listItemFeeds`/`getItemFeedData`** são feeds de produtos em lote: candidatos para a Engine varrer um catálogo grande sem paginar `productOfferV2`.
- **`conversionReport`** só enxerga os **últimos 3 meses** e devolve a etiqueta (`utmContent`) junto de cada comissão. É isso que permite medir canal por canal.
- **Etiquetas (sub ids)** só aceitam letras e números, até 5 por link. Convenção do projeto: 1º nível = canal (`site`, `telegram`...), 2º = categoria ou campanha.
- **Programa de afiliados**: não localizei os termos completos nem regra sobre extensões de navegador. O blog oficial lista como práticas que podem derrubar comissões ou a conta: compra de palavras-chave em anúncios, anúncios em sites impróprios, fraude de cliques e e-mail publicitário sem consentimento prévio. Confirme o texto vigente antes de lançar a extensão e o Telegram.

## Cuidados que valem para tudo

- **Fonte de dados autorizada.** Os termos da Shopee proíbem extração automatizada fora dos meios oficiais. A importação do Garimpo já usa a **API oficial de afiliados**; a Engine (e a extensão) devem continuar nela, sem raspagem.
- **LGPD e a IA externa.** Mandar comportamento individual de visitantes para uma API de terceiros (como a do DeepSeek, hospedada no exterior) é transferência internacional de dados. Preferir: enviar à IA só dados **agregados/anônimos**; ou rodar um modelo aberto na própria VPS; e atualizar `docs/PRIVACY.md`. Perfil individual é calculado por regras/estatística no banco, não por texto enviado a um LLM.
- **Custo e latência.** A IA roda **fora do caminho de requisição** (worker na VPS, em lote), grava o resultado no Neon e o site só lê. Definir um teto de gasto por dia.
- **Consentimento.** Personalização só com `cookiePreferences.personalization`; postagens em grupos só para quem entrou voluntariamente.
- **Medição antes de automação.** Sem comissões reais importadas e sem `sub_id` por canal, a Engine "aprende" no escuro. Isso vem primeiro.

## Ideias a considerar (minhas)

- **Fila de aprovação** no painel (`/admin/engine`): lista de propostas da Engine (importar X, arquivar Y, postar Z), com aceitar/editar/recusar e o motivo registrado. É também o dado para a Engine aprender o gosto editorial do dono.
- **Modo "sombra"**: antes de agir, a Engine só registra o que *teria* feito durante 1–2 semanas; o dono compara com o que realmente quer.
- **Alertas de queda de preço** por produto e por categoria, via e-mail, Telegram e extensão (já é item do BACKLOG; a Engine é o gatilho natural).
- **Resumo semanal** para o dono: o que subiu, o que caiu, o que a Engine fez, quanto rendeu por canal.
- **Teste A/B de verdade**: a Engine precisa disso para saber se um título ou vitrine converte mais; hoje não há bucketing estável (BACKLOG).
- **Qualidade do link**: checar periodicamente se o produto ainda existe, tem estoque e se o preço bate, antes de postar. Postar item indisponível queima a confiança do canal.
- **Calendário editorial**: planejar a semana de postagens por categoria e data comercial, não só ofertas soltas.
- **Mais de um provedor**: a Engine fica mais forte comparando preço do mesmo produto em outras lojas (hoje só Shopee; já há `lib/server/ingestion.ts` com matching).
- **Medir cada decisão**: guardar no banco, para cada ação da Engine, a hipótese e o resultado (cliques/comissão depois), fechando o ciclo de aprendizado.

## Ordem sugerida de construção

1. **Medição**: importar comissões reais (`conversionReport`/`validatedReport`) e usar `sub_id` por canal.
2. **Painel Engine + fila de aprovação** (sem IA ainda): regras simples de faxina e pontuação, em modo sombra.
3. **Telegram**: canal, bot, fila, 3–5 posts por dia, com aprovação humana.
4. **Radar de tendências**: calendário comercial primeiro; depois clima e notícias.
5. **IA (DeepSeek ou modelo aberto)** para redação e sugestões, com limites de custo e dados anonimizados.
6. **Personalização individual** nas vitrines.
7. **Extensão de navegador** e alertas de preço.
8. **WhatsApp, Instagram e TikTok**, com aprovação humana.
