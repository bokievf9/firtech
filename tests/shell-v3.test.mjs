import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, beforeEach, test } from 'node:test'
import { pathToFileURL } from 'node:url'

// Пульт v3 (docs/shell.md): view models of the hub and the CRM panels, the proxy whitelist for the
// new contract, the render file proxy and the dev mock.
const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true }
    if (specifier === 'next/server') return next('next/server.js', context)
    if (specifier.startsWith('@/')) {
      const base = new URL(specifier.slice(2), src).href
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
        try {
          return next(candidate, context)
        } catch {}
      }
    }
    return next(specifier, context)
  },
})

const root = await mkdtemp(path.join(tmpdir(), 'firtech-pult-v3-test-'))
after(() => rm(root, { recursive: true, force: true }))

const p = await import('../src/lib/shell.ts')
const auth = await import('../src/lib/admin-auth.ts')
const proxy = await import('../src/lib/hq-admin.ts')
const files = await import('../src/lib/hq-files.ts')
const hqRoute = await import('../src/app/api/admin/hq/[...path]/route.ts')
const fileRoute = await import('../src/app/api/admin/files/[...path]/route.ts')
const { createHqMock } = await import('../src/lib/hq-admin-mock.ts')
const { admin } = await import('../src/content/admin.ts')

const NOW = Date.parse('2026-11-19T10:00:00.000Z')
const TOKEN = 'test-session-token-pult'
let dirs = 0
const realFetch = globalThis.fetch
beforeEach(async () => {
  process.env.DATA_DIR = path.join(root, `d${++dirs}`)
  await mkdir(process.env.DATA_DIR, { recursive: true })
  const id = createHash('sha256').update(TOKEN).digest('hex')
  await writeFile(path.join(process.env.DATA_DIR, 'admin.json'), JSON.stringify({ codes: [], issued: [], sessions: [{ id, createdAt: Date.now(), expiresAt: Date.now() + 60_000 }] }))
  delete process.env.HQ_ADMIN_URL
  delete process.env.HQ_ADMIN_TOKEN
  delete process.env.HQ_OFFICE_TOKEN
  globalThis.fetch = realFetch
})

