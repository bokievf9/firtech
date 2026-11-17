import assert from 'node:assert/strict'
import { test } from 'node:test'
import { forwardLead } from '../src/lib/lead-forward.ts'

const lead = {
  name: 'Тест', contact: '@test', service: 'websites', budget: '', message: 'Нужен сайт',
  estimate: '', locale: 'ru', page: '/ru', slot: '', source: '', website: '',
}
const env = { LEAD_INTAKE_URL: 'http://intake.local:8787/', LEAD_INTAKE_TOKEN: 'secret' }

test('posts the lead with the token header', async () => {
  let call
  const ok = await forwardLead(lead, '2026-11-20T10:00:00Z', env, async (url, init) => {
    call = { url, init }
    return { ok: true, status: 200 }
  })
  assert.equal(ok, true)
  assert.equal(call.url, 'http://intake.local:8787/lead')
  assert.equal(call.init.headers['x-lead-token'], 'secret')
  const body = JSON.parse(call.init.body)
  assert.equal(body.name, 'Тест')
  assert.equal(body.slot, '2026-11-20T10:00:00Z')
  assert.equal('website' in body, false)
})

test('does nothing without config', async () => {
  const f = async () => assert.fail('must not call')
  assert.equal(await forwardLead(lead, undefined, {}, f), false)
  assert.equal(await forwardLead(lead, undefined, { LEAD_INTAKE_URL: 'http://x' }, f), false)
})

test('fail-open on network error and bad status, no throw', async () => {
  const log = console.error
  console.error = () => {}
  try {
    assert.equal(await forwardLead(lead, undefined, env, async () => { throw new Error('down') }), false)
    assert.equal(await forwardLead(lead, undefined, env, async () => ({ ok: false, status: 401 })), false)
  } finally {
    console.error = log
  }
})
