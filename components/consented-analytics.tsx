'use client'

import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { useVisitorState } from '@/components/visitor-state-provider'

/**
 * Medição de acessos e de desempenho real (Core Web Vitals) só é carregada depois que a pessoa permite
 * a categoria "analytics". O Speed Insights precisa estar ativado no painel da Vercel para receber dados.
 */
export function ConsentedAnalytics() {
  const { hydrated, cookiePreferences } = useVisitorState()
  if (!hydrated || !cookiePreferences.analytics) return null
  return <>
    <Analytics/>
    <SpeedInsights/>
  </>
}
