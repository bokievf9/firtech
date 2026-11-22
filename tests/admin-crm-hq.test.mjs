import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true }
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

const c = await import('../src/lib/admin-crm-hq.ts')
const { createHqMock } = await import('../src/lib/hq-admin-mock.ts')

const NOW = Date.parse('2026-11-19T10:00:00.000Z')

test('lists: a body that is not an object is an error (null), available:false stays unavailable', () => {
  for (const bad of [null, undefined, 'x', 5, [], true]) assert.equal(c.normalizeProspects(bad), null)
  const none = c.normalizeProspects({ ok: true, available: false, items: [{ id: 1, name: 'ghost' }], nextCursor: null })
  assert.equal(none.available, false)
  assert.deepEqual(none.items, [])
  // No items array at all is not data either.
  assert.equal(c.normalizeTickets({ ok: true }).available, false)
  // Reviews are real since agents P-16: a row with an id is kept, rating outside 1..5 becomes 0.
  assert.equal(c.normalizeReviews({ ok: true, available: true, items: [{ id: 1, rating: 9 }, { name: 'no id' }] }).items.length, 1)
  assert.equal(c.normalizeReviews({ ok: true, available: true, items: [{ id: 1, rating: 9 }] }).items[0].rating, 0)
  assert.equal(c.normalizeReviews({ ok: true, available: false, items: [], nextCursor: null }).available, false)
})

test('prospects: defaults, unknown fields ignored, rows without a numeric id dropped', () => {
  const list = c.normalizeProspects({
    available: true,
    statuses: ['new', 'sent', 7],
    nextCursor: 'abc',
    items: [
      { id: 7, name: 'Bro', niche: 'barber', telegram: '@bro', status: 'new', nextStatuses: ['proposed', 5, 'skipped'], secret: 'x', draft: null },
      { id: 'nope', name: 'bad' },
      'junk',
      { id: 8 },
    ],
  })
  assert.equal(list.available, true)
  assert.deepEqual(list.statuses, ['new', 'sent'])
  assert.equal(list.nextCursor, 'abc')
  assert.equal(list.items.length, 2)
  const [a, b] = list.items
  assert.deepEqual(a.nextStatuses, ['proposed', 'skipped'])
  assert.deepEqual(a.contacts, [{ label: 'telegram', value: '@bro' }])
  assert.equal(a.draft, null)
  assert.equal('secret' in a, false)
  assert.equal(b.name, '')
  assert.equal(b.status, 'new')
  assert.deepEqual(b.nextStatuses, [])
  assert.equal(b.createdAt, null)
  assert.equal(c.normalizeProspectItem({ ok: true, item: { id: 3, status: 'sent' } }).status, 'sent')
  assert.equal(c.normalizeProspectItem({ ok: true }), null)
})

test('filters: status, niche and search combine; search is case-insensitive', () => {
  const items = c.normalizeProspects({
    items: [
      { id: 1, name: 'Bro Barber', niche: 'barber', city: 'Dushanbe', status: 'new' },
      { id: 2, name: 'Sadaf Clinic', niche: 'clinic', city: 'Khujand', status: 'sent', telegram: '@Sadaf' },
      { id: 3, name: 'Cut', niche: 'barber', status: 'sent' },
    ],
  }).items
  const ids = (f) => c.visibleProspects(items, { status: 'all', niche: 'all', q: '', ...f }).map((p) => p.id)
  assert.deepEqual(ids({}), [1, 2, 3])
  assert.deepEqual(ids({ status: 'sent' }), [2, 3])
  assert.deepEqual(ids({ niche: 'barber', status: 'sent' }), [3])
  assert.deepEqual(ids({ q: 'KHUJAND' }), [2])
  assert.deepEqual(ids({ q: '@sadaf' }), [2])
  assert.deepEqual(c.distinct(items.map((p) => p.niche)), ['barber', 'clinic'])
})

test('status chips: response order first, unseen statuses after, zero chips kept', () => {
  const rows = [{ status: 'new' }, { status: 'new' }, { status: 'weird' }, { status: 'sent' }]
  assert.deepEqual(c.statusChips(rows, ['new', 'proposed', 'sent']), [
    { status: 'new', count: 2 },
    { status: 'proposed', count: 0 },
    { status: 'sent', count: 1 },
    { status: 'weird', count: 1 },
  ])
})

test('tickets: normalized, command arg keeps the client and is cut to 500', () => {
  const t = c.normalizeTickets({ items: [{ id: 3, clientName: 'Алиса', text: 'не  работает\nбот', money: true, status: 'open' }] }).items[0]
  assert.equal(t.money, true)
  assert.equal(t.slaAlerted, false)
  assert.equal(c.ticketCommandArg(t), 'Алиса: не работает бот')
  const long = c.ticketCommandArg({ clientName: 'Боб', text: 'я'.repeat(900) })
  assert.equal(long.length, 500)
  assert.ok(long.startsWith('Боб: '))
  assert.equal(c.ticketCommandArg({ clientName: '', text: 'q' }), '-: q')
  assert.deepEqual(c.visibleTickets([t], 'answered', '').map((x) => x.id), [])
  assert.deepEqual(c.visibleTickets([t], 'open', 'БОТ').map((x) => x.id), [3])
})

