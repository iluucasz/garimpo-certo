# Segurança

## Modelo de ameaças

Prioridades: takeover administrativo, SSRF em URLs de provider, payloads maliciosos em feeds, open redirect afiliado, replay/fraude de conversão, enumeração de recursos e exfiltração de eventos. Controles atuais no mock: RBAC deny-by-default, validação, allowlist HTTPS, rate limit, assinatura e janela temporal de webhooks, idempotência, headers defensivos, request/trace IDs e logs redigidos.

## Produção

Better Auth deverá usar cookies HttpOnly, Secure e SameSite, MFA para OWNER/ADMIN e queries escopadas por usuário/organização. Secrets ficam apenas no runtime; rotação não registra valores no audit log. CSP permanece report-only até o inventário de origens estar completo, depois passa a enforcing com nonce para scripts do Next.js.

## Incidentes

Revogar sessões, desabilitar o adapter afetado, preservar audit logs, rotacionar credenciais e reconciliar conversões. Vulnerabilidades não devem ser inseridas em issues públicas; usar o canal privado definido pela organização antes do lançamento.
