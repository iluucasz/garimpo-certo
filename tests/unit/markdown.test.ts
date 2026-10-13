import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { Markdown } from '@/components/content/markdown'

const render = (source: string) => renderToStaticMarkup(createElement(Markdown, { source }))

describe('Markdown dos artigos', () => {
  it('converte títulos, parágrafos e listas', () => {
    const html = render('# Título\n\nUm **forte** e *suave*.\n\n- um\n- dois')
    expect(html).toContain('<h2>Título</h2>')
    expect(html).toContain('<strong>forte</strong>')
    expect(html).toContain('<em>suave</em>')
    expect(html).toContain('<ul><li>um</li><li>dois</li></ul>')
  })

  it('não executa HTML digitado no texto', () => {
    const html = render('<script>alert(1)</script> e <img src=x onerror=alert(1)>')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;script&gt;')
  })

  it('descarta links com protocolo perigoso e mantém o texto', () => {
    const html = render('[clique](javascript:alert(1)) e [seguro](https://exemplo.com.br/a)')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('clique')
    expect(html).toContain('href="https://exemplo.com.br/a"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('marca links da Shopee como patrocinados e abre links internos no próprio site', () => {
    const html = render('[loja](https://s.shopee.com.br/abc) [coleções](/colecoes)')
    expect(html).toContain('rel="sponsored noopener noreferrer"')
    expect(html).toContain('href="/colecoes"')
  })
})
