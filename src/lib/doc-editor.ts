import { editPayload, fieldsOf, type ReviewItem, type ReviewVersion } from './review'

// The full-screen document editor (review centre «E», back-office Documents): pure helpers. The
// component only wires them to a textarea. Nothing here touches the DOM, storage or the network.

// ---- which items open the editor ---------------------------------------------------------------------

// A text document: any editable item whose text is the `draft` (КП answer, договор, счёт, ответ...).
// Content items (reels, carousels) keep the side editor: they have several short fields, not a page.
export function documentField(item: ReviewItem): { key: 'draft'; value: string } | null {
  if (item.kind === 'content_item' || item.status !== 'pending') return null
  const f = fieldsOf(item).find((x) => x.key === 'draft' && x.editable)
  return f ? { key: 'draft', value: f.value } : null
}

export const versionText = (v: Pick<ReviewVersion, 'text'> | undefined): string => v?.text.draft ?? v?.text.body ?? ''

// The text v1 had: the snapshot before the owner's first edit (or the only version there is).
export const firstVersionText = (item: ReviewItem): string => {
  const first = [...item.versions].sort((a, b) => a.v - b.v)[0]
  return first ? versionText(first) : (item.text.draft ?? item.text.body ?? '')
}

// The body of the `edit` call that «Сохранить как версию» sends: the same shape as the side editor,
// null when nothing changed (HQ would answer 409 `not_applied`).
export function versionSavePayload(item: ReviewItem, value: string): { action: 'edit'; text: { draft: string } } | null {
  const p = editPayload(item, { draft: value })
  const draft = p?.text.draft
  return typeof draft === 'string' ? { action: 'edit', text: { draft } } : null
}

// HQ refuses a draft longer than this (400 invalid), so the editor stops before it.
export const DOC_MAX = 8000

// ---- counts ------------------------------------------------------------------------------------------

export const wordCount = (s: string): number => s.match(/[^\s]+/g)?.length ?? 0
export const readMinutes = (s: string): number => Math.max(1, Math.round(wordCount(s) / 180))

// ---- keyboard ----------------------------------------------------------------------------------------

export type EditorCommand = 'save' | 'saveClose' | 'find' | 'findNext' | 'findPrev' | 'bold' | 'italic' | 'link' | 'close'
type KeyLike = { key: string; code: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean }

// ⌘ on a Mac, Ctrl elsewhere. Keys follow the physical key (`code`), so the Russian layout works.
export function editorCommand(e: KeyLike): EditorCommand | null {
  if (e.key === 'Escape') return 'close'
  const mod = !!(e.metaKey || e.ctrlKey)
  if (e.code === 'F3' && !mod) return e.shiftKey ? 'findPrev' : 'findNext'
  if (!mod || e.altKey) return null
  if (e.code === 'Enter' || e.code === 'NumpadEnter') return 'saveClose'
  if (e.code === 'KeyS') return 'save'
  if (e.code === 'KeyF') return 'find'
  if (e.code === 'KeyG') return e.shiftKey ? 'findPrev' : 'findNext'
  if (e.code === 'KeyB') return 'bold'
  if (e.code === 'KeyI') return 'italic'
  if (e.code === 'KeyK') return 'link'
  return null
}

// ---- formatting --------------------------------------------------------------------------------------

export type Edit = { text: string; start: number; end: number }
export type FormatKind = 'bold' | 'italic' | 'heading' | 'list' | 'link' | 'table'

const lineStart = (t: string, i: number) => t.lastIndexOf('\n', i - 1) + 1
const lineEnd = (t: string, i: number) => {
  const n = t.indexOf('\n', i)
  return n < 0 ? t.length : n
}

function wrap(t: string, s: number, e: number, mark: string, placeholder: string): Edit {
  const sel = t.slice(s, e)
  // Already wrapped right around the selection: take the marks off again.
  if (s >= mark.length && t.slice(s - mark.length, s) === mark && t.slice(e, e + mark.length) === mark && sel && !(mark === '*' && (t[s - 2] === '*' || t[e + 1] === '*')))
    return { text: t.slice(0, s - mark.length) + sel + t.slice(e + mark.length), start: s - mark.length, end: e - mark.length }
  if (sel.startsWith(mark) && sel.endsWith(mark) && sel.length >= mark.length * 2)
    return { text: t.slice(0, s) + sel.slice(mark.length, -mark.length) + t.slice(e), start: s, end: e - mark.length * 2 }
  const inner = sel || placeholder
  return { text: t.slice(0, s) + mark + inner + mark + t.slice(e), start: s + mark.length, end: s + mark.length + inner.length }
}

