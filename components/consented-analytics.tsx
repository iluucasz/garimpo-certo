'use client'

import { Analytics } from '@vercel/analytics/next'
import { useMock } from '@/components/mock-provider'

/** Medição de acessos só é carregada depois que a pessoa permite a categoria "analytics". */
export function ConsentedAnalytics() {
  const { hydrated, cookiePreferences } = useMock()
  if (!hydrated || !cookiePreferences.analytics) return null
  return <Analytics/>
}
