import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { engineProposals, globalSettings, offers, products } from '@/lib/db/schema'
import { categoryGroups } from '@/lib/providers/shopee/import'
import { settingDefinitions } from '@/lib/admin/settings-defs'
import { recordAudit } from '@/lib/admin/audit'
import { defaultEngineConfig, type CategoryStat, type EngineConfig, type ProductSignal, type ProposalDraft } from './rules'

/**
 * Persistência e aplicação das propostas da Engine. Sem imports do Next (`next/cache`): o worker da VPS também
 * usa este arquivo. Quem precisa invalidar cache (a API do painel) olha `AppliedResult.invalidate`.
 */

export type EngineMode = 'off' | 'shadow' | 'approval' | 'auto'
export type EngineSettings = EngineConfig & { mode: EngineMode }
export type ProposalStatus = 'shadow' | 'pending' | 'applied' | 'rejected' | 'failed' | 'expired'
export type ProposalRow = typeof engineProposals.$inferSelect

/** Tipos que o modo automático aplica sozinho: só o que é reversível e não esconde produto da vitrine. */
export const AUTO_KINDS = ['import_term', 'category_quota'] as const

export const kindLabels: Record<string, string> = {
  archive_product: 'Tirar produto da vitrine',
  import_term: 'Importar termo de busca',
  category_quota: 'Importar mais de uma categoria',
}

const REJECT_COOLDOWN_DAYS = 30
const day = 86_400_000

// ---------------------------------------------------------------- configuração

/** Lê `global_settings.engine` direto (sem cache do Next) por cima dos padrões. */
export async function loadEngineSettings(): Promise<EngineSettings> {
  const defaults = settingDefinitions.engine.defaults as Record<string, unknown>
  const [row] = await db.select({ value: globalSettings.value }).from(globalSettings).where(eq(globalSettings.key, 'engine')).limit(1)
  const stored = row?.value && typeof row.value === 'object' ? row.value as Record<string, unknown> : {}
  const merged = { ...defaults, ...stored }
  const number = (key: string, fallback: number) => { const value = Number(merged[key]); return Number.isFinite(value) ? value : fallback }
  const mode = (['off', 'shadow', 'approval', 'auto'] as const).find((item) => item === merged.mode) ?? 'shadow'
  return {
    mode,
    windowDays: number('windowDays', defaultEngineConfig.windowDays),
    minSiteViews: number('minSiteViews', defaultEngineConfig.minSiteViews),
    minAgeDays: number('minAgeDays', defaultEngineConfig.minAgeDays),
    maxPerRun: number('maxPerRun', defaultEngineConfig.maxPerRun),
    maxShare: number('maxSharePercent', defaultEngineConfig.maxShare * 100) / 100,
    seasonalEnabled: merged.seasonalEnabled !== false,
    lookaheadDays: number('lookaheadDays', defaultEngineConfig.lookaheadDays),
    learnEnabled: merged.learnEnabled !== false,
    minSiteClicks: number('minSiteClicks', defaultEngineConfig.minSiteClicks),
    quotaExtra: number('quotaExtra', defaultEngineConfig.quotaExtra),
  }
}

export type ImportSettings = { enabled: boolean; perCategory: number; minRating: number; minSales: number; maxPerShop: number }

/** Lê `global_settings.import` direto (o worker não tem o cache do Next) por cima dos padrões. */
export async function loadImportSettings(): Promise<ImportSettings> {
  const defaults = settingDefinitions.import.defaults as Record<string, unknown>
  const [row] = await db.select({ value: globalSettings.value }).from(globalSettings).where(eq(globalSettings.key, 'import')).limit(1)
  const stored = row?.value && typeof row.value === 'object' ? row.value as Record<string, unknown> : {}
  const merged = { ...defaults, ...stored }
  const number = (key: string, min: number, max: number, fallback: number) => {
    const value = Number(merged[key])
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
  }
  return {
    enabled: merged.enabled !== false,
    perCategory: Math.round(number('perCategory', 10, 80, 40)),
    minRating: number('minRating', 4, 5, 4.5),
    minSales: Math.round(number('minSales', 10, 500, 50)),
    maxPerShop: Math.round(number('maxPerShop', 1, 5, 2)),
  }
}

