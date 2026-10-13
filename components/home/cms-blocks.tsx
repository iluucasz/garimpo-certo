import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Markdown } from '@/components/content/markdown'
import type { Section } from '@/lib/site-builder/document'
import styles from './cms-blocks.module.css'

const shopeeHost = /(^|\.)shopee\.com\.br$/i

/** Link interno (`/colecoes`, `#ofertas`) ou externo (https). Externo abre em nova aba; Shopee leva `sponsored`. */
function SmartLink({ href, className, children, ariaLabel }: { href: string; className?: string; children: React.ReactNode; ariaLabel?: string }) {
  if (href.startsWith('/') || href.startsWith('#')) return <Link href={href} className={className} aria-label={ariaLabel}>{children}</Link>
  let sponsored = false
  try { sponsored = shopeeHost.test(new URL(href).hostname) } catch { /* mantém falso */ }
  return <a href={href} className={className} aria-label={ariaLabel} target="_blank" rel={`${sponsored ? 'sponsored ' : ''}noopener noreferrer`}>{children}</a>
}

const isExternal = (href: string) => /^https?:\/\//i.test(href)
const toneClass = (tone?: string) => tone === 'dark' ? styles.dark : tone === 'soft' ? styles.soft : ''

/** Blocos livres do editor. Só mostram o que a equipe escreveu; nada aqui lê o catálogo. */
export function CmsBlock({ section }: { section: Section }) {
  const { settings: s } = section
  const align = s.align === 'center' ? styles.center : ''

  switch (section.type) {
    case 'banner':
      return <section className={`container ${styles.banner} ${toneClass(s.tone)} ${align}`} aria-label={s.title || section.name}>
        <div className={styles.copy}>
          {s.eyebrow && <span className={styles.eyebrow}>{s.eyebrow}</span>}
          {s.title && <h2>{s.title}</h2>}
          {s.text && <p>{s.text}</p>}
          {s.buttonLabel && s.buttonHref && <SmartLink href={s.buttonHref} className={styles.button}>{s.buttonLabel}{isExternal(s.buttonHref) ? <ArrowUpRight aria-hidden="true"/> : <ArrowRight aria-hidden="true"/>}</SmartLink>}
        </div>
        {s.image && <img className={styles.bannerImage} src={s.image} alt={s.alt ?? ''} loading="lazy" decoding="async"/>}
      </section>

    case 'text':
      return <section className={`container ${styles.text} ${align}`} aria-label={s.title || section.name}>
        {s.title && <h2>{s.title}</h2>}
        {s.text && <div className={styles.prose}><Markdown source={s.text}/></div>}
      </section>

    case 'cards':
      return <section className={`container ${styles.cards}`} aria-label={s.title || section.name}>
        {(s.title || s.text) && <header>{s.title && <h2>{s.title}</h2>}{s.text && <p>{s.text}</p>}</header>}
        <ul>{(s.items ?? []).map((item) => {
          const body = <>
            {item.image && <img src={item.image} alt="" loading="lazy" decoding="async"/>}
            <span className={styles.cardCopy}>{item.title && <strong>{item.title}</strong>}{item.text && <span>{item.text}</span>}</span>
          </>
          return <li key={item.id}>{item.href ? <SmartLink href={item.href} className={styles.card}>{body}</SmartLink> : <div className={styles.card}>{body}</div>}</li>
        })}</ul>
      </section>

    case 'image':
      if (!s.image) return null
      return <figure className={`container ${styles.image}`}>
        {s.buttonHref
          ? <SmartLink href={s.buttonHref}><img src={s.image} alt={s.alt ?? ''} loading="lazy" decoding="async"/></SmartLink>
          : <img src={s.image} alt={s.alt ?? ''} loading="lazy" decoding="async"/>}
      </figure>

    case 'cta':
      return <aside className={`container ${styles.cta} ${toneClass(s.tone)}`} aria-label={s.title || section.name}>
        <div>{s.title && <strong>{s.title}</strong>}{s.text && <span>{s.text}</span>}</div>
        {s.buttonLabel && s.buttonHref && <SmartLink href={s.buttonHref} className={styles.button}>{s.buttonLabel}{isExternal(s.buttonHref) ? <ArrowUpRight aria-hidden="true"/> : <ArrowRight aria-hidden="true"/>}</SmartLink>}
      </aside>

    case 'spacer':
      return <div aria-hidden="true" style={{ height: s.height ?? 48 }}/>

    default:
      return null
  }
}
