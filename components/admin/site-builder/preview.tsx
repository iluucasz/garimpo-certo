'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import styles from './site-builder.module.css'

export type Zoom = 'fit' | 50 | 75 | 100
export type GlobalArea = 'header' | 'footer'

const WIDTH = { desktop: 1280, mobile: 390 } as const

/** Realce das seções dentro da prévia (a página é a mesma do site, só com estes estilos extras). */
const INJECTED_CSS = `
[data-cms-section] { cursor: pointer; outline: 2px solid transparent; outline-offset: -2px; transition: outline-color .12s; }
[data-cms-section]:hover { outline-color: #93c5fd; }
[data-cms-section][data-cms-selected] { outline-color: #2563eb; }
[data-cms-global] { cursor: pointer; }
[data-cms-global]:hover { outline: 2px dashed #93c5fd; outline-offset: -2px; }
a, button { cursor: pointer; }
`

type Props = {
  src: string
  device: 'desktop' | 'mobile'
  zoom: Zoom
  /** Muda depois de cada salvamento: recarrega a página mantendo a rolagem. */
  token: number
  selectedId: string | null
  onSelect: (id: string) => void
  onGlobal: (area: GlobalArea) => void
  onShortcut: (event: KeyboardEvent) => void
}

/**
 * Prévia da página real (mesmo servidor, com o rascunho), em um iframe do mesmo domínio. O editor liga o
 * clique da página à seleção da seção e bloqueia a navegação, para clicar num botão não tirar a pessoa dali.
 * Largura e zoom só mudam a apresentação: a página sempre é montada em 1280 px (computador) ou 390 px (celular).
 */
export function Preview({ src, device, zoom, token, selectedId, onSelect, onGlobal, onShortcut }: Props) {
  const frame = useRef<HTMLIFrameElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState(0)
  const [viewport, setViewport] = useState(640)
  const [loading, setLoading] = useState(true)
  const scroll = useRef(0)
  const first = useRef(true)

  const handlers = useRef({ onSelect, onGlobal, onShortcut })
  useEffect(() => { handlers.current = { onSelect, onGlobal, onShortcut } })

  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    const measure = () => {
      setAvailable(element.clientWidth)
      setViewport(Math.max(480, Math.min(window.innerHeight - 250, 960)))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    window.addEventListener('resize', measure)
    return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
  }, [])

  const width = WIDTH[device]
  const scale = zoom === 'fit' ? Math.min(1, available > 0 ? available / width : 1) : zoom / 100

  const mark = useCallback(() => {
    const doc = frame.current?.contentDocument
    if (!doc) return
    doc.querySelectorAll('[data-cms-selected]').forEach((node) => node.removeAttribute('data-cms-selected'))
    if (!selectedId) return
    const target = Array.from(doc.querySelectorAll('[data-cms-section]')).find((node) => node.getAttribute('data-cms-section') === selectedId)
    target?.setAttribute('data-cms-selected', '')
  }, [selectedId])

  /** Rola até a seção escolhida na lista, se ela não estiver à vista. */
  useEffect(() => {
    mark()
    const doc = frame.current?.contentDocument
    const target = doc?.querySelector('[data-cms-selected]')
    if (!doc || !target) return
    const rect = target.getBoundingClientRect()
    const height = doc.defaultView?.innerHeight ?? 0
    if (rect.height > 0 && (rect.bottom < 0 || rect.top > height)) target.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [mark])

  /** Depois de cada salvamento a página é recarregada; a rolagem volta para onde estava. */
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const win = frame.current?.contentWindow
    if (!win) return
    scroll.current = win.scrollY
    setLoading(true)
    try { win.location.reload() } catch { if (frame.current) frame.current.src = src }
  }, [token, src])

  function onLoad() {
    const win = frame.current?.contentWindow
    const doc = frame.current?.contentDocument
    if (!win || !doc) return
    setLoading(false)
    if (!doc.getElementById('cms-editor-style')) {
      const style = doc.createElement('style')
      style.id = 'cms-editor-style'
      style.textContent = INJECTED_CSS
      doc.head.appendChild(style)
      doc.addEventListener('click', (event) => {
        const target = event.target as Element | null
        if (!target?.closest) return
        // Nada dentro da prévia deve navegar ou enviar formulário: o clique só escolhe o que editar.
        event.preventDefault()
        event.stopPropagation()
        const section = target.closest('[data-cms-section]')
        if (section) { handlers.current.onSelect(section.getAttribute('data-cms-section') ?? ''); return }
        const area = target.closest('[data-cms-global]')?.getAttribute('data-cms-global')
        if (area === 'header' || area === 'footer') handlers.current.onGlobal(area)
      }, true)
      doc.addEventListener('submit', (event) => event.preventDefault(), true)
      doc.addEventListener('keydown', (event) => handlers.current.onShortcut(event), true)
    }
    if (scroll.current > 0) win.scrollTo(0, scroll.current)
    mark()
  }

  return <div className={styles.previewBox} ref={box}>
    <div className={styles.previewStage} style={{ width: width * scale, height: viewport }} data-loading={loading || undefined}>
      <iframe
        ref={frame}
        title="Prévia da página com o rascunho"
        src={src}
        onLoad={onLoad}
        style={{ width, height: viewport / scale, transform: `scale(${scale})`, transformOrigin: '0 0' }}
      />
    </div>
  </div>
}
