'use client'

import Link from 'next/link'
import { useVisitorState } from '@/components/visitor-state-provider'
import { useStoreData } from '@/components/store-data-provider'
import { StoreBrand } from './store-brand'
import styles from './storefront.module.css'

type Extras = { coupons: boolean; articles: boolean; pages?: { slug: string; title: string }[] }
type FooterContent = { tagline: string; signature: string; links: { id: string; label: string; href: string }[] }

/** Texto de várias linhas do painel: cada quebra vira <br/>. */
const lines = (text: string) => text.split('\n').flatMap((line, index) => index === 0 ? [line] : [<br key={index}/>, line])

export function SiteFooter({ extras, content }: { extras?: Extras; content?: FooterContent }) {
  const { consent, setConsent, hydrated } = useVisitorState()
  const { syncedAt } = useStoreData()
  const syncedLabel = syncedAt ? new Date(syncedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }) : null
  return <>
    <footer className={styles.footer} data-cms-global="footer">
      <div className={`container ${styles.footerGrid}`}>
        <div className={styles.footerAbout}><StoreBrand/>{content?.tagline && <p>{lines(content.tagline)}</p>}{content?.signature && <span>{content.signature}</span>}</div>
        <div><h2>Explore</h2><Link href="/buscar">Todos os achados</Link><Link href="/colecoes">Coleções</Link>{extras?.coupons && <Link href="/cupons">Cupons</Link>}<Link href="/guias">Guias de compra</Link>{extras?.articles && <Link href="/artigos">Artigos</Link>}</div>
        <div><h2>Seu Garimpo</h2><Link href="/favoritos">Favoritos</Link><Link href="/comparar">Comparador</Link><Link href="/historico">Vistos recentemente</Link><Link href="/conta">Minha conta</Link></div>
        <div><h2>Sobre</h2><Link href="/como-funciona">Como funciona</Link><Link href="/como-funciona#afiliados">Links de afiliados</Link><Link href="/privacidade">Privacidade e cookies</Link>{extras?.pages?.map((page) => <Link href={`/p/${page.slug}`} key={page.slug}>{page.title}</Link>)}{content?.links.map((link) => /^https?:\/\//i.test(link.href)
          ? <a href={link.href} key={link.id} target="_blank" rel="noopener noreferrer">{link.label}</a>
          : <Link href={link.href} key={link.id}>{link.label}</Link>)}</div>
      </div>
      <div className={`container ${styles.footerBottom}`}><span>© 2026 Garimpo certo</span><span>{syncedLabel ? `Preços e vendas da Shopee atualizados em ${syncedLabel}` : 'Preços e vendas conforme a última sincronização com a Shopee'} · usamos links de afiliado.</span><Link href="/privacidade">Privacidade</Link></div>
    </footer>
    {hydrated && consent === null && <aside className="cookie-banner" aria-label="Preferências de cookies"><div><strong>Suas preferências de privacidade</strong><p>Guardamos favoritos, histórico e preferências neste aparelho. Você escolhe o que permitir.</p></div><div><button className="btn secondary" onClick={() => setConsent(false)}>Somente essenciais</button><button className="btn primary" onClick={() => setConsent(true)}>Aceitar todos</button></div></aside>}
  </>
}
