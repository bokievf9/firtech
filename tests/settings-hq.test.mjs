import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

// Same mapping as hq-admin.test.mjs: 'server-only' and '@/...' for plain Node.
const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true }
    if (specifier.startsWith('@/')) {
      const base = new URL(specifier.slice(2), src).href
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
        try {
          return next(candidate, context)
        } catch (error) {
          if (!(error instanceof Error)) throw error
        }
      }
    }
    return next(specifier, context)
  },
})

// HQ «Settings» (2026-11-23): the view model, the field catalogue, the PATCH body builders, the proxy whitelist (PATCH, autopilot) and the dev mock.
const s = await import('../src/lib/settings-hq.ts')
const mockLib = await import('../src/lib/settings-mock.ts')
const proxy = await import('../src/lib/hq-admin.ts')
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const none = new URLSearchParams()

const view = () => {
  const m = mockLib.createSettingsMock()
  return { m, get: () => s.normalizeSettings(m('GET', ['settings'], {})) }
}

test('the normalizer keeps known fields, defaults the rest and rejects a bad body', () => {
  assert.equal(s.normalizeSettings(null), null)
  assert.equal(s.normalizeSettings({ ok: true }), null)
  const v = s.normalizeSettings({ settings: { schedule: { summaryTime: 'nope', digestDay: 9, quietHours: { from: '22:00', to: 'x' } }, autopilot: { leadManager: 'bogus' }, calls: { slotHours: ['10:00'] } }, usage: { clientLlmToday: 'x' } })
  assert.equal(v.settings.schedule.summaryTime, '08:00')
  assert.equal(v.settings.schedule.digestDay, 6)
  assert.equal(v.settings.schedule.quietHours, null)
  assert.equal(v.settings.autopilot.leadManager, 'policy')
  assert.deepEqual(v.settings.calls.slotHours, ['10:00', '15:00'])
  assert.equal(v.usage.clientLlmToday, 0)
  assert.equal(v.restartRequired, false)
})

test('autopilot: three modes, policy by default, the owner labels', () => {
  assert.deepEqual([...s.AUTOPILOT_MODES], ['ask_me', 'policy', 'autopilot'])
  assert.equal(s.AUTOPILOT_LABELS.ask_me, 'Зови меня при любом сомнении')
  assert.equal(s.AUTOPILOT_LABELS.policy, 'Зови меня по политике')
  assert.equal(s.AUTOPILOT_LABELS.autopilot, 'Автопилот: зови только если просят человека, злость, юридическое')
  assert.equal(view().get().settings.autopilot.leadManager, 'policy')
})

test('every catalogue field reads from the mock and its patch passes the proxy schema', () => {
  const { get } = view()
  const cur = get().settings
  for (const spec of s.ALL_FIELDS) {
    const value = s.getValue(cur, spec.path)
    assert.notEqual(value, undefined, spec.path)
    assert.equal(proxy.resolveEndpoint('PATCH', ['settings'], none, s.buildPatch(cur, spec.path, value)).ok, true, spec.path)
  }
})

test('patch builders send tuples and quiet hours whole', () => {
  const cur = view().get().settings
  assert.deepEqual(s.buildPatch(cur, 'calls.slotHours.1', '16:30'), { calls: { slotHours: ['11:00', '16:30'] } })
  assert.deepEqual(s.buildPatch(cur, 'schedule.quietHours.from', '22:00'), { schedule: { quietHours: { from: '22:00', to: '08:00' } } })
  assert.deepEqual(s.buildPatch(cur, 'schedule.quietHours.enabled', false), { schedule: { quietHours: null } })
  assert.deepEqual(s.buildPatch(cur, 'limits.deptBudgetUsd.sales', 30), { limits: { deptBudgetUsd: { sales: 30 } } })
  assert.deepEqual(s.buildTrustPatch('lead_reply', { level: 1 }), { trust: { levels: { lead_reply: 1 } } })
  assert.deepEqual(s.buildTrustPatch('lead_reply', { threshold: null }), { trust: { thresholds: { lead_reply: null } } })
})

test('client validation mirrors the HQ ranges', () => {
  const spec = (p) => s.fieldSpec(p)
  assert.equal(s.validateField(spec('calls.durationMin'), 30), null)
  assert.equal(s.validateField(spec('calls.durationMin'), 4), 'range')
  assert.equal(s.validateField(spec('calls.durationMin'), 30.5), 'integer')
  assert.equal(s.validateField(spec('notices.groupWindowMin'), 121), 'range')
  assert.equal(s.validateField(spec('schedule.summaryTime'), '25:00'), 'time')
  assert.equal(s.validateField(spec('schedule.tz'), 'Mars/Olympus'), 'tz')
  assert.equal(s.validateField(spec('schedule.tz'), 'Asia/Dushanbe'), null)
  assert.equal(s.validateField(spec('limits.deptBudgetUsd.sales'), 0), null)
})

