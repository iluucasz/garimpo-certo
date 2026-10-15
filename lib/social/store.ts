import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { globalSettings, socialPosts } from '@/lib/db/schema'
import { settingDefinitions } from '@/lib/admin/settings-defs'
import { generateShortLink } from '@/lib/providers/shopee/client'
import { toSubId } from '@/lib/providers/shopee/links'
import { deepseekConfig } from '@/lib/ai/deepseek'
import { categoryBoosts } from '@/lib/engine/rules'
import { loadCategoryStats, loadEngineSettings } from '@/lib/engine/store'
import { composePost, type PostFacts } from './compose'
import { rewriteWithAi } from './rewrite'
import { adaptiveCooldown, defaultPickOptions, eligible, rankCandidates, type PostCandidate, type Ranked } from './picker'
import { recheckOffer, type OfferNow } from './recheck'
import { brasiliaDay, missingSlots } from './schedule'
import { sendTelegramPost, telegramConfig, TelegramError } from './telegram'

/** Persistência e envio das postagens. Sem imports do Next: o worker da VPS usa este arquivo. */

export type PostStatus = 'pending' | 'approved' | 'sent' | 'failed' | 'cancelled'
export type PostRow = typeof socialPosts.$inferSelect

export type SocialSettings = {
  mode: 'off' | 'on'
  dailyLimit: number
  startHour: number
  endHour: number
  requireApproval: boolean
  autoPlan: boolean
  useAi: boolean
  campaign: string
}

/** Passou mais que isso do horário: não vale mais postar (oferta de manhã às 22h destoa) e a fila não acumula. */
export const MAX_LATE_MS = 3 * 3_600_000
export const MAX_ATTEMPTS = 3

export async function loadSocialSettings(): Promise<SocialSettings> {
  const defaults = settingDefinitions.social.defaults as Record<string, unknown>
  const [row] = await db.select({ value: globalSettings.value }).from(globalSettings).where(eq(globalSettings.key, 'social')).limit(1)
  const stored = row?.value && typeof row.value === 'object' ? row.value as Record<string, unknown> : {}
  const merged = { ...defaults, ...stored }
  const number = (key: string, fallback: number) => { const value = Number(merged[key]); return Number.isFinite(value) ? value : fallback }
  return {
    mode: merged.mode === 'on' ? 'on' : 'off',
    dailyLimit: Math.min(Math.max(Math.round(number('dailyLimit', 15)), 1), 30),
    startHour: number('startHour', 9),
    endHour: number('endHour', 21),
    requireApproval: merged.requireApproval !== false,
    autoPlan: merged.autoPlan !== false,
    useAi: merged.useAi === true,
    campaign: toSubId(String(merged.campaign ?? 'ofertas')) || 'ofertas',
  }
}

export type SocialState = { at: string; planned: number; sent: number; failed: number; expired: number; note: string | null }

export async function saveSocialState(state: SocialState) {
  const now = new Date().toISOString()
  await db.insert(globalSettings).values({ key: 'social_state', value: state, updatedAt: now })
    .onConflictDoUpdate({ target: globalSettings.key, set: { value: state, updatedAt: now } })
}

export async function readSocialState(): Promise<SocialState | null> {
  const [row] = await db.select({ value: globalSettings.value }).from(globalSettings).where(eq(globalSettings.key, 'social_state')).limit(1)
  return (row?.value as SocialState | undefined) ?? null
}

// ---------------------------------------------------------------- aprendizado

/** Reforço por categoria, aprendido com os cliques reais da Engine. Vazio quando desligado ou com poucos dados. */
export async function loadCategoryBoost(): Promise<Record<string, number>> {
  const config = await loadEngineSettings()
  if (config.mode === 'off' || !config.learnEnabled) return {}
  return categoryBoosts(await loadCategoryStats(config.windowDays), config)
}

// ---------------------------------------------------------------- candidatos

type CandidateRow = {
  product_id: string; offer_id: string; name: string; slug: string; image_url: string | null; category: string | null
  price: string; original_price: string | null; discount: string | null; rating: string | null; sold_count: number | null
  editorial_score: string | null; commission_rate: string | null; external_url: string; max_price_30d: string | null; last_posted_at: string | null
}

