import { afterAll, describe, expect, it } from 'vitest'
import { like } from 'drizzle-orm'
import { GET as getState, POST as postAction, PUT as putDraft } from '@/app/api/v1/admin/site-documents/[key]/route'
import { db } from '@/lib/db/client'
import {
  discardDraft, getEditorState, getRenderDocument, HISTORY_LIMIT, publishDraft, restoreVersion, saveDraft,
} from '@/lib/db/repositories/site-documents'
import { siteDocuments } from '@/lib/db/schema'
import { defaultHomeDocument, newSection, type SiteDocument } from '@/lib/site-builder/document'
import { createAuthenticatedUser } from '../helpers/auth'

// Chaves de teste: o painel só aceita "home", mas o repositório aceita qualquer uma, e a home real nunca é tocada aqui.
const keyOf = () => `teste-${crypto.randomUUID().slice(0, 8)}`
const docWith = (title: string): SiteDocument => {
  const banner = newSection('banner')
  return { schemaVersion: 1, sections: [{ ...banner, settings: { ...banner.settings, title } }] }
}
const titleOf = (doc: SiteDocument) => doc.sections[0].settings.title

afterAll(async () => { await db.delete(siteDocuments).where(like(siteDocuments.key, 'teste-%')) })

describe('documentos do editor visual', () => {
  it('sem nada salvo, devolve o padrão da home', async () => {
    const key = keyOf()
    const state = await getEditorState(key)
    expect(state).toMatchObject({ hasDraft: false, isDefault: true, history: [] })
    expect(state.document.sections.map((section) => section.type)).toEqual(defaultHomeDocument({}).sections.map((section) => section.type))
    expect((await getRenderDocument(key)).sections[0].type).toBe('hero')
  })

  it('rascunho não muda o que o site mostra; publicar muda', async () => {
    const key = keyOf()
    await saveDraft(key, docWith('Rascunho A'), null)

    const state = await getEditorState(key)
    expect(state.hasDraft).toBe(true)
    expect(titleOf(state.document)).toBe('Rascunho A')
    // O público continua vendo o padrão; só a prévia vê o rascunho.
    expect((await getRenderDocument(key)).sections[0].type).toBe('hero')
    expect(titleOf(await getRenderDocument(key, { preview: true }))).toBe('Rascunho A')

    await publishDraft(key, null)
    expect(titleOf(await getRenderDocument(key))).toBe('Rascunho A')
    const after = await getEditorState(key)
    expect(after).toMatchObject({ hasDraft: false, isDefault: false })
    expect(after.history).toHaveLength(0)
  })

  it('cada publicação guarda a anterior e dá para restaurar para o rascunho', async () => {
    const key = keyOf()
    await saveDraft(key, docWith('Versão 1'), null)
    await publishDraft(key, null)
    await saveDraft(key, docWith('Versão 2'), null)
    await publishDraft(key, null)

    const state = await getEditorState(key)
    expect(titleOf(state.published)).toBe('Versão 2')
    expect(state.history).toHaveLength(1)

    const restored = await restoreVersion(key, state.history[0].id, null)
    expect(restored && titleOf(restored)).toBe('Versão 1')
    // Restaurar só preenche o rascunho: o site segue na versão 2 até publicar.
    expect(titleOf(await getRenderDocument(key))).toBe('Versão 2')
    expect(titleOf((await getEditorState(key)).document)).toBe('Versão 1')
    expect(await restoreVersion(key, 'inexistente', null)).toBeNull()
  })

  it('descartar volta ao publicado e o histórico respeita o limite', async () => {
    const key = keyOf()
    await saveDraft(key, docWith('Base'), null)
    await publishDraft(key, null)
    await saveDraft(key, docWith('Descartável'), null)
    await discardDraft(key, null)
    const state = await getEditorState(key)
    expect(state.hasDraft).toBe(false)
    expect(titleOf(state.document)).toBe('Base')

    for (let index = 0; index < HISTORY_LIMIT + 3; index++) {
      await saveDraft(key, docWith(`v${index}`), null)
      await publishDraft(key, null)
    }
    expect((await getEditorState(key)).history).toHaveLength(HISTORY_LIMIT)
  })
})

describe('API do editor', () => {
  const ctx = (key: string) => ({ params: Promise.resolve({ key }) })
  const withBody = (method: string, body: unknown, cookie?: string) =>
    new Request('http://localhost/api/v1/admin/site-documents/home', { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) })

  it('exige sessão e respeita o papel', async () => {
    expect((await getState(new Request('http://localhost/x'), ctx('home'))).status).toBe(401)
    const reader = await createAuthenticatedUser('READ_ONLY')
    expect((await getState(new Request('http://localhost/x', { headers: { cookie: reader.cookie } }), ctx('home'))).status).toBe(200)
    expect((await putDraft(withBody('PUT', { document: docWith('x') }, reader.cookie), ctx('home'))).status).toBe(403)
    expect((await postAction(withBody('POST', { action: 'publish' }, reader.cookie), ctx('home'))).status).toBe(403)
  })

  it('recusa página desconhecida, documento inválido e ação inválida', async () => {
    const editor = await createAuthenticatedUser('MARKETING')
    expect((await getState(new Request('http://localhost/x', { headers: { cookie: editor.cookie } }), ctx('outra'))).status).toBe(404)

    const invalid = await putDraft(withBody('PUT', { document: { schemaVersion: 1, sections: [{ id: 'a', type: 'script', name: 'x' }] } }, editor.cookie), ctx('home'))
    expect(invalid.status).toBe(422)

    const unsafe = await putDraft(withBody('PUT', { document: { schemaVersion: 1, sections: [{ ...newSection('cta'), settings: { buttonLabel: 'Ir', buttonHref: 'javascript:alert(1)' } }] } }, editor.cookie), ctx('home'))
    expect(unsafe.status).toBe(422)

    expect((await postAction(withBody('POST', { action: 'apagar-tudo' }, editor.cookie), ctx('home'))).status).toBe(422)
  })
})
