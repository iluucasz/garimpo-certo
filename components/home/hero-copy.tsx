'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { assignVariant, type Variant, type VariantCopy } from '@/lib/experiments/core'
import { registerExposure, visitorBucketId } from '@/lib/experiments/client'
import { analyticsAllowed, readStoredPreferences } from '@/lib/platform/consent'
import styles from './home.module.css'

type Copy = { title: string; accent: string; text: string; buttonLabel: string }
export type HeroExperiment = { key: string; splitB: number; variantB: VariantCopy }

/**
 * Título, texto de apoio e botão do topo da home. O servidor sempre entrega a variante A (a home de hoje); com a
 * medição permitida e um teste em andamento, o navegador sorteia a variante do visitante e, se for B, troca os
 * textos. Sem permissão, ninguém é sorteado e nada é guardado.
 */
export function HeroCopy({ control, experiment, ctaHref }: { control: Copy; experiment: HeroExperiment | null; ctaHref: string }) {
  const [variant, setVariant] = useState<Variant>('a')

  useEffect(() => {
    if (!experiment || !analyticsAllowed(readStoredPreferences())) return
    const visitor = visitorBucketId()
    if (!visitor) return
    const assigned = assignVariant(visitor, experiment.key, experiment.splitB)
    setVariant(assigned)
    registerExposure(experiment.key, assigned)
  }, [experiment])

  const copy: Copy = variant === 'b' && experiment ? {
    title: experiment.variantB.title ?? control.title, accent: experiment.variantB.accent ?? control.accent,
    text: experiment.variantB.text ?? control.text, buttonLabel: experiment.variantB.buttonLabel ?? control.buttonLabel,
  } : control

  return <>
    <h1 id="home-title">{copy.title} <span>{copy.accent}</span></h1>
    {copy.text && <p className={styles.heroLead}>{copy.text}</p>}
    <div className={styles.heroActions}>
      <Link className={styles.heroButton} href={ctaHref}>{copy.buttonLabel} <ArrowRight aria-hidden="true"/></Link>
      <Link className={styles.heroLink} href="/como-funciona">Como funciona</Link>
    </div>
  </>
}
