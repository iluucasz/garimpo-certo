import { afterEach, describe, expect, it } from 'vitest'
import { GET } from '@/app/api/v1/cron/shopee-import/route'

const request = (authorization?: string) => new Request('http://localhost/api/v1/cron/shopee-import', { headers: authorization ? { authorization } : {} })

describe('cron de importação da Shopee', () => {
  afterEach(() => { delete process.env.CRON_SECRET })

  it('fica desligado quando CRON_SECRET não está configurado', async () => {
    delete process.env.CRON_SECRET
    expect((await GET(request('Bearer qualquer'))).status).toBe(503)
  })

  it('recusa chamadas sem o segredo ou com segredo errado', async () => {
    process.env.CRON_SECRET = 'segredo-correto'
    expect((await GET(request())).status).toBe(401)
    expect((await GET(request('Bearer errado'))).status).toBe(401)
    expect((await GET(request('segredo-correto'))).status).toBe(401)
  })
})
