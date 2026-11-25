import type { Dict } from '@/content'
import { defaultPricing, type Pricing } from './pricing'

// The guarantee of the first stage in numbers (owner 2026-11-25). The copy in `dict.guarantee` carries tokens
// ({launchIn}, {pilotIn}, {replyShare}, {replyIn}); the numbers come from `pricing.guarantee` (editable in the Пульт).
type Guarantee = Pricing['guarantee']

function ruPlural(n: number, forms: [string, string, string]) {
  const m100 = n % 100
  const m10 = n % 10
  if (m100 >= 11 && m100 <= 14) return forms[2]
  if (m10 === 1) return forms[0]
  if (m10 >= 2 && m10 <= 4) return forms[1]
  return forms[2]
}

export function guaranteeTokens(locale: string, g: Guarantee = defaultPricing.guarantee): Record<string, string> {
  if (locale === 'en') {
    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
    return {
      launchIn: plural(g.launchDays, 'working day', 'working days'),
      pilotDays: String(g.pilotDays),
      pilotIn: plural(g.pilotDays, 'day', 'days'),
      replyShare: String(g.replyShare),
      replyIn: g.replyMinutes === 1 ? 'a minute' : `${g.replyMinutes} minutes`,
    }
  }
  return {
    launchIn: `${g.launchDays} ${ruPlural(g.launchDays, ['рабочий день', 'рабочих дня', 'рабочих дней'])}`,
    pilotDays: String(g.pilotDays),
    pilotIn: `${g.pilotDays} ${ruPlural(g.pilotDays, ['день', 'дня', 'дней'])}`,
    replyShare: String(g.replyShare),
    replyIn: g.replyMinutes === 1 ? 'минуту' : `${g.replyMinutes} ${ruPlural(g.replyMinutes, ['минуту', 'минуты', 'минут'])}`,
  }
}

// Fills the guarantee tokens in any text of the dictionary.
export function fillGuarantee(text: string, locale: string, pricing: Pricing = defaultPricing) {
  const tokens = guaranteeTokens(locale, pricing.guarantee)
  return text.replace(/\{(launchIn|pilotDays|pilotIn|replyShare|replyIn)\}/g, (_, key: string) => tokens[key] ?? '')
}

// What a product page block needs: the filled line and the pilot length.
export type GuaranteeCtx = { line: string; pilotDays: number; pilot: { title: string; text: string; cta: string } }
export function guaranteeCtx(dict: Dict, locale: string, pricing: Pricing = defaultPricing): GuaranteeCtx {
  return {
    line: guaranteeLine(dict, locale, pricing),
    pilotDays: pricing.guarantee.pilotDays,
    pilot: {
      title: fillGuarantee(dict.productPage.pilot.title, locale, pricing),
      text: fillGuarantee(dict.productPage.pilot.text, locale, pricing),
      cta: dict.productPage.pilot.cta,
    },
  }
}

export function guaranteeLine(
  dict: Dict,
  locale: string,
  pricing: Pricing = defaultPricing,
  kind: 'line' | 'short' | 'llms' = 'line',
) {
  return fillGuarantee(dict.guarantee[kind], locale, pricing)
}