/** Ofertas ativas com o que a escolha precisa: imagem, categoria, queda de preço em 30 dias e última divulgação. */
export async function loadCandidates(channel = 'telegram'): Promise<PostCandidate[]> {
  const result = await db.execute(sql`
    select p.id as product_id, o.id as offer_id, p.name, p.slug,
           (select i.source_url from product_images i where i.product_id = p.id order by i.is_primary desc, i.position asc limit 1) as image_url,
           (select c.slug from product_categories pc join categories c on c.id = pc.category_id where pc.product_id = p.id order by pc.is_primary desc limit 1) as category,
           o.price::text as price, o.original_price::text as original_price, o.discount_percentage::text as discount,
           o.rating::text as rating, o.sold_count, p.editorial_score::text as editorial_score, o.commission_rate::text as commission_rate,
           o.external_url,
           (select max(h.price)::text from price_history h where h.offer_id = o.id and h.captured_at > now() - interval '30 days') as max_price_30d,
           (select max(sp.created_at) from social_posts sp where sp.product_id = p.id and sp.channel = ${channel} and sp.status in ('pending', 'approved', 'sent')) as last_posted_at
    from offers o join products p on p.id = o.product_id
    where o.status = 'active' and p.status = 'active' and o.affiliate_url is not null`)
  return (result.rows as CandidateRow[]).map((row): PostCandidate => {
    const price = Number(row.price)
    const maxPrice = Number(row.max_price_30d ?? 0)
    return {
      productId: row.product_id, offerId: row.offer_id, name: row.name, slug: row.slug, imageUrl: row.image_url, category: row.category ?? 'geral',
      price, originalPrice: row.original_price ? Number(row.original_price) : null, discountPercent: row.discount ? Number(row.discount) : null,
      rating: Number(row.rating ?? 0), soldCount: row.sold_count ?? 0, editorialScore: Number(row.editorial_score ?? 0),
      commissionRate: Number(row.commission_rate ?? 0), priceDropPercent: maxPrice > price ? ((maxPrice - price) / maxPrice) * 100 : 0,
      externalUrl: row.external_url, lastPostedAt: row.last_posted_at ? new Date(row.last_posted_at).toISOString() : null,
    }
  })
}

// ---------------------------------------------------------------- criação

const factsOf = (candidate: PostCandidate): PostFacts => ({
  name: candidate.name, price: candidate.price, originalPrice: candidate.originalPrice, discountPercent: candidate.discountPercent,
  rating: candidate.rating, soldCount: candidate.soldCount,
})

/** Cria a postagem: gera o link com etiqueta `telegram-<campanha>` e escreve o texto com os números da oferta. */
export async function createPost(input: {
  candidate: PostCandidate; campaign: string; source: 'manual' | 'engine'; status: 'pending' | 'approved'; scheduledFor: number | null; userId: string | null
  /** Pede à IA uma redação alternativa (validada); se falhar ou inventar algo, vale o modelo fixo. */
  useAi?: boolean
}) {
  const { candidate } = input
  const link = await generateShortLink(candidate.externalUrl, ['telegram', toSubId(input.campaign) || 'ofertas'])
  const facts = factsOf(candidate)
  const caption = Boolean(candidate.imageUrl)
  let { text } = composePost(facts, link, candidate.productId, { caption })
  let ai: { rewritten: boolean; reason?: string } | undefined
  const config = input.useAi ? deepseekConfig() : null
  if (config) {
    const rewritten = await rewriteWithAi({ config, facts, link, seed: new Date().getDate() + candidate.name.length, caption })
    if (rewritten.ok) { ai = { rewritten: true }; text = rewritten.text } else ai = { rewritten: false, reason: rewritten.reason }
  }
  const [row] = await db.insert(socialPosts).values({
    channel: 'telegram', status: input.status, productId: candidate.productId, offerId: candidate.offerId, campaign: toSubId(input.campaign) || 'ofertas',
    text, imageUrl: candidate.imageUrl, linkUrl: link, facts: ai ? { ...facts, ai } : facts, source: input.source,
    scheduledFor: input.scheduledFor ? new Date(input.scheduledFor).toISOString() : null,
    createdBy: input.userId, approvedBy: input.status === 'approved' ? input.userId : null,
  }).returning()
  return row
}

export type PlanResult = { created: number; ranked: Ranked[]; reason: string | null }

