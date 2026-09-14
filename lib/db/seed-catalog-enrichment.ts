import { eq } from 'drizzle-orm'
import { db } from './client'
import { brands, categories, offers, priceHistory, productAttributeValues, productAttributes, productCategories, productImages, products } from './schema'

const attributeDefs = [
  { code: 'bateria', label: 'Bateria' }, { code: 'conexao', label: 'Conexão' }, { code: 'resistencia', label: 'Resistência' },
  { code: 'garantia', label: 'Garantia' }, { code: 'capacidade', label: 'Capacidade' }, { code: 'material', label: 'Material' },
  { code: 'potencia', label: 'Potência' }, { code: 'tela', label: 'Tela' }, { code: 'compartimento', label: 'Compartimento' },
  { code: 'ajustes', label: 'Ajustes' }, { code: 'carga_maxima', label: 'Carga máxima' }, { code: 'itens', label: 'Itens' },
  { code: 'pecas', label: 'Peças' }, { code: 'fixacao', label: 'Fixação' }, { code: 'programas', label: 'Programas' },
] as const
type AttributeCode = (typeof attributeDefs)[number]['code']

const categoryDefs = [
  { name: 'Tecnologia', slug: 'tecnologia' },
  { name: 'Casa', slug: 'casa' },
  { name: 'Áudio', slug: 'audio' },
  { name: 'Cozinha', slug: 'cozinha' },
  { name: 'Bem-estar', slug: 'bem-estar' },
] as const

type Enrichment = {
  slug: string
  brand: string
  category: (typeof categoryDefs)[number]['slug']
  description: string
  image: string
  rating: string
  reviewsCount: number
  editorialScore: string
  growthPercentage: string
  specs: Partial<Record<AttributeCode, string>>
}

