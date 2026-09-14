'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import Autoplay from 'embla-carousel-autoplay'
import useEmblaCarousel from 'embla-carousel-react'

export type HeroDealSlide = {
  id: string
  name: string
  slug: string
  description: string
  image: string
  provider: string
  price: string
  previousPrice: string
  discount: number
}

export function HeroDealCarousel({ slides }: { slides: HeroDealSlide[] }) {
  const autoplay = useRef(Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true }))
  const [viewportRef, api] = useEmblaCarousel({ loop: true }, [autoplay.current])
  const [selectedIndex, setSelectedIndex] = useState(0)

  const updateSelectedIndex = useCallback(() => {
    if (api) setSelectedIndex(api.selectedScrollSnap())
  }, [api])

  useEffect(() => {
    if (!api) return
    updateSelectedIndex()
    api.on('select', updateSelectedIndex)
    return () => {
      api.off('select', updateSelectedIndex)
    }
  }, [api, updateSelectedIndex])

  return (
    <section className="hero-deal-carousel" aria-roledescription="carrossel" aria-label="Ofertas em destaque">
      <div className="hero-deal-viewport" ref={viewportRef}>
        <div className="hero-deal-track">
          {slides.map((slide, index) => (
            <div className="hero-deal-slide" key={slide.id} aria-hidden={index !== selectedIndex}>
              <Link href={`/produto/${slide.slug}`} className="hero-deal" aria-label={`Ver oferta de ${slide.name}`} tabIndex={index === selectedIndex ? 0 : -1}>
                <div className="hero-deal-image">
                  <Image src={slide.image} alt={slide.name} fill priority={index === 0} sizes="(max-width: 900px) 100vw, 42vw" />
                  <span>-{slide.discount}%</span>
                </div>
                <div className="hero-deal-copy">
                  <small>DESTAQUE DO DIA · {slide.provider}</small>
                  <h2>{slide.name}</h2>
                  <p>{slide.description}</p>
                  <div>
                    <span><s>{slide.previousPrice}</s><strong>{slide.price}</strong></span>
                    <b>Ver oferta <ArrowRight /></b>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
      <div className="hero-deal-dots" aria-label="Escolher oferta em destaque">
        {slides.map((slide, index) => (
          <button
            type="button"
            key={slide.id}
            className={index === selectedIndex ? 'active' : ''}
            onClick={() => api?.scrollTo(index)}
            aria-label={`Mostrar ${slide.name}`}
            aria-current={index === selectedIndex ? 'true' : undefined}
          />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">Oferta {selectedIndex + 1} de {slides.length}: {slides[selectedIndex]?.name}</p>
    </section>
  )
}
