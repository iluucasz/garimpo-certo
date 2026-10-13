import type { AdminRole } from './rbac'

/** Papéis que mexem em acessos e configurações: são os que a verificação em duas etapas protege. */
export const MFA_ROLES: AdminRole[] = ['OWNER', 'ADMIN']

/**
 * Com `ADMIN_REQUIRE_MFA=1`, o painel só abre para OWNER/ADMIN que ativaram a verificação em duas etapas.
 * Desligado por padrão: primeiro a equipe ativa, depois se exige (senão ninguém entra no painel).
 */
export const mfaEnforced = () => process.env.ADMIN_REQUIRE_MFA === '1'

export const needsMfa = (roles: AdminRole[]) => roles.some((role) => MFA_ROLES.includes(role))

export const MFA_REQUIRED_MESSAGE = 'Ative a verificação em duas etapas em Minha conta › Segurança para usar o painel.'
