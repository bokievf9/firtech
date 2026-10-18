import { z } from 'zod'
import { projectIds, type IgItem, type NewTask, type Task, type TaskPatch } from './pulse-types'

// What Echo (the owner's assistant) may DO, not only say. Pure and testable: the stores are
// injected, nothing here touches the disk or the network. Rules enforced here, on the server:
//  - every input is validated with zod; a bad input goes back to the model as an error result;
//  - delete_task needs two steps and the model cannot confirm by itself (see Confirmations);
//  - results carry task titles and numbers only, never a lead's name, contact or text.

export const periods = ['today', 'week', 'month'] as const
export type Period = (typeof periods)[number]

export type EchoStores = {
  listTasks: () => Promise<Task[]>
  createTask: (input: NewTask) => Promise<Task>
  updateTask: (id: string, patch: TaskPatch) => Promise<Task | null>
  deleteTask: (id: string) => Promise<boolean>
  listIgItems: () => Promise<IgItem[]>
  // Counts only. The route builds this from the lead store; no lead object crosses this line.
  leadCounts: () => Promise<Record<Period, number>>
}

// ---- Two-step deletion -------------------------------------------------------------------------

const YES_WORDS = new Set([
  'да',
  'подтверждаю',
  'удаляй',
  'удали',
  'конечно',
  'точно',
  'сэр',
  'эхо',
  'пожалуйста',
])
const YES_KEYS = ['да', 'подтверждаю', 'удаляй']

// The owner's message counts as a confirmation only when it is short and made of agreeing words.
// "да, но сначала покажи" or "не удаляй" are not a yes.
export function isExplicitYes(text: string) {
  const words = text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length || words.length > 4) return false
  return words.every((w) => YES_WORDS.has(w)) && words.some((w) => YES_KEYS.includes(w))
}

type Pending = { id: string; title: string; seq: number; at: number }
export type Request = {
  seq: number
  confirmed: boolean
  approvedId: string | null
  used: boolean
  proposed: boolean
  now: number
}
const PENDING_TTL_MS = 5 * 60_000

// Pending deletions per session. A request calls begin() with the owner's message first:
// a deletion proceeds only if it was proposed in an EARLIER request of this session and this
// request's user message is an explicit yes. begin() turns that yes into ONE approved id for this
// request and clears the pending state, so one yes deletes at most the one task the owner was
// asked about, and the model's own tool calls can never create an approval.
export class Confirmations {
  private pending = new Map<string, Pending>()
  private seq = new Map<string, number>()

  begin(session: string, userText: string, now = Date.now()) {
    const seq = (this.seq.get(session) ?? 0) + 1
    this.seq.set(session, seq)
    const p = this.pending.get(session)
    const fresh = !!p && p.seq < seq && now - p.at < PENDING_TTL_MS
    const confirmed = fresh && isExplicitYes(userText)
    // Whatever the answer was, the question is used up: a yes approves exactly p.id, anything
    // else cancels it.
    if (p) this.pending.delete(session)
    return {
      seq,
      confirmed,
      approvedId: confirmed && p ? p.id : null,
      used: false,
      proposed: false,
      now,
    }
  }

  // At most one question per request, and none in a request that already carried an approval,
  // so the owner always sees which task a later "yes" refers to.
  propose(session: string, id: string, title: string, request: Request) {
    if (request.proposed || request.used || request.approvedId) return false
    request.proposed = true
    this.pending.set(session, { id, title, seq: request.seq, at: request.now })
    return true
  }

  // True once, for exactly the task the owner said yes to in this request.
  take(id: string, request: Request) {
    if (!request.approvedId || request.used || request.approvedId !== id) return false
    request.used = true
    return true
  }

  peek(session: string) {
    return this.pending.get(session) ?? null
  }

  reset() {
    this.pending.clear()
    this.seq.clear()
  }
}

// ---- Inputs ------------------------------------------------------------------------------------

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'due must be YYYY-MM-DD')
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) &&
      new Date(`${s}T00:00:00Z`).toISOString().startsWith(s),
    'not a real date',
  )
const project = z.enum(projectIds as [string, ...string[]]) as unknown as z.ZodType<Task['project']>
const status = z.enum(['todo', 'doing', 'blocked', 'done'])
const priority = z.enum(['high', 'normal', 'low'])
const target = {
  id: z.string().min(1).max(40).optional(),
  match: z.string().trim().min(2).max(200).optional(),
}
const needsTarget = (v: { id?: string; match?: string }) => !!v.id || !!v.match

