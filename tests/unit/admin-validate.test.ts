import { describe, expect, it } from 'vitest'
import { resources } from '@/lib/admin/resource-meta'
import { isSafeLink, slugify, validatePeriod, validateResource } from '@/lib/admin/validate'

describe('validação dos formulários do painel', () => {
  it('exige título, link e valida o endereço do cupom', () => {
    const { errors } = validateResource(resources.cupons, { title: '', url: 'ftp://x' }, 'create')
    expect(errors.title).toBeTruthy()
    expect(errors.url).toBeTruthy()
  })

  it('aceita um cupom válido e normaliza datas', () => {
    const { values, errors } = validateResource(resources.cupons, { title: ' Frete grátis ', url: 'https://s.shopee.com.br/x', code: 'FRETE10', endsAt: '2026-12-31T23:59:00-03:00', isActive: true }, 'create')
    expect(errors).toEqual({})
    expect(values.title).toBe('Frete grátis')
    expect(values.endsAt).toBe('2027-01-01T02:59:00.000Z')
  })

  it('só valida os campos enviados em uma atualização parcial', () => {
    const { values, errors } = validateResource(resources.categorias, { name: 'Novo nome' }, 'update')
    expect(errors).toEqual({})
    expect(values).toEqual({ name: 'Novo nome' })
  })

  it('não deixa trocar o endereço depois de criado', () => {
    const { values } = validateResource(resources.categorias, { name: 'X', slug: 'outro' }, 'update')
    expect(values).not.toHaveProperty('slug')
  })

  it('recusa slug fora do padrão e opção de lista inválida', () => {
    expect(validateResource(resources.colecoes, { title: 'A', slug: 'Com Espaço', tone: 't', description: 'd', status: 'draft' }, 'create').errors.slug).toBeTruthy()
    expect(validateResource(resources.colecoes, { title: 'A', slug: 'ok', tone: 't', description: 'd', status: 'secreto' }, 'create').errors.status).toBeTruthy()
  })

  it('descarta IDs que não são UUID em campos de múltipla escolha', () => {
    const { values } = validateResource(resources.produtos, { name: 'P', status: 'active', categoryIds: ['nao-uuid', '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f'] }, 'update')
    expect(values.categoryIds).toEqual(['3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f'])
  })

  it('destino da campanha aceita caminho do site ou https, nada mais', () => {
    expect(isSafeLink('/colecoes/viralizou')).toBe(true)
    expect(isSafeLink('https://shopee.com.br')).toBe(true)
    expect(isSafeLink('//evil.com')).toBe(false)
    expect(isSafeLink('javascript:alert(1)')).toBe(false)
  })

  it('período: o fim precisa ser depois do início', () => {
    expect(validatePeriod({ startsAt: '2026-10-10T00:00:00Z', endsAt: '2026-10-09T00:00:00Z' })).toBeTruthy()
    expect(validatePeriod({ startsAt: '2026-10-10T00:00:00Z', endsAt: null })).toBeNull()
  })

  it('gera endereço limpo a partir do título', () => {
    expect(slugify('Os Mais Vendidos de Outubro — 2026!')).toBe('os-mais-vendidos-de-outubro-2026')
  })
})