const ORIGIN = 'http://localhost'
function request(url, { method = 'GET', body, cookie = TOKEN, headers: extra = {} } = {}) {
  const headers = { host: 'localhost', 'content-type': 'application/json', origin: ORIGIN, ...extra }
  if (cookie) headers.cookie = `${auth.SESSION_COOKIE}=${cookie}`
  return new Request(`${ORIGIN}${url}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
}
const ctx = (...segments) => ({ params: Promise.resolve({ path: segments }) })
const hqCall = (method, segments, opts = {}) => hqRoute[method](request(`/api/admin/hq/${segments.join('/')}`, { method, ...opts }), ctx(...segments))

// ---- hub ----------------------------------------------------------------------------------------

test('hub: departments default to zero, unknown fields and bad rows are dropped, links parsed', () => {
  assert.equal(p.normalizeHub(null), null)
  assert.equal(p.normalizeHub([]), null)
  const hub = p.normalizeHub({
    ok: true,
    generatedAt: '2026-11-19T10:00:00Z',
    departments: { sales: { pending: 2, approvals: 1, alerts: -3, running: 'x', secret: 1 }, 'back-office': { alerts: 1 }, evil: { pending: 9 } },
    inbox: [
      { id: 'n1', at: '2026-11-19T09:00:00Z', dept: 'sales', kind: 'lead', title: 'Лид', link: 'leads:12' },
      { id: 'n2', at: '2026-11-19T09:30:00Z', dept: 'nope', kind: 'weird', title: 'x', link: 'javascript:alert(1)' },
      { id: 'n3', at: 'not a date', kind: 'info' },
      'junk',
    ],
  })
  assert.deepEqual(hub.departments.sales, { pending: 2, approvals: 1, alerts: 0, running: 0, lastActivityAt: null })
  assert.equal(hub.departments.backoffice.alerts, 1)
  assert.equal('evil' in hub.departments, false)
  assert.equal(hub.inbox.length, 2)
  assert.equal(hub.inbox[0].id, 'n2', 'newest first')
  assert.equal(hub.inbox[0].kind, 'info')
  assert.equal(hub.inbox[0].dept, null)
  assert.equal(hub.inbox[0].link, null)
  assert.deepEqual(hub.inbox[1].link, { panel: 'sales', tab: 'leads', id: '12' })
})

test('links: every contract kind opens its panel and object', () => {
  assert.deepEqual(p.parseLink('clients:c:алиса'), { panel: 'sales', tab: 'clients', id: 'c:алиса' })
  assert.deepEqual(p.parseLink('projects:2'), { panel: 'production', tab: 'projects', id: '2' })
  assert.deepEqual(p.parseLink('invoices:5'), { panel: 'backoffice', tab: 'invoices', id: '5' })
  assert.deepEqual(p.parseLink('content:item:77'), { panel: 'marketing', tab: 'content', id: '77' })
  assert.deepEqual(p.parseLink('content:item:a12'), { panel: 'marketing', tab: 'content', id: 'a12' })
  assert.deepEqual(p.parseLink('approvals:91'), { panel: 'director', tab: 'approvals', id: '91' })
  assert.deepEqual(p.parseLink('tickets:4'), { panel: 'support', tab: 'tickets', id: '4' })
  for (const bad of ['', 'leads', 'nope:1', 'leads:<script>', 5, null, 'leads:' + 'x'.repeat(200)]) assert.equal(p.parseLink(bad), null, String(bad))
})

test('zones: rooms map to panels, keys 1-7, glow levels', () => {
  assert.equal(p.roomPanel('back-office'), 'backoffice')
  assert.equal(p.roomPanel('lobby'), 'sales')
  assert.equal(p.roomPanel('meeting'), 'director')
  assert.equal(p.roomPanel('builders'), 'production')
  assert.equal(p.roomPanel('servers'), 'company')
  assert.equal(p.roomPanel('lounge'), null)
  assert.deepEqual(['1', '2', '3', '4', '5', '6', '7'].map(p.panelForKey), ['director', 'marketing', 'sales', 'support', 'production', 'backoffice', 'company'])
  assert.equal(p.panelForKey('8'), null)
  assert.equal(p.panelForKey('12'), null)
  const hub = p.normalizeHub({ departments: { sales: { approvals: 1 }, support: { pending: 3 } } })
  const glow = p.zoneGlow(hub.departments)
  assert.equal(glow.sales, 1)
  assert.equal(glow.support, 0.5)
  assert.equal(glow.marketing, 0)
  assert.equal(p.zoneGlow(null).director, 0)
  for (const panel of p.PANELS) assert.ok(p.PANEL_TABS[panel].length >= 1)
})

// ---- leads ----------------------------------------------------------------------------------------

test('leads: rows are sanitized, the owner note joins the notes, stage defaults to new', () => {
  const list = p.normalizeLeads({
    available: true,
    items: [
      { id: 7, name: 'Нигина', stage: 'qualified', note: 'перезвонить', notes: [{ at: '2026-11-19T09:00:00Z', text: 'первая' }], estimateUsd: 420, hasDomain: true, callAt: 'x', lostReason: 'дорого', secret: 'x' },
      { id: 'x' },
      { id: 8, stage: 'bogus', task: 'старое поле задачи' },
    ],
  })
  assert.equal(list.items.length, 2)
  const [a, b] = list.items
  assert.deepEqual(a.notes.map((n) => n.text), ['перезвонить', 'первая'])
  assert.equal(a.hasDomain, true)
  assert.equal(a.hasHosting, null)
  assert.equal(a.callAt, null)
  assert.equal(a.lostReason, 'дорого')
  assert.equal('secret' in a, false)
  assert.equal(b.stage, 'new')
  assert.equal(b.brief, 'старое поле задачи')
  assert.equal(p.normalizeLeads({ available: false, items: [{ id: 1 }] }).items.length, 0)
})

test('stage transitions: paid back to new is refused, same and unknown are no-ops', () => {
  assert.deepEqual(p.stageMove('new', 'qualified'), { ok: true })
  assert.deepEqual(p.stageMove('project', 'lost'), { ok: true })
  assert.deepEqual(p.stageMove('paid', 'new'), { ok: false, reason: 'illegal' })
  assert.deepEqual(p.stageMove('new', 'new'), { ok: false, reason: 'same' })
  assert.deepEqual(p.stageMove('new', 'won'), { ok: false, reason: 'unknown' })
  const items = p.normalizeLeads({ items: [{ id: 1, stage: 'new' }, { id: 2, stage: 'paid' }] }).items
  const moved = p.moveLead(items, 1, 'proposal')
  assert.equal(moved[0].stage, 'proposal')
  assert.equal(items[0].stage, 'new', 'the original array is untouched for the rollback')
  const cols = p.leadColumns(moved)
  assert.equal(cols.proposal.length, 1)
  assert.equal(cols.paid.length, 1)
  assert.deepEqual(Object.keys(cols), [...p.LEAD_STAGES, 'lost'])
  assert.deepEqual(p.normalizeReply({ sent: false, via: 'carrier-pigeon' }), { sent: false, via: 'none' })
  assert.deepEqual(p.normalizeReply({ sent: true, via: 'web' }), { sent: true, via: 'web' })
})

// ---- clients ------------------------------------------------------------------------------------

test('clients: ids kept as strings, client 360 sanitizes every block', () => {
  const rows = p.normalizeClientRows({ items: [{ id: '3', name: 'Алиса', sources: ['cabinet', 5] }, { id: 'c:боб', name: 'Боб' }, { name: 'без id' }] })
  assert.deepEqual(rows.items.map((r) => [r.id, r.cabinet]), [['3', true], ['c:боб', false]])
  assert.equal(p.clientPath('c:боб'), 'crm/clients/c%3A%D0%B1%D0%BE%D0%B1')
  assert.equal(p.normalizeClient360({ client: {} }), null)
  const c = p.normalizeClient360({
    client: { id: 'c:алиса', name: 'Алиса', cabinet: true },
    projects: [{ id: 2, client: 'Алиса', status: 'active' }],
    invoices: [{ id: 5, number: 'FT-1', payUrl: 'javascript:alert(1)', amountUsd: 300 }],
    tickets: [{ id: 3, text: 'не работает', status: 'answered', answer: 'починили' }],
    touches: [{ at: '2026-11-18T00:00:00Z', kind: 'lead', title: 'старое' }, { at: '2026-11-19T00:00:00Z', kind: 'payment', title: 'новое' }, { at: 'x' }],
  })
  assert.equal(c.client.cabinet, true)
  assert.equal(c.invoices[0].payUrl, null)
  assert.equal(c.tickets[0].answer, 'починили')
  assert.deepEqual(c.touches.map((t) => t.title), ['новое', 'старое'])
  assert.deepEqual(c.documents, [])
})

// ---- projects -----------------------------------------------------------------------------------

test('projects: detail keeps milestones, drops non-http issue links; columns by status', () => {
  const d = p.normalizeProjectDetail({
    item: { id: 2, client: 'Алиса', status: 'paused' },
    milestones: [{ id: 21, kind: 'brief', title: 'Бриф', dueAt: '2026-11-20T00:00:00Z', doneAt: null }, { title: 'без id' }],
    tasks: [{ id: 5, title: 'Макет', status: 'running', assignee: 'Builder' }],
    issues: [{ number: 12, title: 'ok', url: 'https://github.com/x/y/issues/12' }, { number: 13, title: 'bad', url: 'data:text/html,x' }],
  })
  assert.equal(d.milestones.length, 1)
  assert.equal(d.milestones[0].id, '21')
  assert.equal(d.issues[1].url, null)
  assert.equal(p.projectColumn(d.item), 'paused')
  assert.equal(p.projectColumn({ status: 'weird' }), 'draft')
  assert.equal(p.normalizeProjectDetail({ item: { id: 'x' } }), null)
})

// ---- invoices -----------------------------------------------------------------------------------

test('TON tx: base64 and base64url to hex, hex passes, anything else is null', () => {
  const hex = 'bd0e4391cd33f715ed4bcaba035f20a9df0276061f474dc531e2269f6957738'.padEnd(64, '1')
  const bytes = Buffer.from(hex, 'hex')
  assert.equal(p.tonTxHex(bytes.toString('base64')), hex)
  assert.equal(p.tonTxHex(bytes.toString('base64url')), hex)
  assert.equal(p.tonTxHex(hex.toUpperCase()), hex)
  assert.equal(p.tonTxHex('abc'), null)
  assert.equal(p.tonTxHex(Buffer.alloc(20).toString('base64')), null)
  assert.equal(p.txExplorerUrl('usdt_ton', bytes.toString('base64')), `https://tonviewer.com/transaction/${hex}`)
  assert.equal(p.txExplorerUrl('usdt_trc20', hex), `https://tronscan.org/#/transaction/${hex}`)
  assert.equal(p.txExplorerUrl('usdt_trc20', 'not-a-hash'), null)
  assert.equal(p.txExplorerUrl('manual', hex), null)
  assert.equal(p.txExplorerUrl('ton', ''), null)
})

