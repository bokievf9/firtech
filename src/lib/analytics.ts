// Yandex Metrika goals. Without NEXT_PUBLIC_YM_ID no tag is loaded and track() does nothing, so
// local runs and checks never send real hits. Each goal must also be created in the counter (type
// "JavaScript event", identifier = the goal name below) to show up in reports.

export type GoalParams = {
  lead_sent: [params: { service: string }]
  telegram_click: [params: { place: string }]
  // Main buttons, marked with data-cta="<place>" (hero_builder, hero_contact, header, menu, footer,
  // mobile_bar, article_builder, referral_copy).
  cta_click: [params: { place: string }]
  estimate_handoff: [params: { service: string }]
  builder_step: [params: { step: number }]
  builder_sent: [params: { service: string }]
  // Contact left to open the PDF estimate.
  estimate_pdf: [params: { service: string }]
  builder_link_copied: []
  extra_discuss: [params: { service: string }]
  direction_discuss: [params: { source: string }]
  // On-page receptionist chat (stage A): opened (source: fab, hero, demo, hash) and each reply
  // state reached (intake, contact, done). Never the visitor's text.
  chat_open: [params: { source: string }]
  chat_state: [params: { state: string }]
  // Free audit ordered (the form got ok from HQ, also for a repeat order).
  audit_sent: []
  // A click on an offer card in the cabinet (id of the offer, e.g. product-admin, audit, second).
  cabinet_offer: [params: { offer: string }]
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

// Security 2026-11-23 (P1-7): Metrika never sees the private parts of the site. Not loaded (and switched
// off through `disableYaCounter<id>` after a client-side move) on the cabinet, payment pages, demos and
// unsubscribe links; webvisor is off; every hit is sent without query or hash (?k= of an invoice, the
// unsubscribe ?token=, the demo key, ?lead= never leave the site).
const privateSections = new Set(['cabinet', 'pay', 'demo', 'agent', 'admin'])

export function metrikaAllowed(pathname: string | null | undefined): boolean {
  const parts = String(pathname ?? '').split(/[?#]/)[0]!.split('/').filter(Boolean).map((p) => p.toLowerCase())
  const rest = parts[0] === 'ru' || parts[0] === 'en' ? parts.slice(1) : parts
  if (rest.length > 0 && privateSections.has(rest[0]!)) return false
  return !parts.some((p) => p.includes('unsubscribe'))
}

// origin + path only. Anything that does not parse becomes '' (no hit).
export function hitUrl(href: string | null | undefined): string {
  try {
    const u = new URL(String(href ?? ''))
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
    return `${u.origin}${u.pathname}`
  } catch {
    return ''
  }
}

// The official tag with `defer: true` (no automatic hit with the full address) and one hit sent by hand
// without the query; webvisor off.
export function metrikaInitScript(id: number): string {
  const n = Math.trunc(Number(id))
  return `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js?id=${n}","ym");ym(${n},"init",{defer:true,clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:false,trackHash:false,ssr:true});var fr=(document.referrer||"").split(/[?#]/)[0];ym(${n},"hit",location.origin+location.pathname,fr?{referer:fr}:{});`
}

// Page view after a client-side navigation (the first view is sent by the init script).
export function trackHit(rawUrl: string, rawReferer?: string) {
  const id = ymId()
  const ym = getYm()
  if (!id || !ym) return
  const url = /^https?:/i.test(rawUrl) ? hitUrl(rawUrl) : rawUrl.split(/[?#]/)[0]!
  const referer = rawReferer ? (/^https?:/i.test(rawReferer) ? hitUrl(rawReferer) : rawReferer.split(/[?#]/)[0]) : ''
  if (!url) return
  try {
    if (referer) ym(id, 'hit', url, { referer })
    else ym(id, 'hit', url)
  } catch {
    // Same as above.
  }
}