function eachLine(t: string, s: number, e: number, fn: (line: string, i: number) => string): Edit {
  const a = lineStart(t, s)
  const b = lineEnd(t, Math.max(s, e - (e > s && t[e - 1] === '\n' ? 1 : 0)))
  const lines = t.slice(a, b).split('\n').map(fn)
  const next = lines.join('\n')
  return { text: t.slice(0, a) + next + t.slice(b), start: a, end: a + next.length }
}

export const TABLE_HEAD = ['Этап', 'Что входит', 'Сумма'] as const

export function applyFormat(t: string, s: number, e: number, kind: FormatKind): Edit {
  if (kind === 'bold') return wrap(t, s, e, '**', 'текст')
  if (kind === 'italic') return wrap(t, s, e, '*', 'текст')
  if (kind === 'heading')
    return eachLine(t, s, e, (l) => (/^#{1,3}\s/.test(l) ? l.replace(/^#{1,3}\s/, '') : `## ${l}`))
  if (kind === 'list') {
    const a = lineStart(t, s)
    const b = lineEnd(t, e)
    const all = t.slice(a, b).split('\n').every((l) => /^[-*]\s/.test(l))
    return eachLine(t, s, e, (l) => (all ? l.replace(/^[-*]\s/, '') : /^[-*]\s/.test(l) ? l : `- ${l}`))
  }
  if (kind === 'link') {
    const label = t.slice(s, e) || 'текст ссылки'
    const url = 'https://'
    const text = `${t.slice(0, s)}[${label}](${url})${t.slice(e)}`
    const urlStart = s + label.length + 3
    return { text, start: urlStart, end: urlStart + url.length }
  }
  // Table row: after a table line the new row has the same number of cells, anywhere else the
  // estimate table starts (head, divider, one empty row) after the current line.
  const ls = lineStart(t, s)
  const le = lineEnd(t, s)
  const line = t.slice(ls, le)
  const isRow = /^\s*\|.*\|\s*$/.test(line)
  let insert: string
  let focus: number
  if (isRow) {
    const cells = Math.max(1, line.trim().replace(/^\||\|$/g, '').split('|').length)
    const row = `|${Array.from({ length: cells }, () => '  ').join('|')}|`
    insert = `\n${row}`
    focus = le + 3
  } else {
    const head = `| ${TABLE_HEAD.join(' | ')} |`
    const div = `|${TABLE_HEAD.map(() => '---').join('|')}|`
    const row = `|${TABLE_HEAD.map(() => '  ').join('|')}|`
    insert = `${line ? '\n\n' : '\n'}${head}\n${div}\n${row}`
    focus = le + insert.length - row.length + 2
  }
  return { text: t.slice(0, le) + insert + t.slice(le), start: focus, end: focus }
}

// ---- find and replace --------------------------------------------------------------------------------

export function findMatches(text: string, query: string, caseSensitive = false): number[] {
  if (!query) return []
  const hay = caseSensitive ? text : text.toLowerCase()
  const needle = caseSensitive ? query : query.toLowerCase()
  const out: number[] = []
  for (let i = hay.indexOf(needle); i >= 0 && out.length < 5000; i = hay.indexOf(needle, i + needle.length)) out.push(i)
  return out
}

export function replaceAt(text: string, index: number, length: number, replacement: string): string {
  return text.slice(0, index) + replacement + text.slice(index + length)
}

export function replaceAll(text: string, query: string, replacement: string, caseSensitive = false): { text: string; count: number } {
  const hits = findMatches(text, query, caseSensitive)
  let out = text
  for (const i of [...hits].reverse()) out = replaceAt(out, i, query.length, replacement)
  return { text: out, count: hits.length }
}

// The next / previous match index (wrapping around) from the caret; null without matches.
export function stepMatch(matches: number[], caret: number, dir: 1 | -1): number | null {
  if (!matches.length) return null
  if (dir === 1) return matches.find((m) => m >= caret) ?? matches[0]!
  return [...matches].reverse().find((m) => m < caret) ?? matches.at(-1)!
}

// ---- local draft (autosave every 5 s) ----------------------------------------------------------------

export const AUTOSAVE_MS = 5000
export const draftKey = (itemId: string, field = 'draft') => `firtech-doc-draft:${itemId}:${field}`
export type Draft = { base: string; value: string; at: number }

export const serializeDraft = (d: Draft) => JSON.stringify(d)
export function parseDraft(raw: string | null): Draft | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<Draft>
    return typeof v.base === 'string' && typeof v.value === 'string' && typeof v.at === 'number' ? { base: v.base, value: v.value, at: v.at } : null
  } catch {
    return null
  }
}
// Offer a stored draft only when it was started from the text that is saved now and differs from it.
export const draftRestorable = (d: Draft | null, saved: string): d is Draft => !!d && d.base === saved && d.value !== saved