const enrichments: Enrichment[] = [
  { slug: 'fone-bluetooth-tws-x200', brand: 'TechStore Oficial', category: 'audio', description: 'Fones sem fio com cancelamento de ruído e case de carregamento compacto para o dia a dia.', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=900&q=85', rating: '4.6', reviewsCount: 842, editorialScore: '91', growthPercentage: '24', specs: { bateria: '6h + 24h no case', conexao: 'Bluetooth 5.3', resistencia: 'IPX4', garantia: '12 meses' } },
  { slug: 'smartwatch-fit-band-5', brand: 'FitLife Brasil', category: 'tecnologia', description: 'Monitor cardíaco, contagem de passos e notificações no pulso, com bateria de longa duração.', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85', rating: '4.5', reviewsCount: 1204, editorialScore: '89', growthPercentage: '31', specs: { bateria: '7 dias', tela: 'AMOLED 1.1"', resistencia: '5 ATM', garantia: '12 meses' } },
  { slug: 'mochila-notebook-antifurto-15', brand: 'UrbanBag', category: 'tecnologia', description: 'Compartimento acolchoado para notebook de até 15,6", zíper antifurto e alça reforçada.', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85', rating: '4.7', reviewsCount: 356, editorialScore: '90', growthPercentage: '15', specs: { capacidade: '20 litros', compartimento: 'Até 15,6"', material: 'Poliéster reforçado', garantia: '6 meses' } },
  { slug: 'luminaria-led-mesa-usb', brand: 'CasaSmart', category: 'casa', description: 'Luz regulável com porta USB integrada para carregar o celular enquanto trabalha ou estuda.', image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85', rating: '4.4', reviewsCount: 210, editorialScore: '86', growthPercentage: '18', specs: { potencia: '8 W', conexao: 'USB 5V/1A', ajustes: '3 temperaturas', garantia: '12 meses' } },
  { slug: 'garrafa-termica-inox-1l', brand: 'Vida Prática', category: 'casa', description: 'Aço inoxidável de parede dupla que mantém a temperatura por até 12 horas.', image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=85', rating: '4.8', reviewsCount: 528, editorialScore: '93', growthPercentage: '12', specs: { capacidade: '1 litro', material: 'Aço inoxidável', garantia: '24 meses' } },
  { slug: 'teclado-mecanico-rgb-gamer', brand: 'GamerZone', category: 'tecnologia', description: 'Switches azuis táteis, iluminação RGB customizável e construção resistente para jogos.', image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=85', rating: '4.6', reviewsCount: 673, editorialScore: '92', growthPercentage: '28', specs: { conexao: 'USB-C', ajustes: 'RGB 16.8M cores', garantia: '12 meses' } },
  { slug: 'cadeira-escritorio-ergonomica', brand: 'Office Comfort', category: 'casa', description: 'Apoio lombar ajustável e encosto reclinável para longas jornadas de trabalho.', image: 'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=900&q=85', rating: '4.5', reviewsCount: 389, editorialScore: '88', growthPercentage: '20', specs: { ajustes: 'Altura e apoio lombar', carga_maxima: '120 kg', material: 'Mesh respirável', garantia: '12 meses' } },
  { slug: 'kit-skincare-facial-completo', brand: 'Bella Pele', category: 'bem-estar', description: 'Cinco produtos para limpeza, hidratação e proteção da pele em uma rotina completa.', image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=85', rating: '4.3', reviewsCount: 297, editorialScore: '85', growthPercentage: '35', specs: { itens: '5 produtos', garantia: '24 meses (validade)' } },
  { slug: 'caixa-som-bluetooth-portatil', brand: 'SoundMax', category: 'audio', description: 'Som potente e resistente à água, ideal para levar para qualquer lugar.', image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=85', rating: '4.6', reviewsCount: 951, editorialScore: '90', growthPercentage: '22', specs: { potencia: '20 W RMS', resistencia: 'IPX7', bateria: '12 horas', garantia: '12 meses' } },
  { slug: 'organizador-guarda-roupa-6pc', brand: 'Casa Organizada', category: 'casa', description: 'Seis peças para organizar roupas dobradas e otimizar o espaço do guarda-roupa.', image: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=900&q=85', rating: '4.4', reviewsCount: 178, editorialScore: '84', growthPercentage: '16', specs: { pecas: '6 unidades', material: 'Tecido não-tecido', garantia: '3 meses' } },
  { slug: 'suporte-celular-veicular-mag', brand: 'AutoTech', category: 'tecnologia', description: 'Fixação magnética estável para o painel do carro, instalação sem ferramentas.', image: 'https://images.unsplash.com/photo-1625842268584-8f3296236761?auto=format&fit=crop&w=900&q=85', rating: '4.5', reviewsCount: 412, editorialScore: '87', growthPercentage: '19', specs: { fixacao: 'Magnética N52', garantia: '12 meses' } },
  { slug: 'panela-eletrica-multifuncional', brand: 'CozinhaFácil', category: 'cozinha', description: 'Cozinha, refoga e cozinha no vapor com programas automáticos para o dia a dia.', image: 'https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&w=900&q=85', rating: '4.7', reviewsCount: 634, editorialScore: '94', growthPercentage: '27', specs: { capacidade: '5 litros', potencia: '1200 W', programas: '8 automáticos', garantia: '12 meses' } },
]

async function main() {
  console.log('Seedando categorias...')
  const categoryIdBySlug = new Map<string, string>()
  for (const category of categoryDefs) {
    const [existing] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, category.slug))
    if (existing) { categoryIdBySlug.set(category.slug, existing.id); continue }
    const [row] = await db.insert(categories).values({ name: category.name, slug: category.slug, path: `/${category.slug}` }).returning()
    categoryIdBySlug.set(category.slug, row.id)
  }

  console.log('Seedando atributos...')
  const attributeIdByCode = new Map<AttributeCode, string>()
  for (const attribute of attributeDefs) {
    const [existing] = await db.select({ id: productAttributes.id }).from(productAttributes).where(eq(productAttributes.code, attribute.code))
    if (existing) { attributeIdByCode.set(attribute.code, existing.id); continue }
    const [row] = await db.insert(productAttributes).values({ code: attribute.code, label: attribute.label, dataType: 'text' }).returning()
    attributeIdByCode.set(attribute.code, row.id)
  }

  console.log('Seedando marcas e enriquecendo produtos...')
  for (const item of enrichments) {
    const [product] = await db.select({ id: products.id }).from(products).where(eq(products.slug, item.slug))
    if (!product) { console.warn(`Produto não encontrado: ${item.slug}`); continue }

    let [brand] = await db.select({ id: brands.id }).from(brands).where(eq(brands.name, item.brand))
    if (!brand) {
      const brandSlug = item.brand.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      ;[brand] = await db.insert(brands).values({ name: item.brand, slug: brandSlug }).returning()
    }

    await db.update(products).set({
      brandId: brand.id, description: item.description, rating: item.rating, reviewsCount: item.reviewsCount,
      editorialScore: item.editorialScore, growthPercentage: item.growthPercentage, updatedAt: new Date().toISOString(),
    }).where(eq(products.id, product.id))

    const categoryId = categoryIdBySlug.get(item.category)!
    await db.delete(productCategories).where(eq(productCategories.productId, product.id))
    await db.insert(productCategories).values({ productId: product.id, categoryId, isPrimary: true })

    await db.delete(productImages).where(eq(productImages.productId, product.id))
    await db.insert(productImages).values({ productId: product.id, sourceUrl: item.image, isPrimary: true, position: 0 })

    await db.delete(productAttributeValues).where(eq(productAttributeValues.productId, product.id))
    const specEntries = Object.entries(item.specs) as [AttributeCode, string][]
    if (specEntries.length) await db.insert(productAttributeValues).values(specEntries.map(([code, value]) => ({ productId: product.id, attributeId: attributeIdByCode.get(code)!, valueText: value })))

    const [offer] = await db.select({ id: offers.id, price: offers.price }).from(offers).where(eq(offers.productId, product.id))
    if (offer) {
      await db.delete(priceHistory).where(eq(priceHistory.offerId, offer.id))
      const currentPrice = Number(offer.price)
      const months = ['Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set']
      const rows = months.map((month, index) => ({
        offerId: offer.id, month,
        price: (currentPrice * (1.08 - index * 0.016)).toFixed(2),
        capturedAt: new Date(2026, 3 + index, 1).toISOString(),
      }))
      await db.insert(priceHistory).values(rows.map(({ month: _month, ...row }) => row))
    }

    console.log(`Enriquecido: ${item.slug}`)
  }

  console.log('Concluído.')
  process.exit(0)
}

main().catch((error) => { console.error(error); process.exit(1) })
