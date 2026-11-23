import type { Dict } from '@/content'
import { usd } from '@/lib/price-format'
import { personalPlanList, companyPlanOf } from '@/lib/pricing'
import { getPricing } from '@/lib/pricing-store'
import { SubscriptionCard } from './subscription-card'

// The three levels of the Personal AI as subscription cards (owner 2026-11-22): name, what it connects, setup, monthly
// and the monthly with the client's own API key, all from the live pricing (defaults + the owner's edits in the
// Пульт), never typed in copy.
export async function PlanLevels({
  products,
  copy,
  sub,
}: {
  products: Dict['products']
  copy: Dict['productPage']['planLevels']
  sub: Dict['subscription']
}) {
  const plans = personalPlanList(await getPricing())
  return (
    <div data-plan-levels>
      <ul className="grid gap-gutter md:grid-cols-3">
        {plans.map((plan, i) => (
          <li key={plan.id} data-plan={plan.id} className="flex">
            <SubscriptionCard
              copy={sub}
              title={products.plans[plan.id]}
              setup={plan.setup}
              monthly={plan.monthly}
              byokMonthly={plan.byokMonthly ?? plan.monthly}
              highlight={i === 1}
              className="w-full"
            >
              {copy[plan.id as 'basic' | 'plus' | 'max']}
            </SubscriptionCard>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-faint">{copy.pick}</p>
    </div>
  )
}

// The AI company's starting plan as one subscription card: «от» setup and monthly, the own-key monthly, and the extra
// per employee above five from the live pricing.
export async function CompanyPlan({ sub }: { sub: Dict['subscription'] }) {
  const pricing = await getPricing()
  const plan = companyPlanOf(pricing)
  return (
    <div data-company-plan className="max-w-md">
      <SubscriptionCard
        copy={sub}
        from
        setup={plan.setup}
        monthly={plan.monthly}
        byokMonthly={plan.byokMonthly ?? plan.monthly}
        notes={[sub.employees.replace('{amount}', usd(pricing.companyPerEmployee))]}
        highlight
      />
    </div>
  )
}
