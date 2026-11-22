import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const m = await import('../src/lib/client-knowledge.ts')

test('normalizeClientKnowledge reads the contract and drops unknown values', () => {
  const v = m.normalizeClientKnowledge({
    ok: true,
    site: 'https://a.example',
    instagram: '@a',
    instagramImported: false,
    state: 'done',
    job: { id: 'j1', url: 'https://a.example', origin: 'auto', state: 'done', pages: 2, chunks: 9, chars: 4000, errors: 1, skipped: 3, truncated: true, error: '', startedAt: '2026-11-23T10:00:00Z', finishedAt: 'nonsense' },
    pages: 2,
    chunks: 9,
    lastAt: '2026-11-23T10:01:00Z',
    errors: 1,
    items: [{ url: 'https://a.example/', title: 'Home', chars: 1200, fetchedAt: '2026-11-23T10:00:30Z', text: 'never shown' }],
  })
  assert.equal(v.state, 'done')
  assert.equal(v.job.origin, 'auto')
  assert.equal(v.job.finishedAt, null)
  assert.equal(v.job.truncated, true)
  assert.deepEqual(Object.keys(v.items[0]).sort(), ['chars', 'fetchedAt', 'title', 'url'])
  assert.equal(m.normalizeClientKnowledge({ ok: false }), null)
  const odd = m.normalizeClientKnowledge({ ok: true, state: 'weird', items: 'x', pages: -4 })
  assert.deepEqual([odd.state, odd.job, odd.pages, odd.items.length], ['none', null, 0, 0])
})

test('isBusy and the client id gate', () => {
  assert.equal(m.isBusy('running'), true)
  assert.equal(m.isBusy('queued'), true)
  for (const s of ['none', 'done', 'failed']) assert.equal(m.isBusy(s), false)
  assert.equal(m.knowledgeClientId('12', true), '12')
  assert.equal(m.knowledgeClientId('12', false), null)
  assert.equal(m.knowledgeClientId('c:Bob', true), null)
})

test('checkAddress accepts http(s) only', () => {
  assert.deepEqual(m.checkAddress('https://a.example/x'), { ok: true, url: 'https://a.example/x' })
  assert.deepEqual(m.checkAddress('  a.example '), { ok: true, url: 'https://a.example' })
  assert.deepEqual(m.checkAddress('http://a.example'), { ok: true, url: 'http://a.example' })
  assert.deepEqual(m.checkAddress(''), { ok: false, code: 'empty' })
  for (const bad of ['ftp://a.example', 'javascript:alert(1)', 'https://user:pw@a.example', 'not a url', 'localhost', 'https://']) {
    assert.deepEqual(m.checkAddress(bad), { ok: false, code: 'invalid_url' }, bad)
  }
})

test('page links are plain http(s) only; the import reply is read strictly', () => {
  assert.equal(m.safePageHref('https://a.example/p'), 'https://a.example/p')
  assert.equal(m.safePageHref('javascript:alert(1)'), null)
  assert.deepEqual(m.normalizeImportReply({ ok: true, jobId: 'j1', state: 'running', already: true }), { jobId: 'j1', already: true })
  assert.equal(m.normalizeImportReply({ ok: false }), null)
})

test('the tab polls every 3 s only while busy, pauses on a hidden tab, opens links in the same tab', () => {
  assert.equal(m.KNOWLEDGE_POLL_MS, 3000)
  const ui = readFileSync('src/components/admin/shell-crm/client-knowledge.tsx', 'utf8')
  assert.match(ui, /if \(!busy\) return/)
  assert.match(ui, /document\.hidden/)
  assert.doesNotMatch(ui, /target=/)
})
