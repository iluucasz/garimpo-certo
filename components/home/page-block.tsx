import { CmsBlock } from './cms-blocks'
import { CollectionBlock } from './collection-block'
import type { Section } from '@/lib/site-builder/document'

/** Bloco livre de uma página montada no editor (as seções internas do site são tratadas em `app/page.tsx`). */
export function PageBlock({ section, productIds }: { section: Section; productIds?: string[] }) {
  if (section.type === 'collection') return <CollectionBlock section={section} productIds={productIds}/>
  return <CmsBlock section={section}/>
}
