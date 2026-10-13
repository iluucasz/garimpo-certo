import Link from 'next/link'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import styles from '@/components/storefront/content-pages.module.css'

export const metadata = {
  title: 'Como funciona',
  description: 'De onde vêm os produtos, como calculamos o Índice Garimpo e como os links de afiliado funcionam.',
}

export default function HowPage() {
  return <StorefrontShell>
    <article className={styles.prose}>
      <h1>Escolhas com contexto, não com pressão.</h1>
      <p className={styles.intro}>O Garimpo reúne produtos da Shopee em um lugar só, para você comparar e decidir com calma. Aqui está, sem rodeios, de onde vêm os dados e como ganhamos dinheiro.</p>

      <h2>De onde vêm os produtos</h2>
      <p>Os produtos, preços, notas e vendas vêm da API de afiliados da Shopee. Nas importações aplicamos, por padrão, nota mínima de 4,5, ao menos 50 vendas e no máximo 2 produtos por loja, para evitar que uma só loja domine a vitrine.</p>
      <p>Preço e vendas refletem a última sincronização e podem mudar na loja. Por isso a compra é sempre finalizada lá, com o valor que a Shopee mostrar.</p>

      <h2>O que não mostramos, de propósito</h2>
      <ul>
        <li><strong>Frete:</strong> a Shopee não informa esse valor aos afiliados. Ele é calculado na loja.</li>
        <li><strong>Número de avaliações:</strong> temos só a nota média, então não exibimos a quantidade.</li>
        <li><strong>Preço anterior:</strong> só mostramos o “de/por” quando os dados da Shopee fecham. Quando o produto tem variações de preço, preferimos indicar “a partir de”.</li>
      </ul>

      <h2>Como funciona o Índice Garimpo</h2>
      <p>É uma nota de 0 a 100 que reúne avaliação, volume de vendas (em escala logarítmica, para um produto muito vendido não esmagar os demais) e desconto. Serve para ordenar, não para dizer que um produto é “o melhor”: leia a nota, as vendas e os detalhes antes de decidir.</p>
      <p>As vendas que mostramos são as informadas pela Shopee no programa de afiliados. O anúncio na loja pode exibir um total acumulado maior.</p>

      <h2 id="afiliados">Links de afiliado</h2>
      <p>Os botões de compra levam à Shopee por links de afiliado. Se você comprar por eles, podemos receber uma comissão da Shopee. Esses links são sinalizados pelo aviso no topo e no rodapé do site, e as posições da vitrine não são vendidas.</p>
      <p>O Garimpo não vende produtos nem recebe pagamentos: a compra, a entrega e o suporte são da loja.</p>

      <h2>O que não fazemos</h2>
      <p>Não criamos falsa urgência, não escondemos publicidade e não vendemos dados pessoais. Veja o que guardamos na <Link href="/privacidade">página de privacidade</Link>.</p>
    </article>
  </StorefrontShell>
}