/** Visitas, cliques e compras por categoria principal, na janela. Base das regras que aprendem com os cliques. */
export async function loadCategoryStats(windowDays: number): Promise<CategoryStat[]> {
  const days = Math.min(Math.max(Math.trunc(windowDays) || 30, 1), 365)
  const result = await db.execute(sql`
    with pcat as (
      select distinct on (pc.product_id) pc.product_id, c.slug, c.name
      from product_categories pc
      join categories c on c.id = pc.category_id
      join products p on p.id = pc.product_id and p.status = 'active'
      order by pc.product_id, pc.is_primary desc
    )
    select s.slug, s.name, s.products,
           coalesce(k.clicks, 0)::int as clicks, coalesce(v.views, 0)::int as views, coalesce(cv.conversions, 0)::int as conversions
    from (select slug, name, count(*)::int as products from pcat group by slug, name) s
    left join (
      select pcat.slug, count(*)::int as clicks
      from affiliate_clicks ac join offers o on o.id = ac.offer_id join pcat on pcat.product_id = o.product_id
      where ac.created_at > now() - (${days} * interval '1 day') group by pcat.slug
    ) k on k.slug = s.slug
    left join (
      select pcat.slug, count(*)::int as views
      from analytics_events e join pcat on pcat.product_id = e.product_id
      where e.event_name in ('product_view', 'page_view') and e."timestamp" > now() - (${days} * interval '1 day') group by pcat.slug
    ) v on v.slug = s.slug
    left join (
      select pcat.slug, count(distinct i.conversion_id)::int as conversions
      from affiliate_conversion_items i
      join affiliate_conversions cvv on cvv.id = i.conversion_id and cvv.status in ('pending', 'approved', 'paid')
      join offers o on o.id = i.offer_id join pcat on pcat.product_id = o.product_id
      where coalesce(cvv.converted_at, cvv.synced_at) > now() - interval '180 days' group by pcat.slug
    ) cv on cv.slug = s.slug
    order by s.products desc`)
  return (result.rows as { slug: string; name: string; products: number; clicks: number; views: number; conversions: number }[]).map((row) => ({
    slug: row.slug, name: row.name, products: Number(row.products), clicks: Number(row.clicks), views: Number(row.views), conversions: Number(row.conversions),
  }))
}

/** Produtos a mais por categoria que a equipe (ou o modo automático) aprovou e ainda estão dentro da validade. */
export async function activeCategoryBonuses(now = new Date()): Promise<Record<string, number>> {
  const rows = await db.select({ payload: engineProposals.payload }).from(engineProposals)
    .where(and(eq(engineProposals.kind, 'category_quota'), eq(engineProposals.status, 'applied')))
  const bonuses: Record<string, number> = {}
  for (const row of rows) {
    const payload = row.payload as { category?: string; extra?: number; until?: string }
    if (!payload.category || !payload.until || !Number.isFinite(Number(payload.extra))) continue
    if (new Date(`${payload.until}T23:59:59Z`).getTime() < now.getTime()) continue
    bonuses[payload.category] = Math.max(bonuses[payload.category] ?? 0, Math.min(40, Math.max(0, Math.round(Number(payload.extra)))))
  }
  return bonuses
}

export type RunState = {
  at: string
  mode: EngineMode
  created: number
  refreshed: number
  expired: number
  applied: number
  note: string | null
  coverage: { siteViews: number; minSiteViews: number; eligible: number; activeProducts: number } | null
}

