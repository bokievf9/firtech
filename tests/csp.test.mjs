// Security review 2026-11-23, P1-8: the Report-Only CSP, its report route and no eval in the theme fallback.
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

const cfg = (await import('../next.config.ts')).default
const { parseCsp, cspHeader } = await import('../src/lib/csp.ts')
const report = await import('../src/lib/csp-report.ts')
const route = await import('../src/app/api/csp-report/route.ts')

const headerOf = (rules, source, key) => rules.find((r) => r.source === source)?.headers.find((h) => h.key === key)?.value

test('every path carries a Report-Only CSP that parses, with the policy of the review', async () => {
  const rules = await cfg.headers()
  const value = headerOf(rules, '/:path*', 'Content-Security-Policy-Report-Only')
  assert.ok(value, 'header present')
  assert.equal(headerOf(rules, '/:path*', 'Content-Security-Policy'), undefined, 'stage 1 does not enforce')
  const p = parseCsp(value)
  assert.deepEqual(p['default-src'], ["'self'"])
  for (const s of ["'self'", "'unsafe-inline'", 'https://mc.yandex.ru', 'https://yastatic.net']) assert.ok(p['script-src'].includes(s), s)
  assert.ok(!p['script-src'].includes("'unsafe-eval'") || process.env.NODE_ENV !== 'production')
  assert.deepEqual(p['frame-ancestors'], ["'none'"])
  assert.deepEqual(p['base-uri'], ["'none'"])
  assert.deepEqual(p['object-src'], ["'none'"])
  assert.deepEqual(p['form-action'], ["'self'"])
  assert.deepEqual(p['report-uri'], ['/api/csp-report'])
  assert.ok(p['connect-src'].some((s) => /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(s)))
  assert.ok(p['connect-src'].some((s) => /^wss:\/\/[a-z0-9]+\.supabase\.co$/.test(s)))
  assert.ok(!('upgrade-insecure-requests' in p), 'ignored (and a console error) in Report-Only; comes with stage 2')
  for (const part of value.split(';')) assert.match(part.trim(), /^[a-z-]+( [^\s;]+)*$/, part)
})

test('production policy has no unsafe-eval; frame-ancestors self on the two iframe routes', async () => {
  const prod = parseCsp(cspHeader({ NODE_ENV: 'production' }))
  assert.ok(!prod['script-src'].includes("'unsafe-eval'"))
  assert.ok(!prod['connect-src'].includes('ws:'))
  const rules = await cfg.headers()
  for (const source of ['/api/cabinet/documents/:id/file', '/api/admin/files/:path*']) {
    const v = headerOf(rules, source, 'Content-Security-Policy-Report-Only')
    assert.ok(v, source)
    assert.deepEqual(parseCsp(v)['frame-ancestors'], ["'self'"], source)
    assert.equal(headerOf(rules, source, 'X-Frame-Options'), 'SAMEORIGIN')
  }
})

test('csp reports: only directive and blocked host are counted, never the page or the sample', () => {
  const legacy = JSON.stringify({ 'csp-report': { 'document-uri': 'https://firtech.pro/ru/pay/7?k=SECRET', 'effective-directive': 'script-src-elem', 'blocked-uri': 'https://evil.test/x.js?token=abc', 'script-sample': 'alert(SECRET)' } })
  assert.deepEqual(report.summarizeCspReport(legacy), ['script-src-elem|evil.test'])
  const modern = JSON.stringify([{ type: 'csp-violation', body: { documentURL: 'https://firtech.pro/x?q=1', effectiveDirective: 'script-src', blockedURL: 'inline' } }])
  assert.deepEqual(report.summarizeCspReport(modern), ['script-src|inline'])
  assert.deepEqual(report.summarizeCspReport('not json'), [])
  assert.equal(report.blockedKind('data:image/png;base64,AAA'), 'data')
  const lines = []
  const count = report.createCspCounter((l) => lines.push(l), 1000)
  count(['img-src|data'], 0)
  count(['img-src|data', 'script-src|inline'], 1500)
  assert.equal(lines.length, 1)
  assert.match(lines[0], /img-src\|data=2/)
  assert.doesNotMatch(lines[0], /SECRET|firtech\.pro|token/)
})

test('csp-report route: 204, 413 over 8 KB, 429 over 200 a minute per IP', async () => {
  const post = (body, ip = '203.0.113.5', extra = {}) =>
    route.POST(new Request('http://localhost/api/csp-report', { method: 'POST', headers: { 'content-type': 'application/csp-report', 'x-real-ip': ip, ...extra }, body }))
  assert.equal((await post('{"csp-report":{}}')).status, 204)
  assert.equal((await post('x'.repeat(8 * 1024 + 1), '203.0.113.6')).status, 413)
  assert.equal((await post('{}', '203.0.113.6', { 'content-length': '999999' })).status, 413)
  let last = 0
  for (let i = 0; i < 201; i++) last = (await post('{}', '198.51.100.9')).status
  assert.equal(last, 429)
  assert.equal((await post('{}', '198.51.100.10')).status, 204, 'another IP is not limited')
})

test('the theme fallback has no new Function or eval; the server script is a static string', () => {
  const code = readFileSync('src/components/theme-init.tsx', 'utf8').replace(/\/\/.*$/gm, '')
  assert.doesNotMatch(code, /new Function|\beval\(/)
  assert.match(code, /useServerInsertedHTML\(\(\) => <script dangerouslySetInnerHTML=\{\{ __html: themeScript \}\} \/>\)/)
})
