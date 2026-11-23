import type { Dict } from '@/content'
import { agentPrice, teamPrice, type AgentId, type AiTeamId } from '@/lib/ai-teams'
import { usd } from '@/lib/price-format'
import { getPricing } from '@/lib/pricing-store'
import { CompanyPlan } from '../products/plan-levels'
import { SubscriptionCard } from '../products/subscription-card'

// Price cards of the AI teams section (owner 2026-11-22). A team page shows the sum of its agents minus the team
// discount, live from the pricing; the whole-company team shows the AI company plan; an agent page shows that agent's
// own setup + monthly + own-key monthly. The Director has no card (sold only with a team).
export async function TeamPriceCard({ id, dict }: { id: AiTeamId; dict: Dict }) {
  const sub = dict.subscription
  const pricing = await getPricing()
  const price = teamPrice(id, pricing)
  if (!price) return <CompanyPlan sub={sub} />
  const notes = [
    sub.teamCount.replace('{count}', String(price.count)),
    sub.teamNote.replace('{percent}', String(price.discountPercent)),
    sub.teamFull.replace('{amount}', usd(price.full.monthly)),
  ]
  return (
    <SubscriptionCard
      copy={sub}
      title={sub.teamTitle}
      setup={price.setup}
      monthly={price.monthly}
      byokMonthly={price.byokMonthly}
      notes={notes}
    />
  )
}

export async function AgentPriceCard({ id, dict }: { id: AgentId; dict: Dict }) {
  const sub = dict.subscription
  const price = agentPrice(id, await getPricing())
  if (!price) return null
  return <SubscriptionCard copy={sub} title={sub.agentTitle} {...price} />
}
