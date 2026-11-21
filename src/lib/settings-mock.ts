// Development stand-in for HQ's `GET` and `PATCH /admin/settings` (contract `agents/docs/admin-crm-api.md` «Настройки»): the same
// shape, validation and `changed` list, kept in memory so a save behaves like HQ until the dev server restarts.
import { AUTOPILOT_MODES, BUDGET_DEPTS, NOTICE_ALERTS, NOTICE_TYPES } from './settings-hq'

type Reply = { ok: true; [k: string]: unknown } | { ok: false; error: string; [k: string]: unknown }
type Rec = Record<string, unknown>
const HM = /^([01]?\d|2[0-3]):[0-5]\d$/
const isRec = (v: unknown): v is Rec => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

export function createSettingsMock() {
  const s = {
    schedule: { summaryTime: '08:00', approvalTime: '09:00', digestDay: 1, digestTime: '08:30', quietHours: { from: '23:00', to: '08:00' } as { from: string; to: string } | null, ownerTz: 'Asia/Kuala_Lumpur', tz: 'Asia/Dushanbe' },
    notices: { types: Object.fromEntries(NOTICE_TYPES.map((k) => [k, true])), alerts: Object.fromEntries(NOTICE_ALERTS.map((k) => [k, true])), groupWindowMin: 5, skipWhileDesk: true },
    trust: {
      defaultThreshold: 20,
      kinds: [
        { kind: 'lead_reply', level: 1, locked: false, streak: 3, approvals: 24, threshold: 20, custom: false },
        { kind: 'content_item', level: 0, locked: false, streak: 7, approvals: 12, threshold: 20, custom: false },
        { kind: 'price_change', level: 0, locked: true, streak: 0, approvals: 2, threshold: 20, custom: false },
      ] as { kind: string; level: number; locked: boolean; streak: number; approvals: number; threshold: number; custom: boolean }[],
    },
    limits: { deptBudgetUsd: { marketing: 25, sales: 20, support: 15, production: 15, backoffice: 10, director: 5 } as Record<string, number>, clientLlmDailyCap: 300 },
    calls: { slotHours: ['11:00', '15:00'] as [string, string], durationMin: 30, bufferMin: 0 },
    kp: { validDays: 14, defaultLang: 'ru' },
    playground: { draftMsgsPerDay: 50, liveMsgsPerDay: 500 },
    service: { tgApprovalCards: false, tgGroupReports: false },
    autopilot: { leadManager: 'policy' },
  }
  const usage = { deptMonthUsd: { marketing: 4.2, sales: 1.1, support: 0, production: 0, backoffice: 0, director: 0.6 }, clientLlmToday: 41, monthStartedAt: '2026-10-31T19:00:00.000Z' }
  const restart = new Set<string>()
  const view = () => ({ settings: structuredClone(s), usage, restartRequired: restart.size > 0, restartKeys: [...restart] })

  const bad = (error: string, extra: Rec = {}): Reply => ({ ok: false, error, ...extra })

  // Walks the patch against the schema of HQ (strict keys, ranges) and collects [path, apply] pairs; null on an invalid body.
  function plan(body: Rec): { key: string; same: boolean; apply: () => void }[] | { invalid: string[] } | Reply {
    const out: { key: string; same: boolean; apply: () => void }[] = []
    const invalid: string[] = []
    const set = (obj: Rec, field: string, key: string, v: unknown, ok: boolean) => {
      if (!ok) return void invalid.push(key)
      out.push({ key, same: JSON.stringify(obj[field]) === JSON.stringify(v), apply: () => { obj[field] = v } })
    }
    const int = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
    const hm = (v: unknown) => typeof v === 'string' && HM.test(v)
    const zone = (v: unknown) => {
      if (typeof v !== 'string' || v.length > 64) return false
      try {
        new Intl.DateTimeFormat('en', { timeZone: v })
        return true
      } catch {
        return false
      }
    }
    const group = (name: string, allowed: Record<string, (v: unknown) => boolean>, target: Rec, input: unknown) => {
      if (!isRec(input)) return void invalid.push(name)
      for (const [k, v] of Object.entries(input)) {
        const check = allowed[k]
        if (!check) invalid.push(`${name}.${k}`)
        else if (k === 'quietHours') set(target, k, `${name}.${k}`, v, v === null || (isRec(v) && hm(v.from) && hm(v.to)))
        else set(target, k, `${name}.${k}`, v, check(v))
      }
    }
    const known = ['schedule', 'notices', 'trust', 'limits', 'calls', 'kp', 'playground', 'service', 'autopilot']
    for (const k of Object.keys(body)) if (!known.includes(k)) invalid.push(k)
    if (body.schedule !== undefined) group('schedule', { summaryTime: hm, approvalTime: hm, digestTime: hm, digestDay: (v) => int(v, 0, 6), quietHours: () => true, ownerTz: zone, tz: zone }, s.schedule, body.schedule)
    if (isRec(body.notices)) {
      for (const [k, v] of Object.entries(body.notices)) {
        if (k === 'types' || k === 'alerts') {
          const names = k === 'types' ? NOTICE_TYPES : NOTICE_ALERTS
          if (!isRec(v)) invalid.push(`notices.${k}`)
          else for (const [n, on] of Object.entries(v)) set(s.notices[k], n, `notices.${k}.${n}`, on, (names as readonly string[]).includes(n) && typeof on === 'boolean')
        } else if (k === 'groupWindowMin') set(s.notices, k, 'notices.groupWindowMin', v, int(v, 0, 120))
        else if (k === 'skipWhileDesk') set(s.notices, k, 'notices.skipWhileDesk', v, typeof v === 'boolean')
        else invalid.push(`notices.${k}`)
      }
    } else if (body.notices !== undefined) invalid.push('notices')
    if (isRec(body.trust)) {
      for (const [k, v] of Object.entries(body.trust)) {
        if (k === 'defaultThreshold') set(s.trust, k, 'trust.defaultThreshold', v, int(v, 1, 1000))
        else if ((k === 'thresholds' || k === 'levels') && isRec(v)) {
          for (const [kind, val] of Object.entries(v)) {
            const row = s.trust.kinds.find((x) => x.kind === kind)
            if (!row) return bad('unknown_kind', { kinds: s.trust.kinds.map((x) => x.kind) })
            if (k === 'levels') set(row, 'level', `trust.levels.${kind}`, val, val === 0 || val === 1)
            else {
              const next = val === null ? s.trust.defaultThreshold : val
              set(row, 'threshold', `trust.thresholds.${kind}`, next, val === null || int(val, 1, 1000))
              out.push({ key: '', same: true, apply: () => { row.custom = val !== null } })
            }
          }
        } else invalid.push(`trust.${k}`)
      }
    } else if (body.trust !== undefined) invalid.push('trust')
    if (isRec(body.limits)) {
      for (const [k, v] of Object.entries(body.limits)) {
        if (k === 'clientLlmDailyCap') set(s.limits, k, 'limits.clientLlmDailyCap', v, int(v, 0, 100000))
        else if (k === 'deptBudgetUsd' && isRec(v)) {
          for (const [d, usd] of Object.entries(v)) set(s.limits.deptBudgetUsd, d, `limits.deptBudgetUsd.${d}`, usd, (BUDGET_DEPTS as readonly string[]).includes(d) && typeof usd === 'number' && usd >= 0 && usd <= 100000)
        } else invalid.push(`limits.${k}`)
      }
    } else if (body.limits !== undefined) invalid.push('limits')
    if (body.calls !== undefined) group('calls', { slotHours: (v) => Array.isArray(v) && v.length === 2 && v.every(hm), durationMin: (v) => int(v, 5, 240), bufferMin: (v) => int(v, 0, 240) }, s.calls, body.calls)
    if (body.kp !== undefined) group('kp', { validDays: (v) => int(v, 1, 90), defaultLang: (v) => v === 'ru' || v === 'en' }, s.kp, body.kp)
    if (body.playground !== undefined) group('playground', { draftMsgsPerDay: (v) => int(v, 1, 2000), liveMsgsPerDay: (v) => int(v, 1, 2000) }, s.playground, body.playground)
    if (body.service !== undefined) {
      group('service', { tgApprovalCards: (v) => typeof v === 'boolean', tgGroupReports: (v) => typeof v === 'boolean' }, s.service, body.service)
      for (const o of out) if (o.key.startsWith('service.') && !o.same) restart.add(o.key)
    }
    if (body.autopilot !== undefined) group('autopilot', { leadManager: (v) => (AUTOPILOT_MODES as readonly string[]).includes(v as string) }, s.autopilot, body.autopilot)
    return invalid.length ? { invalid } : out
  }

  return function handle(method: string, seg: string[], body: Rec): Reply | null {
    if (seg.length !== 1 || seg[0] !== 'settings') return null
    if (method === 'GET') return { ok: true, ...view() }
    if (method !== 'PATCH') return null
    const p = plan(body)
    if (!Array.isArray(p)) return 'invalid' in p ? bad('invalid', { fields: p.invalid }) : (p as Reply)
    const changed = p.filter((x) => x.key && !x.same).map((x) => x.key)
    for (const x of p) x.apply()
    return { ok: true, changed, ...view() }
  }
}
