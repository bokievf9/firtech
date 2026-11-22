// P-01: a lead HQ did not confirm is delivered later, once.
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: `data:text/javascript,${encodeURIComponent('export {}')}`, shortCircuit: true }
    return next(specifier, context)
  },
})
const { forwardLeadDetailed } = await import('../src/lib/lead-forward.ts')

process.env.DATA_DIR = await mkdtemp(path.join(tmpdir(), 'lead-retry-'))
const store = await import('../src/lib/store.ts')
const retry = await import('../src/lib/lead-retry.ts')

const lead = { name: 'Али', contact: '@ali', service: 'bots', budget: '', message: 'x', estimate: '', locale: 'ru', page: '/ru', slot: '', source: '', website: '' }
const env = { LEAD_INTAKE_URL: 'http://hq.local', LEAD_INTAKE_TOKEN: 't' }
const identity = { clientEmail: 'a@b.co', cabinetId: 'u1', clientName: 'Али' }

test('HQ down, then up: the lead is delivered once, with the same identity, and then left alone', async () => {
  const log = console.error
  console.error = () => {}
  try {
    const stored = await store.createLead(lead, undefined, identity)
    assert.equal(stored.hqForwarded, false)
    // First try in the request: HQ restarting.
    const down = async () => { throw new TypeError('fetch failed') }
    await retry.recordForward(stored.id, await forwardLeadDetailed(lead, undefined, env, down, undefined, identity))
    let now = Date.now()
    let after = await store.getLead(stored.id)
    assert.equal(after.hqForwarded, false)
    assert.equal(after.hqAttempts, 1)
    // Too early: the backoff holds (1 minute).
    let calls = 0
    const up = async (_url, init) => {
      calls++
      up.body = JSON.parse(init.body)
      return new Response(JSON.stringify({ ok: true, id: 5, leadId: 42 }), { status: 200 })
    }
    assert.equal(await retry.retryPendingForwards(env, up, now + 5_000), 0)
    assert.equal(calls, 0)
    // Still down on the next pass: counted, not marked.
    assert.equal(await retry.retryPendingForwards(env, down, now + 70_000), 0)
    assert.equal((await store.getLead(stored.id)).hqAttempts, 2)
    // HQ is up: delivered with the stored identity, marked, and never sent again.
    now += 300_000
    assert.equal(await retry.retryPendingForwards(env, up, now), 1)
    assert.equal(up.body.clientEmail, 'a@b.co')
    after = await store.getLead(stored.id)
    assert.equal(after.hqForwarded, true)
    assert.equal(after.hqLeadId, 42)
    assert.equal(await retry.retryPendingForwards(env, up, now + 3_600_000), 0)
    assert.equal(calls, 1)
  } finally {
    console.error = log
  }
})

test('retryDue: attempts cap, age cap, old leads without the field are skipped', () => {
  const base = { hqForwarded: false, createdAt: new Date().toISOString() }
  const now = Date.now()
  assert.equal(retry.retryDue(base, now), true)
  assert.equal(retry.retryDue({ ...base, hqAttempts: retry.MAX_ATTEMPTS }, now), false)
  assert.equal(retry.retryDue({ ...base, createdAt: new Date(now - retry.MAX_AGE_MS - 1000).toISOString() }, now), false)
  assert.equal(retry.retryDue({ createdAt: base.createdAt }, now), false)
  assert.equal(retry.retryDue({ ...base, hqForwarded: true }, now), false)
})

test('without HQ config the pass does nothing', async () => {
  assert.equal(await retry.retryPendingForwards({}, async () => assert.fail('no call')), 0)
})

test('siteLeadId: stable between first send and retry; duplicate closes the lead; malformed id is not sent', async () => {
  const log = console.error
  console.error = () => {}
  try {
    const stored = await store.createLead(lead)
    assert.match(stored.siteLeadId, /^[A-Za-z0-9_.:-]{8,64}$/)
    const bodies = []
    const down = async (_u, init) => { bodies.push(JSON.parse(init.body)); throw new TypeError('fetch failed') }
    await retry.recordForward(stored.id, await forwardLeadDetailed({ ...lead, siteLeadId: stored.siteLeadId }, undefined, env, down))
    const dup = async (_u, init) => { bodies.push(JSON.parse(init.body)); return new Response(JSON.stringify({ ok: true, id: 5, leadId: 9, duplicate: true }), { status: 200 }) }
    const now = Date.now() + 300_000
    assert.equal(await retry.retryPendingForwards(env, dup, now), 1)
    assert.equal(bodies.length, 2)
    assert.equal(bodies[0].siteLeadId, stored.siteLeadId)
    assert.equal(bodies[1].siteLeadId, stored.siteLeadId)
    const after = await store.getLead(stored.id)
    assert.equal(after.hqForwarded, true)
    assert.equal(await retry.retryPendingForwards(env, dup, now + 3_600_000), 0)
    assert.equal(bodies.length, 2)
    // queued is retried, a malformed id never goes out
    const queued = async () => new Response(JSON.stringify({ ok: true, queued: true }), { status: 200 })
    assert.equal((await forwardLeadDetailed(lead, undefined, env, queued)).ok, false)
    let sent
    const spy = async (_u, init) => { sent = JSON.parse(init.body); return new Response('{}', { status: 200 }) }
    await forwardLeadDetailed({ ...lead, siteLeadId: 'bad id!' }, undefined, env, spy)
    assert.equal('siteLeadId' in sent, false)
  } finally {
    console.error = log
  }
})
