// HQ «Agents» (2026-11-23, contract `agents/docs/admin-crm-api.md` «Agents»): view models of the agent list and the agent card.
// Pure: no I/O, no React. Nothing from HQ is trusted: unknown fields are dropped, missing ones get defaults. No client texts here by
// contract (ids, counters, states); the only free text is the agent's own instructions and version notes.

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const arr = (v: unknown, max = 200): unknown[] => (Array.isArray(v) ? v.slice(0, max) : [])
const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.slice(0, max) : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const when = (v: unknown): string | null => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null)

export const AGENT_DEPT_ORDER = ['hq', 'marketing', 'sales', 'support', 'production', 'backoffice'] as const
export const MAX_INSTRUCTIONS = 20000
const AGENT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/
export const isAgentId = (v: unknown): v is string => typeof v === 'string' && AGENT_ID.test(v)

export type AgentRow = {
  id: string
  title: string
  gloss: string | null
  dept: string
  role: 'director' | 'head' | 'worker'
  status: 'active' | 'paused'
  trustLevel: number
  monthUsd: number
  openTasks: number
  instructionVersion: number
  hasFira: boolean
}
export type AgentDept = { id: string; budgetUsd: number; monthUsd: number }
export type AgentList = { departments: AgentDept[]; agents: AgentRow[] }

export type InstructionVersion = { version: number; actor: string; note: string; at: string | null; chars: number }
export type AgentCard = {
  agent: { id: string; title: string; gloss: string | null; dept: string; role: AgentRow['role']; bossId: string | null; status: AgentRow['status'] }
  instructions: { text: string; version: number; chars: number; maxChars: number; versions: InstructionVersion[] }
  trust: { level: number; kinds: { kind: string; level: number; locked: boolean; streak: number; threshold: number }[] }
  tools: { name: string; summary: string; configured: boolean; callsToday: number; errorsToday: number }[]
  budget: { dept: string; deptLimitUsd: number; deptMonthUsd: number; agentMonthUsd: number; agentTodayUsd: number; agentMonthCalls: number }
  fira: { pack: string; title: string | null; goal: string | null; tier: string | null; tools: string[]; duties: number; boundaries: number; handoff: number; error: string | null } | null
  history: {
    tasksByStatus: Record<string, number>
    decisionsByKind: Record<string, number>
    recentTasks: { id: number; status: string; at: string | null }[]
    recentDecisions: { approvalId: number | null; kind: string; decision: string; at: string | null }[]
  }
}

const role = (v: unknown): AgentRow['role'] => (v === 'director' || v === 'head' ? v : 'worker')
const status = (v: unknown): AgentRow['status'] => (v === 'paused' ? 'paused' : 'active')
const counts = (v: unknown): Record<string, number> =>
  Object.fromEntries(Object.entries(rec(v)).slice(0, 40).map(([k, n]) => [k.slice(0, 40), num(n)]))

export function normalizeAgentList(body: unknown): AgentList | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const b = body as Rec
  const agents: AgentRow[] = []
  for (const raw of arr(b.agents)) {
    const r = rec(raw)
    if (!isAgentId(r.id)) continue
    agents.push({
      id: r.id,
      title: str(r.title) || r.id,
      gloss: str(r.gloss) || null,
      dept: str(r.dept, 40) || 'hq',
      role: role(r.role),
      status: status(r.status),
      trustLevel: num(r.trustLevel),
      monthUsd: num(r.monthUsd),
      openTasks: Math.max(0, num(r.openTasks)),
      instructionVersion: Math.max(0, num(r.instructionVersion)),
      hasFira: r.hasFira === true,
    })
  }
  const departments = arr(b.departments, 20).map((raw) => {
    const r = rec(raw)
    return { id: str(r.id, 40), budgetUsd: num(r.budgetUsd), monthUsd: num(r.monthUsd) }
  })
  return { departments: departments.filter((d) => d.id), agents }
}

