import { count, idStr, isObj, list, str, strOrNull, unwrapList } from './cabinet-parse'

// Cabinet v3 messenger: threads (one per request, project, support and the client's own agent),
// messages with read marks and attachments. Contract draft: `GET /admin/clients/:id/threads`,
// `.../threads/:tid/messages?after=`, `POST .../messages`, `POST .../read`. Pure helpers.

export type ThreadKind = 'lead' | 'project' | 'agent' | 'support'
export const threadKinds: ThreadKind[] = ['lead', 'project', 'agent', 'support']

export type ChatThread = {
  id: string
  kind: ThreadKind
  refId: string | null
  title: string
  unread: number
  lastAt: string | null
}
export type ChatAttachment = { name: string; href: string; size: number; label: string }
export type ChatFrom = 'client' | 'firtech' | 'agent'
export type ChatMessage = {
  id: string
  at: string | null
  from: ChatFrom
  text: string
  attachments: ChatAttachment[]
  readAt: string | null
  // Browser only: a message that is still on its way (`local:` id) or failed to go.
  state?: 'sending' | 'failed'
}

// Files go to the browser only through the session-checked proxy; HQ's own link stays on the server.
export const MEDIA_ROUTE = '/api/cabinet/media'
export const mediaHref = (url: string, name = '') =>
  `${MEDIA_ROUTE}?u=${encodeURIComponent(url)}${name ? `&name=${encodeURIComponent(name.slice(0, 120))}` : ''}`

export function parseThread(r: Record<string, unknown>): ChatThread | null {
  const id = idStr(r.id)
  const kind = threadKinds.find((k) => k === r.kind)
  if (id === null || !kind) return null
  return {
    id: id.slice(0, 80),
    kind,
    refId: idStr(r.refId),
    title: str(r.title, 160),
    unread: count(r.unread),
    lastAt: strOrNull(r.lastAt),
  }
}
export const parseThreads = (body: unknown): ChatThread[] => list(unwrapList(body, ['threads']), parseThread)

export function parseAttachment(r: Record<string, unknown>): ChatAttachment | null {
  const url = typeof r.url === 'string' && r.url.length <= 1000 ? r.url : ''
  const name = str(r.name, 160)
  if (!url || !name) return null
  return { name, href: url.startsWith(MEDIA_ROUTE) ? url : mediaHref(url, name), size: count(r.size), label: str(r.label, 40) }
}

export function parseMessage(r: Record<string, unknown>): ChatMessage | null {
  const id = idStr(r.id)
  if (id === null) return null
  const from: ChatFrom = r.from === 'client' ? 'client' : r.from === 'agent' ? 'agent' : 'firtech'
  const attachments = list(r.attachments, parseAttachment).slice(0, 10)
  const text = str(r.text, 4000)
  if (!text && attachments.length === 0) return null
  return { id: id.slice(0, 80), at: strOrNull(r.at), from, text, attachments, readAt: strOrNull(r.readAt) }
}
export const parseMessages = (body: unknown): ChatMessage[] => list(unwrapList(body, ['messages']), parseMessage)

// A single message answer of `POST .../messages` (`{ ok, item }` or the message itself).
export function parseMessageItem(body: unknown): ChatMessage | null {
  if (!isObj(body)) return null
  return parseMessage(isObj(body.item) ? body.item : isObj(body.message) ? body.message : body)
}

const time = (iso: string | null) => (iso ? Date.parse(iso) || 0 : 0)

// Union by id (the newer copy wins, so read marks arrive), oldest first.
export function mergeMessages(current: readonly ChatMessage[], incoming: readonly ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>()
  for (const m of current) map.set(m.id, m)
  for (const m of incoming) map.set(m.id, { ...map.get(m.id), ...m, state: undefined })
  return [...map.values()].sort((a, b) => time(a.at) - time(b.at) || a.id.localeCompare(b.id, 'en', { numeric: true }))
}

// The id to ask HQ for newer messages with (`?after=`): the last one that really exists on the server.
export function lastServerId(messages: readonly ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) if (!messages[i]!.id.startsWith('local:')) return messages[i]!.id
  return null
}

export const unreadTotal = (threads: readonly Pick<ChatThread, 'unread'>[]) => threads.reduce((n, t) => n + t.unread, 0)

