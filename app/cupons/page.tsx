import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { CopyCodeButton } from '@/components/content/copy-code-button'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { featureEnabled, getVisibleCoupons, type VisibleCoupon } from '@/lib/db/repositories/site-content'
import { formatPrice } from '@/lib/format'
import styles from '@/components/content/content.module.css'

export const revalidate = 86400
export const metadata = {
  title: 'Cupons',
  description: 'Cupons e campanhas da Shopee para economizar nas suas compras, com validade e condições.',
  alternates: { canonical: '/cupons' },
}

const day = (iso: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))

function Validity({ coupon }: { coupon: VisibleCoupon }) {
  if (!coupon.endsAt) return <span>Sem data de término informada</span>
  const days = Math.ceil((new Date(coupon.endsAt).getTime() - Date.now()) / 86_400_000)
  return <span>Válido até {day(coupon.endsAt)}{days <= 3 && days >= 0 ? ` · ${days === 0 ? 'termina hoje' : days === 1 ? 'falta 1 dia' : `faltam ${days} dias`}` : ''}</span>
}

function CouponCard({ coupon }: { coupon: VisibleCoupon }) {
  return <li className={styles.coupon}>
    <div className={styles.couponTop}>
      {coupon.imageUrl && <img className={styles.couponImage} src={coupon.imageUrl} alt="" loading="lazy" decoding="async"/>}
      <div>
        <h2>{coupon.title}</h2>
        {coupon.discountLabel && <span className={styles.discount}>{coupon.discountLabel}</span>}
      </div>
    </div>
    {coupon.description && <p className={styles.conditions}>{coupon.description}</p>}
    <p className={styles.meta}>
      <Validity coupon={coupon}/>
      {coupon.minSpend !== null && Number(coupon.minSpend) > 0 && <span>Compra mínima {formatPrice(Number(coupon.minSpend))}</span>}
    </p>
    {coupon.code && <div className={styles.codeRow}><span className={styles.code} aria-label={`Código do cupom: ${coupon.code}`}>{coupon.code}</span><CopyCodeButton code={coupon.code}/></div>}
    <a className={styles.go} href={coupon.url} data-coupon-id={coupon.id} target="_blank" rel="sponsored noopener noreferrer">{coupon.code ? 'Ir para a Shopee' : 'Ver na Shopee'} <ArrowUpRight aria-hidden="true" size={18}/></a>
  </li>
}

export default async function CouponsPage() {
  if (!(await featureEnabled('cupons'))) notFound()
  const coupons = await getVisibleCoupons()
  const manual = coupons.filter((coupon) => coupon.source === 'manual')
  const campaigns = coupons.filter((coupon) => coupon.source !== 'manual')

  return <StorefrontShell>
    <div className={`container ${styles.page}`}>
      <nav className={styles.breadcrumbs} aria-label="Navegação estrutural"><Link href="/">Início</Link><span aria-hidden="true">/</span><span aria-current="page">Cupons</span></nav>
      <header className={styles.header}>
        <h1>Cupons e campanhas</h1>
      </header>
      {coupons.length === 0
        ? <p className={styles.empty}>Nenhum cupom no momento. <Link href="/colecoes">Ver coleções</Link></p>
        : <>
          {manual.length > 0 && <section className={styles.group} aria-labelledby="cupons-titulo"><h2 id="cupons-titulo">Cupons</h2><ul className={styles.couponGrid}>{manual.map((coupon) => <CouponCard coupon={coupon} key={coupon.id}/>)}</ul></section>}
          {campaigns.length > 0 && <section className={styles.group} aria-labelledby="campanhas-titulo"><h2 id="campanhas-titulo">Campanhas da Shopee</h2><ul className={styles.couponGrid}>{campaigns.map((coupon) => <CouponCard coupon={coupon} key={coupon.id}/>)}</ul></section>}
        </>}
      <p className={styles.disclosure}>Links de afiliado da Shopee.</p>
    </div>
  </StorefrontShell>
}
