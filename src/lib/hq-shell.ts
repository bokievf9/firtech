// HQ, phase 1 (2026-11-23): the CRM workplace of /admin. A fixed list of sections (English names, owner
// 2026-11-23); five of them are built from the existing panels, the rest say «soon» and link to the old
// screen. Pure data and helpers, no React, so they are unit-tested (tests/hq-shell.test.mjs).

export type HqSectionId =
  | 'inbox'
  | 'approvals'
  | 'tasks'
  | 'calendar'
  | 'chats'
  | 'clients'
  | 'projects'
  | 'documents'
  | 'agents'
  | 'processes'
  | 'content'
  | 'finance'
  | 'settings'
  | 'audit'
  | 'analytics'

export type HqSection = {
  id: HqSectionId
  label: string
  // 'ready' = a page of its own under /admin; 'link' = an existing full-screen page; 'soon' = placeholder.
  state: 'ready' | 'link' | 'soon'
  // Where the section lives: /admin/<id> for ready and soon, the existing page for 'link'.
  href: string
  // The old screen a «soon» section sends to (the pixel hub panel that holds it today).
  legacy: string
}

const office = (panel: string, tab?: string) => `/admin/office?panel=${panel}${tab ? `&tab=${tab}` : ''}`

export const HQ_SECTIONS: readonly HqSection[] = [
  { id: 'inbox', label: 'Inbox', state: 'ready', href: '/admin/inbox', legacy: office('director', 'inbox') },
  { id: 'approvals', label: 'Approvals', state: 'link', href: '/admin/approvals', legacy: '/admin/approvals' },
  { id: 'tasks', label: 'Tasks', state: 'ready', href: '/admin/tasks', legacy: office('director', 'tasks') },
  { id: 'calendar', label: 'Calendar', state: 'ready', href: '/admin/calendar', legacy: office('sales', 'calls') },
  { id: 'chats', label: 'Chats', state: 'link', href: '/admin/chats', legacy: '/admin/chats' },
  { id: 'clients', label: 'Clients', state: 'ready', href: '/admin/clients', legacy: office('sales', 'clients') },
  { id: 'projects', label: 'Projects', state: 'ready', href: '/admin/projects', legacy: office('production', 'projects') },
  { id: 'documents', label: 'Documents', state: 'ready', href: '/admin/documents', legacy: office('backoffice', 'documents') },
  { id: 'agents', label: 'Agents', state: 'ready', href: '/admin/agents', legacy: office('company', 'company') },
  { id: 'processes', label: 'Processes', state: 'ready', href: '/admin/processes', legacy: office('company', 'company') },
  { id: 'content', label: 'Content', state: 'ready', href: '/admin/content', legacy: office('marketing', 'content') },
  { id: 'finance', label: 'Finance', state: 'ready', href: '/admin/finance', legacy: office('backoffice', 'invoices') },
  { id: 'settings', label: 'Settings', state: 'ready', href: '/admin/settings', legacy: office('company', 'prices') },
  { id: 'audit', label: 'Audit log', state: 'ready', href: '/admin/audit', legacy: office('company', 'company') },
  { id: 'analytics', label: 'Analytics', state: 'ready', href: '/admin/analytics', legacy: office('marketing', 'metrics') },
] as const

export const isSoonSection = (v: unknown): v is HqSectionId =>
  HQ_SECTIONS.some((s) => s.id === v && s.state === 'soon')

export const sectionById = (id: string) => HQ_SECTIONS.find((s) => s.id === id)

// Keys 1-9 open the first nine sections in the menu order.
export function sectionForKey(key: string): HqSection | null {
  if (key.length !== 1) return null
  const n = Number(key)
  return Number.isInteger(n) && n >= 1 && n <= 9 ? (HQ_SECTIONS[n - 1] ?? null) : null
}

// Tabs of the four built sections. Each tab is one existing panel; the first one opens by default.
export const HQ_TABS = {
  inbox: ['notifications', 'approvals'],
  clients: ['pipeline', 'clients', 'site', 'calls', 'prospects'],
  projects: ['projects', 'payments'],
  documents: ['documents', 'referrals', 'reviews'],
  content: ['feed', 'calendar', 'orders'],
  finance: ['invoices', 'payments', 'costs'],
} as const satisfies Partial<Record<HqSectionId, readonly string[]>>

export type HqTabbed = keyof typeof HQ_TABS

export const isTabbed = (v: string): v is HqTabbed => v in HQ_TABS

export function sectionTab(section: HqTabbed, tab: string | null | undefined): string {
  const tabs: readonly string[] = HQ_TABS[section]
  return tab && tabs.includes(tab) ? tab : tabs[0]!
}

// The old hub talks in (panel, tab); panels opened from a client card (a project, an invoice, a lead)
// go to the HQ section that now holds the same panel, everything else to the pixel office.
const MAP: Record<string, { section: HqTabbed; tab: string }> = {
  'sales:leads': { section: 'clients', tab: 'pipeline' },
  'sales:clients': { section: 'clients', tab: 'clients' },
  'sales:site': { section: 'clients', tab: 'site' },
  'sales:calls': { section: 'clients', tab: 'calls' },
  'sales:prospects': { section: 'clients', tab: 'prospects' },
  'production:projects': { section: 'projects', tab: 'projects' },
  'backoffice:invoices': { section: 'projects', tab: 'payments' },
  'backoffice:documents': { section: 'documents', tab: 'documents' },
  'backoffice:referrals': { section: 'documents', tab: 'referrals' },
  'backoffice:reviews': { section: 'documents', tab: 'reviews' },
  'director:inbox': { section: 'inbox', tab: 'notifications' },
  'director:approvals': { section: 'inbox', tab: 'approvals' },
}

const safe = (v: string | null | undefined) => (v && /^[\w:.\-Ѐ-ӿ %]{1,80}$/.test(v) ? v : null)

export function hqHref(panel: string, tab?: string | null, focus?: string | null): string {
  const hit = MAP[`${panel}:${tab ?? ''}`] ?? (!tab ? MAP[`${panel}:${panel === 'sales' ? 'leads' : panel === 'production' ? 'projects' : panel === 'backoffice' ? 'invoices' : ''}`] : undefined)
  const f = safe(focus)
  if (hit) {
    const p = new URLSearchParams({ tab: hit.tab })
    if (f) p.set('focus', f)
    return `/admin/${hit.section}?${p}`
  }
  const p = new URLSearchParams({ panel })
  const t = safe(tab)
  if (t) p.set('tab', t)
  if (f) p.set('focus', f)
  return `/admin/office?${p}`
}
