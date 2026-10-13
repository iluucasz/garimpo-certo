import { describe, expect, it } from 'vitest'
import { msUntilNext, parseTime } from '@/worker/importer'
import { cronAuthorization } from '@/lib/server/cron-auth'

describe('agendamento do worker da VPS', () => {
  it('lê HH:MM e recusa horários inválidos', () => {
    expect(parseTime('06:00')).toEqual({ hours: 6, minutes: 0 })
    expect(parseTime('6:30')).toEqual({ hours: 6, minutes: 30 })
    expect(parseTime('23:59')).toEqual({ hours: 23, minutes: 59 })
    expect(parseTime('24:00')).toBeNull()
    expect(parseTime('06:60')).toBeNull()
    expect(parseTime('seis')).toBeNull()
  })

  it('espera até o horário de hoje quando ele ainda não passou', () => {
    const now = new Date(2026, 9, 13, 5, 0, 0)
    expect(msUntilNext({ hours: 6, minutes: 0 }, now)).toBe(60 * 60_000)
  })

  it('passa para amanhã quando o horário já passou (inclusive no instante exato)', () => {
    const now = new Date(2026, 9, 13, 6, 0, 0)
    expect(msUntilNext({ hours: 6, minutes: 0 }, now)).toBe(24 * 60 * 60_000)
    const later = new Date(2026, 9, 13, 18, 30, 0)
    expect(msUntilNext({ hours: 6, minutes: 0 }, later)).toBe(11.5 * 60 * 60_000)
  })
})

describe('autorização das chamadas agendadas', () => {
  const withHeader = (value?: string) => new Request('http://localhost/x', { headers: value ? { authorization: value } : {} })

  it('fica desligada sem CRON_SECRET e só aceita o Bearer exato', () => {
    delete process.env.CRON_SECRET
    expect(cronAuthorization(withHeader('Bearer qualquer'))).toBe('missing')
    process.env.CRON_SECRET = 'segredo-correto'
    expect(cronAuthorization(withHeader('Bearer segredo-correto'))).toBe('ok')
    expect(cronAuthorization(withHeader('Bearer errado'))).toBe('denied')
    expect(cronAuthorization(withHeader('segredo-correto'))).toBe('denied')
    expect(cronAuthorization(withHeader())).toBe('denied')
    delete process.env.CRON_SECRET
  })
})
