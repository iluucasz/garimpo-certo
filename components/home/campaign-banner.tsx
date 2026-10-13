import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import type { campaigns } from '@/lib/db/schema'
import styles from './home.module.css'

type Campaign = typeof campaigns.$inferSelect

/**
 * Faixa de destaque da home, editada em Experiência → Campanhas. Mostra a primeira ativa dentro do período.
 * O clique é contado (só com medição permitida) pelo AffiliateClickTracker, via `data-campaign`.
 */
export function CampaignBanner({ campaigns: active }: { campaigns: Campaign[] }) {
  const campaign = active[0]
  if (!campaign) return null
  const external = /^https?:\/\//i.test(campaign.ctaUrl)
  const body = <>
    <span className={styles.campaignCopy}>
      <strong>{campaign.headline}</strong>
      {campaign.description && <span>{campaign.description}</span>}
    </span>
    <span className={styles.campaignAction}>{campaign.ctaLabel}{external ? <ArrowUpRight aria-hidden="true"/> : <ArrowRight aria-hidden="true"/>}</span>
  </>
  return <aside className={`container ${styles.campaign}`} aria-label="Destaque">
    {campaign.imageUrl && <img className={styles.campaignImage} src={campaign.imageUrl} alt="" loading="lazy" decoding="async"/>}
    {external
      ? <a className={styles.campaignLink} href={campaign.ctaUrl} data-campaign={campaign.slug} target="_blank" rel="sponsored noopener noreferrer">{body}</a>
      : <Link className={styles.campaignLink} href={campaign.ctaUrl} data-campaign={campaign.slug}>{body}</Link>}
  </aside>
}
