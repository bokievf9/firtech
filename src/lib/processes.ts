// HQ «Processes» (2026-11-23): view model of `GET /admin/processes` (agents `docs/admin-crm-api.md`,
// «Processes»): the process chains with the health of every step and the drill table. Pure: no I/O,
// no React. Nothing from HQ is trusted: unknown fields are dropped, missing ones get defaults.

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : [])
const str = (v: unknown, max = 300): string => (typeof v === 'string' ? v.slice(0, max) : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0)
const when = (v: unknown): string | null => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null)
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback

export const STEP_HEALTH = ['ok', 'warn', 'fail', 'idle'] as const
export type StepHealth = (typeof STEP_HEALTH)[number]
export const DRILL_ROW_STATES = ['ok', 'wait', 'fail', 'run'] as const
export type DrillRowState = (typeof DRILL_ROW_STATES)[number]
export const DRILL_ACTIONS = ['start', 'clear'] as const
export type DrillAction = (typeof DRILL_ACTIONS)[number]

export type ProcessStep = {
  id: string
  title: string
  hint: string
  health: StepHealth
  lastOkAt: string | null
  failures7d: number
  stuck: number
  lastFailure: { at: string | null; text: string } | null
}
export type ProcessChain = { id: string; title: string; health: StepHealth; steps: ProcessStep[] }
export type DrillRow = { worker: string; title: string; state: DrillRowState; ms: number; text: string }
export type DrillView = {
  state: 'none' | 'running' | 'done'
  startedAt: string | null
  elapsedMs: number
  openApprovals: number
  counts: Record<DrillRowState, number>
  rows: DrillRow[]
}
export type ProcessesView = {
  generatedAt: string | null
  windowDays: number
  counts: Record<StepHealth, number>
  chains: ProcessChain[]
  // null: HQ has no drill wired (the button is hidden).
  drill: DrillView | null
}

const worst = (list: readonly StepHealth[]): StepHealth =>
  list.includes('fail') ? 'fail' : list.includes('warn') ? 'warn' : list.length && list.every((h) => h === 'idle') ? 'idle' : list.length ? 'ok' : 'idle'

function normalizeDrill(raw: unknown): DrillView | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = rec(raw)
  const counts = rec(r.counts)
  return {
    state: oneOf(r.state, ['none', 'running', 'done'] as const, 'none'),
    startedAt: when(r.startedAt),
    elapsedMs: num(r.elapsedMs),
    openApprovals: num(r.openApprovals),
    counts: { ok: num(counts.ok), wait: num(counts.wait), fail: num(counts.fail), run: num(counts.run) },
    rows: arr(r.rows, 60).map((x) => {
      const o = rec(x)
      return { worker: str(o.worker, 60), title: str(o.title, 120), state: oneOf(o.state, DRILL_ROW_STATES, 'run'), ms: typeof o.ms === 'number' ? o.ms : -1, text: str(o.text, 200) }
    }),
  }
}

export function normalizeProcesses(body: unknown): ProcessesView | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const b = rec(body)
  if (!Array.isArray(b.chains)) return null
  const chains: ProcessChain[] = []
  for (const raw of arr(b.chains, 30)) {
    const c = rec(raw)
    const id = str(c.id, 40)
    if (!id) continue
    const steps: ProcessStep[] = []
    for (const s of arr(c.steps, 60)) {
      const o = rec(s)
      const sid = str(o.id, 40)
      if (!sid) continue
      const lf = o.lastFailure && typeof o.lastFailure === 'object' && !Array.isArray(o.lastFailure) ? rec(o.lastFailure) : null
      steps.push({
        id: sid,
        title: str(o.title, 120),
        hint: str(o.hint, 200),
        health: oneOf(o.health, STEP_HEALTH, 'idle'),
        lastOkAt: when(o.lastOkAt),
        failures7d: num(o.failures7d),
        stuck: num(o.stuck),
        lastFailure: lf ? { at: when(lf.at), text: str(lf.text, 200) } : null,
      })
    }
    chains.push({ id, title: str(c.title, 160), health: worst(steps.map((x) => x.health)), steps })
  }
  const counts: Record<StepHealth, number> = { ok: 0, warn: 0, fail: 0, idle: 0 }
  for (const c of chains) for (const s of c.steps) counts[s.health]++
  return { generatedAt: when(b.generatedAt), windowDays: num(b.windowDays) || 7, counts, chains, drill: normalizeDrill(b.drill) }
}

// «5 мин назад», «вчера» and so on; null (never) is «ещё не было».
export function sinceText(iso: string | null, now: number): string {
  if (!iso) return 'ещё не было'
  const ms = now - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 60_000) return 'только что'
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min} мин назад`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ч назад`
  const d = Math.floor(h / 24)
  return d === 1 ? 'вчера' : `${d} дн. назад`
}

// Drill rows grouped for the button state: the drill is running while any row still works.
export const drillBusy = (d: DrillView | null): boolean => !!d && d.state === 'running'
