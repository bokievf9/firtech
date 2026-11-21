'use client'

import { useMemo } from 'react'
import type { Dict } from '@/content'
import { emptyBuild, toggleProduct, type ProductId } from '@/lib/builder'
import { LivePreview } from '../builder-live-preview'

// The «Автоматизация процессов» and «Telegram Mini App» demo tabs show the builder's own preview of
// that product (the process chain, the phone frame) for a sample salon. Labelled «Пример»: no real data.
export function DemoBuilt({
  dict,
  locale,
  product,
  intro,
  badge,
}: {
  dict: Dict
  locale: 'ru' | 'en'
  product: ProductId
  intro: string
  badge: string
}) {
  const build = useMemo(() => toggleProduct({ ...emptyBuild, kind: 'salon' }, product), [product])
  return (
    <div className="grid gap-5 lg:grid-cols-12 lg:gap-8">
      <div className="lg:col-span-5">
        <p className="max-w-[44ch] text-muted">{intro}</p>
        <p className="mt-6 inline-flex rounded-full bg-accent/15 px-3 py-1 text-xs text-accent-text">{badge}</p>
      </div>
      <div className="lg:col-span-7" data-demo-built={product}>
        <LivePreview build={build} dict={dict} locale={locale} />
      </div>
    </div>
  )
}
