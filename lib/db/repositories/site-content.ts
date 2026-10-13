import { asc, desc, eq } from 'drizzle-orm'
import { db } from '../client'
import { cachedQuery } from '../cached'
import { campaigns, contentPages, coupons, featureFlags } from '../schema'

/** Tudo o que a vitrine lê do que é editado no painel. Os dados são guardados em cache (tag `catalog`) e a janela de datas é aplicada na leitura. */

const inWindow = (startsAt: string | null, endsAt: string | null, now = Date.now()) =>
  (!startsAt || new Date(startsAt).getTime() <= now) && (!endsAt || new Date(endsAt).getTime() >= now)

const loadCampaigns = cachedQuery(
  () => db.select().from(campaigns).where(eq(campaigns.status, 'active')).orderBy(asc(campaigns.sortOrder), desc(campaigns.updatedAt)),
  ['site-campaigns-v1'], ['catalog'],
)
export async function getActiveCampaigns() {
  const rows = await loadCampaigns()
  return rows.filter((row) => inWindow(row.startsAt, row.endsAt))
}

const loadCoupons = cachedQuery(
  () => db.select().from(coupons).where(eq(coupons.isActive, true)).orderBy(asc(coupons.endsAt), desc(coupons.createdAt)),
  ['site-coupons-v1'], ['catalog'],
)
export type VisibleCoupon = Awaited<ReturnType<typeof loadCoupons>>[number]
export async function getVisibleCoupons(): Promise<VisibleCoupon[]> {
  const rows = await loadCoupons()
  return rows.filter((row) => inWindow(row.startsAt, row.endsAt))
}

const loadPublished = cachedQuery(
  () => db.select().from(contentPages).where(eq(contentPages.status, 'published')).orderBy(desc(contentPages.publishedAt)),
  ['site-content-v1'], ['catalog'],
)
export type PublishedContent = Awaited<ReturnType<typeof loadPublished>>[number]
export async function getPublishedContent(kind: 'article' | 'page') {
  return (await loadPublished()).filter((row) => row.kind === kind)
}
export async function getPublishedContentBySlug(kind: 'article' | 'page', slug: string) {
  return (await getPublishedContent(kind)).find((row) => row.slug === slug) ?? null
}

const loadFlags = cachedQuery(() => db.select().from(featureFlags), ['site-flags-v1'], ['catalog'])
/** Recurso ligado? Sem linha cadastrada vale o padrão informado (o site funciona igual a antes do painel). */
export async function featureEnabled(key: string, fallback = true) {
  const row = (await loadFlags()).find((flag) => flag.key === key)
  return row ? row.enabled : fallback
}

export type StorefrontNav = { coupons: boolean; articles: boolean; pages: { slug: string; title: string }[] }

/** O que o menu e o rodapé mostram além do fixo: só aparece o que tem conteúdo publicado. */
export async function getStorefrontNav(): Promise<StorefrontNav> {
  const [couponsOn, visibleCoupons, articles, pages] = await Promise.all([featureEnabled('cupons'), getVisibleCoupons(), getPublishedContent('article'), getPublishedContent('page')])
  return {
    coupons: couponsOn && visibleCoupons.length > 0,
    articles: articles.length > 0,
    pages: pages.slice(0, 6).map((page) => ({ slug: page.slug, title: page.title })),
  }
}