test('documents: grouped by kind in reading order, amount only when a number', () => {
  const docs = c.normalizeDocuments({
    items: [
      { id: 'bl:5', kind: 'invoice', status: 'issued', amountUsd: 300, number: 'FT-1', title: 'Сайт' },
      { id: 'ps:4', kind: 'kp', status: 'draft' },
      { id: 'bo:2', kind: 'contract', status: 'pending', amountUsd: 'lots' },
      { id: 'bo:9', kind: 'zeta', status: 'pending' },
      { id: 'bo:3', kind: 'contract', status: 'approved' },
      { kind: 'invoice' },
    ],
  }).items
  assert.equal(docs.length, 5)
  assert.equal(docs.find((d) => d.id === 'bo:2').amountUsd, null)
  const groups = c.groupDocumentsByKind(docs)
  assert.deepEqual(groups.map((g) => g.kind), ['contract', 'kp', 'invoice', 'zeta'])
  assert.deepEqual(groups[0].items.map((d) => d.id), ['bo:2', 'bo:3'])
  assert.equal(c.formatUsd(300), '$300')
  assert.equal(c.formatUsd(1234.5), '$1,234.5')
  assert.deepEqual(c.visibleDocuments(docs, { kind: 'invoice', status: 'issued', q: 'сайт' }).map((d) => d.id), ['bl:5'])
})

test('projects: progress, next milestone text, clamps broken counters', () => {
  const [p, none, done, odd] = c.normalizeProjects({
    items: [
      { id: 2, client: 'Алиса', status: 'active', stage: 'brief', nextMilestone: { kind: 'brief', title: 'Бриф', dueAt: '2026-11-21T09:00:00.000Z' }, tasksTotal: 4, tasksDone: 1 },
      { id: 3, client: 'Боб', status: 'draft', stage: 'spec', nextMilestone: null },
      { id: 4, client: 'В', status: 'done', stage: 'done', tasksTotal: 2, tasksDone: 2 },
      { id: 5, nextMilestone: { kind: 'delivery' }, tasksTotal: 2, tasksDone: 9 },
    ],
  }).items
  assert.equal(c.progressPercent(p.tasksDone, p.tasksTotal), 25)
  assert.equal(c.nextMilestoneText(p), 'Бриф, until 21 Nov')
  assert.equal(c.progressPercent(none.tasksDone, none.tasksTotal), null)
  assert.equal(c.nextMilestoneText(none), 'No milestones')
  assert.equal(c.nextMilestoneText(done), 'All milestones closed')
  assert.equal(odd.tasksDone, 2)
  assert.equal(c.nextMilestoneText(odd), 'Delivery')
})

test('summary: badges come from available sections only, never a zero', () => {
  const s = c.normalizeSummary({
    prospects: { available: true, total: 2, byStatus: { new: 2 } },
    tickets: { available: true, open: 0 },
    documents: { available: true, pending: 120 },
    projects: { available: false, active: 0 },
    referrals: { available: true, total: 1, byStatus: { proposed: 1 } },
    reviews: { available: false, pending: 0 },
  })
  const b = c.summaryBadges(s)
  assert.deepEqual(b, { prospects: '2', clients: null, tickets: null, documents: '99+', projects: null, referrals: '1', reviews: null })
  assert.equal(c.normalizeSummary('x'), null)
  assert.equal(c.summaryBadges(null).prospects, null)
  assert.equal(c.summaryBadges(c.normalizeSummary({})).tickets, null)
})

test('clients and referrals: defaults and chats totals', () => {
  const l = c.normalizeClients({ available: true, chats: { web: 12, telegram: 'x' }, items: [{ name: 'Алиса', sources: ['site', 3], counts: { leads: 1 } }, { contact: 'no name' }] })
  assert.deepEqual(l.chats, { web: 12, telegram: 0 })
  assert.equal(l.items.length, 1)
  assert.deepEqual(l.items[0].counts, { leads: 1, tickets: 0, projects: 0, invoices: 0, documents: 0 })
  assert.equal(c.visibleClients(l.items, 'алис').length, 1)
  const r = c.normalizeReferrals({ items: [{ id: 1, referrer: 'А', referred: 'Б', status: 'proposed', reward: '10%' }] }).items
  assert.equal(r[0].reward, '10%')
  assert.equal(c.visibleReferrals(r, 'paid', '').length, 0)
})

