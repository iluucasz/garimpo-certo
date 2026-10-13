import type { StorefrontConfig } from '@/components/storefront/storefront-config'
import { googleEnabled } from '@/lib/auth/providers'
import { getSiteDesign } from '@/lib/db/repositories/site-documents'
import { getStorefrontNav } from '@/lib/db/repositories/site-content'
import { themeVariables } from '@/lib/site-builder/design'

/**
 * Configuração que a casca da vitrine consome (tema, aviso do topo, rodapé, menu). Vem do design global
 * publicado em Painel → Páginas → Aparência do site; sem publicação, de Configurações → Tema.
 * Com `preview`, usa o rascunho (só para quem edita).
 */
export async function resolveStorefrontConfig(options: { preview?: boolean } = {}): Promise<StorefrontConfig> {
  const [design, nav] = await Promise.all([getSiteDesign(options), getStorefrontNav()])
  return {
    themeStyle: themeVariables(design),
    notice: { text: design.header.noticeText, detail: design.header.noticeDetail },
    footer: design.footer,
    nav,
    googleEnabled: googleEnabled(),
  }
}
