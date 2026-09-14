import Link from 'next/link'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
export default function NotFound(){return <StorefrontShell><section className="not-found"><div><strong>404</strong><h1>Essa descoberta saiu do mapa.</h1><p>A página pode ter mudado ou nunca ter existido.</p><Link className="btn primary" href="/">Voltar ao início</Link></div></section></StorefrontShell>}
