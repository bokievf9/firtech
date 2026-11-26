// «Client from owner» (Shell Clients > Pipeline): the strict proxy entry, the form helpers, the dev mock and the wiring.
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
        } catch (e) {
          if (e?.code !== 'ERR_MODULE_NOT_FOUND') throw e
        }
      }
    }
    return next(specifier, context)
  },
})

const oc = await import('../src/lib/owner-client.ts')
const { resolveEndpoint } = await import('../src/lib/hq-admin.ts')
const { createHqMock } = await import('../src/lib/hq-admin-mock.ts')
const { normalizeLeads } = await import('../src/lib/shell.ts')
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const NOW = Date.parse('2026-11-26T10:00:00Z')
const q = new URLSearchParams()
const post = (body) => resolveEndpoint('POST', ['leads', 'owner'], q, body)

test('the proxy accepts only the strict body, POST only', () => {
  assert.equal(post({ name: 'Acme', need: 'A site' }).ok, true)
  assert.equal(post({ name: 'Acme', contact: '@acme', need: 'A site', links: ['https://a.tj', 'http://b.tj/x?y=1'], clientRef: 'r1' }).ok, true)
  const bad = [
    {}, { name: 'Acme' }, { need: 'x' }, { name: '', need: 'x' }, { name: 'A', need: ' ' },
    { name: 'a'.repeat(201), need: 'x' }, { name: 'A', need: 'x'.repeat(4001) }, { name: 'A', need: 'x', contact: 'c'.repeat(201) },
    { name: 'A', need: 'x', extra: 1 }, { name: 'A', need: 'x', stage: 'paid' },
    { name: 'A', need: 'x', links: ['ftp://a.tj'] }, { name: 'A', need: 'x', links: ['javascript:alert(1)'] }, { name: 'A', need: 'x', links: ['https://a b'] },
    { name: 'A', need: 'x', links: Array.from({ length: 11 }, (_, i) => `https://a.tj/${i}`) },
    { name: 'A', need: 'x', clientRef: 'r'.repeat(65) }, { name: 'A', need: 'x', clientRef: 5 },
  ]
  for (const body of bad) assert.equal(post(body).ok, false, JSON.stringify(body).slice(0, 80))
  assert.equal(post(undefined).ok, false)
  for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) assert.equal(resolveEndpoint(method, ['leads', 'owner'], q, { name: 'A', need: 'x' }).ok, false, method)
  assert.equal(resolveEndpoint('POST', ['leads', 'owner', 'x'], q, { name: 'A', need: 'x' }).ok, false)
})

test('the form helpers: errors, links, body', () => {
  const ok = { name: ' Acme ', contact: '', need: ' site ', links: '' }
  assert.deepEqual(oc.ownerErrors(ok), {})
  assert.deepEqual(oc.ownerErrors({ name: '', contact: '', need: '', links: '' }), { name: 'required', need: 'required' })
  assert.equal(oc.ownerErrors({ ...ok, links: 'example.com' }).links, 'badLink')
  assert.equal(oc.ownerErrors({ ...ok, links: Array.from({ length: 11 }, (_, i) => `https://a.tj/${i}`).join('\n') }).links, 'tooMany')
  assert.deepEqual(oc.parseLinks('https://a.tj\r\n\n https://a.tj \nhttps://b.tj'), ['https://a.tj', 'https://b.tj'])
  assert.deepEqual(oc.ownerBody(ok, 'ref-1'), { name: 'Acme', need: 'site', clientRef: 'ref-1' })
  const full = oc.ownerBody({ name: 'A', contact: ' @a ', need: 'n', links: 'https://a.tj' }, 'r')
  assert.deepEqual(full, { name: 'A', contact: '@a', need: 'n', links: ['https://a.tj'], clientRef: 'r' })
  assert.equal(post(full).ok, true)
  assert.deepEqual(oc.normalizeOwnerAnswer({ ok: true, id: 12, leadId: 12 }), { id: '12', leadId: '12' })
  assert.equal(oc.normalizeOwnerAnswer({ ok: true }), null)
})

test('the dev mock creates an owner lead once per clientRef and lists it', () => {
  const mock = createHqMock(NOW)
  const before = normalizeLeads(mock('GET', 'crm/leads', { limit: '200' }, {}, NOW)).items.length
  const body = { name: 'Acme', need: 'Need a site', links: ['https://a.tj'], clientRef: 'dialog-1' }
  const a = mock('POST', 'leads/owner', {}, body, NOW)
  assert.equal(a.ok, true)
  assert.ok(a.id !== undefined && a.leadId !== undefined)
  const again = mock('POST', 'leads/owner', {}, body, NOW)
  assert.equal(again.leadId, a.leadId)
  const items = normalizeLeads(mock('GET', 'crm/leads', { limit: '200' }, {}, NOW)).items
  assert.equal(items.length, before + 1)
  const lead = items.find((l) => l.id === a.leadId)
  assert.equal(lead.source, 'owner')
  assert.equal(lead.contact, '')
  assert.equal(lead.name, 'Acme')
  assert.equal(oc.isOwnerLead(lead), true)
  assert.equal(oc.ownerLeadNoContact(lead), true)
  assert.equal(oc.ownerLeadNoContact({ source: 'owner', contact: '@x' }), false)
  assert.equal(oc.ownerLeadNoContact({ source: 'site', contact: '' }), false)
  assert.equal(mock('POST', 'leads/owner', {}, { name: '', need: '' }, NOW).ok, false)
})

test('the funnel carries the button, the badge and the hint', () => {
  const board = read('src/components/admin/shell-crm/leads-funnel.tsx')
  assert.match(board, /OwnerClientButton/)
  assert.match(board, /data-lead-badge="owner"/)
  assert.match(board, /ownerNoContact/)
  assert.match(read('src/components/admin/shell-crm/owner-client-dialog.tsx'), /crypto\.randomUUID\(\)/)
})
