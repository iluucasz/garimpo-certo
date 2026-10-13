# Próximos passos

Registro das pendências e do feedback de design recebidos em 2026-10-13, depois da rodada de redesign, performance e higiene.
O estado técnico geral está em `CLAUDE.md`; as lacunas de engenharia em `docs/BACKLOG.md`.

---

## 1. O que só o dono do projeto pode fazer

- [ ] **`CRON_SECRET` no Vercel (urgente):** sem ele o cron responde 503 e o catálogo volta a envelhecer. Qualquer valor aleatório longo serve.
- [ ] **E-mail (Brevo):** chave e `EMAIL_FROM` já estão no `.env` local (`BREVO_API_KEY`, remetente `Garimpo certo <garimpou.certo@gmail.com>`). O Brevo mandou um e-mail de confirmação para `garimpou.certo@gmail.com`: confirme o remetente lá. Depois leve `BREVO_API_KEY` e `EMAIL_FROM` ao Vercel. Um `@gmail.com` costuma cair em spam por causa do DMARC; para produção, prefira remetente de domínio próprio.
- [ ] **`BETTER_AUTH_URL` e `NEXT_PUBLIC_BETTER_AUTH_URL` no Vercel** com o domínio real. Se estiverem em `localhost`, os links do e-mail saem quebrados.
- [ ] **Domínio próprio:** `NEXT_PUBLIC_SITE_URL` (sem ele vale o `*.vercel.app`).
- [ ] **Contato LGPD:** `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL`.
- [ ] **Conferir no Vercel** se `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` existem em produção; o `.env` local tem, mas o de produção eu não consigo ver.
- [ ] **Ativar o Speed Insights** em *Project → Speed Insights* na Vercel (o componente já é carregado, com consentimento; sem ativar não chegam dados).
- [ ] **Preencher a coleção "Virais do TikTok"**: a Shopee não informa o que viralizou no TikTok, então a lista é manual. Em `lib/catalog/curated.ts`, coloque em `itemIds` os IDs dos produtos (o número no fim do link/slug do produto). Ela só aparece com 3 ou mais itens ativos.
- [ ] **Revisar o texto dos guias** em `lib/catalog/guides.ts` ("o que observar antes de comprar"): é orientação geral escrita no código e sai com a marca do Garimpo.
- [ ] **(opcional) Criar um branch do Neon para testes** e definir `TEST_DATABASE_URL` no CI.

---

## 2. O que foi deliberadamente deixado de fora

> Marcado pelo dono do projeto como **pode começar**. Status em 2026-10-13:

| Item | Status | O que foi feito |
|---|---|---|
| **Painel admin** | **Feito** | 29 módulos com dados reais: catálogo (produtos com bloqueio editorial, ofertas, categorias, lojas, selos, coleções manuais), importações com histórico, home, campanhas, ranking, slots, segmentos, recursos, cupons, artigos, páginas, SEO, analytics, funil, eventos, usuários e papéis, LGPD, auditoria, logs, integrações, medição, tema e segurança. |
| **Coleções e guias reais** | **Feito** | Coleções (`/colecoes`) e guias por categoria (`/guias`) calculados a partir do catálogo, com dados do banco, JSON-LD e sitemap. O texto de "o que observar" é orientação geral escrita em código e deve ser revisado pelo dono. |
| **RUM (Core Web Vitals de campo)** | **Feito (falta ativar)** | `@vercel/speed-insights`, carregado só com consentimento. Ativar em *Project → Speed Insights* na Vercel. |
| **Banco de testes isolado** | **Suporte pronto** | `TEST_DATABASE_URL` redireciona o vitest. Falta criar o branch no Neon e usá-lo no CI. |
| **Regressão visual automática** | Não feito | Baselines dependem de fonte/SO e os dados do catálogo mudam todo dia; mantido como pendência. |
| **Tabelas do schema sem uso** | Não feito | ~22 tabelas; remover exige migração destrutiva no banco real e decisão do dono. Listadas no BACKLOG. |

Pergunta que originou o item: *decidir o futuro do admin* ou *montar o conteúdo real das coleções e guias a partir do catálogo*. As duas foram respondidas acima.

---

## 3. Melhorias de design do site principal (feedback recebido)

### O que está entregando essa aparência de IA?

1. **O design é organizado demais, mas tem pouca personalidade.**
   Tudo segue um padrão muito previsível: fundo branco, bordas fininhas, botões arredondados, espaços amplos e componentes simétricos. É bonito, mas lembra muitos dashboards e projetos SaaS criados com ferramentas de IA.
2. **Os textos parecem um pouco genéricos.**
   Expressões como "Achados para conhecer", "Por onde começamos?" e "Bons produtos. Preços que valem." funcionam, mas ainda não dão uma personalidade muito marcante ao Garimpo.
3. **Os componentes são visualmente parecidos.**
   As categorias, os filtros e alguns botões compartilham praticamente o mesmo tratamento visual. Falta um pouco de contraste entre elementos importantes e secundários.

### O que ficou realmente bom?

A tipografia principal está muito melhor, especialmente o título da homepage. O preço dos produtos está bem destacado, a identidade laranja e azul-escuro funciona e a navegação parece intuitiva.
Também gostei de como você deixou claro que o cliente compra diretamente na Shopee. Isso pode ajudar a transmitir confiança.

### O que faria para chegar a um 9/10?

Eu não pediria outro redesign completo ao Claude. Isso poderia fazer você perder o que já está funcionando.
Minha prioridade seria criar uma identidade visual mais autoral, com refinamentos na tipografia, nas categorias, nos cards e nos elementos de marca. Também padronizaria a apresentação das imagens e daria mais personalidade aos títulos e às seções, sem exagerar nas animações.

E tem uma coisa importante: **não confunda design minimalista com design de IA.** Um site pode ser limpo, sofisticado e ter bastante espaço em branco sem parecer artificial.

### Direções derivadas (a transformar em tarefas)

- [ ] Identidade mais autoral: refinar tipografia, categorias, cards e elementos de marca, sem refazer o que funciona.
- [ ] Mais contraste entre o que é importante e o que é secundário (categorias, filtros e botões hoje compartilham o mesmo tratamento).
- [ ] Padronizar a apresentação das imagens de produto.
- [ ] Dar personalidade aos títulos e às seções (textos menos genéricos).
- [ ] Manter animações discretas.
- [ ] Preservar o que já está bom: título da home, preço em destaque, laranja + azul-escuro, navegação, clareza de que a compra é na Shopee.
