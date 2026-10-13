import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPasswordResetEmail, emailEnabled, sendEmail } from '@/lib/auth/email'

const message = { to: 'pessoa@example.com', subject: 'Assunto', html: '<p>oi</p>', text: 'oi' }

describe('e-mail transacional', () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('só fica ativo com chave e remetente', () => {
    expect(emailEnabled()).toBe(false)
    process.env.RESEND_API_KEY = 're_test'
    expect(emailEnabled()).toBe(false)
    process.env.EMAIL_FROM = 'Garimpo <nao-responda@example.com>'
    expect(emailEnabled()).toBe(true)
  })

  it('sem configuração não chama a rede e informa que não enviou', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await sendEmail(message)).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('envia ao Resend com autorização e corpo esperados', async () => {
    process.env.RESEND_API_KEY = 're_test'
    process.env.EMAIL_FROM = 'Garimpo <nao-responda@example.com>'
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    expect(await sendEmail(message)).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers.authorization).toBe('Bearer re_test')
    expect(JSON.parse(init.body)).toMatchObject({ from: 'Garimpo <nao-responda@example.com>', to: ['pessoa@example.com'], subject: 'Assunto' })
  })

  it('falha do provedor ou da rede não lança e retorna false', async () => {
    process.env.RESEND_API_KEY = 're_test'
    process.env.EMAIL_FROM = 'Garimpo <nao-responda@example.com>'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 422 }))
    expect(await sendEmail(message)).toBe(false)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await sendEmail(message)).toBe(false)
  })

  it('o e-mail de redefinição escapa o link e cita o primeiro nome', () => {
    const email = buildPasswordResetEmail({ name: 'Marina Costa', url: 'https://garimpo.example/r?token=a&x="1"' })
    expect(email.text).toContain('Olá, Marina.')
    expect(email.html).toContain('token=a&amp;x=&quot;1&quot;')
    expect(email.html).not.toContain('x="1"')
    expect(email.text).toContain('https://garimpo.example/r?token=a&x="1"')
  })
})
