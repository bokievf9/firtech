'use client'

import { BuilderPreview } from '@/components/builder-preview'
import en from '@/content/en'
import ru from '@/content/ru'
import type { Build } from '@/lib/builder'

// The builder's own mockup from the decoded `?b=`, drawn at a third of its size. Loaded on demand by
// lead-breakdown.tsx (next/dynamic), so the builder's styles and motion never weigh on the Пульт page.
export default function BreakdownPreview({ build, locale }: { build: Build; locale: 'ru' | 'en' }) {
  return (
    <div className="relative h-44 w-full max-w-sm overflow-hidden rounded-xl border border-line-strong" data-breakdown-preview>
      <div className="pointer-events-none absolute top-0 left-0 w-[300%] origin-top-left scale-[0.3334]">
        <BuilderPreview build={build} dict={locale === 'ru' ? ru : en} locale={locale} className="min-h-[520px]" />
      </div>
    </div>
  )
}
