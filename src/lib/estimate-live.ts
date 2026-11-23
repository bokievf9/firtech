// The living estimate (builder v6 wave 2): the link to the estimate, the honest start line and the bodies of the
// «Прислать мне» and «Оплатить первый этап» leads. Pure, tested in tests/estimate-live.test.mjs.
import type { Dict } from '@/content'
import { agentSource } from './ai-teams'
import { encodeBuild, leadServiceOf, type Build } from './builder'
import { leadBriefOf } from './builder-personal'
import { estimateDoc, leadEstimateFields, leadPage } from './estimate-doc'
import type { LeadIntent } from './lead-intent'
import { startLine } from './estimate-start'
import { defaultPricing, type Pricing } from './pricing'
import { siteUrl } from './site'

// The permanent address of an estimate: it lives without an expiry because the build is the address itself.
export const estimateLink = (locale: string, build: Build, base: string = siteUrl) => `${base}/${locale}/builder/estimate?b=${encodeBuild(build)}`

export { startLine }

export type LeadWho = { name?: string; email?: string; telegram?: string } | null

// A contact typed in «Прислать мне»: an email, or a Telegram handle (with or without @). Null when it is neither.
export function parseContact(raw: string): string | null {
  const v = raw.trim()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return v.slice(0, 120)
  const handle = v.replace(/^(?:https?:\/\/)?t\.me\//i, '').replace(/^@/, '')
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(handle) ? `@${handle}` : null
}

// Body of POST /api/lead for the estimate page and the summary. `contact` is what the visitor typed (save-link) or
// the account's own contact (pay-first); an unknown contact stays a placeholder the schema accepts.
export function estimateLeadBody(
  intent: Extract<LeadIntent, 'save-link' | 'pay-first'>,
  build: Build,
  dict: Dict,
  locale: 'ru' | 'en',
  opts: { who?: LeadWho; contact?: string; pricing?: Pricing; source?: string; base?: string } = {},
) {
  const pricing = opts.pricing ?? defaultPricing
  const who = opts.who ?? null
  const fields = leadEstimateFields(build, dict, locale, pricing)
  const link = estimateDoc(build, dict, locale, pricing).link
  const own = who?.email ? [who.email, who.telegram].filter(Boolean).join(', ') : ''
  const contact = (opts.contact || own || '(estimate)').slice(0, 120)
  const brief = leadBriefOf(build)
  return {
    name: (who?.name || who?.email?.split('@')[0] || 'Client').slice(0, 80),
    contact: contact.length >= 3 ? contact : '(estimate)',
    service: leadServiceOf(build),
    ...fields,
    ...(brief ? { brief } : {}),
    source: opts.source ?? (build.agentBrief && build.agents?.[0] ? agentSource(build.agents[0]) : ''),
    locale,
    page: leadPage(link),
    intent,
    estimateUrl: estimateLink(locale, build, opts.base),
  }
}
