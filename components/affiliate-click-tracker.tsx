'use client'

import { useEffect } from 'react'
import { analyticsAllowed, readStoredPreferences } from '@/lib/platform/consent'

const SESSION_KEY = 'garimpo:session'

/** Identificador da aba, só para agrupar cliques de uma mesma visita. Some quando a aba fecha e não identifica ninguém. */
function sessionId() {
  try {
    const current = window.sessionStorage.getItem(SESSION_KEY)
    if (current) return current
    const created = crypto.randomUUID()
    window.sessionStorage.setItem(SESSION_KEY, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

/**
 * Conta cliques nos botões de compra (`a[data-offer-id]`), em cupons (`a[data-coupon-id]`) e em campanhas (`a[data-campaign]`). Os links continuam apontando direto para a loja,
 * então nada atrasa nem quebra a compra; o registro é um aviso paralelo e só acontece com a medição permitida.
 */
export function AffiliateClickTracker() {
  useEffect(() => {
    function record(event: MouseEvent) {
      if (event.button > 1) return
      const target = event.target as Element | null
      const link = target?.closest?.('a[data-offer-id], a[data-coupon-id], a[data-campaign]') as HTMLAnchorElement | null
      if (!link) return
      if (!analyticsAllowed(readStoredPreferences())) return
      const offerId = link.dataset.offerId
      // Cupons e campanhas têm destino próprio; o aviso é paralelo e nunca atrasa a navegação.
      const engagement = link.dataset.couponId
        ? { kind: 'coupon', id: link.dataset.couponId }
        : link.dataset.campaign ? { kind: 'campaign', id: link.dataset.campaign } : null
      if (!offerId && !engagement) return
      try {
        void fetch(offerId ? '/api/v1/outbound-clicks' : '/api/v1/engagement', {
          method: 'POST',
          keepalive: true,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(offerId ? { offerId, slot: link.dataset.slot ?? 'unknown', sessionId: sessionId() } : { ...engagement, sessionId: sessionId() }),
        }).catch(() => {})
      } catch { /* a compra nunca depende do registro */ }
    }
    document.addEventListener('click', record, true)
    document.addEventListener('auxclick', record, true)
    return () => {
      document.removeEventListener('click', record, true)
      document.removeEventListener('auxclick', record, true)
    }
  }, [])
  return null
}
