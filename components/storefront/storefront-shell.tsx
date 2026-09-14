import { SiteHeader } from './site-header'
import { SiteFooter } from './site-footer'
export function StorefrontShell({children}:{children:React.ReactNode}){return <div className="storefront"><SiteHeader/><main>{children}</main><SiteFooter/></div>}
