// Cabinet coupon (contract coupon/contract.md): the percent is a live price, the discount is on the one-time part
// only, the larger of coupon and bundle applies, the lead carries brief.coupon only when the coupon is valid.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { registerHooks } from 'node:module'
import path from 'node:path'
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

const { getDict } = await import('../src/content/index.ts')
const { decodeBuild, quote } = await import('../src/lib/builder.ts')
const { couponDate, couponValid, parseClientBody, parseCoupon } = await import('../src/lib/cabinet-data.ts')
const { cabinetMock } = await import('../src/lib/cabinet-hq.ts')
const { couponMath, estimateDoc } = await import('../src/lib/estimate-doc.ts')
const { applyIntent, briefWithCoupon } = await import('../src/lib/lead-intent.ts')
const { defaultPricing } = await import('../src/lib/pricing.ts')
const edit = await import('../src/lib/pricing-edit.ts')
const { pricesJson } = await import('../src/lib/prices-json.ts')
const { normalizeClient360 } = await import('../src/lib/shell.ts')

const dict = getDict('ru')
const day = 86_400_000
const future = new Date(Date.now() + 10 * day).toISOString()
const past = new Date(Date.now() - day).toISOString()
const raw = { code: 'cabinet10', percent: 10, expiresAt: future, used: false }

test('pricing: cabinetCouponPercent defaults to 10, is editable (0 to 50) and is served by /api/prices', () => {
  assert.equal(defaultPricing.cabinetCouponPercent, 10)
  const f = edit.fieldOf('cabinetCouponPercent')
  assert.equal(f.label, 'Cabinet coupon, % of one-time part')
  assert.equal(f.unit, 'percent')
  assert.equal(edit.valueError('cabinetCouponPercent', 50), null)
  assert.equal(edit.valueError('cabinetCouponPercent', 51), 'out_of_range')
  const merged = edit.resolvePricing({ cabinetCouponPercent: 15 })
  assert.equal(merged.cabinetCouponPercent, 15)
  assert.equal(edit.resolvePricing({ cabinetCouponPercent: 99 }, () => {}).cabinetCouponPercent, 10)
  const op = edit.applyOps(edit.emptyPrices(), [{ path: 'cabinetCouponPercent', value: 12 }], new Date('2026-11-25T00:00:00Z'))
  assert.equal(op.ok, true)
  assert.equal(pricesJson(merged).cabinetCouponPercent, 15)
})

test('couponMath: one-time only, whole USD, the larger of coupon and bundle applies', () => {
  assert.deepEqual(couponMath(1000, 0, 0, 10), { amount: 100, total: 900, kept: false })
  // A smaller bundle (5 %) is replaced by the coupon (not stacked).
  assert.deepEqual(couponMath(1000, 50, 5, 10), { amount: 100, total: 900, kept: false })
  // A bundle of 10 % or more wins: the coupon stays for the next order.
  assert.deepEqual(couponMath(1000, 100, 10, 10), { amount: 0, total: 900, kept: true })
  assert.deepEqual(couponMath(1000, 150, 15, 10), { amount: 0, total: 850, kept: true })
  assert.deepEqual(couponMath(0, 0, 0, 10), { amount: 0, total: 0, kept: false })
  assert.deepEqual(couponMath(500, 0, 0, 0), { amount: 0, total: 500, kept: false })
})

const one = decodeBuild('websites.landing')
const two = decodeBuild('websites.landing~bots.booking')

test('estimateDoc: the coupon line is on the one-time total, the monthly and the stages follow it', () => {
  const plain = estimateDoc(one, dict, 'ru', defaultPricing)
  assert.equal(plain.coupon, null)
  const q = quote(one, defaultPricing)
  const doc = estimateDoc(one, dict, 'ru', defaultPricing, 10)
  const cut = Math.round(q.total * 0.1)
  assert.equal(doc.coupon.amount, `-$${cut}`)
  assert.equal(doc.coupon.label, 'Купон за кабинет -10 %')
  assert.equal(doc.total, `$${q.total - cut}`)
  assert.equal(doc.subtotal, `$${q.total}`)
  assert.equal(doc.couponNote, null)
  const staged = doc.stages.reduce((s, x) => s + Number(x.amount.replace(/[^\d.]/g, '')), 0)
  assert.equal(staged, q.total - cut)
  assert.equal(doc.monthly, plain.monthly, 'the monthly part is never discounted')
})

