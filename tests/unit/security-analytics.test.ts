import { describe, expect, it } from 'vitest'
import { createPreviewToken, isFreshWebhook, validateProviderUrl, verifyPreviewToken } from '@/lib/security/controls'
import { createSafeSubId } from '@/lib/analytics/attribution'
describe('segurança', () => {
  it('bloqueia SSRF e protocolos inseguros', () => { expect(validateProviderUrl('http://amazon.com.br/item').valid).toBe(false); expect(validateProviderUrl('https://127.0.0.1/admin').valid).toBe(false); expect(validateProviderUrl('https://www.amazon.com.br/item').valid).toBe(true) })
  it('valida preview token por recurso', () => { const token = createPreviewToken('home-v2'); expect(verifyPreviewToken(token, 'home-v2')).toBe(true); expect(verifyPreviewToken(token, 'home-v3')).toBe(false) })
  it('protege timestamp de webhook', () => { expect(isFreshWebhook(String(Math.floor(Date.now() / 1000)))).toBe(true); expect(isFreshWebhook('1')).toBe(false) })
  it('mantém sub_id sem PII', () => expect(createSafeSubId(['Semana 42', 'Home Trending'])).toBe('semana-42_home-trending'))
})