export async function saveRunState(state: RunState) {
  const now = new Date().toISOString()
  await db.insert(globalSettings).values({ key: 'engine_state', value: state, updatedAt: now })
    .onConflictDoUpdate({ target: globalSettings.key, set: { value: state, updatedAt: now } })
}

export async function readRunState(): Promise<RunState | null> {
  const [row] = await db.select({ value: globalSettings.value }).from(globalSettings).where(eq(globalSettings.key, 'engine_state')).limit(1)
  return (row?.value as RunState | undefined) ?? null
}

// ---------------------------------------------------------------- entrada: o que a Engine enxerga

/** Visitas, cliques, favoritos e compras por produto ativo na janela, e o total de visitas a produtos do site. */
export async function loadSignals(windowDays: number): Promise<{ signals: ProductSignal[]; siteViews: number }> {
  const days = Math.min(Math.max(Math.trunc(windowDays) || 30, 1), 365)
  const [productRows, eventRows, clickRows, conversionRows, totalRows] = await Promise.all([
    db.execute(sql`
      select p.id, p.name, p.slug, p.created_at, p.editorial_locked,
             coalesce((select max(o.sold_count) from offers o where o.product_id = p.id and o.status = 'active'), 0)::int as sold
      from products p where p.status = 'active'`),
    db.execute(sql`
      select product_id,
             count(*) filter (where event_name in ('product_view', 'page_view'))::int as views,
             count(*) filter (where event_name in ('favorite_add', 'product_favorite'))::int as favorites
      from analytics_events
      where product_id is not null and "timestamp" > now() - (${days} * interval '1 day')
      group by product_id`),
    db.execute(sql`
      select o.product_id, count(*)::int as clicks
      from affiliate_clicks c join offers o on o.id = c.offer_id
      where c.created_at > now() - (${days} * interval '1 day')
      group by o.product_id`),
    db.execute(sql`
      select o.product_id, count(distinct i.conversion_id)::int as conversions
      from affiliate_conversion_items i
      join affiliate_conversions v on v.id = i.conversion_id and v.status in ('pending', 'approved', 'paid')
      join offers o on o.id = i.offer_id
      where coalesce(v.converted_at, v.synced_at) > now() - interval '180 days'
      group by o.product_id`),
    db.execute(sql`
      select count(*)::int as n from analytics_events
      where event_name in ('product_view', 'page_view') and product_id is not null and "timestamp" > now() - (${days} * interval '1 day')`),
  ])

  const by = <T extends { product_id: string }>(rows: { rows: unknown[] }) => new Map((rows.rows as T[]).map((row) => [row.product_id, row]))
  const events = by<{ product_id: string; views: number; favorites: number }>(eventRows)
  const clicks = by<{ product_id: string; clicks: number }>(clickRows)
  const conversions = by<{ product_id: string; conversions: number }>(conversionRows)

  const signals = (productRows.rows as { id: string; name: string; slug: string; created_at: string; editorial_locked: boolean; sold: number }[]).map((row): ProductSignal => ({
    id: row.id, name: row.name, slug: row.slug, createdAt: new Date(row.created_at).toISOString(), locked: Boolean(row.editorial_locked),
    views: events.get(row.id)?.views ?? 0, favorites: events.get(row.id)?.favorites ?? 0,
    clicks: clicks.get(row.id)?.clicks ?? 0, conversions: conversions.get(row.id)?.conversions ?? 0, soldCount: row.sold,
  }))
  return { signals, siteViews: Number((totalRows.rows[0] as { n: number }).n) }
}

/** Termos que o importador já usa (para o radar não sugerir o que já existe). */
export function importerKeywords() {
  return new Set(categoryGroups.flatMap((group) => [...group.keywords, ...(group.premiumKeywords ?? [])]))
}

