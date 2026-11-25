// Loss block («Сколько вы теряете без агента»): the math, the niche defaults, the draft link roundtrip and the lead brief.
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

const L = await import('../src/lib/loss.ts')
const PR = await import('../src/lib/builder-presets.ts')
const A = await import('../src/lib/builder-agent.ts')
const P = await import('../src/lib/builder-personal.ts')
const { decodeBuild, encodeBuild, emptyBuild } = await import('../src/lib/builder.ts')
const copy = await import('../src/content/builder-loss.ts')

test('math: missedPerDay x 30 x share x check x conversion', () => {
  const r = L.lossMath({ missedPerDay: 4, avgCheck: 30, offHoursShare: 40, conversion: 30 })
  assert.equal(r.missedPerMonth, 48)
  assert.equal(r.monthlyLossUsd, 432)
  assert.deepEqual(L.lossMath({ missedPerDay: 0, avgCheck: 50, offHoursShare: 40 }), { missedPerMonth: 0, monthlyLossUsd: 0 })
  // conversion defaults to 30 %
  assert.equal(L.lossMath({ missedPerDay: 10, avgCheck: 100, offHoursShare: 50 }).monthlyLossUsd, 4500)
})

test('cleanLoss clamps and rejects junk', () => {
  assert.deepEqual(L.cleanLoss({ missedPerDay: '5', avgCheck: 20.6, offHoursShare: 500, conversion: -3 }), { missedPerDay: 5, avgCheck: 21, offHoursShare: 100, conversion: 0 })
  assert.equal(L.cleanLoss({ missedPerDay: 'x', avgCheck: 1, offHoursShare: 1 }), null)
  assert.equal(L.cleanLoss(null), null)
})

test('every niche preset has sane conservative defaults', () => {
  for (const id of PR.presetIds) {
    const d = PR.lossDefaults[id]
    assert.ok(d, id)
    assert.ok(d.missedPerDay >= 1 && d.missedPerDay <= 10, `${id} missedPerDay`)
    assert.ok(d.avgCheck >= 1 && d.avgCheck <= 500, `${id} avgCheck`)
    assert.ok(d.offHoursShare >= 10 && d.offHoursShare <= 50, `${id} offHoursShare`)
    assert.deepEqual(PR.lossDefaultsFor(id), d)
  }
  assert.deepEqual(PR.lossDefaultsFor(undefined), PR.lossDefaultsGeneric)
})

test('the draft link carries the loss inputs', () => {
  const loss = { missedPerDay: 7, avgCheck: 45, offHoursShare: 33, conversion: 20 }
  let b = A.withAgentBrief(A.startAgent(emptyBuild, 'lead-handler'), { channels: ['telegram'], volume: 'm', loss })
  const back = decodeBuild(encodeBuild(b))
  assert.deepEqual(back.agentBrief.loss, loss)
  assert.ok(!decodeBuild(encodeBuild(A.startAgent(emptyBuild, 'lead-handler'))).agentBrief.loss)
})

test('the lead brief carries loss with the monthly sum, only when the visitor typed it', () => {
  const base = A.withAgentBrief(A.startAgent(emptyBuild, 'lead-handler'), { channels: ['telegram'], volume: 'm' })
  assert.ok(!('loss' in P.leadBriefOf(base)))
  const b = A.withAgentBrief(base, { loss: { missedPerDay: 4, avgCheck: 30, offHoursShare: 40, conversion: 30 } })
  assert.deepEqual(P.leadBriefOf(b).loss, { missedPerDay: 4, avgCheck: 30, offHoursShare: 40, monthlyLossUsd: 432 })
})

test('copy: both languages, no promises, no dashes', () => {
  const texts = [copy.lossUi.title, copy.lossUi.open, copy.lossUi.hint, copy.lossUi.result('48', '432'), copy.lossUi.agent('1', '2'), copy.lossUi.basis(30)]
  for (const t of texts) for (const lang of ['ru', 'en']) assert.ok(t[lang] && !/[–—]/.test(t[lang]), lang)
  assert.match(copy.lossUi.result('48', '432').ru, /теряете примерно/)
  assert.ok(!/вернёте|вернете|guarantee/i.test(JSON.stringify(copy.lossUi.hint)))
})
