// HQ «Campaigns» (2026-11-23): news and recommendation mailings to cabinet clients. View models of
// `GET /admin/campaigns`, `GET /admin/campaigns/:id` and the strict body of `POST /admin/campaigns` (agents
// `docs/admin-crm-api.md`, «Рассылки клиентам»). No I/O, no React. Nothing from HQ is trusted: unknown fields are dropped.
// A mailing never leaves without the owner's «Одобрить» in Approvals, and only clients with the matching consent get it.
import { z } from 'zod'

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.slice(0, max) : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)
const iso = (v: unknown): string | null => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null)

export const CAMPAIGN_KINDS = ['news', 'recommendation'] as const
export type CampaignKind = (typeof CAMPAIGN_KINDS)[number]
export const CAMPAIGN_STATUSES = ['pending', 'sending', 'sent', 'rejected', 'failed'] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]
// Outcomes in `counts` and in the journal; unknown ones from HQ are kept under their own name.
export const OUTCOMES = ['email', 'no_consent', 'no_unsubscribe', 'off', 'failed', 'no_client', 'capped', 'already'] as const

const isKind = (v: unknown): v is CampaignKind => typeof v === 'string' && (CAMPAIGN_KINDS as readonly string[]).includes(v)
const isStatus = (v: unknown): v is CampaignStatus => typeof v === 'string' && (CAMPAIGN_STATUSES as readonly string[]).includes(v)

// Same limits as HQ's `campaignSchema`: subject up to 150 characters without control characters, text up to 8000.
const noControl = (v: string) => ![...v].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
const subject = z.string().trim().min(1).max(150).refine(noControl, 'control')
const text = z.string().trim().min(1).max(8000)
export const campaignBody = z
  .object({
    kind: z.enum(CAMPAIGN_KINDS),
    subject: z.object({ ru: subject, en: subject.optional() }).strict(),
    text: z.object({ ru: text, en: text.optional() }).strict(),
    segment: z
      .object({ locale: z.enum(['ru', 'en']).optional(), niche: z.string().trim().min(1).max(40).optional(), city: z.string().trim().min(1).max(80).optional() })
      .strict()
      .optional(),
  })
  .strict()
export type CampaignBody = z.infer<typeof campaignBody>

export type CampaignForm = { kind: CampaignKind; subjectRu: string; subjectEn: string; textRu: string; textEn: string; locale: '' | 'ru' | 'en'; niche: string; city: string }
export const emptyForm: CampaignForm = { kind: 'news', subjectRu: '', subjectEn: '', textRu: '', textEn: '', locale: '', niche: '', city: '' }

// The form to the body HQ takes: empty optional fields are left out, so the server never sees blanks.
export function formBody(f: CampaignForm): CampaignBody | null {
  const en = (a: string, b: string) => (b.trim() ? { ru: a, en: b } : { ru: a })
  const segment = {
    ...(f.locale ? { locale: f.locale } : {}),
    ...(f.niche.trim() ? { niche: f.niche } : {}),
    ...(f.city.trim() ? { city: f.city } : {}),
  }
  const p = campaignBody.safeParse({
    kind: f.kind,
    subject: en(f.subjectRu, f.subjectEn),
    text: en(f.textRu, f.textEn),
    ...(Object.keys(segment).length ? { segment } : {}),
  })
  return p.success ? p.data : null
}

export type CampaignSegment = { locale?: 'ru' | 'en'; niche?: string; city?: string }
export type Campaign = {
  id: number
  kind: CampaignKind
  subject: { ru: string; en: string }
  segment: CampaignSegment
  status: CampaignStatus
  taskId: number | null
  approvalId: string | null
  counts: Record<string, number>
  createdAt: string
  sentAt: string | null
}
export type CampaignLogRow = { clientId: number; outcome: string; at: string }

export function normalizeCampaign(raw: unknown): Campaign | null {
  const c = rec(raw)
  const id = typeof c.id === 'number' && Number.isInteger(c.id) && c.id > 0 ? c.id : null
  const createdAt = iso(c.createdAt)
  if (id === null || !isKind(c.kind) || !isStatus(c.status) || !createdAt) return null
  const subj = rec(c.subject)
  const seg = rec(c.segment)
  const segment: CampaignSegment = {}
  if (seg.locale === 'ru' || seg.locale === 'en') segment.locale = seg.locale
  if (str(seg.niche, 40)) segment.niche = str(seg.niche, 40)
  if (str(seg.city, 80)) segment.city = str(seg.city, 80)
  const counts: Record<string, number> = {}
  for (const [k, v] of Object.entries(rec(c.counts)).slice(0, 20)) if (/^[a-z_]{1,24}$/.test(k)) counts[k] = num(v)
  const approval = typeof c.approvalId === 'number' || typeof c.approvalId === 'string' ? String(c.approvalId).slice(0, 40) : null
  return {
    id,
    kind: c.kind,
    subject: { ru: str(subj.ru, 150), en: str(subj.en, 150) },
    segment,
    status: c.status,
    taskId: typeof c.taskId === 'number' ? c.taskId : null,
    approvalId: approval,
    counts,
    createdAt,
    sentAt: iso(c.sentAt),
  }
}

export function normalizeCampaigns(body: unknown): { items: Campaign[] } | null {
  const b = rec(body)
  if (!Array.isArray(b.items)) return null
  return { items: b.items.slice(0, 200).flatMap((x) => normalizeCampaign(x) ?? []) }
}

export function normalizeCampaignDetail(body: unknown): { campaign: Campaign; log: CampaignLogRow[] } | null {
  const b = rec(body)
  const campaign = normalizeCampaign(b.campaign)
  if (!campaign || !Array.isArray(b.log)) return null
  const log: CampaignLogRow[] = []
  for (const raw of b.log.slice(0, 2000)) {
    const r = rec(raw)
    const at = iso(r.at)
    if (typeof r.clientId !== 'number' || !Number.isInteger(r.clientId) || !at) continue
    log.push({ clientId: r.clientId, outcome: /^[a-z_]{1,24}$/.test(str(r.outcome, 24)) ? str(r.outcome, 24) : 'unknown', at })
  }
  return { campaign, log }
}

// The answer of `POST /admin/campaigns`: the draft and how many clients fit by consent and segment right now.
export function normalizeCreated(body: unknown): { campaign: Campaign; audience: number } | null {
  const b = rec(body)
  const campaign = normalizeCampaign(b.campaign)
  return campaign ? { campaign, audience: num(b.audience) } : null
}

export const campaignPath = (id: number) => `campaigns/${id}`

// Where the owner approves the draft: the card is in Approvals, tab Content.
export const APPROVAL_HREF = '/admin/approvals?tab=content'

export const countsTotal = (counts: Record<string, number>) => Object.values(counts).reduce((a, n) => a + n, 0)

// Counters worth showing in order, zero ones dropped; unknown outcomes follow.
export function countRows(counts: Record<string, number>): [string, number][] {
  const known = OUTCOMES.flatMap((k) => (counts[k] ? [[k, counts[k]!] as [string, number]] : []))
  const rest = Object.entries(counts).filter(([k, n]) => n > 0 && !(OUTCOMES as readonly string[]).includes(k))
  return [...known, ...rest]
}

export const isSegmentEmpty = (s: CampaignSegment) => !s.locale && !s.niche && !s.city
