import Link from 'next/link'
import { Fragment, type ReactNode } from 'react'

/**
 * Renderizador mínimo de Markdown para artigos e páginas editados no painel. Não aceita HTML: o texto vira
 * elementos React, então nada digitado no editor executa script. Suporta títulos (#, ##, ###), parágrafos,
 * listas (- e 1.), citações (>), **negrito**, *itálico* e [links](endereço).
 */

const shopeeHost = /(^|\.)shopee\.com\.br$/i

function safeHref(raw: string) {
  const href = raw.trim()
  if (/^\/(?!\/)[^\s]*$/.test(href)) return { href, external: false, sponsored: false }
  try {
    const url = new URL(href)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return { href: url.toString(), external: true, sponsored: shopeeHost.test(url.hostname) }
  } catch {
    return null
  }
}

const inlinePattern = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_|\[[^\]]+\]\([^)\s]+\))/g

function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(inlinePattern).filter((part) => part !== '').map((part, index) => {
    const key = `${keyPrefix}-${index}`
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={key}>{inline(part.slice(2, -2), key)}</strong>
    if ((part.startsWith('*') && part.endsWith('*') || part.startsWith('_') && part.endsWith('_')) && part.length > 2) return <em key={key}>{inline(part.slice(1, -1), key)}</em>
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
    if (link) {
      const target = safeHref(link[2])
      if (!target) return <Fragment key={key}>{link[1]}</Fragment>
      if (!target.external) return <Link key={key} href={target.href}>{link[1]}</Link>
      return <a key={key} href={target.href} target="_blank" rel={`${target.sponsored ? 'sponsored ' : ''}noopener noreferrer`}>{link[1]}</a>
    }
    return <Fragment key={key}>{part}</Fragment>
  })
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let paragraph: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let quote: string[] = []

  const flushParagraph = () => {
    if (!paragraph.length) return
    blocks.push(<p key={`p${blocks.length}`}>{inline(paragraph.join(' '), `p${blocks.length}`)}</p>)
    paragraph = []
  }
  const flushList = () => {
    if (!list) return
    const Tag = list.ordered ? 'ol' : 'ul'
    const id = `l${blocks.length}`
    blocks.push(<Tag key={id}>{list.items.map((item, index) => <li key={index}>{inline(item, `${id}-${index}`)}</li>)}</Tag>)
    list = null
  }
  const flushQuote = () => {
    if (!quote.length) return
    blocks.push(<blockquote key={`q${blocks.length}`}>{inline(quote.join(' '), `q${blocks.length}`)}</blockquote>)
    quote = []
  }
  const flushAll = () => { flushParagraph(); flushList(); flushQuote() }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) { flushAll(); continue }
    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      flushAll()
      const level = heading[1].length // # → h2, ## → h3, ### → h4 (o título da página já é o h1)
      const Tag = (`h${level + 1}`) as 'h2' | 'h3' | 'h4'
      blocks.push(<Tag key={`h${blocks.length}`}>{inline(heading[2], `h${blocks.length}`)}</Tag>)
      continue
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/)
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/)
    if (bullet || numbered) {
      flushParagraph(); flushQuote()
      const ordered = Boolean(numbered)
      if (list && list.ordered !== ordered) flushList()
      list = list ?? { ordered, items: [] }
      list.items.push((bullet ?? numbered)![1])
      continue
    }
    const quoted = line.match(/^>\s?(.*)$/)
    if (quoted) { flushParagraph(); flushList(); quote.push(quoted[1]); continue }
    flushList(); flushQuote()
    paragraph.push(line.trim())
  }
  flushAll()
  return <>{blocks}</>
}