test('estimateDoc: with a 10 % bundle the bundle line stays and the coupon waits for the next order', () => {
  const doc = estimateDoc(two, dict, 'ru', defaultPricing, 10)
  assert.equal(doc.coupon, null)
  assert.ok(doc.discount)
  assert.match(doc.couponNote, /останется на следующий заказ/)
  assert.equal(doc.total, estimateDoc(two, dict, 'ru', defaultPricing).total)
  // A bigger coupon than the bundle replaces it.
  const big = estimateDoc(two, dict, 'ru', defaultPricing, 20)
  assert.ok(big.coupon)
  assert.equal(big.discount, null)
  assert.equal(big.couponNote, null)
})

test('the coupon payload: parsed, valid only when unused and in the future, dates in UTC', () => {
  assert.equal(parseCoupon(null), null)
  assert.equal(parseCoupon({ code: 'x y', expiresAt: future }), null)
  assert.equal(parseCoupon({ code: 'cabinet10', expiresAt: 'soon' }), null)
  const c = parseCoupon(raw)
  assert.equal(c.percent, 10)
  assert.equal(couponValid(c), true)
  assert.equal(couponValid({ ...c, used: true }), false)
  assert.equal(couponValid({ ...c, expiresAt: past }), false)
  assert.equal(couponValid(null), false)
  assert.equal(couponDate('2026-12-24T23:00:00Z'), '24.12.2026')
  assert.equal(couponDate('2026-12-24T23:00:00Z', false), '24.12')
  const body = { ok: true, client: { id: 3, name: 'A', email: 'a@b.co' }, coupon: raw }
  assert.equal(parseClientBody(body).coupon.code, 'cabinet10')
  assert.equal(parseClientBody({ ok: true, client: { id: 3 } }).coupon, null)
  assert.equal(couponValid(cabinetMock('a@b.co').coupon), true)
})

test('the lead carries brief.coupon only for a valid coupon, and the server keeps it', () => {
  assert.equal(briefWithCoupon({ v: 1, type: 'business' }, false).coupon, undefined)
  assert.equal(briefWithCoupon(null, false), null)
  assert.equal(briefWithCoupon({ v: 1, type: 'business' }, true).coupon, 'cabinet10')
  assert.equal(briefWithCoupon(null, true).coupon, 'cabinet10')
  // Too big: the lead goes without the note instead of being lost.
  const huge = { v: 1, pad: 'x'.repeat(3490) }
  assert.equal(briefWithCoupon(huge, true), huge)
  const lead = applyIntent({ intent: 'quote', message: 'm', brief: { v: 1, coupon: 'cabinet10', pad: 'y'.repeat(3400) } })
  assert.equal(lead.brief.coupon, 'cabinet10')
})

test('the Shell client card shows the coupon chip from the admin CRM client payload', () => {
  const card360 = normalizeClient360({ client: { id: 5, name: 'N' }, coupon: raw })
  assert.deepEqual([card360.client.coupon.percent, card360.client.coupon.used], [10, false])
  assert.equal(normalizeClient360({ client: { id: 5, name: 'N' }, coupon: { ...raw, used: true } }).client.coupon.used, true)
  assert.equal(normalizeClient360({ client: { id: 5, name: 'N' } }).client.coupon, null)
  const card = readFileSync('src/components/admin/shell-crm/clients.tsx', 'utf8')
  assert.match(card, /data-client-coupon/)
  assert.match(card, /c\.couponUsed/)
  assert.match(card, /c\.couponValid/)
})

test('copy: the gate speaks of the coupon with the percent token, no «основатель»', () => {
  for (const loc of ['ru', 'en']) {
    const d = getDict(loc)
    for (const text of [d.leadAuth.authRequired, d.chat.signInFirst]) {
      assert.match(text, /\{percent\}/)
      assert.doesNotMatch(text, /основател|founder/i)
    }
  }
  assert.match(dict.leadAuth.authRequired, /Откройте личный кабинет: заявка сохранится, смета станет документом/)
})
