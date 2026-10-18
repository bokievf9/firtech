import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { dataDir } from './store'
import { normKey, parseTasksMd, planExport } from './tasks-md'
import { listTasks, mergeTasks, type ImportEntry } from './tasks-store'

// Import and export between TASKS.md and the task store (run by scripts/tasks-import.mjs and
// scripts/tasks-export.mjs). After each run a small state file remembers the hash of TASKS.md and
// which task each line stands for, so a rename in the panel still finds its line and an edit of the
// file since the last sync is noticed before export overwrites it.

type State = { sha: string; ids: Record<string, string> }
const stateFile = () => path.join(dataDir(), 'tasks-md-state.json')
const sha = (text: string) => createHash('sha256').update(text).digest('hex')

async function readState(): Promise<State | null> {
  try {
    return JSON.parse(await readFile(stateFile(), 'utf8')) as State
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function writeAtomic(file: string, content: string) {
  await mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, content, { mode: 0o600 })
  await rename(tmp, file)
}

export async function importTasksMd(file: string) {
  const text = await readFile(file, 'utf8')
  const state = await readState()
  const entries: ImportEntry[] = parseTasksMd(text).map((b) => ({
    key: b.key,
    done: b.done,
    doneAt: b.doneDate ? `${b.doneDate}T00:00:00.000Z` : null,
    task: {
      project: b.project,
      title: b.title,
      status: b.status === 'done' ? 'todo' : b.status,
      priority: b.priority,
      due: b.due,
      notes: b.notes,
    },
  }))
  const result = await mergeTasks(entries, state?.ids ?? {}, normKey)
  await writeAtomic(stateFile(), JSON.stringify({ sha: sha(text), ids: result.ids }, null, 2))
  return { lines: entries.length, ...result }
}

export class DriftError extends Error {}

export async function exportTasksMd(file: string, { force = false } = {}) {
  const text = await readFile(file, 'utf8')
  const state = await readState()
  if (!force) {
    if (!state)
      throw new DriftError(
        'Ещё не было синхронизации. Сначала выполните tasks-import, либо --force.',
      )
    if (state.sha !== sha(text))
      throw new DriftError(
        'TASKS.md изменился после последней синхронизации. Выполните tasks-import, чтобы не потерять правки, либо --force.',
      )
  }
  const plan = planExport(text, await listTasks(), state?.ids ?? {})
  if (plan.text !== text) await writeAtomic(file, plan.text)
  await writeAtomic(stateFile(), JSON.stringify({ sha: sha(plan.text), ids: plan.ids }, null, 2))
  const { text: _text, ids: _ids, ...summary } = plan
  void _text
  void _ids
  return summary
}
