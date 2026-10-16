import Link from 'next/link'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { getPublishedContent } from '@/lib/db/repositories/site-content'
import styles from '@/components/content/content.module.css'

export const revalidate = 300
export const metadata = {
  title: 'Artigos',
  description: 'Guias, dicas e análises para escolher melhor antes de comprar.',
  alternates: { canonical: '/artigos' },
}

const date = (iso: string | null) => iso ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(iso)) : null

export default async function ArticlesPage() {
  const articles = await getPublishedContent('article')
  return <StorefrontShell>
    <div className={`container ${styles.page}`}>
      <nav className={styles.breadcrumbs} aria-label="Navegação estrutural"><Link href="/">Início</Link><span aria-hidden="true">/</span><span aria-current="page">Artigos</span></nav>
      <header className={styles.header}>
        <h1>Artigos</h1>
      </header>
      {articles.length === 0
        ? <p className={styles.empty}>Nenhum artigo ainda. <Link href="/colecoes">Ver coleções</Link></p>
        : <ul className={styles.articleList}>{articles.map((article) => <li className={styles.article} key={article.id}>
          <Link href={`/artigos/${article.slug}`}>
            {article.publishedAt && <time dateTime={article.publishedAt}>{date(article.publishedAt)}</time>}
            <h2>{article.title}</h2>
            {article.summary && <p>{article.summary}</p>}
          </Link>
        </li>)}</ul>}
    </div>
  </StorefrontShell>
}
