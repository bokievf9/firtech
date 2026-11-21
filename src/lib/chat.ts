// On-page chat with the AI receptionist («попробуйте приёмщика»): the contract between the widget,
// POST /api/chat and HQ, plus the scripted mock used when HQ_CHAT_URL is unset in development.
// Pure module (no server-only imports), covered by tests/chat.test.mjs. Contract details and the
// HQ side: docs/site-design-notes.md, section «Чат».

import { z } from 'zod'

export const MESSAGE_MAX = 1000
export const REPLY_MAX = 2000
export const BUTTONS_MAX = 8
export const LABEL_MAX = 40
// The widget's first call: HQ (and the mock) answer with the greeting.
export const START = '/start'
// A button press is sent as `/btn <id>`.
export const btnMessage = (id: string) => `/btn ${id}`

export type ChatState = 'chat' | 'intake' | 'contact' | 'done'
export type ChatButton = { id: string; label: string }
export type ChatCta = 'builder' | 'call' | 'telegram'
export const CTAS: readonly ChatCta[] = ['builder', 'call', 'telegram']
export type ChatReply = {
  ok: true
  reply: string
  buttons?: ChatButton[]
  state: ChatState
  // The builder link HQ offered (checked by safeBuilderLink: always a relative /ru|en/builder path).
  builderLink?: string
  // Which offers this reply carries, in order: builder, call, telegram (see chat-cta.ts).
  cta?: ChatCta[]
  // The visitor asked for a person: the founder takes over.
  handoff?: boolean
  // A demo session (persona): nothing is saved, no lead.
  demo?: boolean
  leadCreated?: boolean
  // Replies the owner wrote from the пульт (lead reply via 'web'), delivered with the next answer.
  ownerReplies?: string[]
  // Set by the site itself (never taken from HQ): the visitor sent a contact while signed out, so
  // the message was not forwarded and the widget shows the sign-in step (owner 2026-11-20).
  authRequired?: boolean
}
export type ChatError = { ok: false; error: string }
export type ChatResponse = ChatReply | ChatError

// Plain text only: tags go, stray angle brackets go, control characters (except new lines) go.
export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const personas = ['salon', 'clinic', 'shop'] as const
export type Persona = (typeof personas)[number]

