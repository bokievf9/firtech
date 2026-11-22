// Development stand-in for HQ's `GET` and `POST /admin/campaigns` and `GET /admin/campaigns/:id` (contract `agents/docs/admin-crm-api.md`,
// «Рассылки клиентам»). In memory: a new draft is `pending` and stays so (nothing is ever sent; the owner's «Одобрить» lives in Approvals).
import { campaignBody, type CampaignKind } from './campaigns-hq'

type Reply = { ok: true; [k: string]: unknown } | { ok: false; error: string }
type Rec = Record<string, unknown>

type Row = {
  id: number
  kind: CampaignKind
  subject: { ru: string; en: string }
  segment: { locale?: string; niche?: string; city?: string }
  status: 'pending' | 'sending' | 'sent' | 'rejected' | 'failed'
  taskId: number
  approvalId: number
  counts: Record<string, number>
  createdAt: string
  sentAt: string | null
  log: { clientId: number; outcome: string; at: string }[]
}

// The mock's clients with consent: (locale, niche, city) per kind.
const POOL: { locale: 'ru' | 'en'; niche: string; city: string; news: boolean; recommendation: boolean }[] = Array.from({ length: 24 }, (_, i) => ({
  locale: i % 4 === 0 ? 'en' : 'ru',
  niche: ['salon', 'clinic', 'shop'][i % 3]!,
  city: ['Dushanbe', 'Khujand', 'Tashkent'][i % 3]!,
  news: i % 3 !== 2,
  recommendation: i % 2 === 0,
}))

export function createCampaignsMock() {
  const day = 86_400_000
  const at = (now: number, ago: number) => new Date(now - ago).toISOString()
  let rows: Row[] | null = null
  const seed = (now: number): Row[] => [
    {
      id: 4, kind: 'news', subject: { ru: 'Новая сборка проекта', en: 'The new project builder' }, segment: { locale: 'ru' }, status: 'pending', taskId: 31, approvalId: 71, counts: {},
      createdAt: at(now, 2 * 3_600_000), sentAt: null, log: [],
    },
    {
      id: 3, kind: 'recommendation', subject: { ru: 'Подключите ИИ-администратора', en: 'Connect the AI receptionist' }, segment: { niche: 'salon' }, status: 'sent', taskId: 28, approvalId: 66,
      counts: { email: 6, no_consent: 1, no_unsubscribe: 0, off: 0, failed: 1, capped: 0, already: 0 }, createdAt: at(now, 2 * day), sentAt: at(now, 2 * day - 600_000),
      log: [{ clientId: 2, outcome: 'email', at: at(now, 2 * day - 600_000) }, { clientId: 5, outcome: 'email', at: at(now, 2 * day - 590_000) }, { clientId: 8, outcome: 'failed', at: at(now, 2 * day - 580_000) }, { clientId: 11, outcome: 'no_consent', at: at(now, 2 * day - 570_000) }],
    },
    {
      id: 2, kind: 'news', subject: { ru: 'Цены обновлены', en: 'Prices updated' }, segment: {}, status: 'rejected', taskId: 20, approvalId: 52, counts: {}, createdAt: at(now, 6 * day), sentAt: null, log: [],
    },
    {
      id: 1, kind: 'news', subject: { ru: 'Личный кабинет открыт', en: 'The cabinet is open' }, segment: { city: 'Dushanbe' }, status: 'failed', taskId: 12, approvalId: 40, counts: { failed: 3, no_unsubscribe: 2 },
      createdAt: at(now, 9 * day), sentAt: at(now, 9 * day - 300_000), log: [{ clientId: 1, outcome: 'no_unsubscribe', at: at(now, 9 * day - 300_000) }],
    },
  ]

  const view = (r: Row) => {
    const { log, ...rest } = Object.assign({}, r)
    void log
    return rest
  }

  return function handle(method: string, seg: string[], body: Rec, now: number): Reply | null {
    if (seg[0] !== 'campaigns') return null
    rows ??= seed(now)
    if (method === 'GET' && seg.length === 1) return { ok: true, items: rows.map(view) }
    if (method === 'GET' && seg.length === 2) {
      const r = rows.find((x) => String(x.id) === seg[1])
      return r ? { ok: true, campaign: view(r), log: r.log } : { ok: false, error: 'not_found' }
    }
    if (method === 'POST' && seg.length === 1) {
      const p = campaignBody.safeParse(body)
      if (!p.success) return { ok: false, error: 'invalid' }
      const s = p.data.segment ?? {}
      const audience = POOL.filter((c) => c[p.data.kind] && (!s.locale || c.locale === s.locale) && (!s.niche || c.niche === s.niche.toLowerCase()) && (!s.city || c.city.toLowerCase() === s.city.toLowerCase())).length
      if (audience === 0) return { ok: false, error: 'no_recipients' }
      const id = Math.max(0, ...rows.map((x) => x.id)) + 1
      const row: Row = {
        id, kind: p.data.kind, subject: { ru: p.data.subject.ru, en: p.data.subject.en ?? p.data.subject.ru }, segment: s, status: 'pending', taskId: 30 + id, approvalId: 70 + id,
        counts: {}, createdAt: new Date(now).toISOString(), sentAt: null, log: [],
      }
      rows.unshift(row)
      return { ok: true, campaign: view(row), audience }
    }
    return null
  }
}
