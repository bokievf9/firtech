// Tabs of the cabinet home (owner 2026-11-21: «удобный интерфейс с табами, а не всё в один лист»).
// Pure helpers: the tab list, the default tab from the visitor's data, the badge counts, `?tab=`
// parsing with a fallback and arrow-key movement. The state lives in the URL (`?tab=`).

export const cabinetTabs = [
  'overview',
  'leads',
  'projects',
  'invoices',
  'documents',
  'support',
  'referrals',
  'profile',
] as const
export type CabinetTab = (typeof cabinetTabs)[number]

export const isCabinetTab = (v: unknown): v is CabinetTab =>
  typeof v === 'string' && (cabinetTabs as readonly string[]).includes(v)

// «Заявки» when the visitor has requests or arrives with `?lead=`, else the overview.
export function defaultTab(state: { leadCount: number; leadParam?: string | null }): CabinetTab {
  return state.leadCount > 0 || Boolean(state.leadParam) ? 'leads' : 'overview'
}

// `?tab=` (a string or the first of several) to a known tab; anything else gives the fallback.
export function parseTab(value: unknown, fallback: CabinetTab): CabinetTab {
  const first = Array.isArray(value) ? value[0] : value
  return isCabinetTab(first) ? first : fallback
}

type Counted = {
  leads: readonly { stage: string }[] | null
  invoices: readonly { status: string }[]
  tickets: readonly { status: string }[]
}

// An open request waits for something: not closed («lost») and not yet a project.
export const isOpenLead = (l: { stage: string }) => l.stage !== 'lost' && l.stage !== 'project'

// Badges: open requests, unpaid invoices (status `issued`), open tickets. Zero gives no badge.
export function tabCounts(d: Counted): Partial<Record<CabinetTab, number>> {
  const out: Partial<Record<CabinetTab, number>> = {}
  const leads = (d.leads ?? []).filter(isOpenLead).length
  const invoices = d.invoices.filter((i) => i.status === 'issued').length
  const tickets = d.tickets.filter((t) => t.status === 'open').length
  if (leads > 0) out.leads = leads
  if (invoices > 0) out.invoices = invoices
  if (tickets > 0) out.support = tickets
  return out
}

// The query string for a tab, keeping the other parameters (`lead`, `follow`).
export function withTab(search: string, tab: CabinetTab): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  params.set('tab', tab)
  return `?${params.toString()}`
}

// Arrow keys move along the bar and wrap; Home and End jump. Other keys give null.
export function tabFromKey(current: CabinetTab, key: string): CabinetTab | null {
  const at = cabinetTabs.indexOf(current)
  if (key === 'ArrowRight') return cabinetTabs[(at + 1) % cabinetTabs.length]!
  if (key === 'ArrowLeft') return cabinetTabs[(at - 1 + cabinetTabs.length) % cabinetTabs.length]!
  if (key === 'Home') return cabinetTabs[0]!
  if (key === 'End') return cabinetTabs[cabinetTabs.length - 1]!
  return null
}
