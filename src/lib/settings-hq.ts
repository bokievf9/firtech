// HQ «Settings» (2026-11-23, contract `agents/docs/admin-crm-api.md` «Настройки (2026-11-22)» plus `autopilot`): the view model of
// `GET /admin/settings`, the field catalogue the screen is built from and the PATCH body builder. Pure: no I/O, no React.
// Nothing from HQ is trusted: unknown fields are dropped, missing ones get defaults.

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const arr = (v: unknown, max = 200): unknown[] => (Array.isArray(v) ? v.slice(0, max) : [])
const str = (v: unknown, d = '', max = 64): string => (typeof v === 'string' ? v.slice(0, max) : d)
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const bool = (v: unknown, d = false): boolean => (typeof v === 'boolean' ? v : d)

export const AUTOPILOT_MODES = ['ask_me', 'policy', 'autopilot'] as const
export type AutopilotMode = (typeof AUTOPILOT_MODES)[number]
export const NOTICE_TYPES = ['client', 'lead', 'approval', 'payment', 'stage', 'signed', 'call', 'chat', 'human'] as const
export const NOTICE_ALERTS = ['lost_lead', 'email_failed', 'llm', 'budget', 'service', 'human'] as const
export const BUDGET_DEPTS = ['marketing', 'sales', 'support', 'production', 'backoffice', 'director'] as const
const HM = /^([01]?\d|2[0-3]):[0-5]\d$/

export type TrustKind = { kind: string; level: 0 | 1; locked: boolean; streak: number; approvals: number; threshold: number; custom: boolean }
export type Settings = {
  schedule: { summaryTime: string; approvalTime: string; digestDay: number; digestTime: string; quietHours: { from: string; to: string } | null; ownerTz: string; tz: string }
  notices: { types: Record<string, boolean>; alerts: Record<string, boolean>; groupWindowMin: number; skipWhileDesk: boolean }
  trust: { defaultThreshold: number; kinds: TrustKind[] }
  limits: { deptBudgetUsd: Record<string, number>; clientLlmDailyCap: number }
  calls: { slotHours: [string, string]; durationMin: number; bufferMin: number }
  kp: { validDays: number; defaultLang: 'ru' | 'en' }
  playground: { draftMsgsPerDay: number; liveMsgsPerDay: number }
  service: { tgApprovalCards: boolean; tgGroupReports: boolean }
  autopilot: { leadManager: AutopilotMode; support: AutopilotMode }
}
export type SettingsView = {
  settings: Settings
  usage: { deptMonthUsd: Record<string, number>; clientLlmToday: number; monthStartedAt: string | null }
  restartRequired: boolean
  restartKeys: string[]
}

const hm = (v: unknown, d: string) => (typeof v === 'string' && HM.test(v) ? v : d)
const flags = (v: unknown, keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, bool(rec(v)[k], true)]))
const money = (v: unknown, keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, num(rec(v)[k])]))

export function normalizeSettings(body: unknown): SettingsView | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const b = rec(body)
  const s = rec(b.settings)
  if (!Object.keys(s).length) return null
  const sc = rec(s.schedule)
  const q = rec(sc.quietHours)
  const n = rec(s.notices)
  const tr = rec(s.trust)
  const li = rec(s.limits)
  const ca = rec(s.calls)
  const slots = arr(ca.slotHours, 2)
  const kp = rec(s.kp)
  const pg = rec(s.playground)
  const sv = rec(s.service)
  const apRec = rec(s.autopilot)
  const apMode = (v: unknown): AutopilotMode => (typeof v === 'string' && (AUTOPILOT_MODES as readonly string[]).includes(v) ? (v as AutopilotMode) : 'policy')
  const us = rec(b.usage)
  const kinds: TrustKind[] = []
  for (const raw of arr(tr.kinds, 100)) {
    const r = rec(raw)
    const kind = str(r.kind, '', 60)
    if (!kind) continue
    kinds.push({ kind, level: r.level === 1 ? 1 : 0, locked: bool(r.locked), streak: num(r.streak), approvals: num(r.approvals), threshold: num(r.threshold), custom: bool(r.custom) })
  }
  return {
    settings: {
      schedule: {
        summaryTime: hm(sc.summaryTime, '08:00'), approvalTime: hm(sc.approvalTime, '09:00'), digestDay: Math.min(6, Math.max(0, Math.trunc(num(sc.digestDay, 1)))), digestTime: hm(sc.digestTime, '08:30'),
        quietHours: HM.test(str(q.from)) && HM.test(str(q.to)) ? { from: str(q.from), to: str(q.to) } : null,
        ownerTz: str(sc.ownerTz, 'UTC'), tz: str(sc.tz, 'UTC'),
      },
      notices: { types: flags(n.types, NOTICE_TYPES), alerts: flags(n.alerts, NOTICE_ALERTS), groupWindowMin: num(n.groupWindowMin, 5), skipWhileDesk: bool(n.skipWhileDesk, true) },
      trust: { defaultThreshold: num(tr.defaultThreshold, 20), kinds },
      limits: { deptBudgetUsd: money(li.deptBudgetUsd, BUDGET_DEPTS), clientLlmDailyCap: num(li.clientLlmDailyCap) },
      calls: { slotHours: [hm(slots[0], '11:00'), hm(slots[1], '15:00')], durationMin: num(ca.durationMin, 30), bufferMin: num(ca.bufferMin) },
      kp: { validDays: num(kp.validDays, 14), defaultLang: kp.defaultLang === 'en' ? 'en' : 'ru' },
      playground: { draftMsgsPerDay: num(pg.draftMsgsPerDay, 50), liveMsgsPerDay: num(pg.liveMsgsPerDay, 500) },
      service: { tgApprovalCards: bool(sv.tgApprovalCards), tgGroupReports: bool(sv.tgGroupReports) },
      autopilot: { leadManager: apMode(apRec.leadManager), support: apMode(apRec.support) },
    },
    usage: { deptMonthUsd: money(us.deptMonthUsd, BUDGET_DEPTS), clientLlmToday: num(us.clientLlmToday), monthStartedAt: typeof us.monthStartedAt === 'string' ? us.monthStartedAt : null },
    restartRequired: bool(b.restartRequired),
    restartKeys: arr(b.restartKeys, 20).filter((k): k is string => typeof k === 'string').map((k) => k.slice(0, 80)),
  }
}

