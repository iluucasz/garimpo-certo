import Link from 'next/link'
import { CatalogImportButton } from '@/components/admin/catalog-import-button'
import { listCatalogForAdmin } from '@/lib/db/repositories/admin-overview'
import { formatPrice } from '@/lib/format'

export const metadata = { title: 'Catálogo' }
export const dynamic = 'force-dynamic'

type Item = Awaited<ReturnType<typeof listCatalogForAdmin>>[number]

const dateTime = (iso: string | null) => iso
  ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
  : '—'

function CatalogTable({ items, label }: { items: Item[]; label: string }) {
  return <table className="data-table" style={{ minWidth: 760 }} aria-label={label}>
    <thead><tr><th scope="col">Produto</th><th scope="col">Preço</th><th scope="col">Vendas</th><th scope="col">Nota</th><th scope="col">Índice</th><th scope="col">Sincronizado</th></tr></thead>
    <tbody>{items.map((item) => <tr key={`${item.id}-${item.syncedAt}`}>
      <td><Link href={`/produto/${item.slug}`}><strong>{item.name}</strong></Link><br/><small>{item.brand}</small></td>
      <td>{item.price !== null ? formatPrice(item.price) : '—'}{item.previousPrice && item.price !== null && item.previousPrice > item.price ? <><br/><small><s>{formatPrice(item.previousPrice)}</s></small></> : null}</td>
      <td>{item.soldCount.toLocaleString('pt-BR')}</td>
      <td>{item.rating > 0 ? item.rating.toLocaleString('pt-BR', { minimumFractionDigits: 1 }) : '—'}</td>
      <td>{item.score}</td>
      <td>{dateTime(item.syncedAt)}</td>
    </tr>)}</tbody>
  </table>
}

export default async function AdminCatalogPage() {
  const items = await listCatalogForAdmin()
  const active = items.filter((item) => item.active)
  const archived = items.filter((item) => !item.active)

  return <div>
    <div className="admin-title">
      <div><div className="kicker">Catálogo</div><h1>Catálogo e importação</h1><p>{active.length} produtos ativos e {archived.length} arquivados. Os preços vêm da API de afiliados da Shopee e são atualizados todo dia pelo cron.</p></div>
    </div>

    <div className="panel" style={{ marginBottom: 20 }}>
      <h2>Importar agora</h2>
      <p style={{ color: 'var(--muted-foreground)', marginTop: 0 }}>Busca as ofertas atuais na Shopee, atualiza preços e vendas e arquiva o que saiu da seleção (só se a importação cobrir pelo menos 70% do catálogo atual).</p>
      <CatalogImportButton/>
    </div>

    <div className="panel" style={{ overflow: 'auto' }}>
      <h2>Ativos ({active.length})</h2>
      {active.length > 0 ? <CatalogTable items={active} label="Produtos ativos"/> : <p>O catálogo está vazio. Use “Importar da Shopee agora”.</p>}
    </div>

    {archived.length > 0 && <details className="panel" style={{ marginTop: 20 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 650 }}>Arquivados ({archived.length})</summary>
      <p style={{ color: 'var(--muted-foreground)' }}>Saíram da seleção em alguma importação e não aparecem na vitrine. Os preços aqui são os da última vez que foram sincronizados.</p>
      <div style={{ overflow: 'auto' }}><CatalogTable items={archived} label="Produtos arquivados"/></div>
    </details>}
  </div>
}