test('invoices: rows, overdue, lead and project ids', () => {
  const list = p.normalizeInvoices({ items: [{ id: 6, number: 'FT-6', status: 'issued', dueDate: '2026-11-18T00:00:00Z', amountUsd: 600, leadId: 4, projectId: 'x', payUrl: 'https://firtech.pro/ru/pay/FT-6?k=1' }] })
  const inv = list.items[0]
  assert.equal(inv.leadId, 4)
  assert.equal(inv.projectId, null)
  assert.equal(inv.payUrl, 'https://firtech.pro/ru/pay/FT-6?k=1')
  assert.equal(p.isOverdue(inv, NOW), true)
  assert.equal(p.isOverdue({ ...inv, status: 'paid' }, NOW), false)
  assert.equal(p.normalizeInvoiceItem({ item: { id: 6, status: 'paid' } }).status, 'paid')
})

// ---- content ------------------------------------------------------------------------------------

test('render paths: only plain segments inside the renders with a known extension', () => {
  assert.equal(p.safeRenderPath('content/2026-w47/clip-1.mp4'), 'content/2026-w47/clip-1.mp4')
  assert.equal(p.safeRenderPath(['a', 'b.png']), 'a/b.png')
  for (const bad of ['../etc/passwd.png', 'a/../b.png', '/abs/x.png', 'a//b.png', 'x.svg', 'noext', '.hidden.png', 'a/..png', 'a\\b.png', 'a/%2e%2e/b.png', 'a/b/c/d/e/f/g.png']) {
    assert.equal(p.safeRenderPath(bad), null, bad)
  }
  assert.equal(p.renderType('x.mp4'), 'video/mp4')
  assert.equal(p.fileUrl('a b/c.png'), '/api/admin/files/a%20b/c.png')
})

