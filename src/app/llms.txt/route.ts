import { getDict } from '@/content'
import { directionIds, directionPrices, type DirectionId } from '@/lib/directions'
import { formatUsd } from '@/lib/pricing'
import { siteUrl } from '@/lib/site'

// llms.txt: a plain description of the studio and its services for AI assistants. Built from the
// same dictionaries and price config as the page, so it never drifts from the site.
export const dynamic = 'force-static'

function priceLine(id: DirectionId, from: string, unit: Record<string, string>) {
  const price = directionPrices[id]
  const parts = [`${from} ${formatUsd(price.from)}${price.unit ? ` ${unit[price.unit]}` : ''}`]
  if (price.team) parts.push(`${formatUsd(price.team)} ${unit.team}`)
  if (price.supportMonthly) parts.push(`+ ${formatUsd(price.supportMonthly)} ${unit.support}`)
  return parts.join(', ')
}

export function GET() {
  const blocks = (['en', 'ru'] as const).map((locale) => {
    const dict = getDict(locale)
    const d = dict.directions
    const unit = { month: d.perMonth, person: d.perPerson, team: d.team, support: d.support }
    const items = directionIds.map((id) => {
      const item = d.items[id]
      return `- ${item.title} (${priceLine(id, d.from, unit)}): ${item.lines.join(' ')}\n  ${d.before}: ${item.before}. ${d.after}: ${item.after}.`
    })
    return [
      `## ${locale === 'en' ? 'Services' : 'Услуги'} (${siteUrl}/${locale})`,
      '',
      dict.meta.description,
      '',
      ...items,
      '',
      `${dict.region.title}. ${dict.region.payTitle}: ${dict.region.pay.join(', ')}.`,
    ].join('\n')
  })
  const body = [
    '# Fir Tech',
    '',
    '> Fir Tech builds AI agents, Telegram bots and websites for small business. Working with companies in Tashkent, Almaty, Dushanbe and Bishkek. Prices in US dollars, fixed before the work starts. The site is in Russian and English.',
    '',
    `- Russian: ${siteUrl}/ru`,
    `- English: ${siteUrl}/en`,
    `- Project builder and estimate: ${siteUrl}/en/builder`,
    '',
    ...blocks.flatMap((block) => [block, '']),
  ].join('\n')
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
