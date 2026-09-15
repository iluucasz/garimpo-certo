import { SiteHeader } from './site-header'
import { SiteFooter } from './site-footer'
import styles from './storefront.module.css'
export function StorefrontShell({children}:{children:React.ReactNode}){return <div className={`storefront ${styles.store}`}><a className={styles.skipLink} href="#store-content">Ir para o conteúdo</a><SiteHeader/><main id="store-content">{children}</main><SiteFooter/></div>}
