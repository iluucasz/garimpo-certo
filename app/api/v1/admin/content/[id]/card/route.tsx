import { ImageResponse } from 'next/og'
import { cleanTitle } from '@/lib/social/compose'
import { proofText } from '@/lib/social/content'
import { getContent, type ContentFacts } from '@/lib/social/content-store'
import { authorize, fail } from '@/lib/server/api'

export const dynamic = 'force-dynamic'
export const maxDuration = 30
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Foto do produto como data URL (o gerador de imagem não busca sozinho de forma confiável). Só JPEG/PNG/GIF até 5 MB. */
async function photo(url: string | null) {
  if (!url) return null
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) return null
    const type = (response.headers.get('content-type') ?? '').split(';')[0]
    if (!/^image\/(jpeg|png|gif)$/.test(type)) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length > 5_000_000) return null
    return `data:${type};base64,${bytes.toString('base64')}`
  } catch {
    return null
  }
}

const navy = '#1c2434'
const orange = '#c3441d'

type Font = { name: string; data: ArrayBuffer; weight: 700 | 800; style: 'normal' }
const fontCache = new Map<number, Promise<Font | null>>()

/**
 * Inter em negrito, baixada uma vez e guardada em memória (o gerador só traz a fonte regular). Sem rede ou com erro,
 * devolve null e a imagem sai com a fonte padrão: o post nunca deixa de ser gerado por causa da fonte.
 */
function loadFont(weight: 700 | 800): Promise<Font | null> {
  let cached = fontCache.get(weight)
  if (!cached) {
    cached = (async () => {
      try {
        // Um navegador antigo faz o Google Fonts devolver TrueType em vez de WOFF2 (o gerador não lê WOFF2).
        const css = await fetch(`https://fonts.googleapis.com/css2?family=Inter:wght@${weight}`, {
          headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.30 (KHTML, like Gecko) Chrome/12.0.742.112 Safari/534.30' },
          signal: AbortSignal.timeout(6000),
        }).then((response) => response.text())
        const url = /src:\s*url\(([^)]+)\)/.exec(css)?.[1]
        if (!url) return null
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
        if (!response.ok) return null
        return { name: 'Inter', data: await response.arrayBuffer(), weight, style: 'normal' as const }
      } catch {
        return null
      }
    })()
    fontCache.set(weight, cached)
    // Falha não fica guardada para sempre: tenta de novo na próxima vez.
    void cached.then((font) => { if (!font) fontCache.delete(weight) })
  }
  return cached
}

/**
 * Imagem do post: foto do produto, nome, preço e prova (nota e vendas) reais, com “Link na bio”.
 * `?format=feed` (1080×1350, 4:5, feed do Instagram) ou `?format=story` (1080×1920, 9:16: Stories, Reels e capa de TikTok).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { blocked } = await authorize(request, 'catalog:read')
  if (blocked) return blocked
  const { id } = await params
  if (!uuid.test(id)) return fail('Conteúdo não encontrado.', 404)
  const row = await getContent(id)
  if (!row) return fail('Conteúdo não encontrado.', 404)

  const story = new URL(request.url).searchParams.get('format') === 'story'
  const width = 1080
  const height = story ? 1920 : 1350
  const facts = row.facts as ContentFacts
  const image = await photo(row.imageUrl)
  const proof = proofText(facts)
  const hasDiscount = Boolean(facts.originalPrice && facts.originalPrice > facts.price && (facts.discountPercent ?? 0) >= 5)
  const money = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const photoHeight = story ? 1020 : 620
  const fonts = (await Promise.all([loadFont(700), loadFont(800)])).filter((font): font is Font => font !== null)

  return new ImageResponse(
    (
      <div style={{ width, height, display: 'flex', flexDirection: 'column', background: '#fbfaf7', padding: 64, fontFamily: fonts.length ? 'Inter' : 'sans-serif', color: navy }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>Garimpou Certo</div>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: orange }}>Achado do dia</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: photoHeight, flexShrink: 0, background: '#ffffff', borderRadius: 40, border: '2px solid #e3e0d7', overflow: 'hidden' }}>
          {image
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
            : <div style={{ display: 'flex', fontSize: 40, color: '#596273' }}>Foto do produto</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 40, flexGrow: 1 }}>
          <div style={{ display: 'flex', fontSize: 52, fontWeight: 700, lineHeight: 1.18, letterSpacing: -1 }}>{cleanTitle(facts.name, 70)}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 24 }}>
            <div style={{ display: 'flex', fontSize: 104, fontWeight: 800, letterSpacing: -3 }}>{money(facts.price)}</div>
            {hasDiscount && <div style={{ display: 'flex', fontSize: 40, color: '#596273', textDecoration: 'line-through', marginLeft: 28 }}>{money(facts.originalPrice as number)}</div>}
            {hasDiscount && <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, color: '#1c6b4a', marginLeft: 20 }}>−{Math.round(facts.discountPercent ?? 0)}%</div>}
          </div>
          {proof && <div style={{ display: 'flex', fontSize: 38, color: '#596273', marginTop: 12 }}>{proof}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 104, flexShrink: 0, marginTop: 24, borderRadius: 24, background: orange, color: '#ffffff', fontSize: 46, fontWeight: 800 }}>
          Link na bio
        </div>
      </div>
    ),
    { width, height, ...(fonts.length ? { fonts } : {}), headers: { 'cache-control': 'private, no-store', 'content-disposition': `inline; filename="post-${row.channel}-${story ? 'story' : 'feed'}.png"` } },
  )
}

