import { getDict } from '@/content'
import { guaranteeLine } from '@/lib/guarantee'
import { agentOffers, agentPath, aiTeamIds, aiTeamPath, aiTeamsPath } from '@/lib/ai-teams'
import { formatUsd, type Pricing } from '@/lib/pricing'
import { getPricing } from '@/lib/pricing-store'
import { productIds, productPath, productPrices, type ProductId } from '@/lib/products'
import { serviceSlugs, siteUrl, telegramHandle } from '@/lib/site'

// llms.txt: a plain description of the studio and its products for AI assistants. Built from the
// same dictionaries and price config as the page, so it never drifts from the site.
// The prices are the live ones (owner edits in the Пульт), so it is rebuilt at most every 5 minutes.
export const revalidate = 300

function priceText(pricing: Pricing, id: ProductId, byok: string, t: { from: string; perMonth: string; quote: string; byQuote: string; plans: Record<string, string> }) {
  const price = productPrices(pricing)[id]
  if (price.kind === 'from') return `${t.from} ${formatUsd(price.from)}`
  if (price.kind === 'plans' && price.byQuote) {
    const plan = price.plans[0]!
    return `${t.from} ${formatUsd(plan.setup)} + ${formatUsd(plan.monthly)}${t.perMonth} (${formatUsd(plan.byokMonthly ?? plan.monthly)}${t.perMonth} ${byok}); ${t.byQuote}`
  }
  if (price.kind === 'plans') {
    return price.plans
      .map((p) => `${t.plans[p.id]}: ${formatUsd(p.setup)} + ${formatUsd(p.monthly)}${t.perMonth}${p.byokMonthly ? ` (${formatUsd(p.byokMonthly)}${t.perMonth} ${byok})` : ''}`)
      .join('; ')
  }
  return t.quote
}

export async function GET() {
  const pricing = await getPricing()
  const blocks = (['en', 'ru'] as const).map((locale) => {
    const dict = getDict(locale)
    const t = dict.products
    const items = productIds.map((id) => {
      const item = t.items[id]
      return `- ${item.name} (${priceText(pricing, id, dict.subscription.own.toLowerCase(), t)}): ${item.benefit}. ${t.forWhom}: ${item.forWhom}. ${siteUrl}/${locale}${productPath(id)}`
    })
    // AI-team pages: the index, each department and each agent, one line each (subscription prices on the pages).
    const aiTeam = [
      `- ${dict.aiTeams.nav}: ${siteUrl}/${locale}${aiTeamsPath}`,
      ...aiTeamIds.map((id) => {
        const item = dict.aiTeams.items[id]
        return `- ${item.title}: ${item.promise} ${siteUrl}/${locale}${aiTeamPath(id)}`
      }),
      ...agentOffers.map((a) => {
        const item = dict.aiTeams.agents.items[a.id]
        return `- ${item.title}: ${item.promise} ${siteUrl}/${locale}${agentPath(a.id)}`
      }),
    ]
    const services = serviceSlugs.map(
      (slug) =>
        `- ${dict.services.items[slug].name} (${t.from} ${formatUsd(pricing.startingPrice[slug])}): ${siteUrl}/${locale}/services/${slug}`,
    )
    return [
      `## ${locale === 'en' ? 'Products' : 'Продукты'} (${siteUrl}/${locale})`,
      '',
      dict.meta.description,
      '',
      ...items,
      '',
      `## ${locale === 'en' ? 'Services' : 'Услуги'}`,
      '',
      ...services,
      '',
      `## ${dict.aiTeams.nav}`,
      '',
      ...aiTeam,
      '',
      `${dict.region.title}. ${dict.region.payTitle}: ${dict.region.pay.join(', ')}.`,
      '',
      dict.builder.payNote,
      '',
      guaranteeLine(dict, locale, pricing, 'llms'),
      '',
      dict.sla.llms,
      '',
      `${dict.nav.process}: ${siteUrl}/${locale}/how-we-work`,
      '',
      `${dict.security.title}: ${siteUrl}/${locale}/security`,
      '',
      `${dict.faqLinks['pay-how']}: ${siteUrl}/${locale}/pay-how`,
    ].join('\n')
  })
  const body = [
    '# Fir Tech',
    '',
    '> Fir Tech is a studio of AI agents. It builds AI booking assistants, AI lead managers, process automation, Telegram Mini Apps and websites for small business. Orders come from Tashkent, Almaty, Dushanbe, Bishkek and other cities of the CIS. Prices are in US dollars and fixed before the work starts. The site is in Russian and English.',
    '',
    `- Russian: ${siteUrl}/ru`,
    `- English: ${siteUrl}/en`,
    `- Project builder and estimate: ${siteUrl}/en/builder`,
    `- How we work: ${siteUrl}/en/how-we-work`,
    `- Security and data: ${siteUrl}/en/security`,
    `- Blog: ${siteUrl}/en/blog (RSS feeds: ${siteUrl}/rss-en.xml in English, ${siteUrl}/rss.xml in Russian)`,
    ...(telegramHandle ? [`- Telegram: ${telegramHandle}`] : []),
    '',
    ...blocks.flatMap((block) => [block, '']),
  ].join('\n')
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
