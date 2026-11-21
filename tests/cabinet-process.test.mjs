// Cabinet process view (owner 2026-11-20): HQ `leads` parsing and its absence, the stage track,
// the timeline, the reply call, the home order, copy.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

const { default: ru } = await import('../src/content/ru.ts')
const { default: en } = await import('../src/content/en.ts')
const data = await import('../src/lib/cabinet-data.ts')
const hq = await import('../src/lib/cabinet-hq.ts')

const env = { HQ_ADMIN_URL: 'http://hq.test/admin', HQ_ADMIN_TOKEN: 'secret-token', NODE_ENV: 'production' }
const client = { id: 7, name: 'Алиса', email: 'a@b.co', telegram: '', createdAt: null }
const hqLead = {
  id: 12, createdAt: '2026-11-19T10:00:00Z', service: 'websites', summary: 'Нужен сайт для салона', estimateUsd: 1200,
  hasDomain: true, hasHosting: false, stage: 'proposal', nextStep: 'КП отправлено, ждём вашего решения',
  timeline: [
    { at: '2026-11-20T09:00:00Z', kind: 'kp', title: 'КП готово' },
    { at: '2026-11-19T10:00:00Z', kind: 'lead', title: 'Заявка получена' },
    { kind: 'x' },
  ],
  replies: [{ at: '2026-11-19T12:00:00Z', text: 'Здравствуйте, Алиса!', from: 'manager' }, { text: '' }, { text: 'Когда КП?', from: 'client' }],
}

test('by-email leads: parsed, broken rows dropped; missing field = null, not []', () => {
  const body = data.parseClientBody({ ok: true, client, leads: [hqLead, { stage: 'new' }, 'x'] })
  assert.equal(body.leads.length, 1)
  const l = body.leads[0]
  assert.equal(l.id, 12)
  assert.equal(l.estimateUsd, 1200)
  assert.equal(l.hasDomain, true)
  assert.equal(l.hasHosting, false)
  assert.equal(l.timeline.length, 2)
  assert.deepEqual(l.replies.map((r) => r.from), ['manager', 'client'])
  assert.equal(data.parseClientBody({ ok: true, client }).leads, null)
  assert.deepEqual(data.parseClientBody({ ok: true, client, leads: [] }).leads, [])
  const odd = data.parseLeads([{ id: 3, stage: '', estimateUsd: -5, hasDomain: 'yes', replies: [{ text: 'hi', from: 'evil' }] }])[0]
  assert.equal(odd.stage, 'new')
  assert.equal(odd.estimateUsd, null)
  assert.equal(odd.hasDomain, null)
  assert.equal(odd.replies[0].from, 'manager')
})

test('stage track: Принято → Уточняем → КП → Договор → Оплата → В работе; lost = Закрыто', () => {
  const states = (stage) => data.leadTrack(stage).steps.map((s) => s.state).join(',')
  assert.equal(states('new'), 'now,next,next,next,next,next')
  assert.equal(states('proposal'), 'done,done,now,next,next,next')
  assert.equal(states('project'), 'done,done,done,done,done,now')
  assert.equal(states('weird'), 'now,next,next,next,next,next')
  assert.equal(data.leadTrack('lost').lost, true)
  assert.equal(states('lost'), 'next,next,next,next,next,next')
  assert.deepEqual(data.leadStages, ['new', 'qualified', 'proposal', 'contract', 'paid', 'project'])
  assert.deepEqual(Object.values(ru.cabinet.leads.track), ['Принято', 'Уточняем', 'КП', 'Договор', 'Оплата', 'В работе'])
  assert.equal(ru.cabinet.leads.lost, 'Закрыто')
  for (const s of [...data.leadStages, 'lost']) {
    assert.ok(ru.cabinet.leads.defaultNext[s] && en.cabinet.leads.defaultNext[s], s)
  }
  assert.equal(data.leadNextStep({ stage: 'paid', nextStep: '' }, ru.cabinet.leads.defaultNext), ru.cabinet.leads.defaultNext.paid)
  assert.equal(data.leadNextStep({ stage: 'paid', nextStep: 'Из HQ' }, ru.cabinet.leads.defaultNext), 'Из HQ')
})

test('timeline helper: oldest first, dated, the request itself always there', () => {
  const lead = data.parseLeads([hqLead])[0]
  const rows = data.timelineRows(lead, 'ru', 'Заявка получена')
  assert.deepEqual(rows.map((r) => r.kind), ['lead', 'kp'])
  assert.equal(rows[0].date, data.formatDate('2026-11-19T10:00:00Z', 'ru'))
  const bare = data.timelineRows({ createdAt: '2026-11-01T00:00:00Z', timeline: [] }, 'en', 'Request received')
  assert.deepEqual(bare, [{ kind: 'lead', title: 'Request received', date: 'Nov 1, 2026' }])
})

