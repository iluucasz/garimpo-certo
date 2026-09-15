import { StoreBrand } from './store-brand'
import styles from './store-loading.module.css'

type LoadingVariant = 'catalog' | 'account' | 'compare'

export function ContentSkeleton({ variant = 'catalog' }: { variant?: LoadingVariant }) {
  return <div className={styles.content} aria-busy="true" aria-label="Carregando conteúdo">
    <span className="sr-only" role="status">Carregando conteúdo…</span>
    <div aria-hidden="true">
      <div className={`${styles.bone} ${styles.breadcrumb}`}/><div className={`${styles.bone} ${styles.title}`}/><div className={`${styles.bone} ${styles.subtitle}`}/>
      {variant === 'account' ? <div className={styles.account}>
        <div className={styles.sidebar}><div className={`${styles.bone} ${styles.avatar}`}/><div className={styles.bone}/><div className={styles.bone}/><div className={styles.bone}/></div>
        <div><div className={styles.metrics}>{[0, 1, 2].map((index) => <div key={index}><div className={styles.bone}/><div className={`${styles.bone} ${styles.number}`}/></div>)}</div>{[0, 1].map((index) => <div className={styles.form} key={index}><div className={`${styles.bone} ${styles.formTitle}`}/><div className={styles.fields}><div className={`${styles.bone} ${styles.input}`}/><div className={`${styles.bone} ${styles.input}`}/></div><div className={`${styles.bone} ${styles.button}`}/></div>)}</div>
      </div> : <><div className={styles.toolbar}><div className={styles.bone}/><div className={styles.bone}/></div><div className={`${styles.products} ${variant === 'compare' ? styles.comparison : ''}`}>{Array.from({ length: variant === 'compare' ? 3 : 4 }, (_, index) => <div key={index}><div className={`${styles.bone} ${styles.image}`}/><div className={`${styles.bone} ${styles.productTitle}`}/><div className={`${styles.bone} ${styles.price}`}/>{variant === 'compare' && <><div className={styles.row}/><div className={styles.row}/><div className={styles.row}/></>}</div>)}</div></>}
    </div>
  </div>
}

export function StoreLoading({ variant = 'catalog' }: { variant?: LoadingVariant }) {
  return <div className={styles.screen}><div className={styles.notice} aria-hidden="true"/><header className={styles.header}><StoreBrand/><div className={`${styles.bone} ${styles.search}`} aria-hidden="true"/><div className={styles.headerIcons} aria-hidden="true"><i/><i/><i/></div></header><div className={styles.nav} aria-hidden="true"><div>{[0, 1, 2, 3, 4].map((index) => <span className={styles.bone} key={index}/>)}</div></div><main><ContentSkeleton variant={variant}/></main></div>
}
