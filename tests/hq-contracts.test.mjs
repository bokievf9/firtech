// The site under the new HQ contracts (agents «Деньги и документы», «Клиент заметит», 2026-11-23): quote states and the
// reject payload, the review form rules, `?thread=`, the demo chat answers, the Пульт call/ready/hint helpers, the proxy
// whitelist and the dev mocks. Pure: no network, no Supabase.
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

const docs = await import('../src/lib/cabinet-docs.ts')
const chat = await import('../src/lib/cabinet-chat.ts')
const review = await import('../src/lib/cabinet-review.ts')
const demo = await import('../src/lib/demo-chat.ts')
const pult = await import('../src/lib/pult.ts')
const crm = await import('../src/lib/admin-crm-hq.ts')
const { resolveEndpoint } = await import('../src/lib/hq-admin.ts')
const { createHqMock } = await import('../src/lib/hq-admin-mock.ts')
const hq = await import('../src/lib/cabinet-hq.ts')
const lead = await import('../src/lib/lead-forward.ts')

test('quotes: declined and expired are known states, shown as they are, with no buttons; a quote waiting has accept and reject', () => {
  const base = { id: 'q1', kind: 'quote', title: 'КП', state: 'declined' }
  assert.equal(docs.parseClientDoc(base).state, 'declined')
  assert.equal(docs.parseClientDoc({ ...base, state: 'expired' }).state, 'expired')
  const open = (state) => ({ kind: 'quote', state, payUrl: null, hasPdf: false })
  assert.deepEqual(docs.docActions(open('awaiting_client')), ['accept', 'reject'])
  assert.deepEqual(docs.docActions(open('declined')), [])
  assert.deepEqual(docs.docActions(open('expired')), [])
  assert.equal(docs.docNeedsClient({ kind: 'quote', state: 'declined' }), false)
  // `deliveredAt: null` stays null (the viewer says «готовим письмо»).
  assert.equal(docs.parseClientDoc({ ...base, state: 'awaiting_client', deliveredAt: null }).deliveredAt, null)
})

test('reject payload: reason 1..1000, mode decline by default, discuss allowed, anything else refused', () => {
  assert.deepEqual(docs.buildRejectPayload({ reason: '  дорого ', mode: undefined }), { ok: true, payload: { reason: 'дорого', mode: 'decline' } })
  assert.equal(docs.buildRejectPayload({ reason: 'x', mode: 'discuss' }).payload.mode, 'discuss')
  assert.equal(docs.buildRejectPayload({ reason: '', mode: 'decline' }).error, 'reason')
  assert.equal(docs.buildRejectPayload({ reason: 'x'.repeat(1001), mode: 'decline' }).error, 'reason')
  assert.equal(docs.buildRejectPayload({ reason: 'x', mode: 'delete' }).error, 'mode')
})

test('reject through the dev HQ: declined, the words in the thread, a second try is not_awaiting, a stranger is not_found', async () => {
  const first = await hq.rejectClientDocument(1, 'q-14', { reason: 'Дорого', mode: 'decline' }, {})
  assert.deepEqual(first, { ok: true, data: { state: 'declined' } })
  assert.equal((await hq.rejectClientDocument(1, 'q-14', { reason: 'x', mode: 'decline' }, {})).error, 'not_awaiting')
  assert.equal((await hq.rejectClientDocument(1, 'nope', { reason: 'x', mode: 'decline' }, {})).error, 'not_found')
  const list = await hq.fetchClientDocuments(1, {})
  assert.equal(list.data.find((d) => d.id === 'q-14').state, 'declined')
  assert.ok(list.data.some((d) => d.state === 'expired'))
})

test('reject and review talk to HQ with the right path, body and refusals', async () => {
  const env = { HQ_ADMIN_URL: 'http://hq.local/admin', HQ_ADMIN_TOKEN: 't' }
  const calls = []
  const fake = (status, body) => async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) })
    return new Response(JSON.stringify(body), { status })
  }
  const r = await hq.rejectClientDocument(3, 'q-9', { reason: 'мало', mode: 'discuss' }, env, fake(200, { ok: true, state: 'declined' }))
  assert.equal(r.ok, true)
  assert.equal(calls[0].url, 'http://hq.local/admin/clients/3/documents/q-9/reject')
  assert.deepEqual(calls[0].body, { reason: 'мало', mode: 'discuss' })
  assert.equal((await hq.rejectClientDocument(3, 'q-9', { reason: 'x', mode: 'decline' }, env, fake(409, { ok: false, error: 'not_awaiting' }))).error, 'not_awaiting')
  const ok = await hq.postClientReview(3, { projectId: 4, rating: 5, text: 'супер' }, env, fake(200, { ok: true, item: {} }))
  assert.equal(ok.ok, true)
  assert.equal(calls[calls.length - 1].url, 'http://hq.local/admin/clients/3/reviews')
  assert.deepEqual(calls[calls.length - 1].body, { projectId: 4, rating: 5, text: 'супер' })
  assert.equal((await hq.postClientReview(3, { projectId: 4, rating: 5, text: 'x' }, env, fake(409, { ok: false, error: 'exists' }))).error, 'exists')
  assert.equal((await hq.postClientReview(3, { projectId: 4, rating: 5, text: 'x' }, env, fake(404, { ok: false, error: 'not_found' }))).error, 'not_found')
  assert.equal((await hq.postClientReview(3, { projectId: 4, rating: 5, text: 'x' }, env, fake(400, { ok: false, error: 'invalid' }))).error, 'invalid')
})

