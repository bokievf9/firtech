// POST /api/slots from HQ (agents P-02): the four answers and the shared store.
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true }
    if (specifier === 'next/server') return next(`${specifier}.js`, context)
    if (specifier.startsWith('@/')) {
      const base = new URL(specifier.slice(2), src).href
      for (const c of [`${base}.ts`, `${base}.tsx`]) {
        try {
          return next(c, context)
        } catch {}
      }
    }
    return next(specifier, context)
  },
})
process.env.DATA_DIR = await mkdtemp(path.join(tmpdir(), 'hq-booking-'))
process.env.SITE_BOOKING_TOKEN = 'hq-secret'
const store = await import('../src/lib/store.ts')
const route = await import('../src/app/api/slots/route.ts')
const { generateSlots } = await import('../src/lib/booking.ts')

const post = (body, token) =>
  route.POST(
    new Request('http://localhost/api/slots', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { 'x-hq-token': token } : {}) },
      body: JSON.stringify(body),
    }),
  )

test('HQ booking: 401 without or with a wrong token, 400 bad body, 200 booked, 409 taken', async () => {
  const slot = generateSlots(new Date())[0].slots[0]
  const body = { slot, leadId: 12, name: 'Али', contact: '@ali', locale: 'ru', source: 'chat' }
  assert.equal((await post(body)).status, 401)
  assert.equal((await post(body, 'wrong')).status, 401)
  assert.equal((await post({ slot: 'soon' }, 'hq-secret')).status, 400)

  const ok = await post(body, 'hq-secret')
  assert.equal(ok.status, 200)
  assert.equal((await ok.json()).ok, true)
  // The window is gone from the free list GET /api/slots builds from the store.
  assert.ok((await store.bookedSlots()).includes(slot))
  assert.ok(!generateSlots(new Date(), await store.bookedSlots()).some((d) => d.slots.includes(slot)))

  // Another lead asking for it: taken. The same lead repeating it: still a success.
  assert.equal((await post({ ...body, leadId: 13 }, 'hq-secret')).status, 409)
  assert.equal((await post(body, 'hq-secret')).status, 200)
  // A site lead holding a window blocks HQ too.
  const other = generateSlots(new Date())[0].slots[1]
  await store.createLead({ name: 'x', contact: '@x', service: 'bots', budget: '', message: '', estimate: '', locale: 'ru', page: '/', slot: '', source: '', website: '' }, other)
  assert.equal((await post({ ...body, slot: other }, 'hq-secret')).status, 409)
})

test('HQ booking: without SITE_BOOKING_TOKEN set nobody gets in', async () => {
  const saved = process.env.SITE_BOOKING_TOKEN
  delete process.env.SITE_BOOKING_TOKEN
  try {
    assert.equal((await post({ slot: '2030-01-01T05:00:00Z', leadId: 1 }, 'anything')).status, 401)
  } finally {
    process.env.SITE_BOOKING_TOKEN = saved
  }
})
