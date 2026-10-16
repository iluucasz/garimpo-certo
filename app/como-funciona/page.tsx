import Link from 'next/link'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import styles from '@/components/storefront/content-pages.module.css'

export const metadata = {
  title: 'Como funciona',
  description: 'De onde vêm os produtos, o Índice Garimpo e os links de afiliado.',
}

export default function HowPage() {
  return <StorefrontShell>
    <article className={styles.prose}>
      <h1>Como funciona</h1>

      <h2>Os produtos</h2>
      <p>Produtos, preços, notas e vendas vêm da API de afiliados da Shopee e são atualizados todo dia. Só entram itens bem avaliados e com vendas comprovadas.</p>

      <h2>Índice Garimpo</h2>
      <p>Uma nota de 0 a 100 que reúne avaliação, vendas e desconto. Serve para ordenar; leia os detalhes antes de decidir.</p>

      <h2 id="afiliados">Links de afiliado</h2>
      <p>Os botões de compra levam à Shopee por links de afiliado e podemos receber comissão, sem custo extra para você. A compra, a entrega e o suporte são da loja. <Link href="/privacidade">Privacidade</Link></p>
    </article>
  </StorefrontShell>
}
