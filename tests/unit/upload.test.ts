import { describe, expect, it } from 'vitest'
import { checkImageUpload, MAX_UPLOAD_BYTES, sniffImageType } from '@/lib/storage/upload'

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(32).fill(0)])
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0))

describe('validação de imagem enviada pelo painel', () => {
  it('reconhece os formatos aceitos pelo conteúdo', () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png')
    expect(sniffImageType(new Uint8Array([...ascii('GIF89a'), 0, 0]))).toBe('image/gif')
    expect(sniffImageType(new Uint8Array([...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WEBP')]))).toBe('image/webp')
    expect(sniffImageType(new Uint8Array([0, 0, 0, 0x1c, ...ascii('ftypavif')]))).toBe('image/avif')
  })

  it('recusa o que não é imagem, mesmo com cara de imagem', () => {
    expect(sniffImageType(new Uint8Array(ascii('<svg xmlns="http://www.w3.org/2000/svg"><script>')))).toBeNull()
    expect(sniffImageType(new Uint8Array(ascii('<html><body>oi')))).toBeNull()
    expect(checkImageUpload(new Uint8Array(ascii('<svg></svg>')))).toMatchObject({ ok: false })
  })

  it('limita o tamanho e recusa arquivo vazio', () => {
    const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
    expect(checkImageUpload(png)).toEqual({ ok: true, type: 'image/png', extension: 'png' })
    expect(checkImageUpload(png, MAX_UPLOAD_BYTES + 1)).toMatchObject({ ok: false })
    expect(checkImageUpload(new Uint8Array(0))).toMatchObject({ ok: false })
  })
})