test('content: week shape, unsafe files and urls dropped, string ids for articles', () => {
  const w = p.normalizeContent({
    week: '2026-W47',
    days: [
      { date: '2026-11-16', items: [{ id: 77, kind: 'clip', status: 'pending', files: [{ path: 'c/1.mp4', type: 'mp4' }, { path: '../x.png' }], caption: { instagram: 'привет', evil: 'x' }, publishedUrl: 'javascript:1', sourceSlug: 'Bad Slug' }] },
      { date: '2026-11-17', items: [{ id: 'a12', kind: 'article', status: 'weird' }] },
      { date: 'nope', items: [] },
    ],
    summary: { pending: 1 },
  })
  assert.equal(w.week, '2026-W47')
  assert.equal(w.days.length, 2)
  const [clip] = w.days[0].items
  assert.deepEqual(clip.files.map((f) => f.path), ['c/1.mp4'])
  assert.equal(clip.caption.instagram, 'привет')
  assert.equal('evil' in clip.caption, false)
  assert.equal(clip.publishedUrl, null)
  assert.equal(clip.sourceSlug, null)
  const article = w.days[1].items[0]
  assert.equal(article.id, 'a12')
  assert.equal(article.status, 'draft')
  const replaced = p.replaceContentItem(w, { ...clip, status: 'approved' })
  assert.equal(replaced.days[0].items[0].status, 'approved')
  assert.equal(w.days[0].items[0].status, 'pending')
})