/** Termos sazonais aprovados e ainda dentro da validade; o importador soma estes às buscas da categoria. */
export async function activeSeasonalTerms(now = new Date()): Promise<{ category: string; keyword: string }[]> {
  const rows = await db.select({ payload: engineProposals.payload }).from(engineProposals)
    .where(and(eq(engineProposals.kind, 'import_term'), eq(engineProposals.status, 'applied')))
  return rows.flatMap((row) => {
    const payload = row.payload as { category?: string; keyword?: string; until?: string }
    if (!payload.category || !payload.keyword || !payload.until) return []
    return new Date(`${payload.until}T23:59:59Z`).getTime() >= now.getTime() ? [{ category: payload.category, keyword: payload.keyword }] : []
  })
}

// ---------------------------------------------------------------- propostas

export type PersistResult = { created: number; refreshed: number; skipped: number }

/** Grava as propostas novas. A mesma proposta nunca aparece duas vezes; recusa vale por 30 dias. */
export async function persistDrafts(drafts: ProposalDraft[], mode: Exclude<EngineMode, 'off'>, now = Date.now()): Promise<PersistResult> {
  const result: PersistResult = { created: 0, refreshed: 0, skipped: 0 }
  for (const draft of drafts) {
    const [existing] = await db.select().from(engineProposals)
      .where(and(eq(engineProposals.kind, draft.kind), eq(engineProposals.subjectId, draft.subjectId)))
      .orderBy(desc(engineProposals.createdAt)).limit(1)

    if (existing && (existing.status === 'pending' || existing.status === 'shadow')) {
      await db.update(engineProposals).set({ reason: draft.reason, evidence: draft.evidence, title: draft.title, expiresAt: draft.expiresAt }).where(eq(engineProposals.id, existing.id))
      result.refreshed++
      continue
    }
    if (existing?.status === 'applied' && (draft.kind === 'archive_product' || !existing.expiresAt || new Date(existing.expiresAt).getTime() > now)) { result.skipped++; continue }
    if (existing?.status === 'rejected' && existing.decidedAt && now - new Date(existing.decidedAt).getTime() < REJECT_COOLDOWN_DAYS * day) { result.skipped++; continue }

    await db.insert(engineProposals).values({
      kind: draft.kind, subjectType: draft.subjectType, subjectId: draft.subjectId, title: draft.title, reason: draft.reason,
      evidence: draft.evidence, payload: draft.payload, expiresAt: draft.expiresAt, status: mode === 'shadow' ? 'shadow' : 'pending',
    })
    result.created++
  }
  return result
}

/** Pendentes e sombra que passaram da validade deixam de aparecer na fila. */
export async function expireStale(now = new Date()) {
  const expired = await db.update(engineProposals).set({ status: 'expired' })
    .where(and(inArray(engineProposals.status, ['pending', 'shadow']), lt(engineProposals.expiresAt, now.toISOString())))
    .returning({ id: engineProposals.id })
  return expired.length
}

export async function listProposals(options: { statuses?: ProposalStatus[]; limit?: number } = {}) {
  const where = options.statuses?.length ? inArray(engineProposals.status, options.statuses) : undefined
  return db.select().from(engineProposals).where(where).orderBy(desc(engineProposals.createdAt)).limit(options.limit ?? 100)
}

export async function proposalCounts() {
  const rows = await db.select({ status: engineProposals.status, n: sql<number>`count(*)::int` }).from(engineProposals).groupBy(engineProposals.status)
  return Object.fromEntries(rows.map((row) => [row.status, row.n])) as Partial<Record<ProposalStatus, number>>
}

export type AppliedResult = { ok: true; result: Record<string, unknown>; invalidate: string[] } | { ok: false; error: string }

