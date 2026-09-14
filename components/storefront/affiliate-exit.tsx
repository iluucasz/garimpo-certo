'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import { platformServices } from '@/lib/platform'

export function AffiliateExit({ product, store, offer }: { product: string; store: string; offer?: string }) {
  const [opened, setOpened] = useState(false)
  function simulate() {
    const clickId = `clk_${crypto.randomUUID().slice(0, 10)}`
    platformServices.tracker.track({ name: 'affiliate_click', resource: 'offer', resourceId: offer ?? product, actor: 'visitor', metadata: { product, store, clickId } })
    sessionStorage.setItem('garimpo:last-affiliate-click', JSON.stringify({ clickId, product, store, offer, at: new Date().toISOString() }))
    setOpened(true)
  }
  return <div className="auth-card"><div className="kicker">REDIRECT AFILIADO MOCK</div><h1>{opened ? 'Clique afiliado registrado.' : 'Você sairia do Garimpo agora.'}</h1><p>{opened ? <>Atribuição, consentimento e evento foram simulados localmente para <strong>{store}</strong>.</> : <>Em produção, abriríamos a oferta de <strong>{product}</strong> em <strong>{store}</strong>. Nenhum redirecionamento real será feito.</>}</p><div className="form-stack">{opened ? <button className="btn primary" disabled><CheckCircle2/> Abertura simulada</button> : <button className="btn primary" onClick={simulate}>Simular abertura <ExternalLink/></button>}<Link className="btn secondary" href={`/produto/${product}`}>Voltar ao produto</Link></div></div>
}
