'use client'

import { useState } from 'react'
import { Check, Download, Trash2 } from 'lucide-react'
import { useMock } from '@/components/mock-provider'
import { StorefrontShell } from '@/components/storefront/storefront-shell'

export default function PrivacyPage() {
  const state = useMock()
  const [message, setMessage] = useState('')
  const preferences = state.cookiePreferences

  function update(key: 'analytics' | 'personalization' | 'marketing') {
    state.saveCookiePreferences({ ...preferences, [key]: !preferences[key] })
    setMessage('Preferências de privacidade atualizadas.')
  }

  function exportData() {
    const payload = { favorites: state.favorites, recent: state.recent, compare: state.compare, preferences: state.preferences, savedSearches: state.savedSearches, cookies: state.cookiePreferences }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'garimpo-dados-mock.json'
    link.click()
    URL.revokeObjectURL(url)
    setMessage('Arquivo com os dados locais exportado.')
  }

  function eraseData() {
    ;['garimpo:favorites', 'garimpo:recent', 'garimpo:compare', 'garimpo:saved-searches', 'garimpo:user-preferences'].forEach((key) => localStorage.removeItem(key))
    state.clearRecent()
    state.setConsent(false)
    setMessage('Histórico, preferências e consentimentos locais foram removidos. Recarregue para refletir todos os contadores.')
  }

  return <StorefrontShell><article className="content-prose"><div className="kicker">PRIVACIDADE E LGPD</div><h1>Seus dados continuam seus.</h1><p>Este ambiente não envia dados para backend. A central simula controles reais e mantém tudo neste navegador.</p><h2>Preferências de cookies</h2><div className="panel"><div className="toggle-row"><span><strong>Armazenamento essencial</strong><small>Necessário para favoritos, comparador e sessão demonstrativa.</small></span><button className="toggle on" disabled aria-label="Armazenamento essencial ativado"/></div>{([['analytics', 'Analytics', 'Mede jornadas e interação de forma local.'], ['personalization', 'Personalização', 'Ordena recomendações usando preferências locais.'], ['marketing', 'Marketing', 'Simula elegibilidade para campanhas.']] as const).map(([key, label, description]) => <div className="toggle-row" key={key}><span><strong>{label}</strong><small>{description}</small></span><button className={`toggle ${preferences[key] ? 'on' : ''}`} aria-label={`Alternar ${label}`} aria-pressed={preferences[key]} onClick={() => update(key)}/></div>)}<p>Estado atual: <strong>{state.consent ? 'preferências opcionais permitidas' : 'somente essencial'}</strong></p></div><h2>Portabilidade e exclusão</h2><div className="privacy-actions"><button className="btn secondary" onClick={exportData}><Download/> Exportar meus dados mock</button><button className="btn danger" onClick={eraseData}><Trash2/> Limpar dados locais</button></div>{message && <p className="form-success" role="status"><Check/> {message}</p>}<h2>Direitos LGPD</h2><p>Em uma integração real, os mesmos controles chamariam endpoints autenticados para acesso, correção, portabilidade e exclusão. Nesta demonstração, as ações atuam exclusivamente no armazenamento local.</p></article></StorefrontShell>
}
