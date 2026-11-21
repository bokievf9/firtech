import { editPayload, fieldsOf, withText, type ReviewItem, type ReviewVersion } from './review'

// The full-screen document editor (review centre «E», back-office Documents): pure helpers. The
// component only wires them to a textarea. Nothing here touches the DOM, storage or the network.

// ---- which items open the editor ---------------------------------------------------------------------

// A text document: any non-content item whose text is the `draft` (answer, договор, счёт...) and for which
// HQ lists `edit` in `actions` right now. That is also true for approved documents the client has not acted
// on yet (HQ's `editApproved`): the status is HQ's call, not ours. Content items (reels, carousels) keep the
// side editor: they have several short fields, not a page.
export function documentField(item: ReviewItem): { key: 'draft'; value: string } | null {
  if (item.kind === 'content_item' || item.kind === 'presales_pack') return null
  const f = fieldsOf(item).find((x) => x.key === 'draft' && x.editable)
  return f ? { key: 'draft', value: f.value } : null
}

export const versionText = (v: Pick<ReviewVersion, 'text'> | undefined): string => v?.text.draft ?? v?.text.body ?? ''

// The documents of a presales pack the editor can open (`doc` of the `edit` call).
export const PACK_DOCS = ['kp', 'estimate', 'contract'] as const
export type PackDoc = (typeof PACK_DOCS)[number]
const isPackDoc = (v: unknown): v is PackDoc => (PACK_DOCS as readonly unknown[]).includes(v)

// One thing the editor can open: a whole item (`doc: null`) or one document of a presales pack.
export type DocTarget = { item: ReviewItem; doc: PackDoc | null; title: string; value: string; storageId: string }

// The targets of an item. A presales pack gives its КП, смета and договор (when HQ allows `edit`; the
// contract of an approved pack is a document of its own, edited through its back-office card), anything
// else gives itself through `documentField`.
export function editableTargets(item: ReviewItem): DocTarget[] {
  if (item.kind === 'presales_pack') {
    if (!item.actions.includes('edit')) return []
    const out: DocTarget[] = []
    for (const d of item.text.documents ?? []) {
      if (!isPackDoc(d.key) || !d.body) continue
      if (d.key === 'contract' && item.status !== 'pending') continue
      out.push({ item, doc: d.key, title: d.title || d.key, value: d.body, storageId: `${item.id}:${d.key}` })
    }
    return out
  }
  const f = documentField(item)
  return f ? [{ item, doc: null, title: item.title || item.summary, value: f.value, storageId: item.id }] : []
}

// The target for a key like `ap_5:kp` (or `ap_5`) on an item, null when it is gone or not editable now.
export function targetOf(item: ReviewItem | null | undefined, key: string | null | undefined): DocTarget | null {
  if (!item || !key) return null
  const all = editableTargets(item)
  return all.find((t) => t.storageId === key) ?? (key === item.id ? all[0] ?? null : null)
}

// The text v1 had: the snapshot before the owner's first edit (or the only version there is).
export const firstVersionText = (item: ReviewItem, doc: PackDoc | null = null): string => {
  const first = [...item.versions].sort((a, b) => a.v - b.v)[0]
  if (doc) return first?.text.documents?.find((d) => d.key === doc)?.body ?? item.text.documents?.find((d) => d.key === doc)?.body ?? ''
  return first ? versionText(first) : (item.text.draft ?? item.text.body ?? '')
}
export const targetBase = (t: DocTarget): string => firstVersionText(t.item, t.doc) || t.value

// The body of the `edit` call that «Сохранить как версию» sends: the same shape as the side editor
// (plus `doc` for a presales pack), null when nothing changed (HQ would answer 409 `not_applied`).
export type VersionPayload = { action: 'edit'; doc?: PackDoc; text: { draft: string } }
export function versionSavePayload(item: ReviewItem, value: string, doc: PackDoc | null = null): VersionPayload | null {
  if (doc) {
    const current = item.text.documents?.find((d) => d.key === doc)?.body
    return value.trim() && value !== current ? { action: 'edit', doc, text: { draft: value } } : null
  }
  const p = editPayload(item, { draft: value })
  const draft = p?.text.draft
  return typeof draft === 'string' ? { action: 'edit', text: { draft } } : null
}

// The item with the edited text in place (the optimistic update): a pack's document, or the draft.
export function withDocText(item: ReviewItem, value: string, doc: PackDoc | null): ReviewItem {
  if (!doc) return withText(item, { draft: value })
  const documents = (item.text.documents ?? []).map((d) => (d.key === doc ? { ...d, body: value } : d))
  return { ...item, text: { ...item.text, documents, ...(doc === 'kp' ? { body: value } : {}) } }
}

// The review item and target behind a row of the Documents tab: `bo:<n>` back-office document,
// `bl:<n>` invoice (HQ only lets a draft be edited), `ps:<n>` a КП, смета or договор of a presales
// pack (matched by the document id HQ may send, else by kind and client name).
export type DocRow = { id: string; kind: string; client: string }
// The `ps_documents` ids a pack declares: its `documents[].id` and `meta.pack.documentIds`.
export function packDocIds(item: ReviewItem): Set<string> {
  const out = new Set<string>()
  for (const d of item.text.documents ?? []) if (d.id !== undefined && d.id !== '') out.add(d.id)
  const pack = item.meta.pack as { documentIds?: unknown } | null | undefined
  if (Array.isArray(pack?.documentIds)) for (const v of pack.documentIds) if (typeof v === 'number' || typeof v === 'string') out.add(String(v))
  return out
}
const norm = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '')
export function targetForRow(row: DocRow, items: ReviewItem[]): DocTarget | null {
  const m = /^(bo|bl|ps):(\d{1,12})$/.exec(row.id)
  if (!m) return null
  if (m[1] === 'ps') {
    if (!isPackDoc(row.kind)) return null
    const client = norm(row.client)
    let named: DocTarget | null = null
    for (const it of items) {
      if (it.kind !== 'presales_pack') continue
      const t = editableTargets(it).find((x) => x.doc === row.kind)
      if (!t) continue
      const ids = packDocIds(it)
      // HQ names the pack's documents by `ps_documents.id` (`documents[].id`, `meta.pack.documentIds`): an exact match.
      if (ids.has(m[2]!)) return t
      // The kind + client name guess only for packs that carry no ids at all (an older HQ).
      if (ids.size > 0) continue
      const lead = it.meta.lead as { name?: unknown } | null | undefined
      if (!named && client && (norm(lead?.name) === client || norm(it.title).includes(client))) named = t
    }
    return named
  }
  const kind = m[1] === 'bo' ? 'bo_document' : 'billing_invoice'
  const key = m[1] === 'bo' ? 'document' : 'invoice'
  for (const it of items) {
    if (it.kind !== kind) continue
    const ref = it.meta[key]
    if (!ref || typeof ref !== 'object' || String((ref as Record<string, unknown>).id) !== m[2]) continue
    const t = editableTargets(it)[0]
    if (t) return t
  }
  return null
}

// Why a row cannot be edited, for the disabled button.
export function whyNotEditable(row: Pick<DocRow, 'id' | 'kind'>): string {
  if (row.kind === 'invoice') return 'Выставленный счёт не правится: отмените его и выставьте новый.'
  return 'HQ не даёт править этот документ: клиент уже принял или подписал его, либо карточки нет.'
}

// HQ refuses a draft longer than this (400 invalid), so the editor stops before it (contracts are long).
export const DOC_MAX = 40000

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