test('dates: relative inside a day, owner time zone (Asia/Kuala_Lumpur) otherwise', () => {
  const ago = (min) => new Date(NOW - min * 60_000).toISOString()
  assert.equal(c.relativeDate(ago(0), NOW), 'just now')
  assert.equal(c.relativeDate(ago(5), NOW), '5 min ago')
  assert.equal(c.relativeDate(ago(180), NOW), '3 h ago')
  assert.equal(c.relativeDate(new Date(NOW + 2 * 3600_000).toISOString(), NOW), 'in 2 h')
  // 10:00 UTC is 18:00 in Kuala Lumpur (UTC+8); two days earlier is outside the relative window.
  assert.match(c.relativeDate('2026-11-17T10:00:00.000Z', NOW), /17 Nov,? 18:00/)
  // 20:00 UTC is already the next day in Kuala Lumpur.
  assert.equal(c.dateLabel('2026-11-17T20:00:00.000Z'), '18 Nov')
  assert.equal(c.dateLabel('2026-11-17T20:00:00.000Z', 'UTC'), '17 Nov')
  assert.equal(c.relativeDate(null, NOW), '')
  assert.equal(c.relativeDate('garbage', NOW), '')
  assert.equal(c.dateLabel(null), '')
})

test('mock CRM: lists, filters, the prospect state machine and tickets', () => {
  const mock = createHqMock(NOW)
  const get = (p, q = {}) => mock('GET', p, q, {}, NOW)
  const post = (p, b) => mock('POST', p, {}, b, NOW)

  const sum = get('crm/summary')
  assert.equal(sum.ok, true)
  assert.equal(sum.reviews.available, true)
  assert.equal(c.normalizeSummary(sum).prospects.fresh, 1)

  const pr = c.normalizeProspects(get('crm/prospects'))
  assert.ok(new Set(pr.items.map((p) => p.status)).size >= 5)
  assert.deepEqual(pr.statuses, ['new', 'proposed', 'sent', 'replied', 'no_reply', 'skipped'])
  assert.deepEqual(c.normalizeProspects(get('crm/prospects', { status: 'sent' })).items.map((p) => p.id), [5])
  assert.equal(c.normalizeProspects(get('crm/prospects', { limit: '2' })).nextCursor, '2')
  assert.equal(c.normalizeProspects(get('crm/prospects', { q: 'bro' })).items.length, 1)

  // new -> sent is illegal (409), new -> proposed -> sent is fine, replied is final.
  let res = post('crm/prospects/7', { status: 'sent' })
  assert.deepEqual([res.ok, res.error, res.from, res.allowed], [false, 'illegal_transition', 'new', ['proposed', 'skipped']])
  res = post('crm/prospects/7', { status: 'bogus' })
  assert.equal(res.error, 'invalid_status')
  res = post('crm/prospects/7', { status: 'proposed' })
  assert.equal(res.ok, true)
  assert.deepEqual(res.item.nextStatuses, ['sent', 'skipped'])
  assert.ok(res.item.proposedAt)
  res = post('crm/prospects/7', { status: 'sent' })
  assert.ok(res.item.sentAt)
  assert.equal(post('crm/prospects/7', { status: 'replied' }).item.nextStatuses.length, 0)
  assert.equal(post('crm/prospects/7', { status: 'sent' }).error, 'illegal_transition')
  assert.equal(post('crm/prospects/3', { note: 'позвонить' }).item.note, 'позвонить')
  assert.equal(c.normalizeProspects(get('crm/prospects')).items.find((p) => p.id === 3).note, 'позвонить')
  assert.equal(post('crm/prospects/999', { note: 'x' }).error, 'not_found')
  assert.equal(post('crm/prospects/7', { status: 'skipped', reply: 'x' }).error, 'invalid')

  const tk = c.normalizeTickets(get('crm/tickets'))
  assert.equal(tk.items.length, 2)
  res = post('crm/tickets/3', { status: 'answered' })
  assert.equal(res.ok, true)
  assert.ok(res.item.answeredAt)
  assert.equal(post('crm/tickets/3', { reply: 'hi' }).error, 'reply_not_supported')
  assert.equal(c.normalizeTickets(get('crm/tickets', { status: 'open' })).items.length, 1)

  const docs = c.normalizeDocuments(get('crm/documents'))
  assert.deepEqual(docs.items.map((d) => d.kind).sort(), ['contract', 'invoice', 'invoice', 'kp'])
  assert.equal(docs.items.find((d) => d.id === 'bl:5').amountUsd, 300)
  const proj = c.normalizeProjects(get('crm/projects')).items[0]
  assert.equal(proj.tasksTotal, 4)
  assert.equal(c.normalizeReferrals(get('crm/referrals')).items.length, 1)
  assert.equal(c.normalizeReviews(get('crm/reviews')).available, true)
  assert.equal(c.normalizeClients(get('crm/clients')).chats.web, 12)
  assert.equal(get('crm/nope').error, 'not_found')
})
