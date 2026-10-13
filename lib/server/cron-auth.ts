import { timingSafeEqual } from 'node:crypto'

/**
 * Confere o `Authorization: Bearer $CRON_SECRET` de chamadas agendadas (Vercel Cron ou o worker da VPS).
 * `missing` quando o segredo não está configurado: a rota deve ficar desligada, nunca aberta.
 */
export function cronAuthorization(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return 'missing' as const
  const received = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b) ? ('ok' as const) : ('denied' as const)
}
