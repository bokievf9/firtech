import { count, idStr, intOrNull, isObj, list, str, strOrNull, unwrapList } from './cabinet-parse'

// Cabinet v3, «Ваш агент»: the client's own playground agent (HQ `pg_agents`). Contract draft:
// `GET/PATCH /admin/clients/:id/agents/:aid`, `.../agents`, `.../conversations`. The Telegram bot
// token goes to HQ only (stored encrypted there) and is never returned, so the site only learns
// whether the channel is connected.

export type AgentState = 'draft' | 'live'
export type AgentChannels = { web: boolean; telegram: boolean; siteWidget: string | null }
export type ClientAgent = {
  id: string
  name: string
  niche: string
  tone: string
  languages: string[]
  channels: AgentChannels
  state: AgentState
  limits: { msgsPerDay: number | null }
  usage: { msgsToday: number; msgsMonth: number; conversations: number }
}
export type AgentConversation = { id: string; startedAt: string | null; lastAt: string | null; channel: string; messages: number; preview: string }

export const agentTones = ['friendly', 'formal', 'brief'] as const
export const agentLanguages = ['ru', 'en', 'tg', 'uz'] as const

// The channel flag may be a boolean, an object with `connected`/`enabled`, or (for the site widget)
// an allowed origin; a token itself is never read.
function channelOn(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (isObj(v)) return v.connected === true || v.enabled === true
  return typeof v === 'string' && v.length > 0
}

export function parseAgent(r: Record<string, unknown>): ClientAgent | null {
  const id = idStr(r.id)
  if (id === null) return null
  const ch = isObj(r.channels) ? r.channels : {}
  const limits = isObj(r.limits) ? r.limits : {}
  const usage = isObj(r.usage) ? r.usage : {}
  return {
    id: id.slice(0, 60),
    name: str(r.name, 60) || 'Agent',
    niche: str(r.niche, 80),
    tone: str(r.tone, 40),
    languages: Array.isArray(r.languages) ? r.languages.filter((l): l is string => typeof l === 'string').map((l) => l.slice(0, 5)).slice(0, 6) : [],
    channels: {
      web: ch.web === undefined ? true : channelOn(ch.web),
      telegram: channelOn(ch.telegram),
      siteWidget: typeof ch.siteWidget === 'string' && ch.siteWidget ? ch.siteWidget.slice(0, 200) : null,
    },
    state: r.state === 'live' ? 'live' : 'draft',
    limits: { msgsPerDay: intOrNull(limits.msgsPerDay) },
    usage: { msgsToday: count(usage.msgsToday), msgsMonth: count(usage.msgsMonth), conversations: count(usage.conversations) },
  }
}
export const parseAgents = (body: unknown): ClientAgent[] => list(unwrapList(body, ['agents']), parseAgent)
export const parseAgentItem = (body: unknown): ClientAgent | null => (isObj(body) ? parseAgent(isObj(body.item) ? body.item : isObj(body.agent) ? body.agent : body) : null)

export function parseConversation(r: Record<string, unknown>): AgentConversation | null {
  const id = idStr(r.id)
  if (id === null) return null
  return {
    id: id.slice(0, 80),
    startedAt: strOrNull(r.startedAt),
    lastAt: strOrNull(r.lastAt),
    channel: str(r.channel, 20) || 'web',
    messages: count(r.messages),
    preview: str(r.preview, 160),
  }
}
export const parseConversations = (body: unknown): AgentConversation[] => list(unwrapList(body, ['conversations']), parseConversation)

// Share of the daily limit used (0-100), null without a limit.
export function usageShare(usage: { msgsToday: number }, limit: number | null): number | null {
  return limit && limit > 0 ? Math.min(100, Math.round((usage.msgsToday / limit) * 100)) : null
}

// BotFather tokens look like `123456789:AA...` (digits, colon, 35 URL-safe characters).
export const TELEGRAM_TOKEN = /^\d{6,12}:[A-Za-z0-9_-]{30,50}$/
export function checkBotToken(input: unknown): string | null {
  const token = typeof input === 'string' ? input.trim() : ''
  return TELEGRAM_TOKEN.test(token) ? token : null
}

export type AgentSettings = { name?: unknown; tone?: unknown; languages?: unknown; channels?: unknown }

// The PATCH body: only the settings a client may change, cleaned. Anything else is dropped (state,
// limits and the persona stay Fir Tech's). `channels.telegram` is `{ botToken }` and only with a valid token.
export function agentPatchBody(input: AgentSettings & { botToken?: unknown }): Record<string, unknown> | null {
  const out: Record<string, unknown> = {}
  if (typeof input.name === 'string') {
    const name = input.name.replace(/\s+/g, ' ').trim()
    if (name.length < 2 || name.length > 40) return null
    out.name = name
  }
  if (typeof input.tone === 'string') {
    if (!/^[a-z_]{2,20}$/.test(input.tone)) return null
    out.tone = input.tone
  }
  if (Array.isArray(input.languages)) {
    const langs = [...new Set(input.languages.filter((l): l is string => typeof l === 'string' && (agentLanguages as readonly string[]).includes(l)))]
    if (langs.length === 0) return null
    out.languages = langs
  }
  const channels: Record<string, unknown> = {}
  if (isObj(input.channels)) {
    if (typeof input.channels.web === 'boolean') channels.web = input.channels.web
    if (input.channels.telegram === false) channels.telegram = false
    if (input.channels.siteWidget === false) channels.siteWidget = false
  }
  if (input.botToken !== undefined) {
    const token = checkBotToken(input.botToken)
    if (!token) return null
    channels.telegram = { botToken: token }
  }
  if (Object.keys(channels).length > 0) out.channels = channels
  return Object.keys(out).length > 0 ? out : null
}
