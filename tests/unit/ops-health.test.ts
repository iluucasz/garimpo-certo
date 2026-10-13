import { describe, expect, it } from 'vitest'
import { ageHours, evaluatePrivacy, evaluateRoutine, summarize, thresholds } from '@/lib/ops/health'

const NOW = Date.UTC(2026, 9, 13, 12, 0, 0)
const hoursAgo = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString()
const routine = (run: Parameters<typeof evaluateRoutine>[0]['run']) => evaluateRoutine({
  id: 'catalogo', label: 'Importação', href: '/admin/imports-jobs', run, now: NOW,
  warnHours: thresholds.catalogWarnHours, criticalHours: thresholds.catalogCriticalHours, neverMessage: 'Nunca rodou.',
})

describe('alertas de rotinas agendadas', () => {
  it('ok quando a última execução foi dentro do prazo', () => {
    const check = routine({ startedAt: hoursAgo(5), status: 'succeeded', error: null, lastSuccessAt: hoursAgo(5) })
    expect(check.severity).toBe('ok')
    expect(check.message).toContain('5 h')
  })

  it('aviso quando passou do prazo, crítico quando passou muito', () => {
    expect(routine({ startedAt: hoursAgo(40), status: 'succeeded', error: null, lastSuccessAt: hoursAgo(40) }).severity).toBe('warning')
    const critical = routine({ startedAt: hoursAgo(80), status: 'succeeded', error: null, lastSuccessAt: hoursAgo(80) })
    expect(critical.severity).toBe('critical')
    expect(critical.message).toContain('3 dias')
  })

  it('a última falha com sucesso recente é só aviso e mostra o motivo', () => {
    const check = routine({ startedAt: hoursAgo(1), status: 'failed', error: 'A Shopee respondeu 502.', lastSuccessAt: hoursAgo(20) })
    expect(check.severity).toBe('warning')
    expect(check.message).toContain('A Shopee respondeu 502.')
  })

  it('falhando e sem sucesso recente é crítico', () => {
    const check = routine({ startedAt: hoursAgo(1), status: 'failed', error: 'Credenciais ausentes.', lastSuccessAt: hoursAgo(70) })
    expect(check.severity).toBe('critical')
    expect(check.message).toContain('Credenciais ausentes.')
  })

  it('nunca rodou é aviso; nunca concluiu e falhou é crítico', () => {
    expect(routine({ startedAt: null, status: null, error: null, lastSuccessAt: null })).toMatchObject({ severity: 'warning', message: 'Nunca rodou.' })
    expect(routine({ startedAt: hoursAgo(2), status: 'failed', error: 'x', lastSuccessAt: null }).severity).toBe('critical')
    expect(routine({ startedAt: hoursAgo(2), status: 'running', error: null, lastSuccessAt: null }).severity).toBe('warning')
  })
})

describe('prazo da LGPD', () => {
  it('sem pedido pendente está ok', () => {
    expect(evaluatePrivacy({ pending: 0, oldestAt: null, now: NOW }).severity).toBe('ok')
  })

  it('avisa perto do prazo de 15 dias e marca crítico depois dele', () => {
    const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString()
    expect(evaluatePrivacy({ pending: 2, oldestAt: daysAgo(3), now: NOW }).severity).toBe('ok')
    const warning = evaluatePrivacy({ pending: 2, oldestAt: daysAgo(11), now: NOW })
    expect(warning.severity).toBe('warning')
    expect(warning.message).toContain('2 pedidos')
    expect(evaluatePrivacy({ pending: 1, oldestAt: daysAgo(16), now: NOW })).toMatchObject({ severity: 'critical' })
  })
})

describe('resumo', () => {
  it('o pior alerta define o estado geral', () => {
    const make = (severity: 'ok' | 'warning' | 'critical') => ({ id: severity, label: severity, severity, message: '', since: null, href: '/' })
    expect(summarize([make('ok'), make('ok')], NOW).status).toBe('ok')
    expect(summarize([make('ok'), make('warning')], NOW).status).toBe('warning')
    expect(summarize([make('warning'), make('critical')], NOW).status).toBe('critical')
    expect(ageHours(null, NOW)).toBeNull()
  })
})
