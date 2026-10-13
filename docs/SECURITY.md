# Segurança

## Modelo de ameaças

Prioridades: takeover administrativo, SSRF em URLs de provider, payloads maliciosos em feeds, open redirect afiliado, replay/fraude de conversão, enumeração de recursos e exfiltração de eventos. Controles atuais no mock: RBAC deny-by-default, validação, allowlist HTTPS, rate limit, assinatura e janela temporal de webhooks, idempotência, headers defensivos, request/trace IDs e logs redigidos.

## Produção

Better Auth deverá usar cookies HttpOnly, Secure e SameSite, MFA para OWNER/ADMIN e queries escopadas por usuário/organização. Secrets ficam apenas no runtime; rotação não registra valores no audit log. CSP permanece report-only até o inventário de origens estar completo, depois passa a enforcing com nonce para scripts do Next.js.

## Incidentes

Revogar sessões, desabilitar o adapter afetado, preservar audit logs, rotacionar credenciais e reconciliar conversões. Vulnerabilidades não devem ser inseridas em issues públicas; usar o canal privado definido pela organização antes do lançamento.

## Convites da equipe

- O token do convite é aleatório (32 bytes) e só existe em hash no banco; o link aparece uma vez para quem convida.
- Vale 7 dias, é de uso único e só concede o papel à conta cujo e-mail é o convidado.
- Só proprietários convidam proprietários e administradores. Cada criação, aceite e cancelamento entra na auditoria.
- Pendência: verificação em duas etapas para OWNER/ADMIN (ver `docs/BACKLOG.md`).

## Verificação em duas etapas (MFA)

- Aplicativo autenticador (TOTP) com códigos de recuperação de uso único; o segredo e os códigos ficam cifrados no banco (Better Auth).
- Falhas seguidas bloqueiam a conta por 15 minutos (padrão do plugin), além do limite por IP.
- `ADMIN_REQUIRE_MFA=1` exige MFA de OWNER e ADMIN em toda rota do painel. Desligado por padrão para ninguém ficar de fora antes de ativar.
- Recuperação: `pnpm db:disable-2fa <email>` (exige acesso ao banco). O login pelo Google não passa pelo segundo passo.
