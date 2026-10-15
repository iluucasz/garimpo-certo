import { and, desc, eq, gte, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { globalSettings, socialPosts } from '@/lib/db/schema'
import { settingDefinitions } from '@/lib/admin/settings-defs'
import { generateShortLink } from '@/lib/providers/shopee/client'
import { toSubId } from '@/lib/providers/shopee/links'
import type { PostFacts } from './compose'
import { composeContent, contentChannels, parseBrandTags, type ContentChannel } from './content'
import { adaptiveCooldown, defaultPickOptions, eligible, rankCandidates, type PostCandidate } from './picker'
import { brasiliaDay, slotsForDay } from './schedule'
import { loadCandidates } from './store'

/**
 * Fila diária de conteúdo para Instagram e TikTok. Não publica nada sozinha: gera legenda, roteiro, hashtags e o
 * link de afiliado com etiqueta do canal, e a equipe publica à mão e marca como publicado. Por isso o horário
 * (`scheduledFor`) é só uma sugestão: nenhum envio automático lê estas linhas (o envio do Telegram só olha `telegram`).
 * Sem imports do Next: o worker da VPS usa este arquivo.
 */

export type ContentStatus = 'pending' | 'sent' | 'cancelled'
export type ContentRow = typeof socialPosts.$inferSelect

export type ContentSettings = {
  instagramDaily: number
  tiktokDaily: number
  startHour: number
  endHour: number
  campaign: string
  hashtags: string[]
  disclosure: boolean
  autoPlan: boolean
}

export async function loadContentSettings(): Promise<ContentSettings> {
  const defaults = settingDefinitions.content.defaults as Record<string, unknown>
  const [row] = await db.select({ value: globalSettings.value }).from(globalSettings).where(eq(globalSettings.key, 'content')).limit(1)
  const stored = row?.value && typeof row.value === 'object' ? row.value as Record<string, unknown> : {}
  const merged = { ...defaults, ...stored }
  const number = (key: string, min: number, max: number, fallback: number) => {
    const value = Number(merged[key])
    return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback
  }
  return {
    instagramDaily: number('instagramDaily', 0, 5, 1),
    tiktokDaily: number('tiktokDaily', 0, 5, 1),
    startHour: number('startHour', 6, 20, 10),
    endHour: number('endHour', 10, 23, 20),
    campaign: toSubId(String(merged.campaign ?? 'redes')) || 'redes',
    hashtags: parseBrandTags(String(merged.hashtags ?? '')),
    disclosure: merged.disclosure !== false,
    autoPlan: merged.autoPlan !== false,
  }
}

export const dailyFor = (settings: ContentSettings, channel: ContentChannel) => channel === 'instagram' ? settings.instagramDaily : settings.tiktokDaily

/** Guardado em `facts` ao lado dos números da oferta. */
export type ContentFacts = PostFacts & { script?: string; hashtags?: string[]; category?: string; publishedUrl?: string; publishedAt?: string }

const factsOf = (candidate: PostCandidate): PostFacts => ({
  name: candidate.name, price: candidate.price, originalPrice: candidate.originalPrice, discountPercent: candidate.discountPercent,
  rating: candidate.rating, soldCount: candidate.soldCount,
})

export async function createContentPost(input: {
  candidate: PostCandidate; channel: ContentChannel; settings: ContentSettings; source: 'manual' | 'engine'; scheduledFor: number | null; userId: string | null
}) {
  const { candidate, channel, settings } = input
  const campaign = settings.campaign
  const link = await generateShortLink(candidate.externalUrl, [channel, campaign])
  const facts = factsOf(candidate)
  const content = composeContent(channel, facts, {
    category: candidate.category, seed: candidate.productId, brandTags: settings.hashtags, disclosure: settings.disclosure,
  })
  const stored: ContentFacts = { ...facts, category: candidate.category, hashtags: content.hashtags, ...(content.script ? { script: content.script } : {}) }
  const [row] = await db.insert(socialPosts).values({
    channel, status: 'pending', productId: candidate.productId, offerId: candidate.offerId, campaign,
    text: content.text, imageUrl: candidate.imageUrl, linkUrl: link, facts: stored, source: input.source,
    scheduledFor: input.scheduledFor ? new Date(input.scheduledFor).toISOString() : null,
    createdBy: input.userId,
  }).returning()
  return row
}

export type ContentPlan = { created: { channel: ContentChannel; count: number }[]; notes: string[] }

/** Produtos que já têm conteúdo de hoje em algum canal (o mesmo achado não repete no mesmo dia). */
async function usedToday(day: string) {
  const rows = await db.select({ productId: socialPosts.productId, scheduledFor: socialPosts.scheduledFor, channel: socialPosts.channel, status: socialPosts.status })
    .from(socialPosts).where(and(inArray(socialPosts.channel, contentChannels), inArray(socialPosts.status, ['pending', 'sent'])))
  return rows.filter((row) => row.scheduledFor && brasiliaDay(new Date(row.scheduledFor).getTime()) === day)
}

/** Completa a cota de hoje de cada canal com as melhores ofertas ainda não divulgadas nele. */
export async function planContentToday(settings: ContentSettings, now = Date.now(), userId: string | null = null): Promise<ContentPlan> {
  const day = brasiliaDay(now)
  const today = await usedToday(day)
  const taken = new Set(today.flatMap((row) => row.productId ? [row.productId] : []))
  const plan: ContentPlan = { created: [], notes: [] }

  for (const channel of contentChannels) {
    const daily = dailyFor(settings, channel)
    if (daily <= 0) continue
    const have = today.filter((row) => row.channel === channel).length
    const missing = daily - have
    if (missing <= 0) continue

    const candidates = (await loadCandidates(channel)).filter((candidate) => !taken.has(candidate.productId))
    const base = { ...defaultPickOptions, now, limit: missing }
    const pool = candidates.filter((candidate) => eligible(candidate, { ...base, cooldownDays: 0 }))
    const ranked = rankCandidates(candidates, { ...base, cooldownDays: adaptiveCooldown(pool.length, daily, base.cooldownDays) })
    if (ranked.length === 0) { plan.notes.push(`${channel}: nenhuma oferta atende aos critérios (nota, vendas, imagem e intervalo).`); continue }

    // Horários sugeridos espalhados no dia; os que já existem ficam com o seu.
    const slots = slotsForDay(day, daily, settings.startHour, settings.endHour)
    let created = 0
    for (const [index, item] of ranked.entries()) {
      try {
        await createContentPost({ candidate: item.candidate, channel, settings, source: 'engine', scheduledFor: slots[have + index] ?? slots[slots.length - 1] ?? null, userId })
        taken.add(item.candidate.productId)
        created++
      } catch (error) {
        console.error('[content] não foi possível criar', channel, item.candidate.slug, error instanceof Error ? error.message : error)
      }
    }
    if (created > 0) plan.created.push({ channel, count: created })
  }
  return plan
}

// ---------------------------------------------------------------- consulta e edição

/** Conteúdo recente (hoje e os últimos dias), para a tela. */
export async function listContent(days = 14) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  return db.select().from(socialPosts)
    .where(and(inArray(socialPosts.channel, contentChannels), gte(socialPosts.createdAt, since)))
    .orderBy(desc(socialPosts.scheduledFor), desc(socialPosts.createdAt)).limit(200)
}

