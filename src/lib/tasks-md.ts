import type { ProjectId, Task, TaskPriority, TaskStatus } from './pulse-types'

// TASKS.md <-> panel tasks. Pure text logic (no server-only import) so scripts and tests share it.
// A task is a line "- [ ] title" or "- [x] title (date)" plus indented continuation lines (the
// notes). The caption above it ("Ждут решения владельца:", "Идеи на потом:", "Instagram...:") sets
// status, priority and project; the "## " section sets the project otherwise.

export const sectionNames = {
  firtech: 'Fir Tech (firtech.pro)',
  vibely: 'Vibely (vibelydate.com)',
  tools: 'Инструменты на Mac',
} as const

const sectionOf = (heading: string): 'firtech' | 'vibely' | 'tools' | null => {
  if (heading.startsWith('Fir Tech')) return 'firtech'
  if (heading.startsWith('Vibely')) return 'vibely'
  if (heading.startsWith('Инструменты')) return 'tools'
  return null
}

export const normKey = (title: string) =>
  title.replaceAll('`', '').replace(/\s+/g, ' ').trim().toLowerCase()
const squash = (text: string) => text.replace(/\s+/g, ' ').trim()

export type MdBlock = {
  start: number // first line index
  end: number // exclusive
  section: 'firtech' | 'vibely' | 'tools'
  project: ProjectId
  status: TaskStatus // from the checkbox and caption
  priority: TaskPriority
  due: string | null
  done: boolean
  doneDate: string | null
  title: string
  notes: string
  key: string
}

const DATE_TAIL = /\s*\((\d{4}-\d{2}-\d{2})\)\s*$/
// A caption such as (2026-02-30) must not stop the whole import: an impossible date is just no date.
const realDate = (value: string | undefined | null) => {
  if (!value) return null
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value) ? value : null
}

export function parseTasksMd(text: string): MdBlock[] {
  const lines = text.split('\n')
  const blocks: MdBlock[] = []
  let section: MdBlock['section'] | null = null
  let caption = {
    status: 'todo' as TaskStatus,
    priority: 'normal' as TaskPriority,
    project: null as ProjectId | null,
    due: null as string | null,
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (/^#{1,2} /.test(line)) {
      section = line.startsWith('## ') ? sectionOf(line.slice(3)) : null
      caption = { status: 'todo', priority: 'normal', project: null, due: null }
      continue
    }
    const item = line.match(/^- \[( |x|X)\] (.*)$/)
    if (!item) {
      if (/^\S.*:$/.test(line) && !line.startsWith('- ')) {
        caption = {
          status: /^(Ждут решения|Нужен вход)/.test(line) ? 'blocked' : 'todo',
          priority: /^Идеи на потом/.test(line) ? 'low' : 'normal',
          project: /^Instagram/.test(line) ? 'instagram' : null,
          due: realDate(line.match(/\((\d{4}-\d{2}-\d{2})\)/)?.[1]),
        }
      }
      continue
    }
    let end = i + 1
    while (end < lines.length && /^\s{2,}\S/.test(lines[end] ?? '')) end++
    if (!section) {
      i = end - 1
      continue
    }
    const done = item[1] !== ' '
    const parts = [item[2] ?? '', ...lines.slice(i + 1, end).map((l) => l.trim())]
    let doneDate: string | null = null
    if (done) {
      const last = parts[parts.length - 1] ?? ''
      doneDate = realDate(last.match(DATE_TAIL)?.[1])
      parts[parts.length - 1] = last.replace(DATE_TAIL, '')
    }
    const title = squash(parts[0] ?? '').slice(0, 200)
    blocks.push({
      start: i,
      end,
      section,
      project: caption.project ?? section,
      status: done ? 'done' : caption.status,
      priority: caption.priority,
      due: caption.due,
      done,
      doneDate,
      title,
      notes: squash(parts.slice(1).join(' ')).slice(0, 2000),
      key: normKey(title),
    })
    i = end - 1
  }
  return blocks.filter((b) => b.title)
}

// Dushanbe is UTC+5: the date the owner saw when the task was closed.
const doneDateOf = (iso: string | null) =>
  new Date((iso ? Date.parse(iso) : Date.now()) + 5 * 3_600_000).toISOString().slice(0, 10)