/** Completa a cota de hoje com as melhores ofertas ainda não divulgadas. Devolve o que criou. */
export async function planToday(settings: SocialSettings, now = Date.now(), userId: string | null = null): Promise<PlanResult> {
  const day = brasiliaDay(now)
  const todays = await db.select({ scheduledFor: socialPosts.scheduledFor }).from(socialPosts)
    .where(and(eq(socialPosts.channel, 'telegram'), inArray(socialPosts.status, ['pending', 'approved', 'sent'])))
  const existing = todays.flatMap((row) => row.scheduledFor ? [new Date(row.scheduledFor).getTime()] : []).filter((instant) => brasiliaDay(instant) === day)
  const slots = missingSlots({ now, dailyLimit: settings.dailyLimit, startHour: settings.startHour, endHour: settings.endHour, existing })
  if (slots.length === 0) return { created: 0, ranked: [], reason: 'A cota de hoje já está completa ou os horários de hoje passaram.' }

  const candidates = await loadCandidates()
  // Aprende com os cliques reais: categorias que rendem acima da média ganham um empurrão suave. Falhar aqui nunca impede de postar.
  const categoryBoost = await loadCategoryBoost().catch(() => ({}))
  // Com cota alta, uma por categoria não basta e 14 dias de intervalo esgotariam a lista: ajusta os dois pelo tamanho real da lista.
  const base = { ...defaultPickOptions, now, limit: slots.length }
  const pool = candidates.filter((candidate) => eligible(candidate, { ...base, cooldownDays: 0 }))
  const categories = new Set(pool.map((candidate) => candidate.category)).size || 1
  const ranked = rankCandidates(candidates, {
    ...base,
    perCategory: Math.max(base.perCategory, Math.ceil(slots.length / categories)),
    cooldownDays: adaptiveCooldown(pool.length, settings.dailyLimit, base.cooldownDays),
    categoryBoost,
  })
  if (ranked.length === 0) return { created: 0, ranked, reason: 'Nenhuma oferta atende aos critérios (nota, vendas, imagem e intervalo entre repetições).' }

  let created = 0
  for (const [index, item] of ranked.entries()) {
    try {
      await createPost({
        candidate: item.candidate, campaign: settings.campaign, source: 'engine', userId, useAi: settings.useAi,
        status: settings.requireApproval ? 'pending' : 'approved', scheduledFor: slots[index],
      })
      created++
    } catch (error) {
      console.error('[social] não foi possível criar a postagem', item.candidate.slug, error instanceof Error ? error.message : error)
    }
  }
  return { created, ranked, reason: null }
}

// ---------------------------------------------------------------- consulta e edição

export async function listPosts(options: { statuses?: PostStatus[]; limit?: number } = {}) {
  const where = and(eq(socialPosts.channel, 'telegram'), options.statuses?.length ? inArray(socialPosts.status, options.statuses) : undefined)
  return db.select().from(socialPosts).where(where).orderBy(desc(socialPosts.createdAt)).limit(options.limit ?? 100)
}

export async function updatePost(id: string, patch: { text?: string; scheduledFor?: string | null }) {
  const [row] = await db.update(socialPosts).set({
    ...(patch.text !== undefined ? { text: patch.text } : {}),
    ...(patch.scheduledFor !== undefined ? { scheduledFor: patch.scheduledFor } : {}),
    updatedAt: new Date().toISOString(),
  }).where(and(eq(socialPosts.id, id), eq(socialPosts.channel, 'telegram'), inArray(socialPosts.status, ['pending', 'approved']))).returning()
  return row ?? null
}

type StoredFacts = PostFacts & { originalText?: string; ai?: { rewritten: boolean; reason?: string } }

/** Reescreve o texto com a IA. Guarda o texto anterior para dar para voltar. Só mexe em pendente ou agendada. */
export async function rewritePost(id: string) {
  const [row] = await db.select().from(socialPosts).where(and(eq(socialPosts.id, id), eq(socialPosts.channel, 'telegram'), inArray(socialPosts.status, ['pending', 'approved']))).limit(1)
  if (!row) return { ok: false as const, reason: 'Só postagens pendentes ou agendadas podem ser reescritas.', status: 409 }
  const config = deepseekConfig()
  if (!config) return { ok: false as const, reason: 'A chave da IA não está configurada (DEEPSEEK_API_KEY).', status: 409 }
  const facts = row.facts as StoredFacts
  const result = await rewriteWithAi({ config, facts, link: row.linkUrl, seed: Date.now() % 997, caption: Boolean(row.imageUrl) })
  if (!result.ok) return { ok: false as const, reason: `A IA não gerou um texto aproveitável: ${result.reason} O texto atual foi mantido.`, status: 422 }
  const [updated] = await db.update(socialPosts).set({
    text: result.text, facts: { ...facts, originalText: facts.originalText ?? row.text, ai: { rewritten: true } }, updatedAt: new Date().toISOString(),
  }).where(eq(socialPosts.id, id)).returning()
  return { ok: true as const, row: updated }
}