export async function getContent(id: string) {
  const [row] = await db.select().from(socialPosts).where(and(eq(socialPosts.id, id), inArray(socialPosts.channel, contentChannels))).limit(1)
  return row ?? null
}

/** Edita legenda e/ou roteiro de um conteúdo ainda não publicado. */
export async function updateContent(id: string, patch: { text?: string; script?: string }) {
  const row = await getContent(id)
  if (!row || row.status !== 'pending') return null
  const facts = { ...(row.facts as ContentFacts) }
  if (patch.script !== undefined) facts.script = patch.script
  const [updated] = await db.update(socialPosts).set({
    ...(patch.text !== undefined ? { text: patch.text } : {}), facts, updatedAt: new Date().toISOString(),
  }).where(and(eq(socialPosts.id, id), eq(socialPosts.status, 'pending'))).returning()
  return updated ?? null
}

/** Marca como publicado (a publicação é feita à mão na rede). Guarda o endereço da publicação, se informado. */
export async function markPublished(id: string, userId: string | null, url?: string | null) {
  const row = await getContent(id)
  if (!row || row.status !== 'pending') return null
  const now = new Date().toISOString()
  const facts: ContentFacts = { ...(row.facts as ContentFacts), publishedAt: now, ...(url ? { publishedUrl: url } : {}) }
  const [updated] = await db.update(socialPosts).set({ status: 'sent', sentAt: now, approvedBy: userId, facts, error: null, updatedAt: now })
    .where(and(eq(socialPosts.id, id), eq(socialPosts.status, 'pending'))).returning()
  return updated ?? null
}

export async function cancelContent(id: string) {
  const [row] = await db.update(socialPosts).set({ status: 'cancelled', updatedAt: new Date().toISOString() })
    .where(and(eq(socialPosts.id, id), eq(socialPosts.status, 'pending'), inArray(socialPosts.channel, contentChannels))).returning()
  return row ?? null
}

/** Troca o produto: cancela este e cria outro para o mesmo canal e horário, com a próxima melhor oferta. */
export async function replaceContent(id: string, settings: ContentSettings, userId: string | null, now = Date.now()) {
  const row = await getContent(id)
  if (!row || row.status !== 'pending') return { ok: false as const, reason: 'Só conteúdo ainda não publicado pode ser trocado.' }
  const channel = row.channel as ContentChannel
  const day = brasiliaDay(now)
  const today = await usedToday(day)
  const taken = new Set(today.flatMap((item) => item.productId ? [item.productId] : []))
  if (row.productId) taken.add(row.productId)
  const candidates = (await loadCandidates(channel)).filter((candidate) => !taken.has(candidate.productId))
  const base = { ...defaultPickOptions, now, limit: 1 }
  const pool = candidates.filter((candidate) => eligible(candidate, { ...base, cooldownDays: 0 }))
  const ranked = rankCandidates(candidates, { ...base, cooldownDays: adaptiveCooldown(pool.length, Math.max(1, dailyFor(settings, channel)), base.cooldownDays) })
  if (ranked.length === 0) return { ok: false as const, reason: 'Não há outra oferta que atenda aos critérios agora.' }
  const created = await createContentPost({
    candidate: ranked[0].candidate, channel, settings, source: 'manual',
    scheduledFor: row.scheduledFor ? new Date(row.scheduledFor).getTime() : null, userId,
  })
  await cancelContent(id)
  return { ok: true as const, row: created }
}

/** Quantos de hoje já foram publicados, por canal (para o painel e a central da Engine). */
export async function contentToday(settings: ContentSettings, now = Date.now()) {
  const day = brasiliaDay(now)
  const rows = await usedToday(day)
  return contentChannels.map((channel) => {
    const mine = rows.filter((row) => row.channel === channel)
    return { channel, planned: dailyFor(settings, channel), created: mine.length, published: mine.filter((row) => row.status === 'sent').length }
  })
}

