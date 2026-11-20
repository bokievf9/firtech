// Cabinet stage track and «Принять этап» (2026-11-21): HQ `milestones[]` parsing, the track rows,
// the accept call and its 409 codes, the dev mock, the route, the Пульт whitelist and drawer helpers.
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
const { stageTrackLabel } = await import('../src/lib/payment-stages.ts')
const { resolveEndpoint } = await import('../src/lib/hq-admin.ts')
const pult = await import('../src/lib/pult.ts')
const { hqMock } = await import('../src/lib/hq-admin-mock.ts')

const env = { HQ_ADMIN_URL: 'http://hq.test/admin', HQ_ADMIN_TOKEN: 'secret-token', NODE_ENV: 'production' }
const client = { id: 7, name: 'Алиса', email: 'a@b.co', telegram: '', createdAt: null }
const ms = (over) => ({ stageNo: 1, title: 'Этап', amountUsd: 150, invoiceNumber: 'FT-1', payUrl: null, paidAt: null, acceptedAt: null, state: 'in_progress', ...over })
const json = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body })

test('milestones: parsed, sorted, junk dropped, pay link only while awaiting payment and https', () => {
  const body = data.parseClientBody({
    ok: true,
    client,
    projects: [{
      id: 2,
      milestones: [
        ms({ stageNo: 3, state: 'awaiting_payment', payUrl: 'https://firtech.pro/ru/pay/FT-3?k=a' }),
        ms({ stageNo: 1, state: 'accepted', acceptedAt: '2026-11-20T10:00:00Z', payUrl: 'https://firtech.pro/x' }),
        ms({ stageNo: 2, state: 'awaiting_acceptance' }),
        ms({ stageNo: 4, state: 'weird' }),
        ms({ stageNo: 0 }),
        ms({ stageNo: 5, state: 'awaiting_payment', payUrl: 'javascript:alert(1)' }),
        'x',
      ],
    }, { id: 9 }],
  })
  const [p, bare] = body.projects
  assert.deepEqual(p.milestones.map((m) => m.stageNo), [1, 2, 3, 5])
  assert.equal(p.milestones[0].payUrl, null)
  assert.equal(p.milestones[2].payUrl, 'https://firtech.pro/ru/pay/FT-3?k=a')
  assert.equal(p.milestones[3].payUrl, null)
  assert.deepEqual(bare.milestones, [])
})

test('stage track rows: pay, work, accept, accepted with its date', () => {
  const rows = data.stageRows(
    [
      ms({ stageNo: 1, state: 'accepted', acceptedAt: '2026-11-12T10:00:00Z' }),
      ms({ stageNo: 2, state: 'awaiting_acceptance' }),
      ms({ stageNo: 3, state: 'awaiting_payment', payUrl: 'https://firtech.pro/p' }),
      ms({ stageNo: 4, state: 'in_progress', amountUsd: null }),
    ],
    'ru',
  )
  assert.deepEqual(rows.map((r) => r.step), ['accepted', 'accept', 'pay', 'work'])
  assert.deepEqual(rows.map((r) => r.canAccept), [false, true, false, false])
  assert.equal(rows[0].date, '12 нояб. 2026 г.')
  assert.equal(rows[2].payUrl, 'https://firtech.pro/p')
  assert.equal(rows[1].payUrl, null)
  assert.equal(rows[3].amount, '')
  const tr = ru.cabinet.cards.stageTrack
  const label = (r) => stageTrackLabel(data.stageTemplate(r.step, tr, ru.cabinet.cards.milestones.accepted), r.n)
  assert.deepEqual(rows.map(label), ['Этап 1: принят', 'Этап 2: приёмка', 'Этап 3: оплата', 'Этап 4: в работе'])
})

test('lead card line: the current stage of the only running project, nothing when ambiguous', () => {
  const p = (status, stages) => ({ status, milestones: stages.map((state, i) => ms({ stageNo: i + 1, state })) })
  assert.deepEqual(data.stageLineFor([p('active', ['accepted', 'awaiting_acceptance', 'awaiting_payment'])]), { n: 2, step: 'accept' })
  assert.equal(data.stageLineFor([p('active', ['accepted'])]), null)
  assert.equal(data.stageLineFor([p('active', ['in_progress']), p('active', ['in_progress'])]), null)
  assert.equal(data.stageLineFor([p('done', ['in_progress']), p('active', ['awaiting_payment'])]).step, 'pay')
  assert.equal(data.stageLineFor([]), null)
})

