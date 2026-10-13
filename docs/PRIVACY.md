# Privacidade e LGPD

## O que existe hoje

- **Consentimento**: quatro categorias (`essential`, `analytics`, `personalization`, `marketing`), guardadas em `localStorage` (`garimpo:cookie-preferences`). Só `essential` opera sem escolha; o padrão das demais é desligado.
- **Medição** (`analytics`): eventos da vitrine (favoritar, comparar, ver produto, cliques de compra) só saem do navegador com essa permissão (`lib/platform/consent.ts`), e o Vercel Analytics e o Speed Insights (Core Web Vitals de campo) só são montados depois dela. Ações do painel administrativo não passam por esse filtro.
- **Cliques de compra**: registram oferta, ponto da página e um identificador de aba; não gravam IP, user agent nem usuário.
- **Personalização**: com a permissão e interesses salvos, a home mostra a aba "Para você".
- **Direitos do titular, por autoatendimento** (`/conta#dados`): baixar os dados da conta (`GET /api/v1/me/export`), corrigir o nome e excluir a conta (Better Auth `deleteUser`; as chaves do banco removem favoritos e sessões).
- **Dados locais**: a página `/privacidade` exporta e apaga o que fica no navegador.

## Lacunas

- Não há fila para pedidos que o autoatendimento não cobre; a página mostra um e-mail de contato quando `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL` está definida.
- As tabelas `consent_records`, `privacy_preferences` e `privacy_requests` existem, mas o consentimento ainda não é gravado no servidor.
- Retenção e base legal por campo ainda não estão documentadas campo a campo.