test('weeks: ISO weeks in the company zone, shifting across a year end', () => {
  assert.equal(p.isoWeek(NOW), '2026-W47')
  assert.equal(p.isoWeek(Date.parse('2026-01-01T12:00:00Z'), 'UTC'), '2026-W01')
  assert.equal(p.isoWeek(Date.parse('2027-01-01T12:00:00Z'), 'UTC'), '2026-W53')
  assert.equal(p.shiftWeek('2026-W53', 1), '2027-W01')
  assert.equal(p.shiftWeek('2026-W01', -1), '2025-W52')
  assert.equal(p.shiftWeek('junk', 1), 'junk')
  assert.deepEqual(p.weekDates('2026-W47'), ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'])
})

// ---- metrics, company, support, palette ---------------------------------------------------------

test('company: routines, limits (0 = none), trust, empty playbooks', () => {
  const c = p.normalizeCompany({
    routines: [{ name: 'marketing-article-daily', enabled: false }, { name: '../bad' }],
    costs: { byDept: { marketing: { monthUsd: 12, limitUsd: 15 }, director: { monthUsd: 2, limitUsd: 0 } }, byDay: [{ date: '2026-11-19', usd: 0.4 }, { date: 'x' }] },
    trust: [{ kind: 'billing_invoice', level: 1, locked: true }, { kind: 'x y' }],
    playbooks: [],
    workers: [{ id: 'renderer', state: 'working' }],
  })
  assert.deepEqual(c.routines.map((r) => [r.name, r.enabled]), [['marketing-article-daily', false]])
  assert.equal(p.limitShare(c.costs.byDept[0]), 0.8)
  assert.equal(p.limitShare(c.costs.byDept[1]), null)
  assert.equal(c.costs.byDay.length, 1)
  assert.deepEqual(c.trust, [{ kind: 'billing_invoice', level: 1, locked: true, approvals: 0 }])
  assert.deepEqual(c.playbooks, [])
  assert.equal(c.workers[0].id, 'renderer')
})

test('palette: every word must match, title starts rank first, ё equals е', () => {
  const entries = [
    { id: '1', group: 'g', title: 'Клиенты', hint: 'Продажи' },
    { id: '2', group: 'g', title: 'Пакет недели', keywords: 'контент' },
    { id: '3', group: 'g', title: 'Счета', hint: 'Бэк-офис', keywords: 'оплата' },
    { id: '4', group: 'g', title: 'Отчёт', keywords: 'сводка' },
  ]
  assert.deepEqual(p.searchPalette(entries, 'пак').map((e) => e.id), ['2'])
  assert.deepEqual(p.searchPalette(entries, 'отчет').map((e) => e.id), ['4'])
  assert.deepEqual(p.searchPalette(entries, 'оплата счета').map((e) => e.id), ['3'])
  assert.equal(p.searchPalette(entries, '').length, 4)
  assert.equal(p.searchPalette(entries, 'zzz').length, 0)
})

// ---- proxy and file routes ----------------------------------------------------------------------

test('proxy v3: no session 401; bodies checked; client ids and 4-segment paths allowed', async () => {
  assert.equal((await hqCall('GET', ['hub'], { cookie: null })).status, 401)
  assert.equal((await hqCall('POST', ['crm', 'leads', '7'], { body: { stage: 'new' }, cookie: null })).status, 401)
  const seen = []
  process.env.HQ_ADMIN_URL = 'http://hq.test/admin'
  process.env.HQ_ADMIN_TOKEN = 'secret-admin'
  globalThis.fetch = async (url, init) => {
    seen.push([String(url), init.method, init.body, init.headers['x-admin-token']])
    return new Response(JSON.stringify({ ok: true, item: {} }), { status: 200 })
  }
  assert.equal((await hqCall('GET', ['hub'])).status, 200)
  assert.equal((await hqCall('POST', ['crm', 'leads', '7'], { body: { stage: 'paid' } })).status, 200)
  assert.equal((await hqCall('POST', ['crm', 'leads', '7'], { body: { stage: 'won' } })).status, 400)
  assert.equal((await hqCall('POST', ['crm', 'leads', '7'], { body: {} })).status, 400)
  assert.equal((await hqCall('POST', ['crm', 'leads', '7', 'reply'], { body: { text: '  ' } })).status, 400)
  assert.equal((await hqCall('POST', ['crm', 'leads', '7', 'call'], { body: { at: 'tomorrow' } })).status, 400)
  assert.equal((await hqCall('POST', ['crm', 'leads', '7', 'call'], { body: { at: '2026-11-20T10:00:00.000Z' } })).status, 200)
  assert.equal((await hqCall('GET', ['crm', 'clients', 'c%3A%D0%B1%D0%BE%D0%B1'])).status, 200)
  assert.equal((await hqCall('GET', ['crm', 'clients', 'c:боб'])).status, 200)
  assert.equal((await hqCall('GET', ['crm', 'clients', '..'])).status, 404)
  assert.equal((await hqCall('POST', ['crm', 'projects', '2'], { body: { action: 'set_status', status: 'archived' } })).status, 400)
  assert.equal((await hqCall('POST', ['crm', 'projects', '2'], { body: { action: 'complete_milestone', milestoneId: 21 } })).status, 200)
  assert.equal((await hqCall('POST', ['crm', 'invoices', '5'], { body: { action: 'refund' } })).status, 400)
  assert.equal((await hqCall('POST', ['content', 'a12'], { body: { action: 'revise' } })).status, 400)
  assert.equal((await hqCall('POST', ['content', 'a12'], { body: { action: 'revise', note: 'короче' } })).status, 200)
  // The company routes the old office used (routines, trust, playbooks) are not in the whitelist any more.
  assert.equal((await hqCall('POST', ['company', 'routines', 'marketing-article-daily', 'run'], { body: {} })).status, 404)
  assert.equal((await hqCall('POST', ['company', 'trust', 'billing_invoice'], { body: { level: 1 } })).status, 404)
  assert.equal((await hqCall('GET', ['company', 'secrets'])).status, 404)
  // The token is sent to HQ and never returned; the client id is encoded on the way.
  assert.ok(seen.every(([, , , token]) => token === 'secret-admin'))
  assert.ok(seen.some(([url]) => url === 'http://hq.test/admin/crm/clients/c%3A%D0%B1%D0%BE%D0%B1'))
  const res = await hqCall('GET', ['hub'])
  assert.doesNotMatch(await res.text(), /secret-admin/)
})

test('proxy v3: HQ refusal reasons pass through as a short code', async () => {
  process.env.HQ_ADMIN_URL = 'http://hq.test/admin'
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, error: 'not_started', reason: 'disabled' }), { status: 409 })
  const res = await proxy.callHqAdmin('POST', 'processes/drill', { body: { action: 'start' } })
  assert.deepEqual(res, { ok: false, error: 'not_started', reason: 'disabled' })
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, error: 'x', reason: '<b>long text</b>' }), { status: 409 })
  assert.deepEqual(await proxy.callHqAdmin('POST', 'processes/drill', { body: { action: 'start' } }), { ok: false, error: 'x' })
})

