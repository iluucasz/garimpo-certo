/**
 * Pedidos de titulares de dados (LGPD, art. 18) feitos pelo formulário público de /privacidade.
 * Isomórfico: o formulário usa as opções, o servidor valida com as mesmas regras.
 */

export const privacyRequestOptions = [
  { value: 'access', label: 'Saber quais dados vocês têm sobre mim' },
  { value: 'export', label: 'Receber uma cópia dos meus dados' },
  { value: 'correction', label: 'Corrigir dados incorretos' },
  { value: 'deletion', label: 'Excluir os meus dados' },
  { value: 'information', label: 'Saber com quem os dados são compartilhados' },
  { value: 'revocation', label: 'Revogar um consentimento' },
  { value: 'other', label: 'Outro assunto sobre meus dados' },
] as const

export type PrivacyRequestKind = (typeof privacyRequestOptions)[number]['value']
export const privacyRequestLabels = Object.fromEntries(privacyRequestOptions.map((option) => [option.value, option.label])) as Record<PrivacyRequestKind, string>

export const MESSAGE_MIN = 10
export const MESSAGE_MAX = 1000

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export type PrivacyRequestInput = { email: string; type: PrivacyRequestKind; message: string }

export function validatePrivacyRequest(input: unknown): { value: PrivacyRequestInput } | { errors: Record<string, string> } {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const errors: Record<string, string> = {}
  const email = typeof source.email === 'string' ? source.email.trim().toLowerCase() : ''
  const type = typeof source.type === 'string' ? source.type : ''
  const message = typeof source.message === 'string' ? source.message.trim() : ''

  if (!email) errors.email = 'Informe o e-mail para responder.'
  else if (email.length > 254 || !emailPattern.test(email)) errors.email = 'Esse e-mail não parece válido.'
  if (!privacyRequestOptions.some((option) => option.value === type)) errors.type = 'Escolha o tipo de pedido.'
  if (message.length < MESSAGE_MIN) errors.message = `Conte um pouco mais (pelo menos ${MESSAGE_MIN} caracteres).`
  else if (message.length > MESSAGE_MAX) errors.message = `No máximo ${MESSAGE_MAX} caracteres.`

  return Object.keys(errors).length ? { errors } : { value: { email, type: type as PrivacyRequestKind, message } }
}
