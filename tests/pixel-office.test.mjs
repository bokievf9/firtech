import assert from 'node:assert/strict'
import { test } from 'node:test'
import { officeMock } from '../src/lib/office-mock.ts'
import * as B from '../src/components/admin/office/pixel-office/behaviour.ts'
import * as F from '../src/components/admin/office/pixel-office/font.ts'
import * as L from '../src/components/admin/office/pixel-office/layout.ts'
import { officePeople } from '../src/components/admin/office/pixel-office/model.ts'
import * as P from '../src/components/admin/office/pixel-office/palette.ts'
import { parseSprite, SPRITES } from '../src/components/admin/office/pixel-office/sprites.ts'
import * as S from '../src/components/admin/office/pixel-office/sun.ts'

const NOW = Date.parse('2026-11-19T12:00:00Z')
const STATUSES = ['working', 'waiting', 'blocked', 'idle', 'sleeping', 'paused', 'offline']

// A company of `n` workers spread over the five departments, all idle.
function company(n) {
  const base = officeMock(NOW)
  const depts = base.departments.map((d) => ({ ...d, workers: [] }))
  for (let i = 0; i < n; i++) {
    depts[i % depts.length].workers.push({ id: `w${i}`, title: `Worker ${i}`, status: 'idle' })
  }
  return { ...base, departments: depts }
}

test('sprite parsing: size, transparency, uneven rows rejected', () => {
  const s = parseSprite(['.ab', 'c..'])
  assert.equal(s.w, 3)
  assert.equal(s.h, 2)
  assert.deepEqual(s.px, ['', 'a', 'b', 'c', '', ''])
  assert.throws(() => parseSprite(['ab', 'abc']), /row 1/)
  assert.throws(() => parseSprite([]))
})

test('every sprite uses only palette keys; people are 12 wide, 16 standing and 14 sitting', () => {
  for (const [name, s] of Object.entries(SPRITES)) {
    for (const key of s.px) if (key) assert.ok(key in P.BASE, `${name} uses unknown key ${key}`)
  }
  for (const name of ['stand', 'hand', 'walkA', 'walkB', 'coffee']) {
    assert.equal(SPRITES[name].w, 12, name)
    assert.equal(SPRITES[name].h, 16, name)
  }
  for (const name of ['sit', 'typeA', 'typeB', 'sleep']) {
    assert.equal(SPRITES[name].w, 12, name)
    assert.equal(SPRITES[name].h, 14, name)
  }
})

test('agent looks are stable per id and heads dress differently', () => {
  assert.equal(P.hashId('content-maker'), P.hashId('content-maker'))
  assert.notEqual(P.hashId('content-maker'), P.hashId('publisher'))
  assert.deepEqual(P.agentLook('publisher'), P.agentLook('publisher'))
  const worker = P.agentLook('sales-head', 'worker')
  const head = P.agentLook('sales-head', 'head')
  assert.notEqual(worker.key, head.key)
  assert.equal(head.palette.t, P.COLORS.red)
  assert.equal(P.agentLook('director', 'director').palette.t, P.COLORS.lime)
})

test('colour helpers', () => {
  assert.equal(P.mix('#000000', '#ffffff', 0.5), '#808080')
  assert.equal(P.mix('#102030', '#405060', 0), '#102030')
  assert.equal(P.shade('#808080', -0.5), '#404040')
})

test('pixel font widths and coverage', () => {
  assert.equal(F.textWidth('A'), 3)
  assert.equal(F.textWidth('AB'), 7)
  assert.equal(F.textWidth('M'), 5)
  assert.ok(F.canWrite('BACK OFFICE'))
  assert.equal(F.canWrite('Маркетинг'), false)
})

test('layout is deterministic and gives every person a desk', () => {
  const data = officeMock(NOW)
  const a = L.buildLayout(data)
  const b = L.buildLayout(officeMock(NOW))
  assert.deepEqual(a, b)
  const people = officePeople(data)
  assert.equal(a.desks.length, people.length)
  for (const p of people) assert.ok(a.desks.some((d) => d.agentId === p.id), p.id)
  assert.equal(a.desks.find((d) => d.director)?.agentId, 'director')
  assert.deepEqual(a.racks.map((r) => r.productId), ['dono', 'polly'])
  for (const kind of ['director', 'meeting', 'builders', 'lounge', 'servers']) assert.ok(L.roomOf(a, kind), kind)
})