test('file proxy: session required, paths outside the renders refused, range and type passed', async () => {
  const get = (segments, opts) => fileRoute.GET(request(`/api/admin/files/${segments.join('/')}`, opts), ctx(...segments))
  assert.equal((await get(['c', 'x.png'], { cookie: null })).status, 401)
  assert.equal((await get(['..', 'etc', 'passwd.png'])).status, 404)
  assert.equal((await get(['c', 'x.exe'])).status, 404)
  // Development without HQ: a labelled SVG for images, 404 for videos.
  let res = await get(['c', 'slide.png'])
  assert.equal(res.headers.get('content-type'), 'image/svg+xml')
  assert.equal((await get(['c', 'clip.mp4'])).status, 404)

  process.env.HQ_ADMIN_URL = 'http://hq.test/admin'
  process.env.HQ_ADMIN_TOKEN = 'secret-admin'
  let sent
  globalThis.fetch = async (url, init) => {
    sent = [String(url), init.headers]
    return new Response('abc', { status: 206, headers: { 'content-type': 'text/html', 'content-range': 'bytes 0-2/10', 'content-length': '3' } })
  }
  res = await get(['c', 'clip.mp4'], { headers: { range: 'bytes=0-2' } })
  assert.equal(res.status, 206)
  assert.equal(res.headers.get('content-type'), 'video/mp4', 'type from the extension, not from upstream')
  assert.equal(res.headers.get('content-range'), 'bytes 0-2/10')
  assert.equal(await res.text(), 'abc')
  assert.equal(sent[0], 'http://hq.test/admin/files/c/clip.mp4')
  assert.equal(sent[1].range, 'bytes=0-2')
  assert.equal(sent[1]['x-admin-token'], 'secret-admin')
  // A weird range is not forwarded.
  await files.proxyRenderFile(['c', 'clip.mp4'], 'bytes=0-2, 5-9')
  assert.equal(sent[1].range, undefined)
  globalThis.fetch = async () => new Response('nope', { status: 401 })
  assert.equal((await get(['c', 'clip.mp4'])).status, 502)
})

// ---- mock ---------------------------------------------------------------------------------------

test('mock: the v3 endpoints answer in the contract shape and keep state', () => {
  const mock = createHqMock(NOW)
  const get = (path, q = {}) => mock('GET', path, q, {}, NOW)
  const post = (path, b) => mock('POST', path, {}, b, NOW)
  const hub = p.normalizeHub(get('hub'))
  assert.ok(hub.inbox.length >= 5)
  assert.ok(hub.inbox.every((i) => i.link))
  const leads = p.normalizeLeads(get('crm/leads'))
  assert.ok(new Set(leads.items.map((l) => l.stage)).size >= 6)
  assert.equal(post('crm/leads/3', { stage: 'new' }).error, 'illegal_transition')
  assert.equal(p.normalizeLeadItem(post('crm/leads/7', { stage: 'qualified' })).stage, 'qualified')
  assert.ok(['telegram', 'web', 'none'].includes(post('crm/leads/7/reply', { text: 'hi' }).via))
  const client = p.normalizeClient360(get('crm/clients/1'))
  assert.equal(client.client.cabinet, true)
  assert.ok(client.touches.length)
  assert.equal(get('crm/clients/c:Боб').ok, true)
  const project = p.normalizeProjectDetail(get('crm/projects/2'))
  const open = project.milestones.find((m) => !m.doneAt)
  post('crm/projects/2', { action: 'complete_milestone', milestoneId: Number(open.id) })
  assert.ok(p.normalizeProjectDetail(get('crm/projects/2')).milestones.find((m) => m.id === open.id).doneAt)
  assert.equal(post('crm/invoices/6', { action: 'mark_paid' }).item.status, 'paid')
  assert.equal(post('crm/invoices/6', { action: 'mark_paid' }).error, 'illegal_transition')
  assert.ok(post('crm/invoices/4', { action: 'remind' }).remindedVia)
  const week = p.normalizeContent(get('content'))
  assert.equal(week.days.length, 7)
  const item = week.days[0].items[0]
  assert.equal(p.normalizeContentItem(post(`content/${item.id}`, { action: 'approve' })).status, 'approved')
  const company = p.normalizeCompany(get('company'))
  assert.ok(company.routines.length && company.trust.length)
  assert.equal(post('company/routines/support-sla-watch/run', {}).error, 'not_started')
  assert.equal(post('company/trust/content_item', { level: 1 }).item.level, 1)
})

