'use client'

import type { CSSProperties } from 'react'
import { useStorefrontConfig } from './storefront-config'
import { SiteHeader } from './site-header'
import { SiteFooter } from './site-footer'
import styles from './storefront.module.css'

/** Casca da vitrine. Tema, aviso do topo e itens do menu vêm do painel, pelo contexto do layout raiz. */
export function StorefrontShell({ children }: { children: React.ReactNode }) {
  const { themeStyle, notice, nav, googleEnabled } = useStorefrontConfig()
  const style = Object.keys(themeStyle).length ? themeStyle as CSSProperties : undefined
  return <div className={`storefront ${styles.store}`} style={style}>
    <a className={styles.skipLink} href="#store-content">Ir para o conteúdo</a>
    <SiteHeader googleEnabled={googleEnabled} notice={notice} extras={nav}/>
    <main id="store-content">{children}</main>
    <SiteFooter extras={nav}/>
  </div>
}