// ---- The field catalogue: every editable value of the screen (one row each). Trust rows and the autopilot switch are separate.
export type FieldKind = 'time' | 'int' | 'usd' | 'bool' | 'tz' | 'select'
export type FieldSpec = { path: string; kind: FieldKind; min?: number; max?: number; options?: readonly { value: string; label: string }[] }
export type GroupId = 'schedule' | 'notices' | 'alerts' | 'limits' | 'calls' | 'kp' | 'playground' | 'service'

const f = (path: string, kind: FieldKind, extra: Partial<FieldSpec> = {}): FieldSpec => ({ path, kind, ...extra })
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

export const FIELD_GROUPS: Record<GroupId, FieldSpec[]> = {
  schedule: [
    f('schedule.summaryTime', 'time'), f('schedule.approvalTime', 'time'),
    f('schedule.digestDay', 'select', { options: DAYS.map((d, i) => ({ value: String(i), label: d })) }), f('schedule.digestTime', 'time'),
    f('schedule.quietHours.enabled', 'bool'), f('schedule.quietHours.from', 'time'), f('schedule.quietHours.to', 'time'),
    f('schedule.ownerTz', 'tz'), f('schedule.tz', 'tz'),
  ],
  notices: [...NOTICE_TYPES.map((k) => f(`notices.types.${k}`, 'bool')), f('notices.groupWindowMin', 'int', { min: 0, max: 120 }), f('notices.skipWhileDesk', 'bool')],
  alerts: NOTICE_ALERTS.map((k) => f(`notices.alerts.${k}`, 'bool')),
  limits: [...BUDGET_DEPTS.map((k) => f(`limits.deptBudgetUsd.${k}`, 'usd', { min: 0, max: 100000 })), f('limits.clientLlmDailyCap', 'int', { min: 0, max: 100000 })],
  calls: [f('calls.slotHours.0', 'time'), f('calls.slotHours.1', 'time'), f('calls.durationMin', 'int', { min: 5, max: 240 }), f('calls.bufferMin', 'int', { min: 0, max: 240 })],
  kp: [f('kp.validDays', 'int', { min: 1, max: 90 }), f('kp.defaultLang', 'select', { options: [{ value: 'ru', label: 'Russian' }, { value: 'en', label: 'English' }] })],
  playground: [f('playground.draftMsgsPerDay', 'int', { min: 1, max: 2000 }), f('playground.liveMsgsPerDay', 'int', { min: 1, max: 2000 })],
  service: [f('service.tgApprovalCards', 'bool'), f('service.tgGroupReports', 'bool')],
}
export const ALL_FIELDS: FieldSpec[] = Object.values(FIELD_GROUPS).flat()
export const fieldSpec = (path: string) => ALL_FIELDS.find((x) => x.path === path)

// The current value of a field path in a settings object (as the control shows it).
export function getValue(s: Settings, path: string): string | number | boolean {
  if (path === 'schedule.quietHours.enabled') return s.schedule.quietHours !== null
  if (path === 'schedule.quietHours.from') return s.schedule.quietHours?.from ?? '23:00'
  if (path === 'schedule.quietHours.to') return s.schedule.quietHours?.to ?? '08:00'
  if (path === 'calls.slotHours.0') return s.calls.slotHours[0]
  if (path === 'calls.slotHours.1') return s.calls.slotHours[1]
  let cur: unknown = s
  for (const k of path.split('.')) cur = rec(cur)[k]
  return typeof cur === 'string' || typeof cur === 'number' || typeof cur === 'boolean' ? cur : ''
}

