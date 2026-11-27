import type { ReactNode } from 'react'
import type { Dict } from '@/content'
import type { ProductPageCopy, ProductPageLayout } from '@/content/product-pages'
import { cn } from '@/lib/cn'
import type { ProductPayment } from '@/lib/product-page'
import type { GuaranteeCtx } from '@/lib/guarantee'
import type { ProductId } from '@/lib/products'
import { Reveal } from '../reveal'

// What every product section block gets from the page: the product, its copy, the live price facts and the links.
export type ProductSectionContext = {
  id: ProductId
  locale: 'ru' | 'en'
  dict: Dict
  page: ProductPageCopy
  layout: ProductPageLayout
  payment: ProductPayment
  term: string | null
  buildHref: string
  telegramUrl: string | null
  guarantee: GuaranteeCtx
}

// One section of a product page: a band (tinted, with lines) or plain, a heading, an optional sub and the body.
export function SectionShell({
  id,
  title,
  sub,
  band,
  children,
  className,
}: {
  id: string
  title: string
  sub?: string
  band?: boolean
  children: ReactNode
  className?: string
}) {
  const inner = (
    <div className={cn('mx-auto site-container py-section', className)}>
      <Reveal>
        <h2 id={`ps-${id}`} className="max-w-[24ch] font-display text-title font-semibold text-balance">
          {title}
        </h2>
        {sub && <p className="mt-5 max-w-[60ch] text-lead text-muted">{sub}</p>}
      </Reveal>
      <div className="mt-12">{children}</div>
    </div>
  )
  return (
    <section id={id} aria-labelledby={`ps-${id}`} data-product-section={id} data-tour={id} className={cn(band && 'border-y border-line bg-surface/40')}>
      {inner}
    </section>
  )
}
