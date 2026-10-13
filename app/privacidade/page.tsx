'use client'

import { useState } from 'react'
import { Check, Download, Trash2 } from 'lucide-react'
import { useMock } from '@/components/mock-provider'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import styles from '@/components/storefront/content-pages.module.css'

const preferenceItems = [
  { key: 'analytics', label: 'Medição de uso', description: 'Permite registrar o que você faz no catálogo (favoritar, comparar, ver produtos) e medir acessos. Desligada, nada disso é enviado.' },
  { key: 'personalization', label: 'Personalização', description: 'Reservada para recomendações baseadas nos seus interesses. Hoje ainda não altera a vitrine.' },
  { key: 'marketing', label: 'Comunicações', description: 'Registra se você aceita receber novidades. Hoje não enviamos campanhas.' },
] as const

export default function PrivacyPage() {
  const state = useMock()
  const [message, setMessage] = useState('')
  const preferences = state.cookiePreferences

  function update(key: 'analytics' | 'personalization' | 'marketing') {
    state.saveCookiePreferences({ ...preferences, [key]: !preferences[key] })
    setMessage('Preferência de privacidade atualizada.')
  }

  function exportData() {
    const payload = { favorites: state.favorites, recent: state.recent, compare: state.compare, preferences: state.preferences, savedSearches: state.savedSearches, cookies: state.cookiePreferences }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'garimpo-dados-locais.json'
    link.click()
    URL.revokeObjectURL(url)
    setMessage('Arquivo com os dados deste navegador exportado.')
  }

  function eraseData() {
    ;['garimpo:favorites', 'garimpo:recent', 'garimpo:compare', 'garimpo:saved-searches', 'garimpo:user-preferences'].forEach((key) => localStorage.removeItem(key))
    state.clearRecent()
    state.setConsent(false)
    setMessage('Favoritos, histórico, comparador, buscas e preferências locais foram removidos. Recarregue a página para atualizar os contadores.')
  }

  return <StorefrontShell>
    <article className={styles.prose}>
      <h1>Seus dados continuam seus.</h1>
      <p className={styles.intro}>Guardamos o mínimo para a vitrine funcionar. Aqui você vê o que fica no seu aparelho, o que vai para os nossos servidores e como apagar o que é local.</p>

      <h2>O que fica neste navegador</h2>
      <p>Favoritos, comparador, produtos vistos, buscas recentes, preferências e a sua escolha de privacidade ficam salvos neste aparelho. Se você não tem conta, nada disso sai daqui.</p>

      <h2>O que vai para os nossos servidores</h2>
      <ul>
        <li><strong>Conta:</strong> se você criar uma, guardamos nome, e-mail e a sessão de acesso. Seus favoritos passam a ficar salvos nela.</li>
        <li><strong>Uso do catálogo, só com a sua permissão:</strong> se você ativar a medição de uso, ações como favoritar, comparar e ver produtos são registradas, e medimos acessos com o Vercel Analytics. Sem a permissão, nada disso é enviado.</li>
        <li><strong>Links de afiliado:</strong> ao comprar pelos nossos links, a Shopee identifica a origem da compra.</li>
      </ul>

      <h2>Suas preferências</h2>
      <div className={styles.prefs}>
        <div className={styles.pref}><span><strong>Armazenamento essencial</strong><small>Necessário para favoritos, comparador e histórico funcionarem.</small></span><button type="button" className={styles.switch} aria-pressed="true" disabled aria-label="Armazenamento essencial, sempre ativo"/></div>
        {preferenceItems.map(({ key, label, description }) => <div className={styles.pref} key={key}><span><strong>{label}</strong><small>{description}</small></span><button type="button" className={styles.switch} aria-label={label} aria-pressed={preferences[key]} onClick={() => update(key)}/></div>)}
        <p className={styles.state}>Estado atual: <strong>{state.consent ? 'preferências opcionais permitidas' : 'somente o essencial'}</strong>. Sua escolha fica salva neste navegador e vale imediatamente.</p>
      </div>

      <h2>Seus dados locais</h2>
      <div className={styles.actions}>
        <button type="button" onClick={exportData}><Download aria-hidden="true"/>Exportar meus dados locais</button>
        <button type="button" className={styles.danger} onClick={eraseData}><Trash2 aria-hidden="true"/>Limpar dados deste navegador</button>
      </div>
      {message && <p className={styles.success} role="status"><Check aria-hidden="true"/>{message}</p>}

      <h2>Seus direitos (LGPD)</h2>
      <p>Você pode pedir acesso, correção, portabilidade e exclusão dos dados da sua conta. Os botões acima atuam só nos dados deste navegador; pedidos sobre a conta ainda não têm um canal automático nesta página.</p>
    </article>
  </StorefrontShell>
}
