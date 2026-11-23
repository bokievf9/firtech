import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import { fromLine, priceLine } from '@/lib/price-format'
import { getPricing } from '@/lib/pricing-store'
import { productPrices, type ProductId } from '@/lib/products'

// The price line of a product: «от $300», the plans (setup + monthly; the AI company «от» one plan with the
// «по смете» line), or «По смете».
// Numbers come from the live pricing (productPrices), never from copy.
export async function ProductPriceTag({
  id,
  copy,
  locale,
  className,
}: {
  id: ProductId
  locale?: string
  copy: Dict['products']
  className?: string
}) {
  const loc = locale ?? (copy.from === 'от' ? 'ru' : 'en')
  const price = productPrices(await getPricing())[id]
  if (price.kind === 'from')
    return (
      <p className={cn('font-mono text-sm text-muted', className)}>
        <span className="text-lg text-accent-text">{fromLine(price.from, 0, loc)}</span>
      </p>
    )
  if (price.kind === 'plans')
    return (
      <div className={cn('grid gap-0.5 font-mono text-xs text-muted', className)}>
        {price.plans.map((plan) => (
          <p key={plan.id}>
            {price.byQuote ? '' : `${copy.plans[plan.id]}: `}
            <span className="text-sm text-accent-text">{price.byQuote ? fromLine(plan.setup, plan.monthly, loc) : priceLine(plan.setup, plan.monthly, loc)}</span>
          </p>
        ))}
        {price.byQuote && <p className="font-sans text-xs text-faint">{copy.byQuote}</p>}
      </div>
    )
  return (
    <p className={cn('font-mono text-sm text-muted', className)} title={copy.quoteHint}>
      <span className="text-base text-fg">{copy.quote}</span>
    </p>
  )
}
