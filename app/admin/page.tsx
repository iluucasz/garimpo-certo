import Link from 'next/link'
import { ArrowRight, ArrowUpRight, RefreshCw } from 'lucide-react'
import { getAdminOverview } from '@/lib/db/repositories/admin-overview'
import { getOpsHealth } from '@/lib/ops/health'
import { formatPrice } from '@/lib/format'
import styles from '@/components/admin/admin.module.css'

export const dynamic = 'force-dynamic'

const number = new Intl.NumberFormat('pt-BR')
const weekday = (isoDay: string) => new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${isoDay}T12:00:00Z`)).replace('.', '')
const dateTime = (iso: string | null) => iso
  ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
  : 'nunca'

export default async function AdminDashboard() {
  const [overview, health] = await Promise.all([getAdminOverview(), getOpsHealth()])
  const attention = health.checks.filter((check) => check.severity !== 'ok')
  const { catalog, clicks, conversions, audience, topProducts } = overview
  // Mínimo de 4 para o eixo ter degraus inteiros e distintos mesmo com poucos cliques.
  const peak = Math.max(4, ...clicks.byDay.map((entry) => entry.count))
  const peakDay = clicks.byDay.reduce((best, entry) => (entry.count > best.count ? entry : best), clicks.byDay[0])
  const ageDays = catalog.syncedAt ? Math.floor((Date.now() - new Date(catalog.syncedAt).getTime()) / 86_400_000) : null
  const stale = ageDays === null || ageDays >= 2

  return <div className={styles.dashboard}>
    <div className="admin-title">
      <div><div className={styles.pageEyebrow}>Painel da operação</div><h1>Visão geral</h1></div>
      <Link href="/admin/imports-jobs" className="btn primary"><RefreshCw aria-hidden="true"/>Importar catálogo</Link>
    </div>

    <section className={`${styles.health} ${health.status === 'critical' ? styles.healthCritical : health.status === 'warning' ? styles.healthWarning : styles.healthOk}`} aria-labelledby="health-title">
      <h2 id="health-title">{attention.length === 0 ? 'Tudo em ordem' : attention.length === 1 ? '1 ponto precisa de atenção' : `${attention.length} pontos precisam de atenção`}</h2>
      <ul>{(attention.length ? attention : health.checks).map((check) => <li key={check.id} className={check.severity === 'critical' ? styles.healthItemCritical : check.severity === 'warning' ? styles.healthItemWarning : undefined}>
        <strong><Link href={check.href}>{check.label}</Link></strong>
        <span>{check.message}</span>
      </li>)}</ul>
    </section>

    <section className={styles.metrics} aria-label="Indicadores da operação">
      <Stat label="Produtos ativos" value={number.format(catalog.active)} note={`${number.format(catalog.archived)} arquivados · ${number.format(catalog.offers)} ofertas`}/>
      <Stat label="Cliques de compra (7 dias)" value={number.format(clicks.last7d)} note={`${number.format(clicks.total)} desde o início`}/>
      <Stat label="Conversões" value={number.format(conversions.total)} note={`Comissão aprovada ${formatPrice(conversions.commissionApproved)}`}/>
      <Stat label="Contas e favoritos" value={`${number.format(audience.users)} · ${number.format(audience.favorites)}`} note="contas · itens favoritados"/>
    </section>

    <div className={styles.dashboardGrid}>
      <section className={styles.card} aria-labelledby="performance-title">
        <div className={styles.cardHeader}><div><h2 id="performance-title">Cliques de compra</h2><p>7 dias</p></div><span className={styles.chartLegend}><i/>Cliques</span></div>
        <div className={styles.chartSummary}><strong>{number.format(clicks.last7d)}</strong><span>cliques no período</span></div>
        <div className={styles.activityChart} role="img" aria-label={`Cliques por dia: ${clicks.byDay.map((entry) => `${weekday(entry.day)}, ${entry.count}`).join('; ')}.`}>
          <div className={styles.chartAxis} aria-hidden="true">{[1, 0.75, 0.5, 0.25, 0].map((fraction) => <span key={fraction}>{number.format(Math.round(peak * fraction))}</span>)}</div>
          <div className={styles.plot} aria-hidden="true">
            <div className={styles.gridLines}>{[0, 1, 2, 3, 4].map((line) => <i key={line}/>)}</div>
            <div className={styles.bars}>{clicks.byDay.map((entry, index) => <div className={styles.barColumn} key={entry.day}><div className={`${styles.bar} ${index === clicks.byDay.length - 1 ? styles.latestBar : ''}`} style={{ height: `${(entry.count / peak) * 100}%`, minHeight: entry.count ? 4 : 0 }}><span>{entry.count}</span></div><small>{weekday(entry.day)}</small></div>)}</div>
          </div>
        </div>
        <div className={styles.cardFooter}>
          <span>{clicks.last7d > 0 ? `Pico: ${weekday(peakDay.day)}, ${peakDay.count}` : 'Nenhum clique registrado nos últimos 7 dias. Só contam visitantes que permitiram a medição de uso.'}</span>
          <Link href="/admin/analytics">Ver analytics <ArrowUpRight aria-hidden="true"/></Link>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="operations-title">
        <div className={styles.cardHeader}><div><h2 id="operations-title">Catálogo</h2></div><span className={`${styles.alertCount} ${stale ? '' : styles.quiet}`}>{stale ? 'Desatualizado' : 'Em dia'}</span></div>
        <dl className={styles.facts}>
          <div><dt>Última sincronização</dt><dd>{dateTime(catalog.syncedAt)}{ageDays !== null && ageDays > 0 ? ` · há ${ageDays} ${ageDays === 1 ? 'dia' : 'dias'}` : ''}</dd></div>
          <div><dt>Produtos ativos</dt><dd>{number.format(catalog.active)}</dd></div>
          <div><dt>Ofertas ativas</dt><dd>{number.format(catalog.offers)}</dd></div>
          <div><dt>Importação automática</dt><dd>Diária, às 06:00 (Brasília), pelo worker da VPS</dd></div>
        </dl>
        <div className={styles.cardFooter}><Link href="/admin/imports-jobs">Importar agora <ArrowRight aria-hidden="true"/></Link></div>
      </section>

      <section className={`${styles.card} ${styles.productsCard}`} aria-labelledby="products-title">
        <div className={styles.cardHeader}><div><h2 id="products-title">Mais vendidos</h2></div><Link className={styles.subtleLink} href="/admin/produtos">Ver catálogo <ArrowUpRight aria-hidden="true"/></Link></div>
        <div className={styles.productTableScroll}><table className={styles.productTable}><thead><tr><th scope="col">Produto</th><th scope="col">Vendas</th><th scope="col">Preço</th><th scope="col">Nota</th></tr></thead><tbody>{topProducts.map((product) => <tr key={product.id}>
          <td><Link href={`/produto/${product.slug}`} className={styles.productIdentity}><span><strong>{product.name}</strong><small>{product.brand}</small></span></Link></td>
          <td>{number.format(product.soldCount)}</td>
          <td>{formatPrice(product.price)}</td>
          <td>{product.rating > 0 ? product.rating.toLocaleString('pt-BR', { minimumFractionDigits: 1 }) : '—'}</td>
        </tr>)}</tbody></table></div>
        {topProducts.length === 0 && <p className={styles.emptyCatalog}>O catálogo está vazio. <Link href="/admin/imports-jobs">Importar da Shopee <ArrowRight aria-hidden="true"/></Link></p>}
      </section>
    </div>
  </div>
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className={styles.metric}><span>{label}</span><strong>{value}</strong><div><small>{note}</small></div></div>
}
