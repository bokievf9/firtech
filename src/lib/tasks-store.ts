import 'server-only'
import { z } from 'zod'
import { jsonFile } from './json-file'
import {
  type NewTask,
  type ProjectId,
  type Task,
  type TaskPatch,
  type TaskPriority,
  type TaskStatus,
} from './pulse-types'

// Live task list of the owner's panel: $DATA_DIR/tasks.json.

const projects = ['firtech', 'vibely', 'tools', 'instagram'] as const satisfies readonly ProjectId[]
const statuses = ['todo', 'doing', 'blocked', 'done'] as const satisfies readonly TaskStatus[]
const priorities = ['high', 'normal', 'low'] as const satisfies readonly TaskPriority[]

const due = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
  })
  .nullable()

const fields = {
  project: z.enum(projects),
  title: z.string().trim().min(1).max(200),
  status: z.enum(statuses),
  priority: z.enum(priorities),
  due,
  notes: z.string().trim().max(2000),
}

// Strict: unknown fields are rejected, so a typo never silently does nothing.
export const newTaskSchema = z
  .object({
    project: fields.project,
    title: fields.title,
    status: fields.status.optional(),
    priority: fields.priority.optional(),
    due: fields.due.optional(),
    notes: fields.notes.optional(),
    source: z.enum(['import', 'ui', 'echo']).optional(),
  })
  .strict()

export const taskPatchSchema = z
  .object({
    project: fields.project.optional(),
    title: fields.title.optional(),
    status: fields.status.optional(),
    priority: fields.priority.optional(),
    due: fields.due.optional(),
    notes: fields.notes.optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0)

type Db = { tasks: Task[] }
const file = jsonFile<Db>('tasks.json', () => ({ tasks: [] }))

const newId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export async function listTasks(): Promise<Task[]> {
  return (await file.load()).tasks
}

function build(input: NewTask, now: string, ids: Set<string>): Task {
  const parsed = newTaskSchema.parse(input)
  let id = newId()
  while (ids.has(id)) id = newId()
  const status = parsed.status ?? 'todo'
  return {
    id,
    project: parsed.project,
    title: parsed.title,
    status,
    priority: parsed.priority ?? 'normal',
    due: parsed.due ?? null,
    notes: parsed.notes ?? '',
    source: parsed.source ?? 'ui',
    createdAt: now,
    updatedAt: now,
    doneAt: status === 'done' ? now : null,
  }
}

export function createTask(input: NewTask): Promise<Task> {
  return file.serialize(async () => {
    const db = await file.load()
    const task = build(input, new Date().toISOString(), new Set(db.tasks.map((t) => t.id)))
    db.tasks.push(task)
    await file.save(db)
    return task
  })
}

function apply(task: Task, patch: TaskPatch, now: string) {
  const parsed = taskPatchSchema.parse(patch)
  Object.assign(task, parsed)
  if (parsed.status === 'done' && !task.doneAt) task.doneAt = now
  if (parsed.status && parsed.status !== 'done') task.doneAt = null
  task.updatedAt = now
}

export function updateTask(id: string, patch: TaskPatch): Promise<Task | null> {
  return file.serialize(async () => {
    const db = await file.load()
    const task = db.tasks.find((t) => t.id === id)
    if (!task) return null
    apply(task, patch, new Date().toISOString())
    await file.save(db)
    return task
  })
}

export function deleteTask(id: string): Promise<boolean> {
  return file.serialize(async () => {
    const db = await file.load()
    const next = db.tasks.filter((t) => t.id !== id)
    if (next.length === db.tasks.length) return false
    await file.save({ tasks: next })
    return true
  })
}

export type ImportEntry = {
  key: string // normalised title, how TASKS.md lines are matched
  task: NewTask
  done: boolean
  doneAt: string | null // ISO, from the "(date)" of a checked line
}
export type ImportResult = { added: number; closed: number; kept: number; ids: Record<string, string> }

// Idempotent import in one write: a task already in the store (by `known` id for its key, else by
// key of its title) is never overwritten, except that a line checked in the file closes it.
export function mergeTasks(
  entries: ImportEntry[],
  known: Record<string, string>,
  keyOf: (title: string) => string,
): Promise<ImportResult> {
  return file.serialize(async () => {
    const db = await file.load()
    const now = new Date().toISOString()
    const byId = new Map(db.tasks.map((t) => [t.id, t]))
    const byKey = new Map(db.tasks.map((t) => [keyOf(t.title), t]))
    const result: ImportResult = { added: 0, closed: 0, kept: 0, ids: {} }
    for (const entry of entries) {
      const existing = byId.get(known[entry.key] ?? '') ?? byKey.get(entry.key)
      if (existing) {
        if (entry.done && existing.status !== 'done') {
          existing.status = 'done'
          existing.doneAt = entry.doneAt ?? now
          existing.updatedAt = now
          result.closed += 1
        } else result.kept += 1
        result.ids[entry.key] = existing.id
        continue
      }
      const task = build({ ...entry.task, source: 'import' }, now, new Set(byId.keys()))
      if (entry.done) {
        task.status = 'done'
        task.doneAt = entry.doneAt ?? now
      }
      db.tasks.push(task)
      byId.set(task.id, task)
      byKey.set(entry.key, task)
      result.ids[entry.key] = task.id
      result.added += 1
    }
    if (result.added || result.closed) await file.save(db)
    return result
  })
}