/** Executa a ação da proposta. Falha com mensagem clara quando a situação mudou desde a sugestão. */
export async function applyProposal(row: ProposalRow, actorUserId: string | null): Promise<AppliedResult> {
  if (row.kind === 'archive_product') {
    const productId = String((row.payload as { productId?: string }).productId ?? '')
    const [product] = await db.select({ id: products.id, status: products.status, locked: products.editorialLocked, name: products.name }).from(products).where(eq(products.id, productId))
    if (!product) return { ok: false, error: 'O produto não existe mais.' }
    if (product.status !== 'active') return { ok: false, error: 'O produto já não está na vitrine.' }
    if (product.locked) return { ok: false, error: 'O produto foi editado pela equipe; a Engine não mexe nele.' }
    // Arquivar e travar: sem a trava, a próxima importação reativaria o produto se ele voltasse à seleção.
    await db.update(products).set({ status: 'removed', editorialLocked: true, updatedAt: new Date().toISOString() }).where(eq(products.id, productId))
    await db.update(offers).set({ status: 'removed' }).where(eq(offers.productId, productId))
    await recordAudit({ actorUserId, action: 'engine.archive_product', entityType: 'produto', entityId: productId, before: { status: 'active', name: product.name }, after: { status: 'removed', proposal: row.id } })
    return { ok: true, result: { archived: productId }, invalidate: ['catalog', 'metrics'] }
  }
  if (row.kind === 'import_term') {
    const payload = row.payload as { category?: string; keyword?: string; until?: string }
    if (!payload.category || !payload.keyword) return { ok: false, error: 'Proposta sem categoria ou termo.' }
    await recordAudit({ actorUserId, action: 'engine.import_term', entityType: 'termo', entityId: row.subjectId, after: { ...payload, proposal: row.id } })
    return { ok: true, result: { effectiveUntil: payload.until ?? null, note: 'O termo entra na próxima importação do catálogo.' }, invalidate: [] }
  }
  if (row.kind === 'category_quota') {
    const payload = row.payload as { category?: string; extra?: number; until?: string }
    if (!payload.category || !payload.extra) return { ok: false, error: 'Proposta sem categoria ou quantidade.' }
    await recordAudit({ actorUserId, action: 'engine.category_quota', entityType: 'categoria', entityId: row.subjectId, after: { ...payload, proposal: row.id } })
    return { ok: true, result: { effectiveUntil: payload.until ?? null, extra: payload.extra, note: `A categoria traz ${payload.extra} produtos a mais na próxima importação, até ${payload.until ?? 'o fim da validade'}.` }, invalidate: [] }
  }
  return { ok: false, error: `Tipo de proposta desconhecido: ${row.kind}.` }
}

/** Aprova (e aplica) ou recusa uma proposta pendente. */
export async function decideProposal(id: string, decision: 'approve' | 'reject', actorUserId: string | null, note?: string): Promise<{ row: ProposalRow; invalidate: string[] } | { error: string; status: number }> {
  const [row] = await db.select().from(engineProposals).where(eq(engineProposals.id, id)).limit(1)
  if (!row) return { error: 'Proposta não encontrada.', status: 404 }
  if (row.status !== 'pending') return { error: row.status === 'shadow' ? 'Propostas do modo sombra só registram o que a Engine faria; mude o modo para aprovar.' : 'Esta proposta já foi decidida.', status: 409 }

  const decidedAt = new Date().toISOString()
  if (decision === 'reject') {
    const [updated] = await db.update(engineProposals).set({ status: 'rejected', decidedAt, decidedBy: actorUserId, decisionNote: note?.slice(0, 500) || null }).where(eq(engineProposals.id, id)).returning()
    return { row: updated, invalidate: [] }
  }
  const applied = await applyProposal(row, actorUserId)
  const [updated] = await db.update(engineProposals).set(applied.ok
    ? { status: 'applied', decidedAt, decidedBy: actorUserId, decisionNote: note?.slice(0, 500) || null, appliedAt: decidedAt, result: applied.result }
    : { status: 'failed', decidedAt, decidedBy: actorUserId, decisionNote: note?.slice(0, 500) || null, result: { error: applied.error } })
    .where(eq(engineProposals.id, id)).returning()
  return { row: updated, invalidate: applied.ok ? applied.invalidate : [] }
}
