// Shell Dashboard (2026-11-27): view model of HQ's `GET /admin/today` (contract: shell-today contract section 1,
// agents docs/admin-crm-api.md «GET /admin/today») and the pure helpers the page draws with. No I/O, no React.
// Nothing from HQ is trusted: unknown kinds become `other`, bad numbers 0, bad dates null, strings are cut, links
// must stay inside /admin, and a block HQ marks `available:false` (or that is malformed) is `{ available: false }`
// for that block only. Numbers that are not there are never invented.

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : [])
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)
const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.slice(0, max) : '')
const oneOf = <T extends string>(v: unknown, all: readonly T[], fallback: T): T => ((all as readonly string[]).includes(v as string) ? (v as T) : fallback)

export const isoOrNull = (v: unknown): string | null => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null)
// Links stay inside the Shell: a path under /admin, no scheme, no protocol-relative URL, no control characters.
export const safeHref = (v: unknown): string | null => (typeof v === 'string' && /^\/admin(\/[\w\-./]*)?(\?[\w\-.=&%:]*)?$/.test(v) ? v : null)
// A POST target of an action: the HQ path of an existing endpoint, relative to /admin (`/admin/review/ap_12` or `review/ap_12`).
export const safePostPath = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const p = v.replace(/^\/admin\//, '').replace(/^\//, '')
  return /^review\/ap_\d{1,12}$/.test(p) ? p : null
}

export type Gone = { available: false }
export type Block<T> = Gone | ({ available: true } & T)
const gone: Gone = { available: false }

export const NIGHT_KINDS = ['lead', 'payment', 'content', 'alert', 'task'] as const
export type NightKind = (typeof NIGHT_KINDS)[number]
export const DECIDE_KINDS = ['document', 'reply', 'content', 'money', 'other'] as const
export type DecideKind = (typeof DECIDE_KINDS)[number]
export const TEAM_STATES = ['working', 'waiting', 'idle', 'blocked'] as const
export type TeamState = (typeof TEAM_STATES)[number]
export type AlertLevel = 'bad' | 'warn'

export type NightBlock = { text: string; items: { kind: NightKind; text: string; href: string | null }[] }
export type DecideAction = { id: string; label: string; kind: 'link' | 'post'; href: string | null; url: string | null; body: Rec | null; primary: boolean }
export type DecideItem = { id: string; kind: DecideKind; title: string; meta: string; ageMinutes: number; href: string | null; actions: DecideAction[] }
export type DecideBlock = { total: number; items: DecideItem[]; byKind: Record<DecideKind, number> }
export type HotLead = { id: string; name: string; what: string; amount: number; stage: string; stageLabel: string; ageMinutes: number; channel: string; next: { label: string; href: string | null } | null }
export type MoneyBlock = { paid7d: number; pending: number; overdue: number; overdueCount: number; perDay: { day: string; paid: number }[] }
export type FunnelBlock = { days: number; steps: { step: string; label: string; n: number }[] }
export type TeamBlock = { busy: number; total: number; items: { id: string; title: string; state: TeamState; doing: string; href: string | null }[]; spendToday: number; limitToday: number | null }
export type AlertsBlock = { items: { id: string; level: AlertLevel; text: string; href: string | null }[] }

export type TodayData = {
  generatedAt: string | null
  tz: string
  date: string | null
  night: Block<NightBlock>
  decide: Block<DecideBlock>
  hotLeads: Block<{ items: HotLead[] }>
  money: Block<MoneyBlock>
  funnel: Block<FunnelBlock>
  team: Block<TeamBlock>
  alerts: Block<AlertsBlock>
}

export const BLOCK_IDS = ['night', 'decide', 'hotLeads', 'money', 'funnel', 'team', 'alerts'] as const
export type BlockId = (typeof BLOCK_IDS)[number]

// One block: `available` must be exactly true and the builder must not throw, otherwise the block is gone.
function block<T>(raw: unknown, build: (r: Rec) => T): Block<T> {
  const r = rec(raw)
  if (r.available !== true) return gone
  try {
    return { available: true, ...build(r) }
  } catch {
    return gone
  }
}

const emptyKinds = (): Record<DecideKind, number> => ({ document: 0, reply: 0, content: 0, money: 0, other: 0 })

function action(raw: unknown): DecideAction | null {
  const r = rec(raw)
  const id = str(r.id, 24)
  const label = str(r.label, 40)
  if (!id || !label) return null
  if (r.kind === 'post') {
    const url = safePostPath(r.url)
    if (!url) return null
    return { id, label, kind: 'post', href: null, url, body: rec(r.body), primary: r.primary === true }
  }
  return { id, label, kind: 'link', href: safeHref(r.href), url: null, body: null, primary: r.primary === true }
}

