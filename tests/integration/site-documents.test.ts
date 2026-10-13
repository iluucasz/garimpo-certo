import { afterAll, describe, expect, it } from 'vitest'
import { like, or } from 'drizzle-orm'
import { DELETE as deletePageRoute, GET as getState, POST as postAction, PUT as putDraft } from '@/app/api/v1/admin/site-documents/[key]/route'
import { GET as listIndex, POST as createPageRoute } from '@/app/api/v1/admin/site-documents/route'
import { db } from '@/lib/db/client'
import {
  createPage, deletePage, discardDraft, getEditorState, getPageDocument, getRenderDocument, HISTORY_LIMIT, listPages, publishDraft,
  restoreVersion, saveDraft, unpublishPage,
} from '@/lib/db/repositories/site-documents'
import { siteDocuments } from '@/lib/db/schema'
import { defaultHomeDocument, newSection, pageKeyFor, type SiteDocument } from '@/lib/site-builder/document'
import { createAuthenticatedUser } from '../helpers/auth'

// Chaves de teste: o painel só aceita "home", mas o repositório aceita qualquer uma, e a home real nunca é tocada aqui.
const keyOf = () => `teste-${crypto.randomUUID().slice(0, 8)}`
const docWith = (title: string): SiteDocument => {
  const banner = newSection('banner')
  return { schemaVersion: 1, sections: [{ ...banner, archived: false, settings: { ...banner.settings, title } }] }
}
const titleOf = (doc: SiteDocument) => doc.sections[0].settings.title
const slugOf = () => `teste-${crypto.randomUUID().slice(0, 8)}`

afterAll(async () => {
  await db.delete(siteDocuments).where(or(like(siteDocuments.key, 'teste-%'), like(siteDocuments.key, 'page:teste-%')))
})

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

describe('páginas criadas no painel', () => {
  it('nasce como rascunho fora do ar, publica, sai do ar e só então pode ser apagada', async () => {
    const slug = slugOf()
    const key = pageKeyFor(slug)
    const created = await createPage(slug, 'Página de teste', null)
    expect(created).toMatchObject({ key, slug, title: 'Página de teste', published: false, hasDraft: true })
    // Endereço repetido não sobrescreve.
    expect(await createPage(slug, 'Outra', null)).toBeNull()

    // Fora do ar: o público não vê; a prévia (rascunho) vê.
    expect(await getPageDocument(slug)).toBeNull()
    expect((await getPageDocument(slug, { preview: true }))?.page?.title).toBe('Página de teste')

    await saveDraft(key, { ...docWith('Bloco'), page: { title: 'Título novo' } }, null)
    await publishDraft(key, null)
    expect(titleOf((await getPageDocument(slug))!)).toBe('Bloco')
    expect((await listPages()).find((page) => page.key === key)).toMatchObject({ published: true, title: 'Título novo', hasDraft: false })

    // No ar: não apaga.
    expect(await deletePage(key)).toBe(false)
    expect(await unpublishPage(key, null)).toBe(true)
    expect(await getPageDocument(slug)).toBeNull()
    // O conteúdo ficou como rascunho.
    expect(titleOf((await getEditorState(key)).document)).toBe('Bloco')
    expect(await deletePage(key)).toBe(true)
    expect((await listPages()).some((page) => page.key === key)).toBe(false)
  })

  it('chave que não é de página não vira página', async () => {
    expect(await getPageDocument('Inválida!')).toBeNull()
    expect(await createPage('Inválida!', 'x', null)).toBeNull()
  })
})

describe('API de páginas', () => {
  const ctx = (key: string) => ({ params: Promise.resolve({ key }) })
  const request = (method: string, body?: unknown, cookie?: string) =>
    new Request('http://localhost/api/v1/admin/site-documents', { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })

  it('lista exige sessão, criar exige content:write e o ciclo completo funciona', async () => {
    expect((await listIndex(request('GET'))).status).toBe(401)
    const reader = await createAuthenticatedUser('READ_ONLY')
    const editor = await createAuthenticatedUser('MARKETING')
    const slug = slugOf()

    expect((await listIndex(request('GET', undefined, reader.cookie))).status).toBe(200)
    expect((await createPageRoute(request('POST', { title: 'Teste', slug }, reader.cookie))).status).toBe(403)
    expect((await createPageRoute(request('POST', { title: '' }, editor.cookie))).status).toBe(422)

    const created = await createPageRoute(request('POST', { title: 'Página da API', slug }, editor.cookie))
    expect(created.status).toBe(201)
    expect((await createPageRoute(request('POST', { title: 'Repetida', slug }, editor.cookie))).status).toBe(409)

    const index = await (await listIndex(request('GET', undefined, editor.cookie))).json() as { data: { pages: { slug: string }[]; collections: { slug: string }[] } }
    expect(index.data.pages.some((page) => page.slug === slug)).toBe(true)
    expect(index.data.collections.length).toBeGreaterThan(0)

    const key = pageKeyFor(slug)
    // Páginas só aceitam blocos livres.
    const withBuiltin = { schemaVersion: 1, sections: [{ id: 'hero', type: 'hero', name: 'Topo', hidden: false, archived: false, settings: {} }] }
    expect((await putDraft(request('PUT', { document: withBuiltin }, editor.cookie), ctx(key))).status).toBe(422)

    const good = { schemaVersion: 1, page: { title: 'Título SEO' }, sections: [{ ...newSection('faq'), archived: false }] }
    expect((await putDraft(request('PUT', { document: good }, editor.cookie), ctx(key))).status).toBe(200)
    expect((await postAction(request('POST', { action: 'publish' }, editor.cookie), ctx(key))).status).toBe(200)

    // No ar: apagar é recusado; depois de tirar do ar, vai.
    expect((await deletePageRoute(request('DELETE', undefined, editor.cookie), ctx(key))).status).toBe(409)
    expect((await postAction(request('POST', { action: 'unpublish' }, editor.cookie), ctx(key))).status).toBe(200)
    expect((await deletePageRoute(request('DELETE', undefined, editor.cookie), ctx(key))).status).toBe(200)
    expect((await getState(request('GET', undefined, editor.cookie), ctx(key))).status).toBe(200)
  })

  it('home e aparência não podem ser apagadas e "unpublish" não vale para elas', async () => {
    const editor = await createAuthenticatedUser('MARKETING')
    expect((await deletePageRoute(request('DELETE', undefined, editor.cookie), ctx('home'))).status).toBe(422)
    expect((await deletePageRoute(request('DELETE', undefined, editor.cookie), ctx('global'))).status).toBe(422)
    expect((await postAction(request('POST', { action: 'unpublish' }, editor.cookie), ctx('home'))).status).toBe(422)
    // A aparência abre sem seções e com o design derivado do tema atual.
    const state = await (await getState(request('GET', undefined, editor.cookie), ctx('global'))).json() as { data: { kind: string; document: SiteDocument } }
    expect(state.data.kind).toBe('global')
    expect(state.data.document.design?.theme.primary).toMatch(/^#[0-9a-f]{6}$/)
  })
})