/** Agents grouped by department in the fixed order (unknown departments last), the head first inside a group. */
export function groupAgents(list: AgentList): { dept: AgentDept; agents: AgentRow[] }[] {
  const order = (d: string) => {
    const i = AGENT_DEPT_ORDER.indexOf(d as (typeof AGENT_DEPT_ORDER)[number])
    return i < 0 ? 99 : i
  }
  const rank = (a: AgentRow) => (a.role === 'director' ? 0 : a.role === 'head' ? 1 : 2)
  const ids = [...new Set(list.agents.map((a) => a.dept))].sort((a, b) => order(a) - order(b) || a.localeCompare(b))
  return ids.map((id) => ({
    dept: list.departments.find((d) => d.id === id) ?? { id, budgetUsd: 0, monthUsd: 0 },
    agents: list.agents.filter((a) => a.dept === id).sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title)),
  }))
}

export function normalizeAgentCard(body: unknown): AgentCard | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const b = body as Rec
  const a = rec(b.agent)
  if (!isAgentId(a.id)) return null
  const ins = rec(b.instructions)
  const budget = rec(b.budget)
  const hist = rec(b.history)
  const f = b.fira && typeof b.fira === 'object' ? rec(b.fira) : null
  return {
    agent: { id: a.id, title: str(a.title) || a.id, gloss: str(a.gloss) || null, dept: str(a.dept, 40) || 'hq', role: role(a.role), bossId: isAgentId(a.bossId) ? a.bossId : null, status: status(a.status) },
    instructions: {
      text: str(ins.text, MAX_INSTRUCTIONS),
      version: Math.max(0, num(ins.version)),
      chars: Math.max(0, num(ins.chars)),
      maxChars: num(ins.maxChars) || MAX_INSTRUCTIONS,
      versions: arr(ins.versions).map((raw) => {
        const r = rec(raw)
        return { version: num(r.version), actor: str(r.actor, 40), note: str(r.note, 200), at: when(r.at), chars: num(r.chars) }
      }),
    },
    trust: {
      level: num(rec(b.trust).level),
      kinds: arr(rec(b.trust).kinds).map((raw) => {
        const r = rec(raw)
        return { kind: str(r.kind, 80), level: num(r.level), locked: r.locked === true, streak: num(r.streak), threshold: num(r.threshold) }
      }),
    },
    tools: arr(b.tools, 100).map((raw) => {
      const r = rec(raw)
      return { name: str(r.name, 80), summary: str(r.summary, 200), configured: r.configured === true, callsToday: num(r.callsToday), errorsToday: num(r.errorsToday) }
    }),
    budget: {
      dept: str(budget.dept, 40),
      deptLimitUsd: num(budget.deptLimitUsd),
      deptMonthUsd: num(budget.deptMonthUsd),
      agentMonthUsd: num(budget.agentMonthUsd),
      agentTodayUsd: num(budget.agentTodayUsd),
      agentMonthCalls: num(budget.agentMonthCalls),
    },
    fira: f
      ? {
          pack: str(f.pack, 80),
          title: str(f.title) || null,
          goal: str(f.goal, 600) || null,
          tier: str(f.tier, 20) || null,
          tools: arr(f.tools, 40).map((t) => str(t, 80)).filter(Boolean),
          duties: num(f.duties),
          boundaries: num(f.boundaries),
          handoff: num(f.handoff),
          error: str(f.error, 120) || null,
        }
      : null,
    history: {
      tasksByStatus: counts(hist.tasksByStatus),
      decisionsByKind: counts(hist.decisionsByKind),
      recentTasks: arr(hist.recentTasks, 20).map((raw) => {
        const r = rec(raw)
        return { id: num(r.id), status: str(r.status, 20), at: when(r.at) }
      }),
      recentDecisions: arr(hist.recentDecisions, 20).map((raw) => {
        const r = rec(raw)
        return { approvalId: typeof r.approvalId === 'number' ? r.approvalId : null, kind: str(r.kind, 80), decision: str(r.decision, 20), at: when(r.at) }
      }),
    },
  }
}

/** Line-based diff of two texts for the version viewer: `+` added, `-` removed, ` ` same (a plain LCS, instructions are short). */
export function lineDiff(from: string, to: string): { op: ' ' | '+' | '-'; text: string }[] {
  const a = from.split('\n')
  const b = to.split('\n')
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
  const out: { op: ' ' | '+' | '-'; text: string }[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ op: ' ', text: a[i]! })
      i++
      j++
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) out.push({ op: '-', text: a[i++]! })
    else out.push({ op: '+', text: b[j++]! })
  }
  while (i < a.length) out.push({ op: '-', text: a[i++]! })
  while (j < b.length) out.push({ op: '+', text: b[j++]! })
  return out
}
