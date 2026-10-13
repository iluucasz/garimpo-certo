'use client'

import { Analytics } from '@vercel/analytics/next'
import { useVisitorState } from '@/components/visitor-state-provider'

/** Medição de acessos só é carregada depois que a pessoa permite a categoria "analytics". */
export function ConsentedAnalytics() {
  const { hydrated, cookiePreferences } = useVisitorState()
  if (!hydrated || !cookiePreferences.analytics) return null
  return <Analytics/>
}
