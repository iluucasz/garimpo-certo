import { afterAll, describe, expect, it } from 'vitest'
import { eq, inArray, like } from 'drizzle-orm'
import { GET as listResource } from '@/app/api/v1/admin/resources/[resource]/route'
import { PATCH as patchRecord } from '@/app/api/v1/admin/resources/[resource]/[id]/route'
import { POST as postConsent } from '@/app/api/v1/consent/route'
import { POST as postPrivacyRequest } from '@/app/api/v1/privacy-requests/route'
import { db } from '@/lib/db/client'
import { consentRecords, privacyRequests } from '@/lib/db/schema'
import { validatePrivacyRequest } from '@/lib/privacy/requests'
import { resetRateLimits } from '@/lib/server/rate-limit'
import { createAuthenticatedUser } from '../helpers/auth'

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })

const consentIds: string[] = []
const emailFor = () => `teste-lgpd-${crypto.randomUUID().slice(0, 8)}@example.com`

afterAll(async () => {
  await db.delete(privacyRequests).where(like(privacyRequests.email, 'teste-lgpd-%'))
  if (consentIds.length) await db.delete(consentRecords).where(inArray(consentRecords.anonymousId, consentIds))
})

describe('pedido de titular (formulário público)', () => {
  it('valida e-mail, tipo e tamanho da mensagem', () => {
    expect(validatePrivacyRequest({ email: 'x', type: 'access', message: 'curta' })).toHaveProperty('errors.email')
    expect(validatePrivacyRequest({ email: 'a@b.com', type: 'inventado', message: 'uma mensagem longa o bastante' })).toHaveProperty('errors.type')
    expect(validatePrivacyRequest({ email: 'a@b.com', type: 'access', message: 'curta' })).toHaveProperty('errors.message')
    expect(validatePrivacyRequest({ email: ' A@B.com ', type: 'deletion', message: 'Quero excluir meus dados.' })).toEqual({ value: { email: 'a@b.com', type: 'deletion', message: 'Quero excluir meus dados.' } })
  })

  it('registra o pedido sem exigir conta e devolve o protocolo', async () => {
    resetRateLimits()
    const email = emailFor()
    const response = await postPrivacyRequest(post('/api/v1/privacy-requests', { email, type: 'correction', message: 'Meu nome está escrito errado na conta.' }))
    expect(response.status).toBe(201)
    const { protocol } = (await response.json()).data
    expect(protocol).toMatch(/^[0-9A-F]{8}$/)

    const [row] = await db.select().from(privacyRequests).where(eq(privacyRequests.email, email))
    expect(row).toMatchObject({ userId: null, type: 'correction', status: 'pending', source: 'portal' })
    expect(row.id.slice(0, 8).toUpperCase()).toBe(protocol)
  })

  it('recusa dados inválidos e ignora o campo-armadilha dos robôs', async () => {
    resetRateLimits()
    const invalid = await postPrivacyRequest(post('/api/v1/privacy-requests', { email: 'sem-arroba', type: 'access', message: 'uma mensagem longa o bastante' }))
    expect(invalid.status).toBe(422)
    expect((await invalid.json()).error.details.email).toBeTruthy()

    const email = emailFor()
    const bot = await postPrivacyRequest(post('/api/v1/privacy-requests', { email, type: 'access', message: 'uma mensagem longa o bastante', website: 'http://spam.example' }))
    expect(bot.status).toBe(201)
    expect(await db.select().from(privacyRequests).where(eq(privacyRequests.email, email))).toHaveLength(0)
  })

  it('limita pedidos seguidos do mesmo endereço', async () => {
    resetRateLimits()
    const statuses: number[] = []
    for (let index = 0; index < 7; index++) {
      statuses.push((await postPrivacyRequest(post('/api/v1/privacy-requests', { email: emailFor(), type: 'other', message: 'uma mensagem longa o bastante' }, { 'x-forwarded-for': '203.0.113.9' }))).status)
    }
    expect(statuses.slice(0, 5).every((status) => status === 201)).toBe(true)
    expect(statuses.slice(5)).toEqual([429, 429])
    resetRateLimits()
  })

  it('aparece na fila do painel com e-mail, protocolo e anotação interna', async () => {
    resetRateLimits()
    const email = emailFor()
    await postPrivacyRequest(post('/api/v1/privacy-requests', { email, type: 'information', message: 'Com quem vocês compartilham meus dados?' }))
    const admin = await createAuthenticatedUser('ADMIN')

    const listed = await listResource(new Request(`http://localhost/api/v1/admin/resources/lgpd?q=${encodeURIComponent(email)}`, { headers: { cookie: admin.cookie } }), { params: Promise.resolve({ resource: 'lgpd' }) })
    expect(listed.status).toBe(200)
    const rows = (await listed.json()).data.rows as { id: string; email: string; protocol: string; source: string; message: string }[]
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ email, source: 'Formulário público', message: 'Com quem vocês compartilham meus dados?' })

    const updated = await patchRecord(
      new Request('http://localhost/api/v1/admin/resources/lgpd/x', { method: 'PATCH', headers: { 'content-type': 'application/json', cookie: admin.cookie }, body: JSON.stringify({ status: 'completed', responseNote: 'Respondido por e-mail.' }) }),
      { params: Promise.resolve({ resource: 'lgpd', id: rows[0].id }) },
    )
    expect(updated.status).toBe(200)
    const [saved] = await db.select().from(privacyRequests).where(eq(privacyRequests.id, rows[0].id))
    expect(saved).toMatchObject({ status: 'completed', responseNote: 'Respondido por e-mail.' })
    expect(saved.completedAt).toBeTruthy()
  })
})

describe('registro de consentimento', () => {
  it('guarda a escolha e só grava o que mudou', async () => {
    resetRateLimits()
    const id = crypto.randomUUID()
    consentIds.push(id)

    const first = await postConsent(post('/api/v1/consent', { id, analytics: true, personalization: false, marketing: false }))
    expect(first.status).toBe(201)
    expect((await first.json()).data.recorded).toBe(4)

    const same = await postConsent(post('/api/v1/consent', { id, analytics: true, personalization: false, marketing: false }))
    expect((await same.json()).data.recorded).toBe(0)

    const changed = await postConsent(post('/api/v1/consent', { id, analytics: false, personalization: false, marketing: false }))
    expect((await changed.json()).data.recorded).toBe(1)

    const rows = await db.select().from(consentRecords).where(eq(consentRecords.anonymousId, id))
    expect(rows).toHaveLength(5)
    expect(rows.filter((row) => row.category === 'necessary').every((row) => row.granted === 'true')).toBe(true)
  })

  it('recusa identificador inválido', async () => {
    resetRateLimits()
    expect((await postConsent(post('/api/v1/consent', { id: 'nao-e-uuid', analytics: true }))).status).toBe(422)
    expect((await postConsent(post('/api/v1/consent', { analytics: true }))).status).toBe(422)
  })
})
