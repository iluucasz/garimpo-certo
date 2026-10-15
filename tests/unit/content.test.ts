import { describe, expect, it } from 'vitest'
import { composeContent, composeInstagram, composeTikTok, hashtagsFor, parseBrandTags, priceText, proofText, toTag } from '@/lib/social/content'
import { bannedClaims } from '@/lib/social/rewrite'
import type { PostFacts } from '@/lib/social/compose'

const facts: PostFacts = { name: 'FONE BLUETOOTH TWS PRO 5 COM CANCELAMENTO DE RUÍDO', price: 39.9, originalPrice: 59.9, discountPercent: 33.4, rating: 4.8, soldCount: 12400 }
const plain: PostFacts = { ...facts, originalPrice: null, discountPercent: null }
const options = { category: 'audio', seed: 'produto-1', brandTags: ['#garimpou', '#achadinhos'], disclosure: true }

describe('texto de Instagram e TikTok', () => {
  it('usa só o preço real, e "de/por" apenas com preço anterior informado', () => {
    expect(priceText(facts)).toBe('de R$ 59,90 por R$ 39,90 (−33%)')
    expect(priceText(plain)).toBe('R$ 39,90')
    expect(priceText({ ...facts, discountPercent: 2, originalPrice: 40.5 })).toBe('R$ 39,90')
  })

  it('mostra nota e vendas só quando existem', () => {
    expect(proofText(facts)).toContain('Nota 4,8')
    expect(proofText({ ...facts, soldCount: 10 })).toBe('Nota 4,8')
    expect(proofText({ ...facts, rating: 0, soldCount: 10 })).toBe('')
  })

  it('a legenda do Instagram leva preço, link na bio, aviso de publicidade e hashtags', () => {
    const { caption, hashtags } = composeInstagram(facts, options)
    expect(caption).toContain('R$ 39,90')
    expect(caption.toLowerCase()).toContain('link')
    expect(caption).toContain('Publi: contém link de afiliado')
    expect(hashtags).toContain('#publi')
    expect(hashtags.length).toBeLessThanOrEqual(10)
    expect(caption).toContain('#garimpou')
    expect(caption.length).toBeLessThanOrEqual(2200)
  })

  it('sem aviso de publicidade quando desligado', () => {
    const { caption, hashtags } = composeInstagram(facts, { ...options, disclosure: false })
    expect(caption).not.toContain('Publi:')
    expect(hashtags).not.toContain('#publi')
  })

  it('o roteiro do TikTok orienta o que mostrar sem afirmar nada novo do produto', () => {
    const content = composeTikTok(facts, options)
    expect(content.script).toContain('R$ 39,90')
    expect(content.script).toMatch(/0–3 s/)
    expect(content.script).toContain('link na bio')
    expect(content.hashtags.length).toBeLessThanOrEqual(5)
    expect(content.onScreen).toHaveLength(3)
    expect(content.caption.length).toBeLessThan(400)
  })

  it('nunca usa frases de urgência, escassez ou garantia, em nenhum modelo', () => {
    for (let n = 0; n < 40; n++) {
      const seeded = { ...options, seed: `produto-${n}` }
      const texts = [composeInstagram(facts, seeded).caption, composeInstagram(plain, seeded).caption, composeTikTok(facts, seeded).caption, composeTikTok(plain, seeded).script]
      for (const text of texts) for (const claim of bannedClaims) expect(text).not.toMatch(claim)
    }
  })

  it('não cita desconto quando a Shopee não informou o preço anterior', () => {
    for (let n = 0; n < 20; n++) {
      const seeded = { ...options, seed: `p-${n}` }
      expect(composeInstagram(plain, seeded).caption).not.toMatch(/\d+\s*%/)
      expect(composeInstagram(plain, seeded).hashtags).not.toContain('#oferta')
      expect(composeTikTok(plain, seeded).caption).not.toMatch(/\d+\s*%/)
    }
    expect(composeInstagram(facts, options).hashtags).toContain('#oferta')
  })

  it('o mesmo produto cai sempre no mesmo modelo, e produtos diferentes variam', () => {
    expect(composeInstagram(facts, options).caption).toBe(composeInstagram(facts, options).caption)
    const variants = new Set(Array.from({ length: 30 }, (_, n) => composeInstagram(facts, { ...options, seed: `x-${n}` }).caption.split('\n')[0]))
    expect(variants.size).toBeGreaterThan(1)
  })

  it('hashtags: limpas, sem acento, sem repetição e com as da categoria', () => {
    expect(toTag('Ótimo Preço!')).toBe('#otimopreco')
    expect(parseBrandTags('#Garimpou, achadinhos #garimpou  Shopee')).toEqual(['#garimpou', '#achadinhos', '#shopee'])
    const tags = hashtagsFor('instagram', plain, { ...options, category: 'pet' })
    expect(tags).toContain('#pet')
    expect(new Set(tags).size).toBe(tags.length)
    expect(hashtagsFor('tiktok', plain, options).length).toBeLessThanOrEqual(5)
  })

  it('composeContent devolve roteiro só para o TikTok', () => {
    expect(composeContent('instagram', facts, options).script).toBeNull()
    expect(composeContent('tiktok', facts, options).script).toContain('Formato')
  })
})