function wrap(text: string, width = 92) {
  const out: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    if (line && line.length + 1 + word.length > width) {
      out.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  if (line) out.push(line)
  return out
}

export function formatBlock(
  task: Pick<Task, 'title' | 'notes' | 'status' | 'doneAt'>,
  doneDate?: string | null,
) {
  const done = task.status === 'done'
  const lines = [`- [${done ? 'x' : ' '}] ${squash(task.title)}`]
  if (task.notes) lines.push(...wrap(squash(task.notes)).map((l) => `      ${l}`))
  if (done) lines[lines.length - 1] += ` (${doneDate ?? doneDateOf(task.doneAt)})`
  return lines
}

const captionFor = (task: Task) =>
  task.status === 'blocked'
    ? 'Ждут решения владельца:'
    : task.priority === 'low'
      ? 'Идеи на потом:'
      : task.project === 'instagram'
        ? 'Instagram:'
        : 'Из панели:'

export type ExportPlan = {
  text: string
  ids: Record<string, string> // key of each line in the new text -> task id
  updated: number
  removed: number
  added: number
}

// Rewrites only task lines: unchanged tasks keep their exact original lines, changed ones are
// regenerated, tasks deleted in the panel are dropped, new ones are appended after the last task
// of their section under a caption that the import reads back.
export function planExport(text: string, tasks: Task[], known: Record<string, string>): ExportPlan {
  const lines = text.split('\n')
  const blocks = parseTasksMd(text)
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const used = new Set<string>()
  const plan: ExportPlan = { text, ids: {}, updated: 0, removed: 0, added: 0 }
  const edits: { at: number; remove: number; insert: string[] }[] = []

  for (const block of blocks) {
    const claimed = (t: Task | undefined) => (t && !used.has(t.id) ? t : undefined)
    const task =
      claimed(byId.get(known[block.key] ?? '')) ??
      claimed(tasks.find((t) => normKey(t.title) === block.key))
    if (!task || task.project !== block.project) {
      edits.push({ at: block.start, remove: block.end - block.start, insert: [] })
      plan.removed += 1
      continue
    }
    used.add(task.id)
    plan.ids[normKey(task.title)] = task.id
    const same =
      (task.status === 'done') === block.done &&
      squash(task.title) === block.title &&
      squash(task.notes) === block.notes
    if (same) continue
    edits.push({
      at: block.start,
      remove: block.end - block.start,
      insert: formatBlock(task, block.done ? block.doneDate : null),
    })
    plan.updated += 1
  }

  const fresh = tasks.filter((t) => !used.has(t.id))
  const sections = Object.keys(sectionNames) as (keyof typeof sectionNames)[]
  const tail: string[] = []
  for (const section of sections) {
    const mine = fresh.filter(
      (t) => (t.project === 'instagram' ? 'firtech' : t.project) === section,
    )
    if (!mine.length) continue
    const added: string[] = []
    for (const caption of [...new Set(mine.map(captionFor))]) {
      added.push('', caption)
      for (const task of mine.filter((t) => captionFor(t) === caption)) {
        added.push(...formatBlock(task))
        plan.ids[normKey(task.title)] = task.id
      }
    }
    plan.added += mine.length
    const own = blocks.filter((b) => b.section === section)
    const last = own[own.length - 1]
    if (last) edits.push({ at: last.end, remove: 0, insert: added })
    else {
      const heading = lines.findIndex(
        (l) =>
          l === `## ${sectionNames[section]}` ||
          (l.startsWith('## ') && sectionOf(l.slice(3)) === section),
      )
      if (heading >= 0) {
        let end = heading + 1
        while (end < lines.length && !/^#{1,2} /.test(lines[end] ?? '')) end++
        while (end > heading + 1 && !(lines[end - 1] ?? '').trim()) end--
        edits.push({ at: end, remove: 0, insert: added })
      } else tail.push('', `## ${sectionNames[section]}`, ...added.slice(1))
    }
  }

  edits.sort((a, b) => b.at - a.at)
  for (const edit of edits) lines.splice(edit.at, edit.remove, ...edit.insert)
  while (tail.length && lines.length && !(lines[lines.length - 1] ?? '').trim()) lines.pop()
  if (tail.length) lines.push(...tail, '')
  plan.text = lines.join('\n')
  return plan
}