test('desks stay put when statuses change', () => {
  const data = officeMock(NOW)
  const changed = structuredClone(data)
  for (const d of changed.departments) {
    d.head.status = 'sleeping'
    for (const w of d.workers) w.status = 'offline'
  }
  changed.director.status = 'working'
  assert.equal(L.layoutSignature(data), L.layoutSignature(changed))
  assert.deepEqual(L.buildLayout(changed).desks, L.buildLayout(data).desks)
})

test('rooms tile each floor without overlap and desks sit inside their room', () => {
  const layout = L.buildLayout(company(20))
  for (let f = 0; f < layout.floors; f++) {
    const rooms = layout.rooms.filter((r) => r.floor === f)
    let x = L.FLOOR_X
    for (const r of rooms) {
      assert.equal(r.x, x)
      x += r.w
    }
    assert.equal(x, layout.width - L.MARGIN)
  }
  for (const desk of layout.desks) {
    const room = layout.rooms.find((r) => r.id === desk.roomId)
    assert.ok(desk.x >= room.x && desk.x + desk.w <= room.x + room.w, desk.agentId)
  }
  const byFloor = Object.groupBy(layout.desks, (d) => d.floor)
  for (const desks of Object.values(byFloor)) {
    const sorted = desks.toSorted((p, q) => p.x - q.x)
    for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].x >= sorted[i - 1].x + sorted[i - 1].w)
  }
})

test('about 25 agents fit a 1280 px screen at 3x on four floors at most', () => {
  const layout = L.buildLayout(company(19)) // 19 workers + 5 heads + the director = 25
  assert.equal(officePeople(company(19)).length, 25)
  assert.ok(layout.width * 3 <= 1216, `width ${layout.width}`)
  assert.ok(layout.floors <= 4, `floors ${layout.floors}`)
})

test('status decides where a person goes and what they do there', () => {
  const data = officeMock(NOW)
  const layout = L.buildLayout(data)
  const people = officePeople(data)
  const desk = (id) => layout.desks.find((d) => d.agentId === id)
  const lounge = L.roomOf(layout, 'lounge')
  const builders = L.roomOf(layout, 'builders')
  const person = (id, status) => ({ ...people.find((p) => p.id === id), status })
  const crowd = (list, issues = 0, time = NOW) => B.crowdOf(list, issues, time)

  const working = B.targetFor(person('publisher', 'working'), desk('publisher'), layout, crowd(people))
  assert.deepEqual(working, { floor: desk('publisher').floor, x: L.seatX(desk('publisher')), pose: 'type', facing: 1 })

  const waiting = B.targetFor(person('publisher', 'waiting'), desk('publisher'), layout, crowd(people))
  assert.equal(waiting.pose, 'hand')
  assert.equal(waiting.x, L.standX(desk('publisher')))

  const sleeping = B.targetFor(person('analyst', 'sleeping'), desk('analyst'), layout, crowd(people))
  assert.equal(sleeping.pose, 'sleep')
  assert.equal(sleeping.x, L.seatX(desk('analyst')))

  const idle = B.targetFor(person('finance', 'idle'), desk('finance'), layout, crowd(people))
  assert.equal(idle.floor, lounge.floor)
  assert.ok(idle.x >= lounge.x && idle.x < lounge.x + lounge.w)
  assert.ok(idle.pose === 'coffee' || idle.pose === 'chat')

  const director = B.targetFor(person('director', 'idle'), desk('director'), layout, crowd(people))
  assert.equal(director.pose, 'sit')

  for (const status of ['paused', 'offline']) {
    const away = B.targetFor(person('presales', status), desk('presales'), layout, crowd(people))
    assert.equal(away.pose, 'absent')
    assert.equal(away.x, layout.stairsX)
  }

  const seo = person('seo-specialist', 'blocked')
  assert.equal(B.targetFor(seo, desk('seo-specialist'), layout, crowd(people, 0)).pose, 'stand')
  assert.equal(B.targetFor(seo, desk('seo-specialist'), layout, crowd(people, 0)).x, L.standX(desk('seo-specialist')))
  // Over one cycle the blocked agent spends some time at the builders' terminal, and only there.
  let visits = 0
  for (let t = 0; t < 80_000; t += 1000) {
    const target = B.targetFor(seo, desk('seo-specialist'), layout, crowd(people, 2, NOW + t))
    if (target.floor === builders.floor && target.x >= builders.x && target.x < builders.x + builders.w) visits++
  }
  assert.ok(visits > 5 && visits < 40, `visits ${visits}`)
})