test('review form: ?review= is a project number, rating 1..5, a text of 1..2000', () => {
  assert.equal(review.reviewProjectId('12'), 12)
  assert.equal(review.reviewProjectId(['7', '8']), 7)
  for (const bad of ['0', '-1', 'abc', '1e3', '', undefined, '12345678901']) assert.equal(review.reviewProjectId(bad), null)
  assert.deepEqual(review.buildReviewBody({ projectId: '4', rating: 5, text: ' ok ' }), { ok: true, body: { projectId: 4, rating: 5, text: 'ok' } })
  assert.equal(review.buildReviewBody({ projectId: 4, rating: 0, text: 'x' }).error, 'rating')
  assert.equal(review.buildReviewBody({ projectId: 4, rating: 6, text: 'x' }).error, 'rating')
  assert.equal(review.buildReviewBody({ projectId: 4, rating: 3.5, text: 'x' }).error, 'rating')
  assert.equal(review.buildReviewBody({ projectId: 4, rating: 3, text: '  ' }).error, 'text')
  assert.equal(review.buildReviewBody({ projectId: 0, rating: 3, text: 'x' }).error, 'project')
})

test('?thread= picks a thread by its id, then by the ?ref= form', () => {
  const threads = [
    { id: 'lead-14', kind: 'lead', refId: '14' },
    { id: 'project-2', kind: 'project', refId: '2' },
    { id: 'agent-ag_1', kind: 'agent', refId: 'pg-1' },
  ]
  assert.equal(chat.threadByParam(threads, 'project-2').id, 'project-2')
  assert.equal(chat.threadByParam(threads, 'agent-ag_1').id, 'agent-ag_1')
  assert.equal(chat.threadByParam(threads, 'lead').id, 'lead-14')
  assert.equal(chat.threadByParam(threads, 'project-99'), null)
  assert.equal(chat.threadByParam(threads, null), null)
})

test('demo chat: the key, the conversation id and every HQ answer', () => {
  assert.equal(demo.demoKeyOf('abcdef0123456789'), 'abcdef0123456789')
  for (const bad of [undefined, '', 'short', 'a b c d e f g h', '<script>alert(1)</script>']) assert.equal(demo.demoKeyOf(bad), null)
  assert.equal(demo.isPublicId('ag_12ab'), true)
  assert.equal(demo.isPublicId('../x'), false)
  assert.match(demo.newConversationId(), /^w-[a-z0-9]{16}$/)
  const ok = demo.parseDemoAnswer(200, { ok: true, reply: 'Здравствуйте', conversationId: 'w-abc', mode: 'demo', limit: 50, remaining: 49 })
  assert.deepEqual(ok, { ok: true, reply: 'Здравствуйте', conversationId: 'w-abc', limit: { limit: 50, remaining: 49 } })
  assert.deepEqual(demo.parseDemoAnswer(200, { ok: true, reply: 'x', usage: { limit: 50, used: 20 } }).limit, { limit: 50, remaining: 30 })
  assert.deepEqual(demo.parseDemoAnswer(200, { ok: true, reply: 'x' }).limit, { limit: null, remaining: null })
  assert.equal(demo.parseDemoAnswer(401, { ok: false, error: 'unauthorized' }).error, 'unauthorized')
  assert.equal(demo.parseDemoAnswer(429, { ok: false, error: 'limit_reached' }).error, 'limit_reached')
  assert.equal(demo.parseDemoAnswer(429, { ok: false, error: 'rate_limited' }).error, 'rate_limited')
  assert.equal(demo.parseDemoAnswer(400, {}).error, 'invalid')
  assert.equal(demo.parseDemoAnswer(503, null).error, 'unavailable')
  assert.equal(demo.parseDemoAnswer(200, { ok: true, reply: '  ' }).ok, false)
})

