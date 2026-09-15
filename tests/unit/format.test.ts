import { describe, expect, it } from 'vitest'
import { formatSoldCount } from '@/lib/mock-data'

describe('formatSoldCount', () => {
  it('abrevia milhares no padrão pt-BR e flexiona o singular', () => {
    expect(formatSoldCount(1)).toBe('1 vendido')
    expect(formatSoldCount(842)).toBe('842 vendidos')
    expect(formatSoldCount(8740)).toMatch(/^8,7\smil vendidos$/)
    expect(formatSoldCount(1_250_000)).toMatch(/^1,3\smi vendidos$/)
  })
})
