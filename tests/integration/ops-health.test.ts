import { describe, expect, it } from 'vitest'
import { GET as adminHealth } from '@/app/api/v1/admin/health/route'
import { GET as publicHealth } from '@/app/api/v1/health/route'
import { getOpsHealth } from '@/lib/ops/health'
import { resetRateLimits } from '@/lib/server/rate-limit'
import { createAuthenticatedUser } from '../helpers/auth'

describe('saúde operacional', () => {
  it('lê o banco real e devolve as quatro verificações', async () => {
    const health = await getOpsHealth()
    expect(health.checks.map((check) => check.id)).toEqual(['catalogo', 'comissoes', 'tamanho', 'tarefas', 'lgpd'])
    expect(['ok', 'warning', 'critical']).toContain(health.status)
    for (const check of health.checks) expect(check.message.length).toBeGreaterThan(0)
  })

  it('o endereço público só devolve o estado, sem detalhes', async () => {
    resetRateLimits()
    const response = await publicHealth(new Request('http://localhost/api/v1/health'))
    expect([200, 503]).toContain(response.status)
    const body = await response.json()
    expect(Object.keys(body).sort()).toEqual(['checkedAt', 'status'])
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('o detalhe exige sessão', async () => {
    expect((await adminHealth(new Request('http://localhost/api/v1/admin/health'))).status).toBe(401)
    const reader = await createAuthenticatedUser('READ_ONLY')
    const response = await adminHealth(new Request('http://localhost/api/v1/admin/health', { headers: { cookie: reader.cookie } }))
    expect(response.status).toBe(200)
    expect((await response.json()).data.checks.length).toBe(5)
  })
})