export function normalizeToday(body: unknown): TodayData | null {
  const b = rec(body)
  if (b.ok === false) return null
  if (typeof b.generatedAt !== 'string' && !('decide' in b) && !('night' in b) && !('money' in b)) return null
  return {
    generatedAt: isoOrNull(b.generatedAt),
    tz: str(b.tz, 60) || 'UTC',
    date: typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null,
    night: block(b.night, (r) => ({
      text: str(r.text, 400),
      items: arr(r.items, 4).map((x) => {
        const i = rec(x)
        return { kind: oneOf(i.kind, NIGHT_KINDS, 'task'), text: str(i.text, 200), href: safeHref(i.href) }
      }).filter((i) => i.text),
    })),
    decide: block(b.decide, (r) => {
      const items: DecideItem[] = arr(r.items, 50).flatMap((x) => {
        const i = rec(x)
        const id = str(i.id, 40)
        if (!id) return []
        return [{
          id,
          kind: oneOf(i.kind, DECIDE_KINDS, 'other'),
          title: str(i.title, 200) || id,
          meta: str(i.meta, 120),
          ageMinutes: num(i.ageMinutes),
          href: safeHref(i.href),
          actions: arr(i.actions, 4).map(action).filter((a): a is DecideAction => a !== null),
        }]
      })
      const byKind = emptyKinds()
      const bk = rec(r.byKind)
      for (const k of DECIDE_KINDS) byKind[k] = num(bk[k])
      return { total: Math.max(num(r.total), items.length), items, byKind }
    }),
    hotLeads: block(b.hotLeads, (r) => ({
      items: arr(r.items, 5).flatMap((x): HotLead[] => {
        const i = rec(x)
        const id = str(i.id, 40)
        if (!id) return []
        const n = rec(i.next)
        const label = str(n.label, 40)
        return [{
          id,
          name: str(i.name, 80) || id,
          what: str(i.what, 120),
          amount: num(i.amount),
          stage: str(i.stage, 30),
          stageLabel: str(i.stageLabel, 40),
          ageMinutes: num(i.ageMinutes),
          channel: str(i.channel, 20),
          next: label ? { label, href: safeHref(n.href) } : null,
        }]
      }),
    })),
    money: block(b.money, (r) => ({
      paid7d: num(r.paid7d),
      pending: num(r.pending),
      overdue: num(r.overdue),
      overdueCount: Math.round(num(r.overdueCount)),
      perDay: arr(r.perDay, 7).map((x) => {
        const d = rec(x)
        return { day: typeof d.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.day) ? d.day : '', paid: num(d.paid) }
      }),
    })),
    funnel: block(b.funnel, (r) => ({
      days: Math.round(num(r.days)),
      steps: arr(r.steps, 6).map((x) => {
        const s = rec(x)
        return { step: str(s.step, 20), label: str(s.label, 40), n: Math.round(num(s.n)) }
      }).filter((s) => s.step),
    })),
    team: block(b.team, (r) => ({
      busy: Math.round(num(r.busy)),
      total: Math.round(num(r.total)),
      items: arr(r.items, 24).flatMap((x) => {
        const i = rec(x)
        const id = str(i.id, 40)
        return id ? [{ id, title: str(i.title, 60) || id, state: oneOf(i.state, TEAM_STATES, 'idle'), doing: str(i.doing, 120), href: safeHref(i.href) }] : []
      }),
      spendToday: num(r.spendToday),
      limitToday: typeof r.limitToday === 'number' && r.limitToday > 0 && Number.isFinite(r.limitToday) ? r.limitToday : null,
    })),
    alerts: block(b.alerts, (r) => ({
      items: arr(r.items, 10).flatMap((x) => {
        const i = rec(x)
        const text = str(i.text, 200)
        return text ? [{ id: str(i.id, 40) || text, level: (i.level === 'bad' ? 'bad' : 'warn') as AlertLevel, text, href: safeHref(i.href) }] : []
      }),
    })),
  }
}

// «Ждёт вас» after a decision: the row leaves, the total and the kind count go down by one (never below 0).
export function withoutDecision(d: TodayData, id: string): TodayData {
  if (!d.decide.available) return d
  const it = d.decide.items.find((x) => x.id === id)
  if (!it) return d
  const byKind = { ...d.decide.byKind, [it.kind]: Math.max(0, d.decide.byKind[it.kind] - 1) }
  return { ...d, decide: { ...d.decide, total: Math.max(0, d.decide.total - 1), items: d.decide.items.filter((x) => x.id !== id), byKind } }
}

// The number every surface shows for «waiting for the owner»: the Dashboard block, the menu badge, Approvals.
export const waitingTotal = (d: TodayData | null | undefined): number | null => (d && d.decide.available ? d.decide.total : null)

export const DECIDE_VISIBLE = 5

// «5 min», «3 h», «2 d»: compact age for rows (English units, content stays Russian elsewhere).
export function ageLabel(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m < 1) return 'now'
  if (m < 60) return `${m} min`
  if (m < 60 * 48) return `${Math.floor(m / 60)} h`
  return `${Math.floor(m / 1440)} d`
}

export const usd = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`

// Sparkline: seven bars, heights relative to the largest day (a zero day keeps a 1/16 stub so the row reads as a row).
export function sparkBars(perDay: { paid: number }[]): { ratio: number; last: boolean }[] {
  const max = Math.max(0, ...perDay.map((d) => d.paid))
  return perDay.map((d, i) => ({ ratio: max > 0 ? Math.max(d.paid / max, 0.06) : 0.06, last: i === perDay.length - 1 }))
}

// Funnel bars: width relative to the first step, never over 100 %, a step with 0 keeps a hairline.
export function funnelRows(steps: { step: string; label: string; n: number }[]): { step: string; label: string; n: number; width: number }[] {
  const top = steps[0]?.n ?? 0
  return steps.map((s) => ({ ...s, width: top > 0 ? Math.min(1, s.n / top) : 0 }))
}

export function spendRatio(spend: number, limit: number | null): number {
  return limit && limit > 0 ? Math.min(1, spend / limit) : 0
}

export function updatedLabel(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// «Friday, 27 November» in words from the HQ date (the company's day, not the browser's).
export function dateInWords(date: string | null): string {
  if (!date) return ''
  const d = new Date(`${date}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}
