'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { useMock } from '@/components/mock-provider'
import { StoreBrand } from './store-brand'
import styles from './storefront.module.css'

export function SiteFooter() {
  const { consent, setConsent, hydrated } = useMock()
  return <>
    <footer className={styles.footer}>
      <div className={`container ${styles.footerGrid}`}>
        <div className={styles.footerAbout}><StoreBrand/><p>Um lugar para descobrir produtos,<br/>comparar preços e escolher com calma.</p><span>Curadoria. Comparação. Descoberta.</span></div>
        <div><h2>Explore</h2><Link href="/buscar">Todos os achados</Link><Link href="/#colecoes">Nossas coleções</Link><Link href="/guias">Guias de compra</Link></div>
        <div><h2>Seu Garimpo</h2><Link href="/favoritos">Favoritos</Link><Link href="/comparar">Comparador</Link><Link href="/historico">Vistos recentemente</Link><Link href="/conta">Minha conta</Link></div>
        <div><h2>Sobre</h2><Link href="/como-funciona">Como funciona</Link><Link href="/como-funciona#afiliados">Links de afiliados</Link><Link href="/privacidade">Privacidade e cookies</Link><Link href="/admin">Painel administrativo <ArrowUpRight aria-hidden="true"/></Link></div>
      </div>
      <div className={`container ${styles.footerBottom}`}><span>© 2026 Garimpo certo</span><span>Ambiente demonstrativo · preços, estoque e avaliações simulados.</span><Link href="/privacidade">Privacidade</Link></div>
    </footer>
    {hydrated && consent === null && <aside className="cookie-banner" aria-label="Preferências de cookies"><div><strong>Suas preferências de privacidade</strong><p>Usamos armazenamento local para favoritos, histórico e preferências deste protótipo.</p></div><div><button className="btn secondary" onClick={() => setConsent(false)}>Somente essenciais</button><button className="btn primary" onClick={() => setConsent(true)}>Aceitar todos</button></div></aside>}
  </>
}
