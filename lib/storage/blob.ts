import { put } from '@vercel/blob'

const allowedContentTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])

export async function rehostProviderImage(sourceUrl: string, providerCode: string): Promise<string | null> {
  try {
    const response = await fetch(sourceUrl)
    if (!response.ok) return null
    const contentType = response.headers.get('content-type')?.split(';')[0] ?? ''
    if (!allowedContentTypes.has(contentType)) return null
    const extension = contentType.split('/')[1]
    const bytes = await response.arrayBuffer()
    const pathname = `providers/${providerCode}/${crypto.randomUUID()}.${extension}`
    const blob = await put(pathname, Buffer.from(bytes), { access: 'public', contentType })
    return blob.url
  } catch {
    return null
  }
}
