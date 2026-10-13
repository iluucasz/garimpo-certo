import { put } from '@vercel/blob'
import { recordAudit } from '@/lib/admin/audit'
import { checkImageUpload, MAX_UPLOAD_BYTES } from '@/lib/storage/upload'
import { authorize, fail, ok } from '@/lib/server/api'
import { rateLimit } from '@/lib/server/rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Envia uma imagem para o Vercel Blob e devolve o endereço público.
 * Multipart com o campo `file`. Exige `content:write`; confere o conteúdo real do arquivo, não o tipo declarado.
 */
export async function POST(request: Request) {
  const { blocked, userId } = await authorize(request, 'content:write')
  if (blocked) return blocked
  const quota = rateLimit(request, 'admin-upload', 30)
  if (!quota.allowed) return fail('Muitos envios seguidos. Aguarde um instante.', 429, undefined, { 'retry-after': String(quota.retryAfter) })
  if (!process.env.BLOB_READ_WRITE_TOKEN) return fail('Armazenamento de imagens não configurado (BLOB_READ_WRITE_TOKEN).', 503)

  // Recusa cedo pelo cabeçalho, antes de ler o corpo inteiro.
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) return fail(`A imagem passa de ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB. Reduza o tamanho e tente de novo.`, 413)

  let file: File | null = null
  try {
    const form = await request.formData()
    const value = form.get('file')
    if (value instanceof File) file = value
  } catch {
    return fail('Envio inválido. Use um formulário com o campo "file".', 400)
  }
  if (!file) return fail('Nenhum arquivo enviado.', 422, { file: 'Escolha uma imagem.' })

  const bytes = new Uint8Array(await file.arrayBuffer())
  const check = checkImageUpload(bytes, file.size)
  if (!check.ok) return fail(check.message, 422, { file: check.message })

  const month = new Date().toISOString().slice(0, 7)
  const pathname = `uploads/${month}/${crypto.randomUUID()}.${check.extension}`
  try {
    const blob = await put(pathname, Buffer.from(bytes), { access: 'public', contentType: check.type })
    await recordAudit({ actorUserId: userId, action: 'upload.create', entityType: 'imagem', entityId: pathname, after: { url: blob.url, bytes: bytes.byteLength, type: check.type } })
    return ok({ url: blob.url, bytes: bytes.byteLength, contentType: check.type }, { status: 201 })
  } catch (error) {
    console.error('[upload] falha ao gravar no Vercel Blob', error instanceof Error ? error.message : error)
    return fail('Não foi possível guardar a imagem agora. Tente de novo em instantes.', 502)
  }
}