// Unread first, then the latest activity.
export function sortThreads<T extends Pick<ChatThread, 'unread' | 'lastAt'>>(threads: readonly T[]): T[] {
  return [...threads].sort((a, b) => Number(b.unread > 0) - Number(a.unread > 0) || time(b.lastAt) - time(a.lastAt))
}

// The thread of a request or project: `?ref=lead-12` / `project-3` from a link inside the cabinet.
export function threadFor(threads: readonly ChatThread[], ref: string | null | undefined): ChatThread | null {
  const m = /^(lead|project|agent|support)(?:-([A-Za-z0-9_:.-]{1,60}))?$/.exec(ref ?? '')
  if (!m) return null
  return threads.find((t) => t.kind === m[1] && (m[2] === undefined || t.refId === m[2])) ?? null
}

// A key press in the composer: Enter sends, Shift+Enter breaks the line, and nothing happens while
// an input method (Chinese, Japanese, Korean, dead keys) is composing a word.
export function composerKey(e: { key: string; shiftKey: boolean; isComposing?: boolean; ctrlKey?: boolean; metaKey?: boolean }): 'send' | 'newline' | null {
  if (e.key !== 'Enter' || e.isComposing) return null
  return e.shiftKey && !e.ctrlKey && !e.metaKey ? 'newline' : 'send'
}

export const MESSAGE_MAX = 2000
export function cleanMessage(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim().slice(0, MESSAGE_MAX)
}

// ---- uploads -------------------------------------------------------------------------------------

export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024
export const uploadTypes: Record<string, string[]> = {
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  gif: ['image/gif'],
  webp: ['image/webp'],
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  zip: ['application/zip', 'application/x-zip-compressed'],
}
export type UploadError = 'type' | 'size' | 'empty'

// Images, PDF, DOCX and ZIP up to 10 MB (contract §4). The extension decides; a browser may leave the
// MIME type empty, but a type that is present must match it.
export function checkUpload(file: { name: string; size: number; type?: string }): { ok: true; ext: string } | { ok: false; error: UploadError } {
  const ext = /\.([A-Za-z0-9]{1,5})$/.exec(file.name.trim())?.[1]?.toLowerCase() ?? ''
  const mimes = uploadTypes[ext]
  if (!mimes) return { ok: false, error: 'type' }
  if (file.type && !mimes.includes(file.type.toLowerCase())) return { ok: false, error: 'type' }
  if (file.size <= 0) return { ok: false, error: 'empty' }
  if (file.size > UPLOAD_MAX_BYTES) return { ok: false, error: 'size' }
  return { ok: true, ext }
}
export const uploadAccept = Object.keys(uploadTypes).map((e) => `.${e}`).join(',')

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ---- materials -----------------------------------------------------------------------------------

export const materialLabels = ['logo', 'texts', 'access', 'photos', 'other'] as const
export type MaterialLabel = (typeof materialLabels)[number]
export const isMaterialLabel = (v: unknown): v is MaterialLabel => typeof v === 'string' && (materialLabels as readonly string[]).includes(v)

// Materials go into the project thread, else the request's thread; none = nothing to attach to yet.
export function materialsThread(threads: readonly ChatThread[]): ChatThread | null {
  return threads.find((t) => t.kind === 'project') ?? threads.find((t) => t.kind === 'lead') ?? null
}

export type MaterialFile = ChatAttachment & { at: string | null; messageId: string }
// The client's own uploads of a thread, newest first.
export function materialFiles(messages: readonly ChatMessage[]): MaterialFile[] {
  return messages
    .filter((m) => m.from === 'client')
    .flatMap((m) => m.attachments.map((a) => ({ ...a, at: m.at, messageId: m.id })))
    .sort((a, b) => time(b.at) - time(a.at))
}

// «Сегодня», «Вчера» or a date; UTC like formatDate so the server and the browser agree.
export function dayKey(iso: string | null): string {
  const d = iso ? new Date(iso) : null
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : ''
}
export function groupByDay(messages: readonly ChatMessage[]): { day: string; items: ChatMessage[] }[] {
  const out: { day: string; items: ChatMessage[] }[] = []
  for (const m of messages) {
    const day = dayKey(m.at)
    const last = out[out.length - 1]
    if (last && last.day === day) last.items.push(m)
    else out.push({ day, items: [m] })
  }
  return out
}