export async function restoreOriginalText(id: string) {
  const [row] = await db.select().from(socialPosts).where(and(eq(socialPosts.id, id), eq(socialPosts.channel, 'telegram'), inArray(socialPosts.status, ['pending', 'approved']))).limit(1)
  const facts = row?.facts as StoredFacts | undefined
  if (!row || !facts?.originalText) return null
  const { originalText, ...rest } = facts
  const [updated] = await db.update(socialPosts).set({ text: originalText, facts: { ...rest, ai: { rewritten: false } }, updatedAt: new Date().toISOString() }).where(eq(socialPosts.id, id)).returning()
  return updated ?? null
}

export async function approvePost(id: string, userId: string | null, scheduledFor?: string | null) {
  const [row] = await db.update(socialPosts).set({
    status: 'approved', approvedBy: userId, updatedAt: new Date().toISOString(),
    ...(scheduledFor ? { scheduledFor } : {}),
  }).where(and(eq(socialPosts.id, id), eq(socialPosts.channel, 'telegram'), eq(socialPosts.status, 'pending'))).returning()
  return row ?? null
}

export async function cancelPost(id: string) {
  const [row] = await db.update(socialPosts).set({ status: 'cancelled', updatedAt: new Date().toISOString() })
    .where(and(eq(socialPosts.id, id), eq(socialPosts.channel, 'telegram'), inArray(socialPosts.status, ['pending', 'approved', 'failed']))).returning()
  return row ?? null
}

// ---------------------------------------------------------------- envio

/** Estado da oferta agora (preço, desconto, nota, vendas e situação da oferta e do produto). */
async function loadOfferNow(offerId: string): Promise<OfferNow> {
  const result = await db.execute(sql`
    select o.status as offer_status, p.status as product_status, o.price::text as price, o.original_price::text as original_price,
           o.discount_percentage::text as discount, o.rating::text as rating, o.sold_count
    from offers o join products p on p.id = o.product_id where o.id = ${offerId}`)
  const row = result.rows[0] as Record<string, string | number | null> | undefined
  if (!row) return null
  return {
    offerStatus: String(row.offer_status), productStatus: String(row.product_status), price: Number(row.price),
    originalPrice: row.original_price ? Number(row.original_price) : null, discountPercent: row.discount ? Number(row.discount) : null,
    rating: Number(row.rating ?? 0), soldCount: Number(row.sold_count ?? 0),
  }
}

export type DeliverResult = { ok: true; messageId: string } | { ok: false; error: string; retry: boolean }

