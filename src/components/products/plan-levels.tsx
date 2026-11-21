import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import { formatUsd, personalPlanList } from '@/lib/pricing'
import { getPricing } from '@/lib/pricing-store'

// The three levels of the Personal AI as cards (owner 2026-11-22): name, what it connects, setup and monthly
// from the live pricing (defaults + the owner's edits in the Пульт), never typed in copy.
export async function PlanLevels({ products, copy }: { products: Dict['products']; copy: Dict['productPage']['planLevels'] }) {
  const plans = personalPlanList(await getPricing())
  return (
    <div data-plan-levels>
      <ul className="grid gap-gutter md:grid-cols-3">
        {plans.map((plan, i) => (
          <li
            key={plan.id}
            data-plan={plan.id}
            className={cn(
              'flex flex-col rounded-card border p-6',
              i === 1 ? 'border-accent-text/50 bg-[linear-gradient(160deg,var(--color-pine),var(--color-surface)_70%)]' : 'border-line bg-surface',
            )}
          >
            <p className="font-mono text-xs tracking-[0.14em] text-accent-text uppercase">{products.plans[plan.id]}</p>
            <p className="mt-4 font-mono">
              <span className="text-3xl text-fg">{formatUsd(plan.setup)}</span>
              <span className="ml-2 text-sm text-muted">{copy.setup}</span>
            </p>
            <p className="mt-1 font-mono text-sm text-muted">
              + <span className="text-fg">{formatUsd(plan.monthly)}</span> {copy.monthly}
            </p>
            <p className="mt-5 border-t border-line pt-4 leading-relaxed text-muted">{copy[plan.id as 'basic' | 'plus' | 'max']}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-faint">{copy.pick}</p>
    </div>
  )
}