// ---- copy ---------------------------------------------------------------------------------------

function* strings(value, at = '') {
  if (typeof value === 'string') yield [at, value]
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) yield* strings(v, `${at}.${k}`)
}

test('copy: hub and CRM panel strings are Russian, filled, without long dashes or AI tells', () => {
  for (const [name, dict] of [['hub', admin.hub], ['pult', admin.pult], ['office.zones', admin.office.zones]]) {
    for (const [at, text] of strings(dict)) {
      assert.ok(text.trim().length > 0, `${name}${at} is empty`)
      assert.doesNotMatch(text, /[–—]/, `${name}${at}`)
      assert.doesNotMatch(text, /TODO|lorem|не просто|это не .*, а /i, `${name}${at}`)
      assert.doesNotMatch(text, /\$\d/, `${name}${at}: no typed prices`)
    }
  }
  // Every panel and tab has a label.
  for (const panel of p.PANELS) {
    assert.ok(admin.hub.panels[panel], panel)
    for (const tab of p.PANEL_TABS[panel]) assert.ok(admin.hub.tabs[tab], tab)
  }
  for (const s of p.ALL_LEAD_STAGES) assert.ok(admin.pult.leads.stages[s], s)
})

// ---- follow-ups (2026-11-20) --------------------------------------------------------------------

test('company tools: tolerant parsing, grouping by prefix, state and limits text', () => {
  assert.deepEqual(p.normalizeCompany({ ok: true }).tools, [], 'the field may be absent')
  const c = p.normalizeCompany({
    tools: [
      { name: 'web.search', departments: ['marketing', 'Bad Dept!', 'sales'], configured: true, callsToday: 4, errorsToday: 1, limits: { timeoutMs: 8000, minGapMs: 1000, cacheTtlMs: 3_600_000, maxResults: 10, junk: { x: 1 } }, env: ['BRAVE_SEARCH_KEY', 'not a key'] },
      { name: 'google.youtube.channel', configured: false, env: ['YT_REFRESH_TOKEN'] },
      { name: 'media.pdf', configured: false },
      { name: '../evil' },
      'garbage',
      { name: 'web.getJson', configured: true, callsToday: -3 },
    ],
  })
  assert.equal(c.tools.length, 4)
  const search = c.tools.find((t) => t.name === 'web.search')
  assert.deepEqual(search.departments, ['marketing', 'sales'])
  assert.deepEqual(search.env, ['BRAVE_SEARCH_KEY'])
  assert.equal(p.limitsText(search.limits), 'timeout 8 s, pause 1 s, cache 1 h, up to 10 results')
  assert.equal(c.tools.find((t) => t.name === 'web.getJson').callsToday, 0)
  assert.equal(p.toolState(search), 'ok')
  assert.equal(p.toolState(c.tools.find((t) => t.name === 'google.youtube.channel')), 'missing')
  assert.equal(p.toolState(c.tools.find((t) => t.name === 'media.pdf')), 'off')
  assert.deepEqual(p.toolGroups(c.tools).map((g) => g.group), ['web', 'media', 'google'])
  assert.deepEqual(p.toolGroups(c.tools)[0].tools.map((t) => t.name), ['web.getJson', 'web.search'])
  for (const g of p.TOOL_GROUP_ORDER) assert.ok(admin.pult.company.toolGroups[g], g)
})

test('support: ticket clientId and the search fallback', () => {
  const body = { ok: true, available: true, items: [{ id: 3, clientName: 'Алиса', contact: '@alice', text: 'x', status: 'open', clientId: 1 }, { id: 4, clientName: 'Боб', contact: '@bob', text: 'y', status: 'open', clientId: 'bad id!' }, { id: 5, clientName: 'Z', contact: '', text: 'z', status: 'open' }] }
  const t = p.normalizeSupportTickets(body).items
  assert.deepEqual(t.map((x) => x.clientId), ['1', null, null])
  assert.equal(p.clientIdOf('c:Боб'), 'c:Боб')
  assert.equal(p.clientIdOf('../x'), null)
  assert.equal(p.ticketClientQuery({ contact: '@bob', clientName: 'Боб' }), 'bob')
  assert.equal(p.ticketClientQuery({ contact: '', clientName: 'Боб' }), 'Боб')
  const rows = [{ id: '1', name: 'Алиса', contact: '@alice' }, { id: 'c:Боб', name: 'Боб', contact: '@bob' }]
  assert.equal(p.pickTicketClient(rows, { contact: '@BOB', clientName: 'x' }), 'c:Боб')
  assert.equal(p.pickTicketClient(rows, { contact: '', clientName: 'алиса' }), '1')
  assert.equal(p.pickTicketClient([rows[0]], { contact: 'other', clientName: 'other' }), '1', 'a single result is taken')
  assert.equal(p.pickTicketClient(rows, { contact: 'other', clientName: 'other' }), null, 'ambiguous gives the list')
  assert.equal(p.pickTicketClient([], { contact: 'a', clientName: 'b' }), null)
})

