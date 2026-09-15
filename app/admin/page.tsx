import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, ArrowUpRight, CalendarDays, Check, CircleAlert, Clock3, PencilLine } from 'lucide-react'
import { auditEvents, jobs } from '@/lib/mock-data'
import { getStoreCatalog } from '@/lib/db/repositories/store-catalog'
import styles from '@/components/admin/admin.module.css'

const activity = [48, 62, 56, 77, 68, 96, 84]
const days = ['Sex', 'Sáb', 'Dom', 'Seg', 'Ter', 'Qua', 'Qui']

export default async function AdminDashboard() {
  const { products } = await getStoreCatalog()
  const featured = [...products].sort((a, b) => b.score - a.score).slice(0, 5)
  const alerts = jobs.filter((job) => job.status === 'Com alerta').length

  return <div className={styles.dashboard}>
    <div className="admin-title">
      <div><div className={styles.pageEyebrow}>PAINEL DA OPERAÇÃO</div><h1>Visão geral</h1><p>O desempenho da loja e o que precisa da sua atenção.</p></div>
      <Link href="/admin/home-builder" className="btn primary"><PencilLine aria-hidden="true"/>Editar homepage</Link>
    </div>

    <div className={styles.overviewMeta}><span><span className={styles.demoDot}/>Indicadores demonstrativos</span><span><CalendarDays aria-hidden="true"/>Período de exemplo · 7 dias</span></div>
    <section className={styles.metrics} aria-label="Indicadores da operação">
      <Stat label="Receita afiliada estimada" value="R$ 84.290" delta="18,4%"/>
      <Stat label="Cliques afiliados" value="18.642" delta="12,8%"/>
      <Stat label="Produtos no catálogo" value={products.length.toLocaleString('pt-BR')} note="Cadastrados na plataforma"/>
      <Stat label="CTR médio" value="4,82%" delta="0,6 p.p."/>
    </section>

    <div className={styles.dashboardGrid}>
      <section className={styles.card} aria-labelledby="performance-title">
        <div className={styles.cardHeader}><div><h2 id="performance-title">Desempenho da descoberta</h2><p>Visualizações ao longo da semana</p></div><span className={styles.chartLegend}><i/>Visualizações</span></div>
        <div className={styles.chartSummary}><strong>{activity.reduce((sum, value) => sum + value, 0)} mil</strong><span>visualizações no período</span></div>
        <div className={styles.activityChart} role="img" aria-label={`Visualizações demonstrativas: ${activity.map((value, index) => `${days[index]}, ${value} mil`).join('; ')}.`}>
          <div className={styles.chartAxis} aria-hidden="true">{['100 mil', '75 mil', '50 mil', '25 mil', '0'].map((tick) => <span key={tick}>{tick}</span>)}</div>
          <div className={styles.plot} aria-hidden="true">
            <div className={styles.gridLines}>{[0, 1, 2, 3, 4].map((line) => <i key={line}/>)}</div>
            <div className={styles.bars}>{activity.map((value, index) => <div className={styles.barColumn} key={days[index]}><div className={`${styles.bar} ${index === activity.length - 1 ? styles.latestBar : ''}`} style={{ height: `${value}%` }}><span>{value} mil</span></div><span className={styles.dayLabel}>{days[index]}</span></div>)}</div>
          </div>
        </div>
        <div className={styles.cardFooter}><span>Pico da semana: quarta-feira, 96 mil</span><Link href="/admin/analytics">Ver analytics <ArrowUpRight aria-hidden="true"/></Link></div>
      </section>

      <section className={styles.card} aria-labelledby="operations-title">
        <div className={styles.cardHeader}><div><h2 id="operations-title">Operação</h2><p>Acompanhe suas integrações</p></div><span className={styles.alertCount}>{alerts} {alerts === 1 ? 'alerta' : 'alertas'}</span></div>
        <div className={styles.jobList}>{jobs.map((job) => {
          const warning = job.status === 'Com alerta'
          const running = job.status === 'Em execução'
          const Icon = warning ? CircleAlert : running ? Clock3 : Check
          return <div className={styles.job} key={job.id}>
            <div className={styles.jobHeading}><span className={styles.providerMark}>{job.provider.slice(0, 1)}</span><strong>{job.provider}</strong><span className={`${styles.jobStatus} ${warning ? styles.warning : running ? styles.running : styles.success}`}><Icon aria-hidden="true"/>{job.status}</span></div>
            <p>{job.name}</p><small>Última execução · {job.lastRun}</small>
            {running && <div className={styles.jobProgress} role="progressbar" aria-label={`Progresso: ${job.name}`} aria-valuenow={job.progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${job.progress}%` }}/></div>}
          </div>
        })}</div>
        <div className={styles.cardFooter}><Link href="/admin/imports-jobs">Gerenciar integrações e jobs <ArrowRight aria-hidden="true"/></Link></div>
      </section>

      <section className={`${styles.card} ${styles.productsCard}`} aria-labelledby="products-title">
        <div className={styles.cardHeader}><div><h2 id="products-title">Destaques do catálogo</h2><p>Produtos com a melhor avaliação editorial</p></div><Link className={styles.subtleLink} href="/admin/produtos">Ver todos <ArrowUpRight aria-hidden="true"/></Link></div>
        <div className={styles.productTableScroll}><table className={styles.productTable}><thead><tr><th scope="col">Produto</th><th scope="col">Score</th><th scope="col">Crescimento</th><th scope="col"><span className="sr-only">Detalhes</span></th></tr></thead><tbody>{featured.map((product) => <tr key={product.id}>
          <td><Link href={`/produto/${product.slug}`} className={styles.productIdentity}><Image src={product.image} alt="" width={40} height={40}/><span><strong>{product.name}</strong><small>{product.brand}</small></span></Link></td>
          <td><span className={styles.score}>{product.score}<small>/100</small></span></td>
          <td><span className={product.growth >= 0 ? styles.positive : styles.negative}>{product.growth > 0 ? '+' : ''}{product.growth.toLocaleString('pt-BR')}%</span></td>
          <td><Link className={styles.productArrow} href={`/produto/${product.slug}`} aria-label={`Ver ${product.name}`}><ArrowUpRight aria-hidden="true"/></Link></td>
        </tr>)}</tbody></table></div>
        {featured.length === 0 && <p className={styles.emptyCatalog}>Seu catálogo ainda não tem produtos. <Link href="/admin/produtos">Adicionar produtos <ArrowRight aria-hidden="true"/></Link></p>}
      </section>

      <section className={styles.card} aria-labelledby="recent-title">
        <div className={styles.cardHeader}><div><h2 id="recent-title">Atividade recente</h2><p>Últimas atualizações da equipe</p></div></div>
        <ol className={styles.timeline}>{auditEvents.map((event) => <li key={event.id}><span className={styles.timelineDot}/><div><div className={styles.eventHeading}><strong>{event.type}</strong><time>{event.at}</time></div><p>{event.subject}</p><small>{event.actor}</small></div></li>)}</ol>
        <div className={styles.cardFooter}><Link href="/admin/audit-log">Ver histórico completo <ArrowRight aria-hidden="true"/></Link></div>
      </section>
    </div>
    <p className={styles.dashboardNote}>Receita, tráfego, jobs e atividade recente usam dados de demonstração.</p>
  </div>
}

function Stat({ label, value, delta, note }: { label: string; value: string; delta?: string; note?: string }) {
  return <div className={styles.metric}><span>{label}</span><strong>{value}</strong><div>{delta ? <><span className={styles.delta}><ArrowUpRight aria-hidden="true"/>{delta}</span><small>vs. período anterior</small></> : <small>{note}</small>}</div></div>
}
