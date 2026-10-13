/**
 * Validação de imagens enviadas pelo painel. Isomórfica e pura: o servidor confere o conteúdo real do arquivo
 * (a assinatura nos primeiros bytes), não só o tipo que o navegador declarou, para ninguém publicar um HTML
 * ou SVG com script no armazenamento público fazendo-se passar por imagem.
 */

/** A Vercel recusa corpos acima de 4,5 MB em funções; 4 MB deixa folga para o multipart. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

export const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'] as const
export type ImageType = (typeof imageTypes)[number]

const extensions: Record<ImageType, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' }
export const extensionFor = (type: ImageType) => extensions[type]

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) => signature.every((value, index) => bytes[offset + index] === value)

/** Tipo detectado pelo conteúdo, ou null se não for uma imagem aceita. */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) return 'image/gif'
  // RIFF....WEBP
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp'
  // ....ftypavif / avis
  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4) && (startsWith(bytes, [0x61, 0x76, 0x69, 0x66], 8) || startsWith(bytes, [0x61, 0x76, 0x69, 0x73], 8))) return 'image/avif'
  return null
}

export type UploadCheck = { ok: true; type: ImageType; extension: string } | { ok: false; message: string }

export function checkImageUpload(bytes: Uint8Array, size = bytes.byteLength): UploadCheck {
  if (size === 0) return { ok: false, message: 'O arquivo está vazio.' }
  if (size > MAX_UPLOAD_BYTES) return { ok: false, message: `A imagem passa de ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB. Reduza o tamanho e tente de novo.` }
  const type = sniffImageType(bytes)
  if (!type) return { ok: false, message: 'Formato não aceito. Envie JPG, PNG, WebP, AVIF ou GIF.' }
  return { ok: true, type, extension: extensionFor(type) }
}