test('acceptMilestone: success, repeat, 404, 409 codes, bad numbers', async () => {
  const calls = []
  const reply = (status, body) => async (url, init) => {
    calls.push({ url, init })
    return json(status, body)
  }
  const okBody = { ok: true, already: false, milestone: ms({ stageNo: 2, state: 'accepted', acceptedAt: '2026-11-21T10:00:00Z' }) }
  const done = await hq.acceptMilestone(7, 2, 2, env, reply(200, okBody))
  assert.equal(done.ok, true)
  assert.equal(done.data.already, false)
  assert.equal(done.data.milestone.state, 'accepted')
  assert.equal(calls[0].url, 'http://hq.test/admin/clients/7/projects/2/milestones/2/accept')
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.headers['x-admin-token'], 'secret-token')
  assert.equal((await hq.acceptMilestone(7, 2, 2, env, reply(200, { ...okBody, already: true }))).data.already, true)
  assert.deepEqual(await hq.acceptMilestone(7, 2, 2, env, reply(404, { ok: false, error: 'not_found' })), { ok: false, error: 'not_found' })
  assert.deepEqual(await hq.acceptMilestone(7, 2, 2, env, reply(409, { ok: false, error: 'not_ready' })), { ok: false, error: 'not_ready' })
  assert.deepEqual(await hq.acceptMilestone(7, 2, 2, env, reply(409, { ok: false, error: 'not_paid' })), { ok: false, error: 'not_paid' })
  assert.deepEqual(await hq.acceptMilestone(7, 2, 2, env, reply(409, { ok: false, error: 'other' })), { ok: false, error: 'hq_error' })
  assert.deepEqual(await hq.acceptMilestone(7, 2, 2, env, reply(500, {})), { ok: false, error: 'hq_error' })
  const before = calls.length
  assert.deepEqual(await hq.acceptMilestone(7, 2, 0, env, reply(200, okBody)), { ok: false, error: 'not_found' })
  assert.equal(calls.length, before, 'bad numbers never reach HQ')
  const down = await hq.acceptMilestone(7, 2, 2, env, async () => {
    throw new Error('x')
  })
  assert.deepEqual(down, { ok: false, error: 'hq_unreachable' })
})

test('HQ codes become sentences in both languages', () => {
  assert.equal(data.acceptErrorKey('not_ready'), 'not_ready')
  assert.equal(data.acceptErrorKey('not_paid'), 'not_paid')
  assert.equal(data.acceptErrorKey('weird'), 'hq')
  assert.equal(data.acceptErrorKey(undefined), 'hq')
  for (const dict of [ru, en]) {
    const m = dict.cabinet.cards.milestones
    for (const key of ['not_ready', 'not_paid', 'not_found', 'unauthorized', 'rate_limited', 'hq', 'network']) assert.match(m.errors[key], /\S/)
    for (const key of ['accepted']) assert.match(m[key], /\{n\}/)
    assert.match(m.acceptedOn, /\{date\}/)
    assert.match(dict.cabinet.leads.stageNow, /\{stage\}/)
  }
  assert.equal(ru.cabinet.cards.milestones.accept, 'Принять этап')
  assert.deepEqual(Object.keys(ru.cabinet.cards.milestones), Object.keys(en.cabinet.cards.milestones))
})

test('dev mock: 3 stages in mixed states, accepting stage 2 works once, stage 3 is not paid', async () => {
  const mock = hq.cabinetMock('a@b.co')
  const stages = mock.projects[0].milestones
  assert.deepEqual(stages.map((m) => m.state), ['accepted', 'awaiting_acceptance', 'awaiting_payment'])
  assert.ok(stages[2].payUrl?.startsWith('https://'))
  const dev = { NODE_ENV: 'development' }
  assert.deepEqual(await hq.acceptMilestone(1, 1, 3, dev), { ok: false, error: 'not_paid' })
  assert.deepEqual(await hq.acceptMilestone(1, 5, 1, dev), { ok: false, error: 'not_found' })
  const first = await hq.acceptMilestone(1, 1, 2, dev)
  assert.equal(first.data.already, false)
  assert.equal((await hq.acceptMilestone(1, 1, 2, dev)).data.already, true)
  assert.equal(hq.cabinetMock('a@b.co').projects[0].milestones[1].state, 'accepted')
})

