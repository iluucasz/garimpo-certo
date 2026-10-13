import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { emailEnabled, parseSender } from '@/lib/auth/email'
import { shopeeRequest } from '@/lib/providers/shopee/client'
import { authorize, fail, jsonBody, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'

type Check = { id: string; name: string; description: string; configured: boolean; testable: boolean; env: string[] }

const present = (...names: string[]) => names.every((name) => Boolean((process.env[name] ?? '').trim()))

/** O que está configurado no ambiente. Nunca devolve valores de segredo, só se existem. */
function inventory(): Check[] {
  return [
    { id: 'database', name: 'Banco de dados (Neon)', description: 'Catálogo, contas, cupons, auditoria e configurações.', configured: present('DATABASE_URL'), testable: true, env: ['DATABASE_URL', 'DATABASE_URL_UNPOOLED'] },
    { id: 'shopee', name: 'API de afiliados da Shopee', description: 'Catálogo, preços e links de afiliado.', configured: present('SHOPEE_AFFILIATE_APP_ID', 'SHOPEE_AFFILIATE_APP_SECRET'), testable: true, env: ['SHOPEE_AFFILIATE_APP_ID', 'SHOPEE_AFFILIATE_APP_SECRET'] },
    { id: 'email', name: 'E-mail transacional (Brevo)', description: 'Redefinição de senha e avisos da conta.', configured: emailEnabled(), testable: true, env: ['BREVO_API_KEY', 'EMAIL_FROM'] },
    { id: 'blob', name: 'Armazenamento de imagens (Vercel Blob)', description: 'Imagens reenviadas de provedores.', configured: present('BLOB_READ_WRITE_TOKEN'), testable: false, env: ['BLOB_READ_WRITE_TOKEN'] },
    { id: 'auth', name: 'Autenticação (Better Auth)', description: 'Sessões e login.', configured: present('BETTER_AUTH_SECRET'), testable: false, env: ['BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'] },
    { id: 'google', name: 'Login com Google', description: 'Entrar com conta Google.', configured: present('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'), testable: false, env: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] },
    { id: 'cron', name: 'Aviso do worker da VPS (CRON_SECRET)', description: 'Autoriza o worker da VPS, que importa o catálogo todo dia, a avisar o site para atualizar o cache.', configured: present('CRON_SECRET'), testable: false, env: ['CRON_SECRET'] },
  ]
}

export async function GET(request: Request) {
  const { blocked } = await authorize(request, 'catalog:read')
  if (blocked) return blocked
  const sender = parseSender(process.env.EMAIL_FROM)
  return ok({ checks: inventory(), sender: sender ? { name: sender.name ?? null, email: sender.email } : null, siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null })
}

/** Executa um teste real de conectividade. Cada teste é uma chamada pequena e idempotente. */
export async function POST(request: Request) {
  const { blocked } = await authorize(request, 'settings:write')
  if (blocked) return blocked
  const body = await jsonBody<{ id?: string }>(request)
  const started = Date.now()
  const done = (status: 'ok' | 'error', message: string) => ok({ id: body?.id, status, message, latencyMs: Date.now() - started })

  try {
    if (body?.id === 'database') {
      await db.execute(sql`select 1`)
      return done('ok', 'Conexão com o banco respondeu.')
    }
    if (body?.id === 'shopee') {
      await shopeeRequest<unknown>('{ shopeeOfferV2(page: 1, limit: 1) { pageInfo { page } } }')
      return done('ok', 'A API de afiliados respondeu e aceitou a assinatura.')
    }
    if (body?.id === 'email') {
      const sender = parseSender(process.env.EMAIL_FROM)
      const key = (process.env.BREVO_API_KEY ?? process.env.brevo ?? '').trim()
      if (!sender || !key) return done('error', 'Faltam BREVO_API_KEY ou EMAIL_FROM no ambiente.')
      const response = await fetch('https://api.brevo.com/v3/senders', { headers: { 'api-key': key, accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
      if (!response.ok) return done('error', `O Brevo respondeu ${response.status}. Confira a chave.`)
      const data = await response.json() as { senders?: { email: string; active: boolean }[] }
      const found = data.senders?.find((item) => item.email.toLowerCase() === sender.email.toLowerCase())
      if (!found) return done('error', `O remetente ${sender.email} não está cadastrado no Brevo.`)
      if (!found.active) return done('error', `O remetente ${sender.email} existe, mas ainda não foi confirmado no Brevo. Abra o e-mail de confirmação.`)
      return done('ok', `Chave válida e remetente ${sender.email} confirmado.`)
    }
  } catch (error) {
    return done('error', error instanceof Error ? error.message.slice(0, 200) : 'Falha no teste.')
  }
  return fail('Teste desconhecido.', 404)
}
