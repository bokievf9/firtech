// Tabs of the cabinet home. v3 (2026-11-22, owner: «в кабинет можно добавить больше»): Проекты (the
// client's own project and what is needed from them), Документы, Сообщения, Ваш агент (only when the
// client has one), Материалы, Рекомендации, Профиль. Pure helpers: the tab list, `?tab=` parsing with
// legacy names, the badge counts and arrow-key movement. The state lives in the URL (`?tab=`).

export const cabinetTabs = ['projects', 'documents', 'messages', 'agent', 'materials', 'referrals', 'profile'] as const
export type CabinetTab = (typeof cabinetTabs)[number]

export const isCabinetTab = (v: unknown): v is CabinetTab =>
  typeof v === 'string' && (cabinetTabs as readonly string[]).includes(v)

// The tabs a client sees: «Ваш агент» only when HQ has a playground agent for them.
export const visibleTabs = (state: { hasAgent: boolean }): CabinetTab[] =>
  cabinetTabs.filter((t) => t !== 'agent' || state.hasAgent)

// Tabs of the 2026-11-21 cabinet that old links and bookmarks may still carry.
const legacy: Record<string, CabinetTab> = {
  overview: 'projects',
  leads: 'projects',
  invoices: 'documents',
  support: 'messages',
}

// The first screen is always the project (or the request): that is what the client came for.
export const defaultTab = (): CabinetTab => 'projects'

// `?tab=` (a string or the first of several) to a visible tab; legacy names are mapped, anything
// else gives the fallback.
export function parseTab(value: unknown, fallback: CabinetTab, visible: readonly CabinetTab[] = cabinetTabs): CabinetTab {
  const first = Array.isArray(value) ? value[0] : value
  const own = typeof first === 'string' && Object.hasOwn(legacy, first) ? legacy[first] : first
  return isCabinetTab(own) && visible.includes(own) ? own : fallback
}

// An open request waits for something: not closed («lost») and not yet a project.
export const isOpenLead = (l: { stage: string }) => l.stage !== 'lost' && l.stage !== 'project'

// Badges: documents that wait for the client (accept, sign, pay) and unread messages. Zero gives none.
export function tabCounts(d: { docsNeedingClient: number; unread: number }): Partial<Record<CabinetTab, number>> {
  const out: Partial<Record<CabinetTab, number>> = {}
  if (d.docsNeedingClient > 0) out.documents = d.docsNeedingClient
  if (d.unread > 0) out.messages = d.unread
  return out
}

// The query string for a tab, keeping the other parameters (`lead`, `follow`) and dropping those that
// belong to another tab (`doc`, `ref`) unless `extra` sets them.
export function withTab(search: string, tab: CabinetTab, extra: Record<string, string | null> = {}): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  params.delete('doc')
  params.delete('ref')
  params.set('tab', tab)
  for (const [key, value] of Object.entries(extra)) {
    if (value === null) params.delete(key)
    else params.set(key, value)
  }
  return `?${params.toString()}`
}

// Arrow keys move along the bar and wrap; Home and End jump. Other keys give null.
export function tabFromKey(current: CabinetTab, key: string, tabs: readonly CabinetTab[] = cabinetTabs): CabinetTab | null {
  const at = tabs.indexOf(current)
  if (at < 0) return null
  if (key === 'ArrowRight') return tabs[(at + 1) % tabs.length]!
  if (key === 'ArrowLeft') return tabs[(at - 1 + tabs.length) % tabs.length]!
  if (key === 'Home') return tabs[0]!
  if (key === 'End') return tabs[tabs.length - 1]!
  return null
}