export const chatRequestSchema = z.object({
  sessionId: z.string().regex(UUID),
  locale: z.enum(['ru', 'en']),
  message: z.string().transform(stripHtml).pipe(z.string().min(1).max(MESSAGE_MAX)),
  // The page path the visitor is on; never a full URL with a query string.
  page: z
    .string()
    .max(300)
    .transform((p) => (p.startsWith('/') ? p.split(/[?#]/)[0]!.slice(0, 200) : '/')),
  // The niche the visitor picked in the #demo tab «ИИ-менеджер заявок» (owner 2026-11-22). Passed on to
  // HQ as `persona` (HQ answers as that fictional business and returns `demo: true`). A request
  // with a persona never creates a lead (the route answers contacts itself).
  persona: z.enum(personas).optional(),
  // Referral slug (sanitized by the site, see referral.ts).
  ref: z
    .string()
    .regex(/^[a-z0-9_-]{1,32}$/)
    .optional(),
})

export type ChatRequest = z.infer<typeof chatRequestSchema>

// HQ's builder link is shown as a button that opens in the same tab: only a /ru|en/builder path of
// this site survives (relative, or absolute on firtech.pro), anything else is dropped.
export function safeBuilderLink(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 600) return null
  let url: URL
  try {
    url = new URL(value, 'https://firtech.pro')
  } catch {
    return null
  }
  if (url.hostname !== 'firtech.pro' && url.hostname !== 'www.firtech.pro') return null
  if (!/^\/(ru|en)\/builder\/?$/.test(url.pathname)) return null
  return `${url.pathname}${url.search}`
}

const STATES: readonly ChatState[] = ['chat', 'intake', 'contact', 'done']
const BUTTON_ID = /^[a-z0-9_.:-]{1,40}$/i

// Checks and cleans what HQ sent back before it reaches a visitor; null when it is not a reply.
export function sanitizeReply(body: unknown): ChatResponse | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (b.ok === false)
    return { ok: false, error: typeof b.error === 'string' ? b.error.slice(0, 60) : 'hq_error' }
  if (b.ok !== true || typeof b.reply !== 'string') return null
  const reply = stripHtml(b.reply).slice(0, REPLY_MAX)
  if (!reply) return null
  const buttons = Array.isArray(b.buttons)
    ? b.buttons
        .filter(
          (x): x is { id: string; label: string } =>
            !!x && typeof x === 'object' && typeof x.id === 'string' && typeof x.label === 'string',
        )
        .filter((x) => BUTTON_ID.test(x.id))
        .map((x) => ({ id: x.id, label: stripHtml(x.label).slice(0, LABEL_MAX) }))
        .filter((x) => x.label)
        .slice(0, BUTTONS_MAX)
    : []
  const state = STATES.includes(b.state as ChatState) ? (b.state as ChatState) : 'chat'
  const ownerReplies = Array.isArray(b.ownerReplies)
    ? b.ownerReplies
        .filter((x): x is string => typeof x === 'string')
        .map((x) => stripHtml(x).slice(0, REPLY_MAX))
        .filter(Boolean)
        .slice(0, 5)
    : []
  const builderLink = safeBuilderLink(b.builderLink)
  const cta = Array.isArray(b.cta)
    ? CTAS.filter((c) => (b.cta as unknown[]).includes(c))
    : []
  return {
    ok: true,
    reply,
    ...(buttons.length ? { buttons } : {}),
    state,
    ...(builderLink ? { builderLink } : {}),
    ...(cta.length ? { cta } : {}),
    ...(b.handoff === true ? { handoff: true } : {}),
    ...(b.demo === true ? { demo: true } : {}),
    ...(b.leadCreated === true ? { leadCreated: true } : {}),
    ...(ownerReplies.length ? { ownerReplies } : {}),
  }
}

// ---- Mock receptionist ----------------------------------------------------------------------
// A three-step intake (what / deadline / budget), then a contact request, then the thank-you.
// Copy comes from the content dictionary (chat.mock), passed in by the route.

export type MockCopy = {
  greeting: string
  what: Record<string, string>
  askDeadline: string
  deadline: Record<string, string>
  askBudget: string
  budget: Record<string, string>
  askContact: string
  badContact: string
  thanks: string
  after: string
  restart: string
}

type Step = 'what' | 'deadline' | 'budget' | 'contact' | 'done'
type MockSession = { step: Step; at: number }

const SESSION_TTL_MS = 60 * 60 * 1000
const SESSIONS_MAX = 2000

const buttonsOf = (labels: Record<string, string>): ChatButton[] =>
  Object.entries(labels).map(([id, label]) => ({ id, label }))

// Telegram username, e-mail or a phone number with at least 7 digits.
// A message that would turn the chat into a lead: a contact while HQ waits for one, or anything
// that looks like a contact. Commands (/start, button presses) never do.
export function wouldCreateLead(message: string): boolean {
  const m = message.trim()
  if (m === START || m.startsWith('/btn ')) return false
  return looksLikeContact(m)
}

export function looksLikeContact(text: string): boolean {
  if (/(^|\s)@[a-z0-9_]{4,}/i.test(text)) return true
  if (/t\.me\/[a-z0-9_]{4,}/i.test(text)) return true
  if (/\S+@\S+\.\S+/.test(text)) return true
  return (text.match(/\d/g) ?? []).length >= 7
}

export function createMockReceptionist(now: () => number = Date.now) {
  const sessions = new Map<string, MockSession>()

  function sweep(t: number) {
    if (sessions.size < SESSIONS_MAX) return
    for (const [id, s] of sessions) if (t - s.at > SESSION_TTL_MS) sessions.delete(id)
    if (sessions.size >= SESSIONS_MAX) sessions.clear()
  }

  return function reply(
    req: Pick<ChatRequest, 'sessionId' | 'message'> & { persona?: Persona },
    copy: MockCopy,
  ): ChatReply {
    const out = answer(req, copy)
    return req.persona ? { ...out, demo: true } : out
  }

  function answer(req: Pick<ChatRequest, 'sessionId' | 'message'>, copy: MockCopy): ChatReply {
    const t = now()
    sweep(t)
    const msg = req.message.trim()
    const button = msg.startsWith('/btn ') ? msg.slice(5).trim() : null
    let session = sessions.get(req.sessionId)
    if (session && t - session.at > SESSION_TTL_MS) session = undefined

    const greet = (): ChatReply => {
      sessions.set(req.sessionId, { step: 'what', at: t })
      return { ok: true, reply: copy.greeting, buttons: buttonsOf(copy.what), state: 'chat' }
    }
    if (!session || msg === START || button === 'restart') return greet()

    const save = (step: Step) => sessions.set(req.sessionId, { step, at: t })
    switch (session.step) {
      case 'what':
        save('deadline')
        return {
          ok: true,
          reply: copy.askDeadline,
          buttons: buttonsOf(copy.deadline),
          state: 'intake',
        }
      case 'deadline':
        save('budget')
        return { ok: true, reply: copy.askBudget, buttons: buttonsOf(copy.budget), state: 'intake' }
      case 'budget':
        save('contact')
        return { ok: true, reply: copy.askContact, state: 'contact' }
      case 'contact':
        if (button || !looksLikeContact(msg)) {
          save('contact')
          return { ok: true, reply: copy.badContact, state: 'contact' }
        }
        save('done')
        // The mock never creates a lead: leadCreated stays false, so nothing pretends otherwise.
        return {
          ok: true,
          reply: copy.thanks,
          buttons: [{ id: 'restart', label: copy.restart }],
          state: 'done',
        }
      case 'done':
        save('done')
        return {
          ok: true,
          reply: copy.after,
          buttons: [{ id: 'restart', label: copy.restart }],
          state: 'done',
        }
    }
  }
}