const schemas = {
  add_task: z.object({
    project,
    title: z.string().trim().min(1).max(200),
    priority: priority.optional(),
    due: date.optional(),
    notes: z.string().max(2000).optional(),
  }),
  update_task: z
    .object({
      ...target,
      status: status.optional(),
      priority: priority.optional(),
      due: date.nullable().optional(),
      notes: z.string().max(2000).optional(),
    })
    .refine(needsTarget, 'give id or match')
    .refine(
      (v) => v.status || v.priority || v.due !== undefined || v.notes !== undefined,
      'nothing to change',
    ),
  list_tasks: z.object({ project: project.optional(), status: status.optional() }),
  delete_task: z.object(target).refine(needsTarget, 'give id or match'),
  lead_counts: z.object({ period: z.enum(periods) }),
  blocked_on_owner: z.object({}),
  instagram_today: z.object({}),
}
export type ToolName = keyof typeof schemas
export const toolNames = Object.keys(schemas) as ToolName[]

// Plain JSON Schema for the API (kept by hand: stable bytes, so the prompt cache survives).
const idProps = {
  id: { type: 'string', description: 'Task id like t1abc, from list_tasks.' },
  match: { type: 'string', description: 'Part of the task title, when the id is not known.' },
}
export const toolDefinitions = [
  {
    name: 'add_task',
    description:
      "Add a task to the owner's list. Use when the owner asks to remember, add or plan something. projects: firtech, vibely, tools, instagram.",
    input_schema: {
      type: 'object',
      properties: {
        project: { type: 'string', enum: [...projectIds] },
        title: { type: 'string', description: 'Short task title, up to 200 characters.' },
        priority: { type: 'string', enum: ['high', 'normal', 'low'] },
        due: { type: 'string', description: 'Date YYYY-MM-DD.' },
        notes: { type: 'string' },
      },
      required: ['project', 'title'],
    },
  },
  {
    name: 'update_task',
    description:
      'Change a task: status (todo, doing, blocked = waits for the owner, done), priority, due date (null clears) or notes. Find it by id or by part of the title.',
    input_schema: {
      type: 'object',
      properties: {
        ...idProps,
        status: { type: 'string', enum: ['todo', 'doing', 'blocked', 'done'] },
        priority: { type: 'string', enum: ['high', 'normal', 'low'] },
        due: { type: ['string', 'null'], description: 'Date YYYY-MM-DD or null.' },
        notes: { type: 'string' },
      },
    },
  },
  {
    name: 'list_tasks',
    description: 'List tasks (id, title, status, priority, due). Filter by project and/or status.',
    input_schema: {
      type: 'object',
      properties: {
        project: { type: 'string', enum: [...projectIds] },
        status: { type: 'string', enum: ['todo', 'doing', 'blocked', 'done'] },
      },
    },
  },
  {
    name: 'delete_task',
    description:
      'Delete a task. Two steps: the first call only asks for confirmation (needs_confirmation). Then ask the owner in words "удалить задачу ...?" and stop. Only if the owner\'s next message is an explicit yes, call delete_task again with the same id. You cannot confirm yourself.',
    input_schema: { type: 'object', properties: { ...idProps } },
  },
  {
    name: 'lead_counts',
    description:
      'Number of new leads for a period. Numbers only; names and contacts are never available.',
    input_schema: {
      type: 'object',
      properties: { period: { type: 'string', enum: [...periods] } },
      required: ['period'],
    },
  },
  {
    name: 'blocked_on_owner',
    description: "Tasks in status blocked, i.e. waiting for the owner's decision or action.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'instagram_today',
    description:
      "Today's Instagram plan (Dushanbe date): what is scheduled and whether it is published.",
    input_schema: { type: 'object', properties: {} },
  },
] as const

// ---- Execution ---------------------------------------------------------------------------------

export type ToolOutcome = {
  content: string // JSON for the tool_result
  isError: boolean
  act?: string // short Russian line for the owner's chip, set when something changed
}

const out = (value: unknown, act?: string): ToolOutcome => ({
  content: JSON.stringify(value),
  isError: false,
  act,
})
const err = (message: string, extra: Record<string, unknown> = {}): ToolOutcome => ({
  content: JSON.stringify({ error: message, ...extra }),
  isError: true,
})

// Chip text goes into a [[act:...]] marker, so it must not contain bracket pairs or newlines.
export const chip = (text: string) =>
  text
    .replace(/[\[\]\n\r]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)

const brief = (t: Task) => ({
  id: t.id,
  project: t.project,
  title: t.title,
  status: t.status,
  priority: t.priority,
  due: t.due,
})

export const dushanbeDay = (now: number) => new Date(now + 5 * 3_600_000).toISOString().slice(0, 10)

export type ToolContext = {
  stores: EchoStores
  confirmations: Confirmations
  session: string
  request: Request
}

