'use client'

import { useState } from 'react'
import type { Product } from '@/lib/types'
import { ProductGrid } from './product-card'

/**
 * Mostra os primeiros `pageSize` produtos e libera o resto sob demanda. Mantém a página leve sem
 * esconder produtos atrás de um teto fixo.
 */
export function PagedProductGrid({ items, pageSize = 24, eagerCount = 0 }: { items: Product[]; pageSize?: number; eagerCount?: number }) {
  const [visible, setVisible] = useState(pageSize)
  const remaining = items.length - visible
  return <>
    <ProductGrid items={items.slice(0, visible)} eagerCount={eagerCount}/>
    {remaining > 0 && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
      <button type="button" onClick={() => setVisible((current) => current + pageSize)} style={{ minHeight: 48, padding: '0 24px', border: '1px solid var(--foreground)', borderRadius: 10, background: 'transparent', font: 'inherit', fontWeight: 650, cursor: 'pointer' }}>
        Mostrar mais {Math.min(pageSize, remaining)} ({remaining} restantes)
      </button>
    </div>}
    <p className="sr-only" role="status">{items.length > pageSize ? `Mostrando ${Math.min(visible, items.length)} de ${items.length} produtos.` : ''}</p>
  </>
}