test('proxy whitelist: GET and PATCH settings only, strict body, autopilot included', () => {
  const { resolveEndpoint: r } = proxy
  assert.equal(r('GET', ['settings'], none, undefined).ok, true)
  assert.equal(r('POST', ['settings'], none, { kp: { validDays: 10 } }).ok, false)
  assert.equal(r('PATCH', ['settings'], none, { autopilot: { leadManager: 'autopilot' } }).ok, true)
  assert.equal(r('PATCH', ['settings'], none, { autopilot: { leadManager: 'yolo' } }).ok, false)
  assert.equal(r('PATCH', ['settings'], none, { autopilot: { other: 1 } }).ok, false)
  assert.equal(r('PATCH', ['settings'], none, {}).ok, false)
  assert.equal(r('PATCH', ['settings'], none, { nope: 1 }).ok, false)
  assert.equal(r('PATCH', ['settings'], none, { calls: { durationMin: 4 } }).ok, false)
  assert.equal(r('PATCH', ['settings'], none, { schedule: { quietHours: null, digestDay: 3 } }).ok, true)
  assert.equal(r('PATCH', ['settings'], none, { trust: { thresholds: { lead_reply: null }, levels: { lead_reply: 1 } } }).ok, true)
  assert.equal(r('PATCH', ['settings'], none, { limits: { deptBudgetUsd: { sales: 30, other: 1 } } }).ok, false)
  assert.equal(r('PATCH', ['settings', 'x'], none, { kp: { validDays: 10 } }).ok, false)
  assert.equal(r('PATCH', ['agents', 'seo'], none, {}).ok, false)
})

test('the proxy forwards PATCH to HQ with a JSON body and the token', async () => {
  const calls = []
  const fetcher = async (url, init) => {
    calls.push({ url, init })
    return new Response(JSON.stringify({ ok: true, changed: [], settings: {} }), { status: 200 })
  }
  const out = await proxy.callHqAdmin('PATCH', 'settings', { body: { kp: { validDays: 10 } } }, { env: { HQ_ADMIN_URL: 'http://hq.test/admin', HQ_ADMIN_TOKEN: 't' }, fetcher })
  assert.equal(out.ok, true)
  assert.equal(calls[0].url, 'http://hq.test/admin/settings')
  assert.equal(calls[0].init.method, 'PATCH')
  assert.equal(calls[0].init.headers['content-type'], 'application/json')
  assert.equal(calls[0].init.body, '{"kp":{"validDays":10}}')
})

test('a 400 from HQ keeps the field list for the page', async () => {
  const fetcher = async () => new Response(JSON.stringify({ ok: false, error: 'invalid', fields: ['schedule.tz'] }), { status: 400 })
  const out = await proxy.callHqAdmin('PATCH', 'settings', { body: { schedule: { tz: 'x' } } }, { env: { HQ_ADMIN_URL: 'http://hq.test/admin' }, fetcher })
  assert.deepEqual([out.ok, out.error, out.fields], [false, 'invalid', ['schedule.tz']])
})

test('mock: a patch changes only what differs, validates, journals the keys and flags a restart', () => {
  const { m, get } = view()
  const a = m('PATCH', ['settings'], { schedule: { summaryTime: '09:30' }, autopilot: { leadManager: 'ask_me' }, kp: { validDays: 14 } })
  assert.deepEqual(a.changed, ['schedule.summaryTime', 'autopilot.leadManager'])
  assert.equal(get().settings.autopilot.leadManager, 'ask_me')
  assert.equal(a.restartRequired, false)
  const bad = m('PATCH', ['settings'], { calls: { durationMin: 1 }, nope: 1 })
  assert.equal(bad.ok, false)
  assert.equal(bad.error, 'invalid')
  assert.deepEqual(bad.fields.sort(), ['calls.durationMin', 'nope'])
  assert.equal(get().settings.calls.durationMin, 30, 'all or nothing')
  const r = m('PATCH', ['settings'], { service: { tgGroupReports: true } })
  assert.equal(r.restartRequired, true)
  assert.deepEqual(r.restartKeys, ['service.tgGroupReports'])
  assert.equal(m('PATCH', ['settings'], { trust: { levels: { nope: 1 } } }).error, 'unknown_kind')
  assert.equal(m('PATCH', ['settings'], { trust: { thresholds: { lead_reply: 5 } } }).changed[0], 'trust.thresholds.lead_reply')
  assert.equal(m('PATCH', ['settings'], { trust: { thresholds: { lead_reply: null } } }).settings.trust.kinds[0].custom, false)
  assert.equal(m('GET', ['agents'], {}), null)
})

test('the session journal shows old and new values', () => {
  const { m, get } = view()
  const before = get().settings
  const r = m('PATCH', ['settings'], { schedule: { quietHours: null }, calls: { slotHours: ['10:00', '16:00'] }, trust: { levels: { content_item: 1 } }, autopilot: { leadManager: 'autopilot' } })
  const after = s.normalizeSettings(r).settings
  const rows = s.diffChanged(before, after, r.changed, 1)
  const by = Object.fromEntries(rows.map((x) => [x.key, `${x.old} > ${x.next}`]))
  assert.equal(by['schedule.quietHours'], '23:00-08:00 > (none)')
  assert.equal(by['calls.slotHours'], '11:00, 15:00 > 10:00, 16:00')
  assert.equal(by['trust.levels.content_item'], '0 > 1')
  assert.equal(by['autopilot.leadManager'], 'policy > autopilot')
})

test('the screen: every group and the autopilot sit in the component, copy has no long dashes, no «Пульт»', () => {
  const ui = read('src/components/admin/hq/settings-section.tsx')
  for (const g of Object.keys(s.FIELD_GROUPS)) assert.match(read('src/content/admin.ts'), new RegExp(`\\b${g}: \\{ title:`), g)
  for (const spec of s.ALL_FIELDS) assert.match(read('src/content/admin.ts'), new RegExp(`'${spec.path.replace(/\./g, '\\.')}':`), spec.path)
  assert.match(ui, /hqPatch<.*>\('settings'/)
  assert.match(ui, /data-group="autopilot"/)
  const copy = read('src/content/admin.ts').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
  assert.doesNotMatch(copy, /settings: \{[\s\S]{0,6000}?[–—]/)
})