test('route: session first, then the client by session email, 409 codes passed on', () => {
  const route = readFileSync('src/app/api/cabinet/projects/[pid]/milestones/[no]/accept/route.ts', 'utf8')
  assert.match(route, /checkPublicPost/)
  assert.match(route, /supabase\.auth\.getUser\(\)/)
  assert.match(route, /fetchClientByEmail\(data\.user\.email\)/)
  assert.match(route, /unauthorized.*401/)
  assert.match(route, /409/)
  assert.doesNotMatch(route, /clientId|searchParams/, 'the client id never comes from the browser')
})

test('Пульт whitelist: the accept call is allowed with a numeric client, nothing near it', () => {
  const ok = resolveEndpoint('POST', ['clients', '1', 'projects', '2', 'milestones', '1', 'accept'], new URLSearchParams(), {})
  assert.equal(ok.ok, true)
  assert.equal(ok.path, 'clients/1/projects/2/milestones/1/accept')
  const no = (m, segs, body = {}) => resolveEndpoint(m, segs, new URLSearchParams(), body)
  assert.equal(no('GET', ['clients', '1', 'projects', '2', 'milestones', '1', 'accept']).ok, false)
  assert.equal(no('POST', ['clients', 'c:Боб', 'projects', '2', 'milestones', '1', 'accept']).ok, false)
  assert.equal(no('POST', ['clients', '1', 'projects', '2', 'milestones', '1', 'accept'], { x: 1 }).ok, false)
  assert.equal(no('POST', ['clients', '1', 'tickets']).ok, false)
  assert.equal(no('POST', ['clients', '1', 'projects', '2', 'milestones', '1', 'accept', 'x']).ok, false)
  assert.equal(no('POST', ['crm', 'a', 'b', 'c', 'd', 'e', 'f']).ok, false, 'seven segments only for the accept call')
})

test('Пульт drawer helpers: accept only an awaiting stage, client picked by name, path built from digits', async () => {
  assert.equal(pult.canAcceptStage({ stageNo: 1, state: 'awaiting_acceptance' }), true)
  assert.equal(pult.canAcceptStage({ stageNo: 1, state: 'in_progress' }), false)
  assert.equal(pult.canAcceptStage({ stageNo: null, state: 'awaiting_acceptance' }), false)
  assert.equal(pult.acceptStagePath('7', 2, 3), 'clients/7/projects/2/milestones/3/accept')
  assert.equal(pult.acceptStagePath('c:Боб', 2, 3), null)
  assert.equal(pult.pickProjectClient([{ id: 'c:Боб', name: 'Боб' }, { id: '1', name: 'Алиса' }], 'алиса'), '1')
  assert.equal(pult.pickProjectClient([{ id: 'c:Боб', name: 'Боб' }], 'Боб'), null)
  assert.equal(pult.pickProjectClient([{ id: '1', name: 'Алиса' }, { id: '2', name: 'Борис' }], 'Кто-то'), null)
  const detail = pult.normalizeProjectDetail({
    ok: true,
    item: { id: 2, client: 'Алиса' },
    milestones: [{ id: 25, kind: 'stage', title: 'Этап 1', stageNo: 1, amountUsd: 300, state: 'awaiting_acceptance' }, { id: 21, kind: 'brief' }],
  })
  assert.deepEqual(detail.milestones.map((m) => [m.stageNo, m.state]), [[1, 'awaiting_acceptance'], [null, null]])
  // The dev mock answers the same calls as HQ.
  const call = (method, p, body = {}) => hqMock()(method, p, {}, body, Date.now())
  assert.deepEqual(await call('POST', 'clients/1/projects/2/milestones/2/accept'), { ok: false, error: 'not_paid' })
  const accepted = await call('POST', 'clients/1/projects/2/milestones/1/accept')
  assert.equal(accepted.ok, true)
  assert.equal(accepted.milestone.state, 'accepted')
  assert.equal((await call('POST', 'clients/1/projects/2/milestones/1/accept')).already, true)
})
