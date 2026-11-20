import { getDict } from '@/content'
import { formatUsd, type Pricing } from '@/lib/pricing'
import { getPricing } from '@/lib/pricing-store'
import { productIds, productPrices, type ProductId } from '@/lib/products'
import { serviceSlugs, siteUrl, telegramHandle } from '@/lib/site'

// llms.txt: a plain description of the studio and its products for AI assistants. Built from the
// same dictionaries and price config as the page, so it never drifts from the site.
// The prices are the live ones (owner edits in the Пульт), so it is rebuilt at most every 5 minutes.
export const revalidate = 300

function priceText(pricing: Pricing, id: ProductId, t: { from: string; perMonth: string; quote: string; plans: Record<string, string> }) {
  const price = productPrices(pricing)[id]
  if (price.kind === 'from') return `${t.from} ${formatUsd(price.from)}`
  if (price.kind === 'plans') {
    return price.plans
      .map((p) => `${t.plans[p.id]}: ${formatUsd(p.setup)} + ${formatUsd(p.monthly)}${t.perMonth}`)
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
      return `- ${item.name} (${priceText(pricing, id, t)}): ${item.benefit}. ${t.forWhom}: ${item.forWhom}.`
    })
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
      `${dict.region.title}. ${dict.region.payTitle}: ${dict.region.pay.join(', ')}.`,
      '',
      dict.builder.payNote,
      '',
      dict.guarantee.llms,
    ].join('\n')
  })
  const body = [
    '# Fir Tech',
    '',
    '> Fir Tech builds AI agents, Telegram bots and websites for small business. Taking orders from Tashkent, Almaty, Dushanbe, Bishkek and other cities of the CIS. Prices in US dollars, fixed before the work starts. The site is in Russian and English.',
    '',
    `- Russian: ${siteUrl}/ru`,
    `- English: ${siteUrl}/en`,
    `- Project builder and estimate: ${siteUrl}/en/builder`,
    `- Blog: ${siteUrl}/en/blog (RSS feed with the Russian articles: ${siteUrl}/rss.xml)`,
    ...(telegramHandle ? [`- Telegram: ${telegramHandle}`] : []),
    '',
    ...blocks.flatMap((block) => [block, '']),
  ].join('\n')
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
