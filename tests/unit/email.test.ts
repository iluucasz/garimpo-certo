import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPasswordResetEmail, emailEnabled, parseSender, sendEmail } from '@/lib/auth/email'

const message = { to: 'pessoa@example.com', subject: 'Assunto', html: '<p>oi</p>', text: 'oi' }

describe('e-mail transacional (Brevo)', () => {
  beforeEach(() => {
    delete process.env.BREVO_API_KEY
    delete process.env.brevo
    delete process.env.EMAIL_FROM
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('interpreta o remetente com ou sem nome', () => {
    expect(parseSender('Garimpo certo <nao-responda@exemplo.com.br>')).toEqual({ name: 'Garimpo certo', email: 'nao-responda@exemplo.com.br' })
    expect(parseSender('"Garimpo, certo" <a@b.co>')).toEqual({ name: 'Garimpo, certo', email: 'a@b.co' })
    expect(parseSender('contato@exemplo.com')).toEqual({ name: undefined, email: 'contato@exemplo.com' })
    expect(parseSender('sem-arroba')).toBeNull()
    expect(parseSender('')).toBeNull()
    expect(parseSender(undefined)).toBeNull()
  })

  it('só fica ativo com chave e remetente válido; aceita o nome antigo "brevo"', () => {
    expect(emailEnabled()).toBe(false)
    process.env.BREVO_API_KEY = 'xkeysib-teste'
    expect(emailEnabled()).toBe(false)
    process.env.EMAIL_FROM = 'sem-arroba'
    expect(emailEnabled()).toBe(false)
    process.env.EMAIL_FROM = 'Garimpo <nao-responda@exemplo.com.br>'
    expect(emailEnabled()).toBe(true)

    delete process.env.BREVO_API_KEY
    expect(emailEnabled()).toBe(false)
    process.env.brevo = 'xkeysib-legado'
    expect(emailEnabled()).toBe(true)
  })

  it('sem configuração não chama a rede e informa que não enviou', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await sendEmail(message)).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('envia ao Brevo com a chave no cabeçalho api-key e o corpo da API v3', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-teste'
    process.env.EMAIL_FROM = 'Garimpo <nao-responda@exemplo.com.br>'
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 })
    vi.stubGlobal('fetch', fetchMock)
    expect(await sendEmail(message)).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(init.headers['api-key']).toBe('xkeysib-teste')
    expect(init.headers.authorization).toBeUndefined()
    expect(JSON.parse(init.body)).toMatchObject({
      sender: { name: 'Garimpo', email: 'nao-responda@exemplo.com.br' },
      to: [{ email: 'pessoa@example.com' }],
      subject: 'Assunto',
      htmlContent: '<p>oi</p>',
      textContent: 'oi',
    })
  })

  it('falha do provedor ou da rede não lança, retorna false e não vaza a chave no log', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-segredo'
    process.env.EMAIL_FROM = 'Garimpo <nao-responda@exemplo.com.br>'
    const errors: string[] = []
    const original = console.error
    console.error = (...args: unknown[]) => { errors.push(args.join(' ')) }
    try {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ code: 'unauthorized', message: 'Key not found' }) }))
      expect(await sendEmail(message)).toBe(false)
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
      expect(await sendEmail(message)).toBe(false)
    } finally { console.error = original }
    expect(errors.join(' | ')).toContain('401')
    expect(errors.join(' | ')).not.toContain('xkeysib-segredo')
  })

  it('o e-mail de redefinição escapa o link e cita o primeiro nome', () => {
    const email = buildPasswordResetEmail({ name: 'Marina Costa', url: 'https://garimpo.example/r?token=a&x="1"' })
    expect(email.text).toContain('Olá, Marina.')
    expect(email.html).toContain('token=a&amp;x=&quot;1&quot;')
    expect(email.html).not.toContain('x="1"')
    expect(email.text).toContain('https://garimpo.example/r?token=a&x="1"')
  })
})
