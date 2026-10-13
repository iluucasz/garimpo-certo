'use client'

import Link from 'next/link'
import { useMock } from '@/components/mock-provider'
import { useStoreData } from '@/components/store-data-provider'
import { StoreBrand } from './store-brand'
import { editorialEnabled } from '@/lib/site'
import styles from './storefront.module.css'

export function SiteFooter() {
  const { consent, setConsent, hydrated } = useMock()
  const { syncedAt } = useStoreData()
  const syncedLabel = syncedAt ? new Date(syncedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }) : null
  return <>
    <footer className={styles.footer}>
      <div className={`container ${styles.footerGrid}`}>
        <div className={styles.footerAbout}><StoreBrand/><p>Um lugar para descobrir produtos,<br/>comparar preços e escolher com calma.</p><span>Curadoria. Comparação. Descoberta.</span></div>
        <div><h2>Explore</h2><Link href="/buscar">Todos os achados</Link>{editorialEnabled && <><Link href="/guias">Guias de compra</Link></>}</div>
        <div><h2>Seu Garimpo</h2><Link href="/favoritos">Favoritos</Link><Link href="/comparar">Comparador</Link><Link href="/historico">Vistos recentemente</Link><Link href="/conta">Minha conta</Link></div>
        <div><h2>Sobre</h2><Link href="/como-funciona">Como funciona</Link><Link href="/como-funciona#afiliados">Links de afiliados</Link><Link href="/privacidade">Privacidade e cookies</Link></div>
      </div>
      <div className={`container ${styles.footerBottom}`}><span>© 2026 Garimpo certo</span><span>{syncedLabel ? `Preços e vendas da Shopee atualizados em ${syncedLabel}` : 'Preços e vendas conforme a última sincronização com a Shopee'} · usamos links de afiliado.</span><Link href="/privacidade">Privacidade</Link></div>
    </footer>
    {hydrated && consent === null && <aside className="cookie-banner" aria-label="Preferências de cookies"><div><strong>Suas preferências de privacidade</strong><p>Guardamos favoritos, histórico e preferências neste aparelho. Você escolhe o que permitir.</p></div><div><button className="btn secondary" onClick={() => setConsent(false)}>Somente essenciais</button><button className="btn primary" onClick={() => setConsent(true)}>Aceitar todos</button></div></aside>}
  </>
}