test('idle people get distinct lounge spots in a stable order', () => {
  const data = officeMock(NOW)
  const layout = L.buildLayout(data)
  const people = officePeople(data)
  const crowd = B.crowdOf(people, 0, NOW)
  const idle = people.filter((p) => p.status === 'idle' && p.role !== 'director')
  const xs = idle.map((p) => B.targetFor(p, layout.desks.find((d) => d.agentId === p.id), layout, crowd).x)
  assert.equal(new Set(xs).size, xs.length)
  assert.deepEqual([...crowd.idle.keys()], idle.map((p) => p.id).sort())
})

test('walks change floors through the stairwell', () => {
  const to = { floor: 2, x: 200, pose: 'coffee', facing: 1 }
  const path = B.planPath({ x: 100, y: L.feetY(0) }, 0, to, 14)
  assert.deepEqual(path, [
    { x: 14, y: L.feetY(0) },
    { x: 14, y: L.feetY(1) },
    { x: 14, y: L.feetY(2) },
    { x: 200, y: L.feetY(2) },
  ])
  assert.deepEqual(B.planPath({ x: 100, y: L.feetY(1) }, 1, { ...to, floor: 1 }, 14), [{ x: 200, y: L.feetY(1) }])
  const up = B.planPath({ x: 100, y: L.feetY(2) }, 2, { ...to, floor: 0 }, 14)
  assert.deepEqual(up.map((p) => p.y), [L.feetY(2), L.feetY(1), L.feetY(0), L.feetY(0)])
})

test('room light: off when all paused, dim when nobody is awake or in quiet hours', () => {
  const room = { id: 'x', kind: 'dept', title: 'X', floor: 0, x: 0, w: 50, agentIds: ['a', 'b'] }
  const of = (map) => (id) => map[id]
  assert.equal(B.roomLight(room, of({ a: 'paused', b: 'paused' }), false), 'off')
  assert.equal(B.roomLight(room, of({ a: 'sleeping', b: 'offline' }), false), 'dim')
  assert.equal(B.roomLight(room, of({ a: 'working', b: 'paused' }), false), 'on')
  assert.equal(B.roomLight(room, of({ a: 'working', b: 'idle' }), true), 'dim')
  assert.equal(B.roomLight({ ...room, agentIds: [] }, of({}), false), 'on')
})

test('local hour follows the company time zone', () => {
  assert.equal(S.localHour(Date.parse('2026-11-19T18:40:00Z'), 'Asia/Tashkent'), 23 + 40 / 60)
  assert.equal(S.localHour(Date.parse('2026-11-19T07:00:00Z'), 'Asia/Tashkent'), 12)
  assert.equal(S.localHour(Date.parse('2026-11-19T07:30:00Z'), 'Not/AZone'), 7.5)
})

test('sky by hour: night, dawn, day, dusk', () => {
  const noon = S.skyAt(12)
  assert.equal(noon.phase, 'day')
  assert.equal(noon.daylight, 1)
  assert.equal(noon.cityLights, false)
  assert.ok(noon.sun && noon.sun.y > 0.9)

  const night = S.skyAt(23.5)
  assert.equal(night.phase, 'night')
  assert.equal(night.daylight, 0)
  assert.equal(night.cityLights, true)
  assert.equal(night.sun, null)
  assert.equal(S.skyAt(3).top, night.top)

  assert.equal(S.skyAt(6.5).phase, 'dawn')
  assert.equal(S.skyAt(17.5).phase, 'dusk')
  assert.ok(S.skyAt(6.5).daylight > 0 && S.skyAt(6.5).daylight < 1)
  assert.ok(S.skyAt(9).daylight === 1)
  assert.equal(S.skyAt(24 + 12).phase, 'day')
})

test('the mock shows every agent status', () => {
  const people = officePeople(officeMock(NOW))
  const seen = new Set(people.map((p) => p.status))
  for (const s of STATUSES) assert.ok(seen.has(s), s)
  const production = officeMock(NOW).departments.find((d) => d.id === 'production')
  assert.ok([production.head, ...production.workers].every((a) => a.status === 'paused'))
})
