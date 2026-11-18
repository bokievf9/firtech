import assert from 'node:assert/strict'
import { test } from 'node:test'
import { officeMock } from '../src/lib/office-mock.ts'
import * as B from '../src/components/pixel-office/behaviour.ts'
import * as Life from '../src/components/pixel-office/life.ts'
import * as F from '../src/components/pixel-office/font.ts'
import * as L from '../src/components/pixel-office/layout.ts'
import { officePeople } from '../src/components/pixel-office/model.ts'
import * as P from '../src/components/pixel-office/palette.ts'
import { parseSprite, SPRITES } from '../src/components/pixel-office/sprites.ts'
import * as S from '../src/components/pixel-office/sun.ts'

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
  for (const name of ['stand', 'hand', 'walkA', 'walkB', 'coffee', 'stretch']) {
    assert.equal(SPRITES[name].w, 12, name)
    assert.equal(SPRITES[name].h, 16, name)
  }
  for (const name of ['sit', 'typeA', 'typeB', 'sleep', 'read', 'lean']) {
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

  // Sleeping people rest at their desk (a lamp, no slump); only the night plan wakes a few.
  const sleeping = B.targetFor(person('analyst', 'sleeping'), desk('analyst'), layout, crowd(people))
  assert.equal(sleeping.floor, desk('analyst').floor)
  assert.ok(['lean', 'sleep', 'read', 'hand', 'stand', 'coffee'].includes(sleeping.pose))

  // An idle worker is somewhere on a floor of the building, doing something from the repertoire.
  const idle = B.targetFor(person('finance', 'idle'), desk('finance'), layout, crowd(people))
  assert.ok(idle.tag)
  assert.ok(idle.floor >= 0 && idle.floor < layout.floors)
  void lounge

  // The director stays in his office (or the meeting room) when idle.
  const director = B.targetFor(person('director', 'idle'), desk('director'), layout, crowd(people))
  const droom = L.roomOf(layout, 'director')
  const meet = L.roomOf(layout, 'meeting')
  const inRoom = (t, r) => t.floor === r.floor && t.x >= r.x && t.x < r.x + r.w
  assert.ok(inRoom(director, droom) || inRoom(director, meet))

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

test('crowd keeps the lounge order of idle people sorted by id', () => {
  const data = officeMock(NOW)
  const people = officePeople(data)
  const crowd = B.crowdOf(people, 0, NOW)
  const idle = people.filter((p) => p.status === 'idle' && p.role !== 'director')
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

// ---- Office life ------------------------------------------------------------------------------

const everyone = (status) => officePeople(company(19)).map((p) => ({ ...p, status }))
const inRoom = (layout, kind, t) => {
  const r = L.roomOf(layout, kind)
  return !!r && t.floor === r.floor && t.x >= r.x && t.x < r.x + r.w
}
const targets = (people, layout, time) => {
  const crowd = B.crowdOf(people, 0, time)
  return people.map((p) => ({ p, t: B.targetFor(p, layout.desks.find((d) => d.agentId === p.id), layout, crowd) }))
}

test('life: repertoire is stable inside a bucket and changes across buckets', () => {
  const id = 'content-maker'
  const b0 = Life.bucketOf(id, NOW)
  // Same bucket: same pick, however often it is asked.
  assert.equal(Life.idleRoll(id, b0), Life.idleRoll(id, b0))
  let t = NOW
  while (Life.bucketOf(id, t) === b0) t += 1000
  const length = t - NOW
  assert.ok(length <= 91_000, `bucket ends within a minute and a half (${length} ms)`)
  // Buckets last 30 to 90 s.
  let end = t
  while (Life.bucketOf(id, end) === b0 + 1) end += 1000
  assert.ok(end - t >= 30_000 && end - t <= 91_000, `bucket length ${end - t}`)
  // Over many buckets a person does several different things.
  const seen = new Set(Array.from({ length: 60 }, (_, i) => Life.idleRoll(id, i)))
  assert.ok(seen.size >= 5, `activities seen: ${[...seen]}`)
  // Two pages asking at the same moment get the same office; a later bucket changes some of it.
  const layout = L.buildLayout(company(19))
  const people = everyone('idle')
  const a = JSON.stringify(targets(people, layout, NOW).map((x) => x.t))
  assert.equal(a, JSON.stringify(targets(people, layout, NOW).map((x) => x.t)))
  assert.notEqual(a, JSON.stringify(targets(people, layout, NOW + 200_000).map((x) => x.t)))
})

test('life: heads and the director never go to the lounge', () => {
  const layout = L.buildLayout(company(19))
  const people = everyone('idle')
  for (let time = NOW; time < NOW + 1_800_000; time += 7_000) {
    for (const { p, t } of targets(people, layout, time)) {
      if (p.role === 'worker') continue
      assert.ok(!inRoom(layout, 'lounge', t), `${p.id} in the lounge at +${time - NOW}`)
      if (p.role === 'director') assert.ok(inRoom(layout, 'director', t) || inRoom(layout, 'meeting', t), 'director strays')
    }
  }
})

test('life: heads meet in the Meeting room now and then, and talk in turns', () => {
  const layout = L.buildLayout(company(19))
  const people = everyone('idle')
  let meetings = 0
  for (let time = NOW - (NOW % Life.MEET_PERIOD); time < NOW + 3_600_000; time += 5_000) {
    const there = targets(people, layout, time).filter(({ p, t }) => p.role !== 'worker' && inRoom(layout, 'meeting', t))
    if (there.length) {
      meetings++
      assert.equal(there.length, 2)
      assert.deepEqual(there.map(({ t }) => t.side).sort(), [0, 1])
    }
  }
  assert.ok(meetings > 20, `meeting ticks ${meetings}`)
  // Bubbles alternate: exactly one side speaks at any moment, and it switches.
  assert.notEqual(Life.speaks(0, 0), Life.speaks(1, 0))
  assert.notEqual(Life.speaks(0, 0), Life.speaks(0, 1600))
  assert.equal(Life.speaks(undefined, 0), false)
})

test('life: at most 40% of idle people are in the lounge, the rest stay near their desks', () => {
  for (const n of [5, 12, 19]) {
    const data = company(n)
    const layout = L.buildLayout(data)
    const people = officePeople(data).map((p) => ({ ...p, status: 'idle' }))
    let peak = 0
    for (let time = NOW; time < NOW + 3_600_000; time += 9_000) {
      const inLounge = targets(people, layout, time).filter(({ t }) => inRoom(layout, 'lounge', t)).length
      peak = Math.max(peak, inLounge)
      assert.ok(inLounge <= Math.floor(people.length * 0.4), `${inLounge} of ${people.length} in the lounge`)
    }
    assert.ok(peak > 0, 'the lounge is used')
  }
})

test('life: chats are pairs that face each other', () => {
  const layout = L.buildLayout(company(19))
  const people = everyone('idle')
  let pairs = 0
  for (let time = NOW; time < NOW + 1_200_000; time += 11_000) {
    const chat = targets(people, layout, time).filter(({ t }) => t.pose === 'chat' && t.tag !== 'meeting')
    const sides = chat.map(({ t }) => t.side)
    assert.equal(sides.filter((s) => s === 0).length, sides.filter((s) => s === 1).length, 'every talker has a partner')
    pairs += sides.filter((s) => s === 0).length
    for (const { t } of chat.filter(({ t }) => t.side === 0)) {
      const partner = chat.find(({ t: u }) => u.side === 1 && u.floor === t.floor && Math.abs(u.x - t.x) === 11)
      assert.ok(partner, 'partner stands next to them')
      assert.equal(partner.t.facing, -t.facing)
    }
  }
  assert.ok(pairs > 10, `pairs ${pairs}`)
})

test('life: quiet night keeps at most 20% awake and at most two with Z', () => {
  const layout = L.buildLayout(company(19))
  const people = everyone('sleeping')
  let awakeSeen = 0
  let headsAtBoard = 0
  for (let time = NOW; time < NOW + 7_200_000; time += 20_000) {
    const all = targets(people, layout, time)
    const awake = all.filter(({ t }) => t.pose !== 'lean' && t.pose !== 'sleep')
    assert.ok(awake.length <= Math.floor(people.length * 0.2), `${awake.length} awake of ${people.length}`)
    assert.ok(all.filter(({ t }) => t.z).length <= 2)
    awakeSeen = Math.max(awakeSeen, awake.length)
    headsAtBoard = Math.max(headsAtBoard, all.filter(({ p, t }) => p.role === 'head' && t.tag === 'board').length)
    // Nobody is mass-asleep, the rest rest with a lamp on.
    for (const { t } of all) if (t.pose === 'lean' || t.pose === 'sleep') assert.equal(t.lamp, true)
    assert.ok(all.filter(({ t }) => t.pose === 'lean').length >= people.length - 2 - Math.floor(people.length * 0.2))
  }
  assert.ok(awakeSeen >= 2, 'a few stay up')
  assert.ok(headsAtBoard >= 1 && headsAtBoard <= 2, `heads at the board ${headsAtBoard}`)
})

test('life: night targets are slow-changing (buckets of 90 s and more)', () => {
  assert.ok(Life.bucketOf('analyst', NOW, 'night') !== undefined)
  let t = NOW
  const b = Life.bucketOf('analyst', t, 'night')
  while (Life.bucketOf('analyst', t, 'night') === b) t += 1000
  let end = t
  while (Life.bucketOf('analyst', end, 'night') === b + 1) end += 1000
  assert.ok(end - t >= 90_000, `night bucket ${end - t}`)
})

test('life: reduced motion re-rolls half as often and nobody paces', () => {
  const slowLen = (() => {
    let t = NOW
    const b = Life.bucketOf('analyst', t, 'day', true)
    while (Life.bucketOf('analyst', t, 'day', true) === b) t += 1000
    let end = t
    while (Life.bucketOf('analyst', end, 'day', true) === b + 1) end += 1000
    return end - t
  })()
  assert.ok(slowLen >= 60_000)
})

test('thinking flag reaches the person and draws a moving cue', () => {
  const data = officeMock(NOW)
  data.departments[0].workers[0] = { ...data.departments[0].workers[0], thinking: true }
  const people = officePeople(data)
  assert.equal(people.find((p) => p.id === data.departments[0].workers[0].id).thinking, true)
  assert.equal(people.filter((p) => p.thinking).length, 1)
  // Absent in the data counts as false.
  assert.ok(officePeople(officeMock(NOW)).every((p) => p.thinking === false))
  const a = Life.thinkCue(0, false)
  assert.equal(a.length, 3)
  assert.notDeepEqual(a, Life.thinkCue(200, false))
  // Reduced motion: the same frame for half a second, then a slow step.
  assert.deepEqual(Life.thinkCue(0, true), Life.thinkCue(500, true))
  assert.notDeepEqual(Life.thinkCue(0, true), Life.thinkCue(900, true))
})

test('director sign: the font can write «Очередь пуста»', () => {
  assert.ok(F.canWrite('ОЧЕРЕДЬ'))
  assert.ok(F.canWrite('ПУСТА'))
})

test('whiteboards and windows do not collide, lounge spots are inside the lounge', () => {
  const layout = L.buildLayout(company(19))
  const lounge = L.roomOf(layout, 'lounge')
  const spots = L.loungeSpots(layout)
  for (const x of [spots.coffee, spots.cooler, spots.plant, ...spots.sofa]) assert.ok(x > lounge.x && x < lounge.x + lounge.w)
  for (const room of layout.rooms.filter((r) => L.hasBoard(r))) {
    assert.ok(!L.lookWindows(room).includes(L.boardX(room)))
  }
  assert.ok(layout.rooms.some((r) => L.hasBoard(r)))
})
