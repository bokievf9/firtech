// The CRM workplace of /admin (Shell): a fixed list of sections with English names (owner 2026-11-23).
// Office is one of them: the living pixel office, information only. Pure data and helpers, no React,
// so they are unit-tested (tests/hq-shell.test.mjs).

export type HqSectionId =
  | 'dashboard'
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
  | 'knowledge'
  | 'quality'
  | 'office'

export type HqGroupId = 'work' | 'clients' | 'company' | 'control'

export type HqSection = {
  id: HqSectionId
  group: HqGroupId
  label: string
  state: 'ready'
  // Where the section lives: /admin/<id>.
  href: string
}

export const HQ_SECTIONS: readonly HqSection[] = [
  { id: 'dashboard', group: 'work', label: 'Dashboard', state: 'ready', href: '/admin/dashboard' },
  { id: 'inbox', group: 'work', label: 'Inbox', state: 'ready', href: '/admin/inbox' },
  { id: 'approvals', group: 'work', label: 'Approvals', state: 'ready', href: '/admin/approvals' },
  { id: 'tasks', group: 'work', label: 'Tasks', state: 'ready', href: '/admin/tasks' },
  { id: 'calendar', group: 'work', label: 'Calendar', state: 'ready', href: '/admin/calendar' },
  { id: 'chats', group: 'work', label: 'Chats', state: 'ready', href: '/admin/chats' },
  { id: 'clients', group: 'clients', label: 'Clients', state: 'ready', href: '/admin/clients' },
  { id: 'projects', group: 'clients', label: 'Projects', state: 'ready', href: '/admin/projects' },
  { id: 'documents', group: 'clients', label: 'Documents', state: 'ready', href: '/admin/documents' },
  { id: 'finance', group: 'clients', label: 'Finance', state: 'ready', href: '/admin/finance' },
  { id: 'office', group: 'company', label: 'Office', state: 'ready', href: '/admin/office' },
  { id: 'content', group: 'company', label: 'Content', state: 'ready', href: '/admin/content' },
  { id: 'agents', group: 'company', label: 'Agents', state: 'ready', href: '/admin/agents' },
  { id: 'processes', group: 'company', label: 'Processes', state: 'ready', href: '/admin/processes' },
  { id: 'knowledge', group: 'company', label: 'Knowledge', state: 'ready', href: '/admin/knowledge' },
  { id: 'settings', group: 'company', label: 'Settings', state: 'ready', href: '/admin/settings' },
  { id: 'quality', group: 'control', label: 'Quality', state: 'ready', href: '/admin/quality' },
  { id: 'audit', group: 'control', label: 'Audit log', state: 'ready', href: '/admin/audit' },
  { id: 'analytics', group: 'control', label: 'Analytics', state: 'ready', href: '/admin/analytics' },
] as const

// The menu groups, in order (owner audit 2026-11-23): labels are English like the sections.
export const HQ_GROUPS: readonly { id: HqGroupId; label: string }[] = [
  { id: 'work', label: 'Work' },
  { id: 'clients', label: 'Clients' },
  { id: 'company', label: 'Company' },
  { id: 'control', label: 'Control' },
] as const

export const sectionById = (id: string) => HQ_SECTIONS.find((s) => s.id === id)

// Keys 1-9 open the first nine sections in the menu order (the Dashboard is 1, the Inbox 2).
export function sectionForKey(key: string): HqSection | null {
  if (key.length !== 1) return null
  const n = Number(key)
  return Number.isInteger(n) && n >= 1 && n <= 9 ? (HQ_SECTIONS[n - 1] ?? null) : null
}

// Tabs of the four built sections. Each tab is one existing panel; the first one opens by default.
export const HQ_TABS = {
  inbox: ['notifications', 'approvals'],
  clients: ['pipeline', 'clients', 'site', 'calls', 'prospects'],
  projects: ['projects'],
  documents: ['documents', 'referrals', 'reviews'],
  content: ['feed', 'orders', 'campaigns'],
  finance: ['invoices', 'payments', 'costs'],
} as const satisfies Partial<Record<HqSectionId, readonly string[]>>

export type HqTabbed = keyof typeof HQ_TABS

export const isTabbed = (v: string): v is HqTabbed => v in HQ_TABS

export function sectionTab(section: HqTabbed, tab: string | null | undefined): string {
  const tabs: readonly string[] = HQ_TABS[section]
  return tab && tabs.includes(tab) ? tab : tabs[0]!
}

// Links from HQ objects talk in (panel, tab); every panel now lives in a Shell section.
const MAP: Record<string, { section: HqTabbed; tab: string }> = {
  'sales:leads': { section: 'clients', tab: 'pipeline' },
  'sales:clients': { section: 'clients', tab: 'clients' },
  'sales:site': { section: 'clients', tab: 'site' },
  'sales:calls': { section: 'clients', tab: 'calls' },
  'sales:prospects': { section: 'clients', tab: 'prospects' },
  'production:projects': { section: 'projects', tab: 'projects' },
  'backoffice:invoices': { section: 'finance', tab: 'invoices' },
  'backoffice:payments': { section: 'finance', tab: 'payments' },
  'backoffice:documents': { section: 'documents', tab: 'documents' },
  'backoffice:referrals': { section: 'documents', tab: 'referrals' },
  'backoffice:reviews': { section: 'documents', tab: 'reviews' },
  'director:inbox': { section: 'inbox', tab: 'notifications' },
}

// A click on a department zone of the Office goes to the section that holds that department's work.
export const ZONE_SECTION: Record<string, HqSectionId> = {
  director: 'inbox',
  marketing: 'content',
  sales: 'clients',
  support: 'chats',
  production: 'projects',
  backoffice: 'finance',
  company: 'agents',
}

const safe = (v: string | null | undefined) => (v && /^[\w:.\-Ѐ-ӿ %]{1,80}$/.test(v) ? v : null)

export function hqHref(panel: string, tab?: string | null, focus?: string | null): string {
  // A task opens its card on the Tasks page.
  if (panel === 'director' && tab === 'tasks') {
    const id = safe(focus)
    return id ? `/admin/tasks?task=${encodeURIComponent(id)}` : '/admin/tasks'
  }
  // Approving lives in one place: the Approvals section.
  if (panel === 'director' && tab === 'approvals') return '/admin/approvals'
  const hit = MAP[`${panel}:${tab ?? ''}`] ?? (!tab ? MAP[`${panel}:${panel === 'sales' ? 'leads' : panel === 'production' ? 'projects' : panel === 'backoffice' ? 'invoices' : ''}`] : undefined)
  const f = safe(focus)
  if (hit) {
    const p = new URLSearchParams({ tab: hit.tab })
    if (f) p.set('focus', f)
    return `/admin/${hit.section}?${p}`
  }
  // Panels without a tab of their own (support tickets, marketing, company) open their section.
  return `/admin/${ZONE_SECTION[panel] ?? 'inbox'}`
}
