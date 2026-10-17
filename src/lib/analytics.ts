// Yandex Metrika goals. Without NEXT_PUBLIC_YM_ID no tag is loaded and track() does nothing, so
// local runs and checks never send real hits. Each goal must also be created in the counter (type
// "JavaScript event", identifier = the goal name below) to show up in reports.

export type GoalParams = {
  lead_sent: [params: { service: string }]
  telegram_click: [params: { place: string }]
  // Main buttons, marked with data-cta="<place>" (hero_builder, hero_contact, header, menu, footer,
  // mobile_bar, article_builder).
  cta_click: [params: { place: string }]
  estimate_handoff: [params: { service: string }]
  builder_step: [params: { step: number }]
  builder_sent: [params: { service: string }]
  builder_link_copied: []
  extra_discuss: [params: { service: string }]
}
export type Goal = keyof GoalParams

type Ym = (id: number, method: string, ...args: unknown[]) => void

// Digits only: the id is placed into an inline script.
export function ymId(): number | null {
  const raw = (process.env.NEXT_PUBLIC_YM_ID ?? '').trim()
  return /^\d{1,12}$/.test(raw) ? Number(raw) : null
}

function getYm(): Ym | null {
  const ym = (globalThis as { ym?: unknown }).ym
  return typeof ym === 'function' ? (ym as Ym) : null
}

export function track<G extends Goal>(goal: G, ...[params]: GoalParams[G]) {
  const id = ymId()
  const ym = getYm()
  if (!id || !ym) return
  try {
    if (params) ym(id, 'reachGoal', goal, params)
    else ym(id, 'reachGoal', goal)
  } catch {
    // Analytics must never break the page.
  }
}

// Page view after a client-side navigation (the first view is counted by "init").
export function trackHit(url: string, referer?: string) {
  const id = ymId()
  const ym = getYm()
  if (!id || !ym) return
  try {
    if (referer) ym(id, 'hit', url, { referer })
    else ym(id, 'hit', url)
  } catch {
    // Same as above.
  }
}