test('content: profile kit items carry three sections split into copyable blocks', () => {
  const item = p.normalizeContentItem({ item: { id: 9, kind: 'profile', platform: 'all', status: 'pending', kit: { instagram: 'Био: a\nСсылка: b\n\nАктуальное:\n1. x', youtube: 'Название: Fir', tiktok: '  ' } } })
  assert.equal(item.kind, 'profile')
  assert.deepEqual(p.kitSections(item.kit), ['instagram', 'youtube'])
  assert.deepEqual(p.kitBlocks(item.kit.instagram), ['Био: a\nСсылка: b', 'Актуальное:\n1. x'])
  assert.equal(p.normalizeContentItem({ item: { id: 1, kind: 'post', kit: 'x' } }).kit, null)
  assert.equal(p.normalizeContentItem({ item: { id: 1, kind: 'profile', kit: { instagram: '', youtube: '', tiktok: '' } } }).kit, null)
  assert.deepEqual([p.YOUTUBE_BANNER.w, p.YOUTUBE_BANNER.h], [2560, 1440])
  assert.ok(admin.pult.content.kinds.profile)
})

test('mock: tools, a profile kit and a ticket with clientId are served', () => {
  const mock = createHqMock(NOW)
  const company = p.normalizeCompany(mock('GET', 'company', {}, {}, NOW))
  assert.ok(company.tools.length >= 5)
  assert.ok(company.tools.some((t) => p.toolState(t) === 'missing'))
  const items = p.normalizeContent(mock('GET', 'content', {}, {}, NOW)).days.flatMap((d) => d.items)
  assert.ok(items.some((i) => i.kind === 'profile' && i.kit && p.kitSections(i.kit).length === 3))
  const tickets = p.normalizeSupportTickets(mock('GET', 'crm/tickets', {}, {}, NOW)).items
  assert.ok(tickets.some((t) => t.clientId) && tickets.some((t) => !t.clientId))
})

// ---- playbooks, days (2026-11-20) ---------------------------------------------------------------

test('markdown-lite: blocks, tables, code and no raw HTML', async () => {
  const { parseMarkdown } = await import(new URL('lib/markdown-lite.ts', src).href)
  const b = parseMarkdown('# T\n\ntext **b** `c` <b>x</b>\n\n- a\n- b\n\n1. one\n2. two\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```\ncode <i>\n```\n\n[l](javascript:alert(1))')
  assert.deepEqual(b.map((x) => x.type), ['heading', 'p', 'ul', 'ol', 'table', 'code', 'p'])
  assert.equal(b[2].items.length, 2)
  assert.equal(b[4].rows[0].length, 2)
  assert.equal(b[5].text, 'code <i>')
  const para = b[1].spans
  assert.ok(para.some((s) => s.kind === 'bold') && para.some((s) => s.kind === 'code'))
  assert.ok(para.some((s) => s.kind === 'text' && s.text.includes('<b>x</b>')), 'tags stay plain text')
  assert.equal(JSON.stringify(b[6]).includes('javascript'), false, 'link targets are dropped')
})


test('palette: matchTasks filters the open tasks by words, #id and assignee, newest first, capped', () => {
  const tasks = [
    { id: 42, title: 'Договор-шаблон для сайтов', assigneeTitle: 'Lina', status: 'review' },
    { id: 7, title: 'Отчёт по лидам', assigneeTitle: 'Analyst', status: 'running' },
    { id: 9, title: 'Договор с клиентом', assigneeTitle: null, status: 'running' },
  ]
  assert.deepEqual(p.matchTasks(tasks, 'договор').map((t) => t.id), [42, 9])
  assert.deepEqual(p.matchTasks(tasks, '#7').map((t) => t.id), [7])
  assert.deepEqual(p.matchTasks(tasks, 'lina договор').map((t) => t.id), [42])
  assert.deepEqual(p.matchTasks(tasks, 'отчет').map((t) => t.id), [7])
  assert.deepEqual(p.matchTasks(tasks, '   '), [])
  assert.equal(p.matchTasks(tasks, 'о', 1).length, 1)
})