test('lead: HQ notified:true is read from the answer, and only then the site bot stays quiet', async () => {
  const env = { LEAD_INTAKE_URL: 'http://hq.local', LEAD_INTAKE_TOKEN: 't' }
  const l = { name: 'A', contact: '@a', service: 'bots', budget: '', message: '', estimate: '', locale: 'ru', page: '/', slot: '', source: '', website: '' }
  const answer = (body) => async () => new Response(JSON.stringify(body), { status: 200 })
  const yes = await lead.forwardLeadDetailed(l, undefined, env, answer({ ok: true, id: 1, leadId: 9, notified: true }))
  assert.deepEqual(yes, { ok: true, id: 9, notified: true })
  assert.equal(lead.hqNotified(yes), true)
  const queued = await lead.forwardLeadDetailed(l, undefined, env, answer({ ok: true, id: 1, queued: true }))
  assert.equal(lead.hqNotified(queued), false)
  assert.equal(lead.hqNotified({ ok: false, id: null }), false)
  assert.equal(lead.hqNotified({ ok: false, id: null, notified: true }), false)
})

test('Пульт: call actions, the booking, what the client was told', () => {
  assert.deepEqual(pult.callBody('confirm'), { action: 'confirm' })
  assert.deepEqual(pult.callBody('cancel', '2026-12-01T10:00'), { action: 'cancel' })
  assert.equal(pult.callBody('reschedule', null), null)
  assert.equal(pult.callBody('reschedule', 'soon'), null)
  assert.equal(pult.callBody('reschedule', '2026-12-01T10:00:00Z').action, 'reschedule')
  assert.deepEqual(pult.callActionsFor(null), [])
  assert.deepEqual(pult.callActionsFor({ state: 'pending', at: null, site: '' }), ['confirm', 'reschedule', 'cancel'])
  assert.deepEqual(pult.callActionsFor({ state: 'confirmed', at: null, site: '' }), ['reschedule', 'cancel'])
  assert.deepEqual(pult.callActionsFor({ state: 'cancelled', at: null, site: '' }), [])
  const a = pult.normalizeCallAnswer({ ok: true, booking: { id: 1, at: '2026-12-01T10:00:00Z', state: 'confirmed', site: 'booked' }, told: ['cabinet', 'email', 'cabinet', 'pigeon'] })
  assert.deepEqual(a, { booking: { at: '2026-12-01T10:00:00Z', state: 'confirmed', site: 'booked' }, told: ['cabinet', 'email'] })
  assert.deepEqual(pult.normalizeCallAnswer({ ok: true, booking: null, told: [] }), { booking: null, told: [] })
  assert.equal(pult.leadRow({ id: 5, booking: { at: '2026-12-01T10:00:00Z', state: 'pending', site: 'taken' } }).booking.site, 'taken')
  assert.equal(pult.leadRow({ id: 5 }).booking, null)
})

test('Пульт: «Этап готов» is offered for stages in work or waiting for payment; HQ\'s hint is shown for the four 409 codes', () => {
  assert.equal(pult.canReadyStage({ stageNo: 1, state: 'in_progress' }), true)
  assert.equal(pult.canReadyStage({ stageNo: 2, state: 'awaiting_payment' }), true)
  assert.equal(pult.canReadyStage({ stageNo: 1, state: 'awaiting_acceptance' }), false)
  assert.equal(pult.canReadyStage({ stageNo: 1, state: 'accepted' }), false)
  assert.equal(pult.canReadyStage({ stageNo: null, state: 'in_progress' }), false)
  const own = (code) => `own:${code}`
  for (const code of ['not_paid', 'not_ready', 'stages_open', 'placeholder']) assert.equal(pult.failureText({ error: code, hint: ' Сначала счёт ' }, own), 'Сначала счёт')
  assert.equal(pult.failureText({ error: 'not_paid' }, own), 'own:not_paid')
  assert.equal(pult.failureText({ error: 'hq_error', hint: 'x' }, own), 'own:hq_error')
})

