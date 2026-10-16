'use client'

import { createContext, useContext } from 'react'

export type StorefrontConfig = {
  /** Variáveis CSS do tema escolhido no painel; vazio com o tema original. */
  themeStyle: Record<string, string>
  notice: { text: string; detail: string }
  /** Textos e links extras do rodapé (Painel → Páginas → Aparência do site). */
  footer: { tagline: string; signature: string; links: { id: string; label: string; href: string }[] }
  nav: { coupons: boolean; articles: boolean; pages: { slug: string; title: string }[] }
  googleEnabled: boolean
}

export const defaultStorefrontConfig: StorefrontConfig = {
  themeStyle: {},
  notice: { text: '', detail: '' },
  footer: { tagline: '', signature: '', links: [] },
  nav: { coupons: false, articles: false, pages: [] },
  googleEnabled: false,
}

const StorefrontConfigContext = createContext<StorefrontConfig>(defaultStorefrontConfig)

/**
 * Configuração que o painel controla e a casca da vitrine consome. É lida uma vez no layout raiz (servidor) e
 * chega por contexto, para `StorefrontShell` continuar utilizável em páginas cliente (/conta, /comparar...).
 * A prévia do editor aninha outro provedor com o rascunho do design global.
 */
export function StorefrontConfigProvider({ value, children }: { value: StorefrontConfig; children: React.ReactNode }) {
  return <StorefrontConfigContext.Provider value={value}>{children}</StorefrontConfigContext.Provider>
}

export const useStorefrontConfig = () => useContext(StorefrontConfigContext)