test('focus and follow parameters', () => {
  const leads = data.parseLeads([hqLead])
  assert.equal(data.pickLead(leads, '12'), 12)
  assert.equal(data.pickLead(leads, '13'), null)
  assert.equal(data.pickLead(leads, 'new'), null)
  assert.equal(data.pickLead(null, '12'), null)
  assert.equal(data.followLink('3.abcdef123456', 'firtech_bot'), 'https://t.me/firtech_bot?start=lead_3_abcdef123456')
  assert.equal(data.followLink('3.<script>', 'firtech_bot'), null)
  assert.equal(data.followLink(undefined, 'firtech_bot'), null)
})

test('reply: POST /clients/:id/leads/:leadId/messages with the token; errors mapped', async () => {
  let seen
  const r = await hq.postLeadMessage(7, 12, '  Когда КП?  ', env, async (url, init) => {
    seen = { url, init }
    return new Response(JSON.stringify({ ok: true, item: { at: '2026-11-20T10:00:00Z', text: 'Когда КП?', from: 'client', leadId: 12, ticketId: 7 } }))
  })
  assert.equal(seen.url, 'http://hq.test/admin/clients/7/leads/12/messages')
  assert.equal(seen.init.method, 'POST')
  assert.equal(seen.init.headers['x-admin-token'], 'secret-token')
  assert.deepEqual(JSON.parse(seen.init.body), { text: 'Когда КП?' })
  assert.deepEqual(r, { ok: true, data: { at: '2026-11-20T10:00:00Z', text: 'Когда КП?', from: 'client' } })
  const reply = (status, body) => async () => new Response(JSON.stringify(body), { status })
  assert.deepEqual(await hq.postLeadMessage(7, 12, 'x y', env, reply(404, {})), { ok: false, error: 'not_found' })
  assert.deepEqual(await hq.postLeadMessage(7, 12, 'x y', env, reply(429, {})), { ok: false, error: 'rate_limited' })
  assert.deepEqual(await hq.postLeadMessage(7, 12, 'x y', env, reply(200, { ok: true })), { ok: false, error: 'hq_error' })
  assert.deepEqual(await hq.postLeadMessage(7, 0, 'x y', env, reply(200, {})), { ok: false, error: 'hq_error' })
  const failed = await hq.postLeadMessage(7, 12, 'x y', env, async () => { throw new TypeError('secret-token down') })
  assert.deepEqual(failed, { ok: false, error: 'hq_unreachable' })
  const dev = await hq.postLeadMessage(1, 12, 'привет', { NODE_ENV: 'development' })
  assert.equal(dev.ok && dev.data.from, 'client')
  // The dev mock carries leads, and the message shows up in its thread.
  const mock = hq.cabinetMock('a@b.co')
  assert.ok(mock.leads.length >= 1)
  assert.ok(mock.leads.find((l) => l.id === 12).replies.some((m) => m.text === 'привет'))
})

test('home order (v3): projects with requests and recent items, documents, messages, agent, materials, referrals, profile', () => {
  const page = readFileSync('src/app/[locale]/cabinet/page.tsx', 'utf8')
  const order = ['<ProjectCard', '<LeadsSection', '<RecentBlock', '<DocumentsPanel', '<MessagesPanel', '<AgentPanel', '<MaterialsPanel', '<ReferralsCard', '<ProfileForm']
  const at = order.map((tag) => page.indexOf(tag))
  assert.ok(at.every((i) => i > 0), JSON.stringify(at))
  assert.deepEqual([...at].sort((a, b) => a - b), at)
  // The home is the project: refreshed every minute while visible, no reply box, a link to the thread.
  assert.match(readFileSync('src/components/cabinet/refresh-while-visible.tsx', 'utf8'), /everyMs = 60_000/)
  assert.match(page, /<RefreshWhileVisible \/>/)
  const section = readFileSync('src/components/cabinet/leads-section.tsx', 'utf8')
  assert.doesNotMatch(section, /ReplyBox|replyErrors|\/messages`/)
  assert.match(section, /tab="messages"/)
  assert.match(section, /ref: `lead-\$\{lead\.id\}`/)
  const route = readFileSync('src/app/api/cabinet/leads/[id]/messages/route.ts', 'utf8')
  assert.match(route, /fetchClientByEmail\(data\.user\.email\)/)
  assert.match(route, /status: 401|, 401\)/)
})

test('copy: leads block same shape in ru and en, no long dashes, no dollar amounts', () => {
  const shape = (v) => (v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v)
  assert.deepEqual(shape(ru.cabinet.leads), shape(en.cabinet.leads))
  assert.equal(ru.cabinet.leads.pending, 'Заявка принята, ответим в течение 5 минут.')
  assert.equal(ru.cabinet.leads.emptyBuilder, 'Собрать проект')
  assert.equal(ru.cabinet.leads.emptyAudit, 'Заказать бесплатный аудит')
  assert.match(ru.cabinet.leads.defaultNext.contract, /подпись/)
  function* strings(v) {
    if (typeof v === 'string') yield v
    else if (v && typeof v === 'object') for (const x of Object.values(v)) yield* strings(x)
  }
  for (const text of [...strings(ru.cabinet.leads), ...strings(en.cabinet.leads)]) {
    assert.doesNotMatch(text, /[–—]/, text)
    assert.doesNotMatch(text, /\$\s?\d/, text)
  }
})