async function resolve(ctx: ToolContext, input: { id?: string; match?: string }) {
  const all = await ctx.stores.listTasks()
  if (input.id) {
    const hit = all.find((t) => t.id === input.id)
    return hit ? { task: hit } : { error: err('task not found', { id: input.id }) }
  }
  const needle = (input.match ?? '').toLowerCase()
  const hits = all.filter((t) => t.title.toLowerCase().includes(needle))
  if (hits.length === 1) return { task: hits[0]! }
  if (!hits.length) return { error: err('no task matches', { match: input.match }) }
  return { error: err('several tasks match, use id', { candidates: hits.slice(0, 6).map(brief) }) }
}

export async function runTool(
  ctx: ToolContext,
  name: string,
  rawInput: unknown,
): Promise<ToolOutcome> {
  if (!(name in schemas)) return err(`unknown tool ${name}`)
  const tool = name as ToolName
  const parsed = schemas[tool].safeParse(rawInput ?? {})
  if (!parsed.success) {
    return err('invalid input', {
      issues: parsed.error.issues
        .slice(0, 4)
        .map((i) => `${i.path.join('.') || 'input'}: ${i.message}`),
    })
  }
  const input = parsed.data as never
  const s = ctx.stores
  try {
    switch (tool) {
      case 'add_task': {
        const v = parsed.data as z.infer<typeof schemas.add_task>
        const task = await s.createTask({
          project: v.project,
          title: v.title,
          priority: v.priority ?? 'normal',
          due: v.due ?? null,
          notes: v.notes ?? '',
          status: 'todo',
          source: 'echo',
        })
        return out({ task: brief(task) }, chip(`Добавлена задача: ${task.title}`))
      }
      case 'update_task': {
        const v = parsed.data as z.infer<typeof schemas.update_task>
        const found = await resolve(ctx, v)
        if (found.error) return found.error
        const patch: TaskPatch = {}
        if (v.status) patch.status = v.status
        if (v.priority) patch.priority = v.priority
        if (v.due !== undefined) patch.due = v.due
        if (v.notes !== undefined) patch.notes = v.notes
        const task = await s.updateTask(found.task.id, patch)
        if (!task) return err('task not found', { id: found.task.id })
        const words: Record<string, string> = {
          todo: 'в работу',
          doing: 'в процессе',
          blocked: 'ждёт владельца',
          done: 'готово',
        }
        const what = v.status ? words[v.status] : 'изменена'
        return out({ task: brief(task) }, chip(`Задача ${what}: ${task.title}`))
      }
      case 'list_tasks': {
        const v = parsed.data as z.infer<typeof schemas.list_tasks>
        const all = (await s.listTasks()).filter(
          (t) => (!v.project || t.project === v.project) && (!v.status || t.status === v.status),
        )
        return out({ count: all.length, tasks: all.slice(0, 40).map(brief) })
      }
      case 'blocked_on_owner': {
        const all = (await s.listTasks()).filter((t) => t.status === 'blocked')
        return out({ count: all.length, tasks: all.slice(0, 40).map(brief) })
      }
      case 'delete_task': {
        const v = parsed.data as z.infer<typeof schemas.delete_task>
        const found = await resolve(ctx, v)
        if (found.error) return found.error
        const { task } = found
        if (!ctx.confirmations.take(task.id, ctx.request)) {
          if (!ctx.confirmations.propose(ctx.session, task.id, task.title, ctx.request)) {
            return err('one deletion per message: ask the owner and wait for the next message')
          }
          return out({
            needs_confirmation: true,
            id: task.id,
            title: task.title,
            instruction:
              'Ask the owner in words whether to delete it and stop. Do not call delete_task again until the owner answers yes.',
          })
        }
        const ok = await s.deleteTask(task.id)
        return ok
          ? out({ deleted: true, id: task.id }, chip(`Удалена задача: ${task.title}`))
          : err('task not found', { id: task.id })
      }
      case 'lead_counts': {
        const v = parsed.data as z.infer<typeof schemas.lead_counts>
        const counts = await s.leadCounts()
        return out({ period: v.period, count: counts[v.period] })
      }
      case 'instagram_today': {
        const day = dushanbeDay(ctx.request.now)
        const items = (await s.listIgItems()).filter((i) => i.date === day)
        return out({
          date: day,
          items: items.map((i) => ({
            time: i.time,
            kind: i.kind,
            title: i.title,
            published: i.published,
          })),
          published: items.filter((i) => i.published).length,
          total: items.length,
        })
      }
    }
  } catch (error) {
    console.error('[echo] tool failed', name, error instanceof Error ? error.message : error)
    return err('tool failed')
  }
  void input
  return err('unreachable')
}