/** Envia uma postagem aprovada. Marca como enviada ou registra a falha; só tenta de novo erro passageiro. */
export async function deliverPost(row: PostRow, fetchImpl: typeof fetch = fetch): Promise<DeliverResult> {
  if (row.channel !== 'telegram') return { ok: false, error: 'Só postagens do Telegram são enviadas pelo painel; Instagram e TikTok são publicados à mão.', retry: false }
  const config = telegramConfig()
  if (!config) return { ok: false, error: 'O bot do Telegram não está configurado (TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID).', retry: false }
  // Confere a oferta de agora contra o que o texto afirma. Só lê: nada é reservado nem enviado se a leitura falhar.
  let current = row
  if (row.offerId) {
    let now: OfferNow
    try { now = await loadOfferNow(row.offerId) } catch { return { ok: false, error: 'Não foi possível conferir a oferta antes do envio; tentaremos de novo.', retry: true } }
    const check = recheckOffer(row.facts as StoredFacts, now)
    if (check.action === 'cancel') {
      await db.update(socialPosts).set({ status: 'cancelled', error: check.reason.slice(0, 300), updatedAt: new Date().toISOString() }).where(and(eq(socialPosts.id, row.id), eq(socialPosts.status, 'approved')))
      return { ok: false, error: check.reason, retry: false }
    }
    if (check.action === 'refresh') {
      // Texto refeito no modelo fixo com os números de agora; o que a IA tinha escrito não vale mais.
      const { text } = composePost(check.facts, row.linkUrl, row.productId ?? row.id, { caption: Boolean(row.imageUrl) })
      const stored = row.facts as StoredFacts
      const facts: StoredFacts = { ...check.facts, originalText: stored.originalText ?? row.text, ai: { rewritten: false, reason: check.reason } }
      const [updated] = await db.update(socialPosts).set({ text, facts, updatedAt: new Date().toISOString() })
        .where(and(eq(socialPosts.id, row.id), eq(socialPosts.status, 'approved'), eq(socialPosts.attempts, row.attempts))).returning()
      if (!updated) return { ok: false, error: 'Esta postagem já está sendo enviada.', retry: false }
      current = updated
    }
  }
  // Reserva a postagem antes de enviar: dois processos (worker e botão do painel) não mandam a mesma duas vezes.
  const [claimed] = await db.update(socialPosts).set({ attempts: sql`${socialPosts.attempts} + 1`, updatedAt: new Date().toISOString() })
    .where(and(eq(socialPosts.id, row.id), eq(socialPosts.status, 'approved'), eq(socialPosts.attempts, row.attempts))).returning()
  if (!claimed) return { ok: false, error: 'Esta postagem já está sendo enviada.', retry: false }
  try {
    const sent = await sendTelegramPost(config, { text: current.text, imageUrl: current.imageUrl }, fetchImpl)
    await db.update(socialPosts).set({ status: 'sent', sentAt: new Date().toISOString(), externalMessageId: sent.messageId, error: null, updatedAt: new Date().toISOString() }).where(eq(socialPosts.id, row.id))
    return { ok: true, messageId: sent.messageId }
  } catch (error) {
    const message = error instanceof TelegramError ? error.message : 'Falha inesperada ao enviar.'
    const transient = error instanceof TelegramError && (error.status === 0 || error.status === 429 || error.status >= 500)
    const giveUp = !transient || claimed.attempts >= MAX_ATTEMPTS
    await db.update(socialPosts).set({ status: giveUp ? 'failed' : 'approved', error: message.slice(0, 300), updatedAt: new Date().toISOString() }).where(eq(socialPosts.id, row.id))
    return { ok: false, error: message, retry: !giveUp }
  }
}

/** Envia o que venceu. Passou de 3 h do horário: falha com motivo (não posta fora de hora). */
export async function deliverDue(now = Date.now(), fetchImpl: typeof fetch = fetch, scope: { campaign?: string } = {}) {
  const due = await db.select().from(socialPosts)
    .where(and(eq(socialPosts.channel, 'telegram'), eq(socialPosts.status, 'approved'), lt(socialPosts.scheduledFor, new Date(now).toISOString()), scope.campaign ? eq(socialPosts.campaign, scope.campaign) : undefined))
  const summary = { sent: 0, failed: 0, expired: 0 }
  for (const row of due) {
    if (row.scheduledFor && now - new Date(row.scheduledFor).getTime() > MAX_LATE_MS) {
      await db.update(socialPosts).set({ status: 'failed', error: 'Passou mais de 3 horas do horário agendado; não foi enviada.', updatedAt: new Date().toISOString() }).where(eq(socialPosts.id, row.id))
      summary.expired++
      continue
    }
    const result = await deliverPost(row, fetchImpl)
    if (result.ok) summary.sent++
    else if (!result.retry) summary.failed++
  }
  return summary
}

/** Pendentes de aprovação que já passaram do horário (e da tolerância) saem da fila. */
export async function expireOldPending(now = Date.now(), scope: { campaign?: string } = {}) {
  const cutoff = new Date(now - MAX_LATE_MS).toISOString()
  const rows = await db.update(socialPosts).set({ status: 'cancelled', error: 'Venceu sem aprovação.', updatedAt: new Date().toISOString() })
    .where(and(eq(socialPosts.channel, 'telegram'), eq(socialPosts.status, 'pending'), lt(socialPosts.scheduledFor, cutoff), scope.campaign ? eq(socialPosts.campaign, scope.campaign) : undefined)).returning({ id: socialPosts.id })
  return rows.length
}
