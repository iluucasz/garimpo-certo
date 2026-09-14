export type Category = { id: string; name: string; slug: string; icon: string; description: string }
export type Provider = { id: string; name: string; slug: string; rating: number; verified: boolean; color: string }
export type Offer = { id: string; productId: string; providerId: string; price: number; previousPrice?: number; shipping: number; installment: string; stock: 'disponível' | 'últimas unidades' | 'indisponível'; url: string; updatedAt: string }
export type Product = {
  id: string; name: string; slug: string; brand: string; category: string; description: string; longDescription: string
  image: string; images: string[]; rating: number; reviews: number; score: number; growth: number; tags: string[]
  specs: Record<string, string>; priceHistory: { month: string; price: number }[]
}
export type Collection = { id: string; title: string; slug: string; description: string; productIds: string[]; tone: string }
export type Article = { id: string; title: string; slug: string; excerpt: string; category: string; readTime: string; image: string; content: string[] }
export type AdminRecord = { id: string; name: string; status: string; meta: string; updatedAt: string }
export type EventRecord = { id: string; type: string; subject: string; actor: string; at: string }
export type Job = { id: string; name: string; provider: string; status: 'Concluído' | 'Em execução' | 'Com alerta'; progress: number; lastRun: string }