// The PATCH body for one field (a tuple or the quiet-hours pair is sent whole, so HQ's strict schema accepts it).
export function buildPatch(s: Settings, path: string, value: string | number | boolean): Rec {
  const nest = (keys: string[], v: unknown): Rec => keys.reduceRight<unknown>((acc, k) => ({ [k]: acc }), v) as Rec
  if (path.startsWith('schedule.quietHours.')) {
    const cur = s.schedule.quietHours ?? { from: '23:00', to: '08:00' }
    const part = path.slice('schedule.quietHours.'.length)
    if (part === 'enabled') return { schedule: { quietHours: value ? cur : null } }
    return { schedule: { quietHours: { ...cur, [part]: value } } }
  }
  if (path.startsWith('calls.slotHours.')) {
    const slots: [string, string] = [...s.calls.slotHours]
    slots[path.endsWith('.0') ? 0 : 1] = String(value)
    return { calls: { slotHours: slots } }
  }
  return nest(path.split('.'), value)
}

// Client-side check before a save: the same ranges HQ enforces, so a typo shows at once. Null = fine.
export function validateField(spec: FieldSpec, value: string | number | boolean): string | null {
  if (spec.kind === 'time') return typeof value === 'string' && HM.test(value) ? null : 'time'
  if (spec.kind === 'int' || spec.kind === 'usd') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'number'
    if (spec.kind === 'int' && !Number.isInteger(value)) return 'integer'
    if (spec.min !== undefined && value < spec.min) return 'range'
    if (spec.max !== undefined && value > spec.max) return 'range'
    return null
  }
  if (spec.kind === 'tz') {
    if (typeof value !== 'string' || !value.trim()) return 'tz'
    try {
      new Intl.DateTimeFormat('en', { timeZone: value.trim() })
      return null
    } catch {
      return 'tz'
    }
  }
  return null
}

// Quiet hours for tz are written as typed; trust edits.
export function buildTrustPatch(kind: string, change: { level?: 0 | 1; threshold?: number | null }): Rec {
  return { trust: { ...(change.level !== undefined ? { levels: { [kind]: change.level } } : {}), ...(change.threshold !== undefined ? { thresholds: { [kind]: change.threshold } } : {}) } }
}

export const AUTOPILOT_LABELS: Record<AutopilotMode, string> = {
  ask_me: 'Зови меня при любом сомнении',
  policy: 'Зови меня по политике',
  autopilot: 'Автопилот: зови только если просят человека, злость, юридическое',
}

export type LogEntry = { at: number; key: string; old: string; next: string; source: string }

// `GET /admin/settings/log`: the journal of settings_log, newest first (values of settings only). Rows without a key are dropped.
export function normalizeLog(body: unknown): LogEntry[] | null {
  const items = rec(body).items
  if (!Array.isArray(items)) return null
  const out: LogEntry[] = []
  for (const raw of items.slice(0, 200)) {
    const r = rec(raw)
    const key = str(r.key, '', 120)
    const at = typeof r.at === 'string' ? Date.parse(r.at) : num(r.at, NaN)
    if (!key || !Number.isFinite(at)) continue
    out.push({ at, key, old: str(r.old, '', 200), next: str(r.new, '', 200), source: str(r.source, 'owner', 40) })
  }
  return out
}

export type SessionChange = { at: number; key: string; old: string; next: string }
const show = (v: unknown) => (v === null || v === undefined || v === '' ? '(none)' : String(v))

// Rows for the «changed in this session» journal: HQ answers with the changed keys, the old and new values come from the two views.
export function diffChanged(before: Settings, after: Settings, changed: string[], at: number): SessionChange[] {
  return changed.map((key) => {
    if (key.startsWith('trust.levels.')) {
      const k = key.slice('trust.levels.'.length)
      return { at, key, old: show(before.trust.kinds.find((x) => x.kind === k)?.level), next: show(after.trust.kinds.find((x) => x.kind === k)?.level) }
    }
    if (key.startsWith('trust.thresholds.')) {
      const k = key.slice('trust.thresholds.'.length)
      return { at, key, old: show(before.trust.kinds.find((x) => x.kind === k)?.threshold), next: show(after.trust.kinds.find((x) => x.kind === k)?.threshold) }
    }
    if (key === 'schedule.quietHours') {
      const q = (s: Settings) => (s.schedule.quietHours ? `${s.schedule.quietHours.from}-${s.schedule.quietHours.to}` : '')
      return { at, key, old: show(q(before)), next: show(q(after)) }
    }
    if (key === 'calls.slotHours') return { at, key, old: before.calls.slotHours.join(', '), next: after.calls.slotHours.join(', ') }
    const pick = (s: Settings) => {
      let cur: unknown = s
      for (const p of key.split('.')) cur = rec(cur)[p]
      return show(cur)
    }
    return { at, key, old: pick(before), next: pick(after) }
  })
}
