# Privacidade e LGPD

## O que existe hoje

- **Consentimento**: quatro categorias (`essential`, `analytics`, `personalization`, `marketing`), guardadas em `localStorage` (`garimpo:cookie-preferences`). Só `essential` opera sem escolha; o padrão das demais é desligado.
- **Medição** (`analytics`): eventos da vitrine (favoritar, comparar, ver produto, cliques de compra) só saem do navegador com essa permissão (`lib/platform/consent.ts`), e o Vercel Analytics e o Speed Insights (Core Web Vitals de campo) só são montados depois dela. Ações do painel administrativo não passam por esse filtro.
- **Cliques de compra**: registram oferta, ponto da página e um identificador de aba; não gravam IP, user agent nem usuário.
- **Personalização**: com a permissão e interesses salvos, a home mostra a aba "Para você".
- **Direitos do titular, por autoatendimento** (`/conta#dados`): baixar os dados da conta (`GET /api/v1/me/export`), corrigir o nome e excluir a conta (Better Auth `deleteUser`; as chaves do banco removem favoritos e sessões).
- **Dados locais**: a página `/privacidade` exporta e apaga o que fica no navegador.
- **Registro do consentimento** (`consent_records`): ao salvar a escolha de cookies, o navegador envia a escolha para `POST /api/v1/consent` com um identificador aleatório (`garimpo:consent-id`, criado só nesse momento e apagado em "Limpar dados deste navegador") e, havendo sessão, o usuário. Cada categoria é gravada com a base legal (`consent` para as opcionais, `legitimate_interest` para a necessária) e só quando o valor muda. Gravar a própria escolha não depende de a pessoa ter aceitado a medição.
- **Pedidos de titulares** (`privacy_requests`): o formulário de `/privacidade#pedido` (`POST /api/v1/privacy-requests`, sem exigir conta) grava e-mail, tipo (acesso, cópia, correção, exclusão, compartilhamento, revogação, outro) e mensagem, e devolve um protocolo. Fila e anotação interna em Painel → LGPD; prazo de resposta de 15 dias. Proteções: limite por IP, teto de 100 pedidos por hora no sistema, campo-armadilha contra robôs.

## Lacunas

- Ninguém é avisado quando entra um pedido novo: a equipe precisa abrir Painel → LGPD (item de alertas no BACKLOG). A resposta ao titular é por e-mail, fora do sistema, enquanto o envio do Brevo não estiver funcionando.
- Não há tela para consultar o histórico de consentimento de um titular (os registros existem em `consent_records`).
- A tabela `privacy_preferences` segue sem uso.
- Retenção e base legal por campo ainda não estão documentadas campo a campo.
