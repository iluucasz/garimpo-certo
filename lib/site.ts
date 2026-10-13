/**
 * Endereço público do site e flags de conteúdo.
 *
 * - NEXT_PUBLIC_SITE_URL define o domínio canônico (ex.: https://garimpocerto.com.br).
 * - Sem ela, usa o domínio de produção que a própria Vercel injeta (VERCEL_PROJECT_PRODUCTION_URL).
 * - Em desenvolvimento cai em http://localhost:3000.
 */
const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || vercelProduction || 'http://localhost:3000').replace(/\/+$/, '')

/**
 * Coleções e guias ainda são conteúdo de demonstração (não há tabelas nem edição para eles).
 * Ficam escondidos — menu, rodapé, home, sitemap e as próprias rotas — até que exista conteúdo real
 * e NEXT_PUBLIC_EDITORIAL_ENABLED=1 seja definida.
 */
export const editorialEnabled = process.env.NEXT_PUBLIC_EDITORIAL_ENABLED === '1'
