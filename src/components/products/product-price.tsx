import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import { formatUsd } from '@/lib/pricing'
import { productPrice, type ProductId } from '@/lib/products'

// The price line of a product: «от $300», the two agent plans (setup + monthly), or «По смете».
// Numbers come from productPrice (pricing.ts and the approved agent plans), never from copy.
export function ProductPriceTag({
  id,
  copy,
  className,
}: {
  id: ProductId
  copy: Dict['products']
  className?: string
}) {
  const price = productPrice[id]
  if (price.kind === 'from')
    return (
      <p className={cn('font-mono text-sm text-muted', className)}>
        {copy.from} <span className="text-lg text-accent-text">{formatUsd(price.from)}</span>
      </p>
    )
  if (price.kind === 'plans')
    return (
      <div className={cn('grid gap-0.5 font-mono text-xs text-muted', className)}>
        {price.plans.map((plan) => (
          <p key={plan.id}>
            {copy.plans[plan.id]}:{' '}
            <span className="text-sm text-accent-text">{formatUsd(plan.setup)}</span> +{' '}
            <span className="text-fg">{formatUsd(plan.monthly)}</span>
            {copy.perMonth}
          </p>
        ))}
      </div>
    )
  return (
    <p className={cn('font-mono text-sm text-muted', className)} title={copy.quoteHint}>
      <span className="text-base text-fg">{copy.quote}</span>
    </p>
  )
}