test('proxy whitelist: ready_milestone, the call actions, cabinet documents and their resend; nothing wider', () => {
  const go = (m, segs, body = {}, search = '') => resolveEndpoint(m, segs, new URLSearchParams(search), body)
  assert.equal(go('POST', ['crm', 'projects', '2'], { action: 'ready_milestone', milestoneId: 7 }).ok, true)
  assert.equal(go('POST', ['crm', 'projects', '2'], { action: 'ready_milestone' }).ok, false)
  assert.equal(go('POST', ['crm', 'leads', '5', 'call'], { at: '2026-12-01T10:00:00Z' }).ok, true)
  assert.equal(go('POST', ['crm', 'leads', '5', 'call'], { action: 'book', at: '2026-12-01T10:00:00Z' }).ok, true)
  assert.equal(go('POST', ['crm', 'leads', '5', 'call'], { action: 'confirm' }).ok, true)
  assert.equal(go('POST', ['crm', 'leads', '5', 'call'], { action: 'cancel' }).ok, true)
  assert.equal(go('POST', ['crm', 'leads', '5', 'call'], { action: 'reschedule', at: '2026-12-01T10:00:00Z' }).ok, true)
  assert.equal(go('POST', ['crm', 'leads', '5', 'call'], { action: 'reschedule' }).ok, false)
  assert.equal(go('POST', ['crm', 'leads', '5', 'call'], { action: 'confirm', at: '2026-12-01T10:00:00Z' }).ok, false)
  assert.equal(go('POST', ['crm', 'leads', '5', 'call'], { action: 'delete' }).ok, false)
  assert.equal(go('POST', ['crm', 'leads', '5', 'call'], {}).ok, false)
  const list = go('GET', ['crm', 'cabinet-docs'], {}, 'problem=1&clientId=3&limit=100&x=1')
  assert.deepEqual(list.query, { limit: '100', problem: '1', clientId: '3' })
  assert.equal(go('POST', ['crm', 'cabinet-docs', '7'], { action: 'resend' }).ok, true)
  assert.equal(go('POST', ['crm', 'cabinet-docs', '7'], { action: 'void' }).ok, false)
  assert.equal(go('POST', ['crm', 'cabinet-docs', 'x'], { action: 'resend' }).ok, false)
})

test('reviews and cabinet documents of the Пульт: rows, ratings, marks', () => {
  const r = crm.normalizeReviews({ ok: true, available: true, items: [{ id: 3, clientId: 2, client: 'Алиса', projectId: 4, rating: 5, text: 'Супер', at: '2026-11-22T10:00:00Z' }] })
  assert.equal(r.available, true)
  assert.deepEqual(r.items[0], { id: 3, clientId: 2, client: 'Алиса', projectId: 4, rating: 5, text: 'Супер', at: '2026-11-22T10:00:00Z' })
  const d = crm.normalizeCabinetDocs({ ok: true, items: [{ id: 7, clientId: 3, client: 'Anvar', kind: 'quote', title: 'КП', number: 'КП-12', state: 'awaiting_client', deliveredAt: null, mail: { state: 'failed', error: 'http_500', attempts: 1 }, pdf: true, signedPdf: false, problems: ['email_failed', 'no_pdf'], actions: ['resend'] }] })
  assert.equal(d.items[0].mail.state, 'failed')
  assert.equal(d.items[0].deliveredAt, null)
  assert.deepEqual(d.items[0].problems, ['email_failed', 'no_pdf'])
  assert.equal(crm.problemLabel('email_failed'), 'письмо не ушло')
  assert.equal(crm.problemLabel('no_pdf'), 'нет PDF')
})

test('the Пульт mock follows the contract: call actions, ready_milestone 409 with a hint, resend, reviews', () => {
  const mock = createHqMock(Date.parse('2026-11-23T10:00:00Z'))
  const now = Date.parse('2026-11-23T10:00:00Z')
  const confirm = mock('POST', 'crm/leads/5/call', {}, { action: 'confirm' }, now)
  assert.equal(confirm.ok, true)
  assert.equal(confirm.booking.state, 'confirmed')
  assert.deepEqual(confirm.told, ['cabinet', 'email'])
  assert.equal(mock('POST', 'crm/leads/7/call', {}, { action: 'cancel' }, now).error, 'no_call')
  const same = mock('POST', 'crm/leads/7/call', {}, { action: 'book', at: '2026-12-02T05:00:00.000Z' }, now)
  assert.equal(same.ok, true)
  assert.deepEqual(mock('POST', 'crm/leads/7/call', {}, { action: 'book', at: '2026-12-02T05:00:00.000Z' }, now).told, [])

  const unpaid = mock('POST', 'crm/projects/2', {}, { action: 'ready_milestone', milestoneId: 26 }, now)
  assert.equal(unpaid.error, 'not_paid')
  assert.match(unpaid.hint, /ещё не оплачен/)
  assert.equal(mock('POST', 'crm/projects/3', {}, { action: 'ready_milestone', milestoneId: 35 }, now).ok, true)
  assert.equal(mock('POST', 'crm/projects/3', {}, { action: 'ready_milestone', milestoneId: 35 }, now).ok, true)

  const problems = mock('GET', 'crm/cabinet-docs', { problem: '1' }, {}, now)
  assert.deepEqual(problems.items.map((x) => x.id), [8, 7])
  assert.equal(mock('POST', 'crm/cabinet-docs/7', {}, { action: 'resend' }, now).ok, true)
  assert.equal(mock('POST', 'crm/cabinet-docs/8', {}, { action: 'resend' }, now).error, 'email_failed')
  assert.equal(mock('POST', 'crm/cabinet-docs/7', {}, { action: 'nope' }, now).error, 'invalid')
  assert.equal(mock('GET', 'crm/reviews', {}, {}, now).items.length, 2)
})
