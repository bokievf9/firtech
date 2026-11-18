// Office v2: reception and visitors, approvals and reactions, weather, camera, TV, props, plants,
// layer cache, and the scene block of the data contract. Pure layers only.
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

// 'server-only' and '@/...' for plain Node, as in admin.test.mjs.
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

const { officeMock, mockScene, weatherMock, MOCK_REACTIONS } = await import('../src/lib/office-mock.ts')
const { normalizeScene } = await import('../src/lib/office-view.ts')
const { withScene, fetchOffice } = await import('../src/lib/office-hq.ts')
const W = await import('../src/lib/office-weather.ts')
const pub = await import('../src/lib/office-public.ts')
const L = await import('../src/components/pixel-office/layout.ts')
const V = await import('../src/components/pixel-office/visitors.ts')
const A = await import('../src/components/pixel-office/approvals.ts')
const C = await import('../src/components/pixel-office/camera.ts')
const E = await import('../src/components/pixel-office/environment.ts')
const P = await import('../src/components/pixel-office/props.ts')
const LC = await import('../src/components/pixel-office/layer-cache.ts')
const B = await import('../src/components/pixel-office/behaviour.ts')
const { skyAt } = await import('../src/components/pixel-office/sun.ts')

const NOW = Date.parse('2026-11-19T12:00:00Z')
const iso = (ms) => new Date(ms).toISOString()

// ---- Data contract --------------------------------------------------------------------------

test('scene block: normalised, bad entries dropped, everything optional', () => {
  const empty = normalizeScene(undefined)
  assert.deepEqual(empty.visitors, [])
  assert.equal(empty.leadsToday, 0)
  assert.equal(empty.notice, '')
  assert.equal(empty.uptimeDays, null)
  const s = normalizeScene({
    visitors: [
      { id: 'v-a1b2c3', channel: 'telegram', state: 'intake', since: iso(NOW) },
      { id: 'v-a1b2c3', channel: 'web', state: 'chat', since: iso(NOW) },
      { id: 'v-bad', channel: 'web', state: 'dancing', since: iso(NOW) },
      { id: 'v-nodate', channel: 'web', state: 'chat', since: 'yesterday' },
      { id: 'v-odd', channel: 'fax', state: 'chat', since: iso(NOW) },
    ],
    leadsToday: 3.7,
    publishedToday: -2,
    builderIssuesByDept: { marketing: 2, sales: 0, x: 'many' },
    approvalsByAgent: { publisher: 2 },
    reactions: [{ agent: 'publisher', kind: 'published', at: iso(NOW) }, { agent: 'x', kind: 'exploded', at: iso(NOW) }],
    notice: '  Утренняя   сводка, 19.11 ' + 'x'.repeat(100),
    uptimeDays: 12.46,
  })
  assert.deepEqual(s.visitors.map((v) => [v.id, v.channel]), [['v-a1b2c3', 'telegram'], ['v-odd', 'web']])
  assert.equal(s.leadsToday, 3)
  assert.equal(s.publishedToday, 0)
  assert.deepEqual(s.builderIssuesByDept, { marketing: 2 })
  assert.equal(s.reactions.length, 1)
  assert.ok(s.notice.startsWith('Утренняя сводка, 19.11'))
  assert.equal(s.notice.length, 80)
  assert.equal(s.uptimeDays, 12.5)
  // At most 20 visitors, at most 30 reactions (the newest).
  const many = normalizeScene({
    visitors: Array.from({ length: 25 }, (_, i) => ({ id: `v-${i}`, channel: 'web', state: 'chat', since: iso(NOW) })),
    reactions: Array.from({ length: 35 }, (_, i) => ({ agent: `a${i}`, kind: 'done', at: iso(NOW) })),
  })
  assert.equal(many.visitors.length, 20)
  assert.equal(many.reactions.length, 30)
  assert.equal(many.reactions.at(-1).agent, 'a34')
})

test('office-hq passes the scene block and visitorsActive through, cleaned', async () => {
  const body = { ...officeMock(NOW), visitorsActive: 4.9, scene: { visitors: [{ id: 'v-1', channel: 'web', state: 'bogus', since: iso(NOW) }], leadsToday: 2 } }
  const out = withScene(body)
  assert.equal(out.visitorsActive, 4)
  assert.deepEqual(out.scene.visitors, [])
  assert.equal(out.scene.leadsToday, 2)
  const bare = withScene({ ...officeMock(NOW), visitorsActive: 'x', scene: null })
  assert.equal('scene' in bare, false)
  assert.equal('visitorsActive' in bare, false)
  const fetcher = async () => new Response(JSON.stringify(body), { status: 200 })
  const got = await fetchOffice({ HQ_OFFICE_URL: 'http://hq/office', NODE_ENV: 'production' }, fetcher)
  assert.equal(got.ok, true)
  assert.equal(got.visitorsActive, 4)
})

test('the mock exercises every mechanic: visitor states, reactions, approvals, notice', () => {
  const states = new Set()
  for (let t = 0; t < 120_000; t += 10_000) for (const v of mockScene(NOW + t).visitors) states.add(v.state)
  assert.deepEqual([...states].sort(), ['chat', 'contact', 'done', 'human', 'intake'])
  const s = mockScene(NOW)
  assert.ok(s.visitors.every((v) => /^v-[0-9a-f]{6}$/.test(v.id)))
  const kinds = new Set(s.reactions.map((r) => r.kind))
  for (const [kind] of MOCK_REACTIONS) assert.ok(kinds.has(kind), kind)
  assert.ok(s.reactions.length <= 30)
  const ats = s.reactions.map((r) => Date.parse(r.at))
  assert.deepEqual(ats, [...ats].sort((a, b) => a - b), 'oldest first')
  assert.ok(ats.every((a) => a >= NOW - 10 * 60_000 && a <= NOW))
  assert.ok(s.reactions.filter((r) => r.kind === 'published').every((r) => r.agent === 'publisher'))
  assert.match(s.notice, /^Утренняя сводка, \d\d\.\d\d$/)
  const m = officeMock(NOW)
  assert.equal(m.director.pendingApprovals, A.approvalsTotal(m.scene.approvalsByAgent, 0))
  assert.equal(m.visitorsActive, m.scene.visitors.length)
  for (const kind of W.WEATHER_KINDS) assert.equal(weatherMock(kind, NOW).kind, kind)
})

test('public office: only visitorsActive joins the counts', () => {
  const out = pub.toPublicOffice({ ...officeMock(NOW), visitorsActive: 37 })
  assert.equal(out.counts.visitorsActive, 37)
  const text = JSON.stringify(out)
  for (const leak of ['v-c0ffee', 'reactions', 'approvalsByAgent', 'notice', 'leadsToday', 'scene']) assert.ok(!text.includes(leak), leak)
  assert.equal(pub.toPublicOffice({ ...officeMock(NOW), visitorsActive: undefined }).counts.visitorsActive, 0)
  // The hero draws up to four anonymous visitors from the count.
  const scene = pub.publicToScene(out)
  assert.equal(scene.scene.visitors.length, 4)
  assert.ok(scene.scene.visitors.every((v) => v.id.startsWith('pub-') && v.state === 'chat'))
})

// ---- Visitors -------------------------------------------------------------------------------

test('visitor lifecycle: chat waits, intake talks, done delivers then leaves, human, expiry, gone', () => {
  const v = (id, state, sinceMin = 1) => ({ id, channel: 'web', state, since: iso(NOW - sinceMin * 60_000) })
  let memo = V.trackVisitors(new Map(), [v('v-1', 'chat'), v('v-2', 'intake'), v('v-3', 'contact'), v('v-4', 'human'), v('v-5', 'chat', 31)], NOW)
  const stage = (id, at = NOW) => V.visitorStage(memo.get(id), at)
  assert.equal(stage('v-1'), 'wait')
  assert.equal(stage('v-2'), 'talk')
  assert.equal(stage('v-3'), 'talk')
  assert.equal(stage('v-4'), 'human')
  assert.equal(stage('v-5'), 'leave', 'since + 30 min')
  assert.equal(V.needsHuman(memo.values(), NOW), true)

  // v-2 is done: deliver for 45 s from when the scene first saw it done, then leave.
  memo = V.trackVisitors(memo, [v('v-1', 'chat'), v('v-2', 'done'), v('v-4', 'human')], NOW + 1000)
  assert.equal(memo.get('v-2').doneAt, NOW + 1000)
  assert.equal(stage('v-2', NOW + 2000), 'deliver')
  memo = V.trackVisitors(memo, [v('v-1', 'chat'), v('v-2', 'done'), v('v-4', 'human')], NOW + 20_000)
  assert.equal(memo.get('v-2').doneAt, NOW + 1000, 'the delivery clock does not restart')
  assert.equal(stage('v-2', NOW + 1000 + V.DELIVER_MS + 1), 'leave')

  // v-3 vanished from the data: leaves, and is forgotten LEAVE_MS later.
  assert.equal(memo.get('v-3').goneAt, NOW + 1000)
  assert.equal(stage('v-3', NOW + 1500), 'leave')
  memo = V.trackVisitors(memo, [v('v-1', 'chat')], NOW + 1000 + V.LEAVE_MS)
  assert.equal(memo.has('v-3'), false)
  assert.equal(memo.get('v-1').firstSeen, NOW)
})

test('visitor places: talkers take the counter first, two spots; bench of three; queue; deliver to Sales', () => {
  const layout = L.buildLayout(officeMock(NOW))
  const spots = L.lobbySpots(layout)
  const lobby = L.roomOf(layout, 'lobby')
  assert.equal(lobby.floor, layout.floors - 1, 'reception is on the ground floor')
  assert.equal(lobby.x + lobby.w, layout.width - L.MARGIN, 'and the rightmost room, by the front door')
  const list = [
    ['a', 'chat'], ['b', 'chat'], ['c', 'intake'], ['d', 'chat'], ['e', 'contact'], ['f', 'intake'], ['g', 'human'], ['h', 'done'],
  ].map(([id, state], i) => ({ id, channel: 'web', state, since: iso(NOW), firstSeen: NOW + i, doneAt: state === 'done' ? NOW : null, goneAt: null }))
  const places = V.visitorPlaces(list, layout, NOW + 1000)
  assert.deepEqual([places.get('c').x, places.get('e').x], spots.counter)
  assert.equal(places.get('c').counterIndex, 0)
  assert.equal(places.get('f').stage, 'talk')
  assert.ok(!spots.counter.includes(places.get('f').x), 'third talker waits elsewhere')
  const seated = [...places.values()].filter((p) => p.pose === 'sit').map((p) => p.x)
  assert.deepEqual(seated, spots.bench)
  const drop = V.salesDrop(layout)
  assert.equal(places.get('h').stage, 'deliver')
  assert.equal(places.get('h').floor, drop.floor)
  assert.equal(places.get('h').x, drop.x)
  assert.ok(layout.desks.some((d) => d.agentId === drop.agentId && /sales/.test(d.roomId)))
  for (const p of places.values()) {
    if (p.stage === 'deliver') continue
    assert.ok(p.x >= lobby.x && p.x <= lobby.x + lobby.w, 'everybody else stays in the reception')
  }
  const gone = V.visitorPlaces([{ ...list[0], goneAt: NOW }], layout, NOW)
  assert.equal(gone.get('a').pose, 'absent')
  assert.equal(gone.get('a').x, spots.door)
})

// ---- Approvals and reactions ----------------------------------------------------------------

test('approvals: stack count from the per-agent block, diffs, carrying and fetching', () => {
  assert.equal(A.approvalsTotal({ publisher: 2, presales: 1 }, 9), 3)
  assert.equal(A.approvalsTotal({}, 4), 4, 'falls back to director.pendingApprovals')
  assert.equal(A.approvalsTotal(undefined, 2), 2)
  assert.deepEqual(A.diffApprovals(null, { a: 1 }), [], 'first load animates nothing')
  assert.deepEqual(A.diffApprovals({ a: 1, b: 2 }, { a: 2, c: 1 }), [
    { agent: 'a', delta: 1 },
    { agent: 'b', delta: -2 },
    { agent: 'c', delta: 1 },
  ])
  assert.equal(A.visibleStack(3, 1, 0), 2, 'a paper still in a hand is not on the desk yet')
  assert.equal(A.visibleStack(2, 0, 1), 3, 'an approved paper stays until fetched')
  assert.equal(A.visibleStack(40, 0, 0), A.STACK_CAP)
  assert.equal(A.visibleStack(0, 2, 0), 0)
})

test('reactions: each kind has its animation, each reaction plays once and only while fresh', () => {
  const plans = Object.fromEntries(['approved', 'rejected', 'published', 'blocked', 'issue_closed', 'lead', 'done'].map((k) => [k, A.reactionPlan(k)]))
  assert.equal(plans.approved.errand, 'fetch')
  assert.equal(plans.approved.icon, 'check')
  assert.equal(plans.rejected.effect, 'crumple')
  assert.equal(plans.published.effect, 'confetti')
  assert.equal(plans.blocked.effect, 'cloud')
  assert.equal(plans.issue_closed.errand, 'box')
  assert.equal(plans.lead.icon, 'mail')
  assert.equal(plans.done.icon, 'thumb')

  const seen = new Set()
  const list = [
    { agent: 'a', kind: 'done', at: iso(NOW - 5 * 60_000) },
    { agent: 'b', kind: 'lead', at: iso(NOW - 10_000) },
  ]
  assert.deepEqual(A.freshReactions(list, seen, NOW).map((r) => r.agent), ['b'], 'old ones are history')
  assert.deepEqual(A.freshReactions(list, seen, NOW + 1000), [], 'never twice')
  const more = [...list, { agent: 'c', kind: 'published', at: iso(NOW + 2000) }]
  assert.deepEqual(A.freshReactions(more, seen, NOW + 3000).map((r) => r.agent), ['c'])
  A.freshReactions(more.slice(2), seen, NOW + 4000)
  assert.equal(seen.size, 1, 'keys that left the list are forgotten')
})

test('errands: papers go to the director desk and back, boxes come from the builders corner', () => {
  const layout = L.buildLayout(officeMock(NOW))
  const desk = layout.desks.find((d) => d.agentId === 'publisher')
  const director = layout.desks.find((d) => d.director)
  const deliver = A.errandSteps('deliver', desk, director, layout)
  assert.equal(deliver.length, 1)
  assert.equal(deliver[0].carry, 'paper')
  assert.equal(deliver[0].arrive, 'drop')
  assert.equal(deliver[0].floor, director.floor)
  assert.equal(deliver[0].x, L.directorDropX(director))
  const fetch = A.errandSteps('fetch', desk, director, layout)
  assert.deepEqual(fetch.map((s) => [s.arrive, s.carry, s.icon]), [['pick', null, null], [null, 'paper', 'check']])
  assert.equal(fetch[1].x, L.standX(desk))
  const box = A.errandSteps('box', desk, director, layout)
  assert.equal(box[0].floor, L.roomOf(layout, 'builders').floor)
  assert.equal(box[1].carry, 'box')
  assert.deepEqual(A.errandSteps('deliver', desk, undefined, layout), [])
})

// ---- Weather ---------------------------------------------------------------------------------

test('weather codes map to six looks; anything odd is clear', () => {
  const table = {
    0: 'clear', 1: 'clear', 2: 'clouds', 3: 'clouds', 45: 'fog', 48: 'fog', 51: 'rain', 55: 'rain', 61: 'rain', 65: 'rain',
    66: 'rain', 80: 'rain', 82: 'rain', 71: 'snow', 75: 'snow', 77: 'snow', 85: 'snow', 86: 'snow', 95: 'thunder', 99: 'thunder',
  }
  for (const [code, kind] of Object.entries(table)) assert.equal(W.weatherKind(Number(code)), kind, code)
  for (const odd of [undefined, null, 'rain', Number.NaN, 42, -1]) assert.equal(W.weatherKind(odd), 'clear')
  const ok = W.parseOpenMeteo({ current: { temperature_2m: 6.6, weather_code: 63, is_day: 0, wind_speed_10m: 11.2 } }, NOW)
  assert.deepEqual([ok.ok, ok.kind, ok.tempC, ok.isDay, ok.windKmh, ok.city], [true, 'rain', 7, false, 11, 'Dushanbe'])
  for (const bad of [null, {}, { current: {} }, { current: { weather_code: 'x' } }, 'oops']) {
    const w = W.parseOpenMeteo(bad, NOW)
    assert.equal(w.ok, false)
    assert.equal(w.kind, 'clear')
  }
  assert.ok(W.WEATHER_URL.includes('latitude=38.56') && W.WEATHER_URL.includes('longitude=68.79'))
  assert.ok(W.WEATHER_URL.includes('timezone=Asia/Dushanbe'))
})

test('weather source: one call per 10 minutes, shared, fail-soft to clear and retried after a minute', async () => {
  let clock = NOW
  let calls = 0
  let mode = 'ok'
  const fetcher = async () => {
    calls++
    if (mode === 'throw') throw new Error('down')
    if (mode === '500') return new Response('x', { status: 500 })
    return new Response(JSON.stringify({ current: { temperature_2m: -2, weather_code: 73, is_day: 1, wind_speed_10m: 3 } }))
  }
  const src = W.weatherSource({ fetcher, clock: () => clock })
  const [a, b] = await Promise.all([src.get(), src.get()])
  assert.equal(calls, 1, 'concurrent misses share one call')
  assert.equal(a.kind, 'snow')
  assert.equal(b.tempC, -2)
  clock += W.WEATHER_TTL_MS - 1
  await src.get()
  assert.equal(calls, 1)
  clock += 2
  mode = 'throw'
  const down = await src.get()
  assert.equal(calls, 2)
  assert.deepEqual([down.ok, down.kind], [false, 'clear'])
  clock += W.WEATHER_FAIL_TTL_MS - 1
  await src.get()
  assert.equal(calls, 2)
  clock += 2
  mode = '500'
  assert.equal((await src.get()).kind, 'clear')
  assert.equal(calls, 3)
  assert.equal(W.looksLikeWeather(down), true)
  assert.equal(W.looksLikeWeather({ kind: 'lava' }), false)
})

test('weather on the canvas: greyer sky, particles stay in their box, lightning is rare and never under reduced motion', () => {
  const day = skyAt(13)
  assert.deepEqual(E.weatherSky(day, 'clear'), day)
  const rain = E.weatherSky(day, 'rain')
  assert.notEqual(rain.top, day.top)
  assert.equal(rain.sun, null, 'no sun behind rain clouds')
  for (let t = 0; t < 20_000; t += 777) {
    for (const [x, y] of E.rainDrops(5, 14, 12, NOW + t, false)) assert.ok(x >= 0 && x < 14 && y >= -2 && y < 14)
    for (const [x, y] of E.snowFlakes(5, 14, 12, NOW + t, false)) assert.ok(x >= 0 && x < 14 && y >= 0 && y <= 12)
  }
  assert.deepEqual(E.rainDrops(5, 14, 12, NOW, true), E.rainDrops(5, 14, 12, NOW + 5000, true), 'reduced motion: still')
  let lit = 0
  for (let t = 0; t < 60_000; t += 10) if (E.lightning(t, false) > 0) lit++
  assert.ok(lit > 0 && lit < 120, `flash frames ${lit}`)
  for (let t = 0; t < 60_000; t += 10) assert.equal(E.lightning(t, true), 0)
  assert.equal(E.animatedWeather('fog'), false)
  assert.equal(E.animatedWeather('rain'), true)
})

// ---- Camera ----------------------------------------------------------------------------------

test('zoom is clamped to whole steps 2x..6x and pans stay inside the building', () => {
  assert.equal(C.clampZoom(1), 2)
  assert.equal(C.clampZoom(9), 6)
  assert.equal(C.clampZoom(3.4), 3)
  assert.equal(C.clampZoom(Number.NaN), 2)
  const world = { w: 400, h: 270 }
  assert.equal(C.fitZoom({ w: 1376, h: 0 }, world), 3)
  assert.equal(C.fitZoom({ w: 358, h: 0 }, world), 2, 'phones start at 2x and pan')
  assert.equal(C.fitZoom({ w: 4000, h: 0 }, world), 4)
  const view = { w: 1200, h: 810 }
  // Bigger view than building: centred.
  const home = C.homeCamera(view, world)
  assert.equal(home.zoom, 3)
  assert.equal(home.x, 0)
  assert.equal(home.y, 0)
  const far = C.clampPan({ zoom: 5, x: 9999, y: -50 }, view, world)
  assert.equal(far.x, world.w - view.w / 5)
  assert.equal(far.y, 0)
  const wide = C.clampPan({ zoom: 2, x: 30, y: 30 }, { w: 1600, h: 600 }, world)
  assert.equal(wide.x, -(800 - 400) / 2, 'narrow building centred')
  assert.equal(wide.y, -(600 / 2 - 270) / 2, 'short building centred too')
  // Zoom keeps the point under the cursor.
  const cam = { zoom: 3, x: 0, y: 0 }
  const z = C.zoomAround(cam, 5, 600, 400, view, world)
  const before = C.toWorld(cam, 600, 400)
  const after = C.toWorld(z, 600, 400)
  assert.ok(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9)
  const panned = C.panBy(z, -100, 0, view, world)
  assert.equal(panned.x, z.x + 20)
  const centred = C.centerOn(z, 200, 135, view, world)
  assert.ok(Math.abs(centred.x + view.w / 10 - 200) < 1e-9)
  assert.deepEqual(C.ease({ zoom: 4, x: 0, y: 0 }, { zoom: 4, x: 0.01, y: 10 }, 0.5), { zoom: 4, x: 0.01, y: 5 })
})

// ---- TV, plants, props -----------------------------------------------------------------------

test('lounge TV: leads, published, approved, visitors, then Dushanbe weather; one every 8 s', () => {
  const scene = normalizeScene(mockScene(NOW))
  const slides = E.tvSlides(scene, 4, 16, { kind: 'rain', tempC: 7 })
  assert.deepEqual(slides.map((s) => s.id), ['leads', 'published', 'approved', 'visitors', 'weather'])
  assert.deepEqual(slides.map((s) => s.value), ['3', '2', '4', '4', '+7°'])
  assert.equal(E.tvSlides(scene, 4, 16, E.CLEAR).length, 4, 'no weather slide without a temperature')
  assert.deepEqual(E.tvSlides(null, 0, 16, { kind: 'snow', tempC: -3 }).map((s) => [s.id, s.value]), [['done', '16'], ['weather', '-3°']])
  const order = []
  for (let t = 0; t < 5 * E.TV_SLIDE_MS; t += E.TV_SLIDE_MS) order.push(E.tvSlideAt(slides, t).slide.id)
  assert.deepEqual(order, ['leads', 'published', 'approved', 'visitors', 'weather'])
  assert.equal(E.tvSlideAt(slides, E.TV_SLIDE_MS - 1).index, 0)
  assert.equal(E.tvSlideAt([], 0).slide, null)
  assert.equal(E.formatTemp(0), '0°')
  const h = E.clockHands(15.5, 4)
  assert.deepEqual([h.mx, h.my], [0, 4], 'minute hand at 30 points down')
  assert.equal(h.hx > 0, true)
})

test('plants grow one step per 10 tasks done today, up to four steps', () => {
  assert.deepEqual([0, 9, 10, 19, 20, 35, 40, 400, -5, Number.NaN].map(P.plantStage), [0, 0, 1, 1, 2, 3, 4, 4, 0, 0])
})

test('props: every department has its own, all inside their rooms, wall props clear of windows', () => {
  for (const data of [officeMock(NOW)]) {
    const layout = L.buildLayout(data)
    for (const room of layout.rooms) {
      const props = P.roomProps(room, layout)
      const kind = room.kind === 'dept' ? L.deptKind(room.id) : null
      if (kind) for (const need of P.DEPT_PROPS[kind]) assert.ok(props.some((p) => p.kind === need), `${room.id} lacks ${need}`)
      for (const p of props) {
        assert.ok(p.x >= room.x && p.x + p.w <= room.x + room.w + 1, `${room.id} ${p.kind} x`)
        assert.ok(p.y >= L.floorTop(room.floor) && p.y + p.h <= L.feetY(room.floor), `${room.id} ${p.kind} y`)
        const wall = ['poster', 'wallMap', 'ticketBoard', 'codeBoard'].includes(p.kind)
        if (!wall || p.board) continue
        for (const wx of L.windowXs(room)) {
          const overlap = p.x < wx + L.WINDOW_W + 1 && p.x + p.w > wx - 1 && p.y < L.floorTop(room.floor) + 33 && p.y + p.h > L.floorTop(room.floor) + 17
          assert.ok(!overlap, `${room.id} ${p.kind} covers a window`)
        }
      }
    }
    const all = P.allProps(layout)
    for (const k of ['tv', 'noticeBoard', 'counter', 'bench', 'frontDoor', 'issueMonitor', 'award', 'cityWindow', 'bin', 'bell']) {
      assert.ok(all.some((p) => p.kind === k), k)
    }
    // Floor props stand on the floor, clear of every desk.
    for (const p of all.filter((x) => ['ringLight', 'tripod', 'miniRack', 'cabinet', 'safe'].includes(x.kind))) {
      for (const d of layout.desks.filter((d) => d.roomId === p.roomId)) assert.ok(p.x >= d.x + d.w || p.x + p.w <= d.x, `${p.kind} hits a desk`)
    }
  }
  assert.deepEqual(P.mapPins(undefined), { count: 5, live: false })
  assert.deepEqual(P.mapPins({ contactedToday: 30 }), { count: 12, live: true })
  assert.deepEqual(P.issueLines({ sales: 2, marketing: 1, lab: 1 }, ['marketing', 'sales']), ['MKT #1', 'SLS #2', 'LAB #1'])
  assert.equal(L.deptKind('backoffice'), 'back-office')
  assert.equal(L.deptKind('labs'), null)
})

test('the static layers are repainted only when content or zoom change', () => {
  let paints = 0
  const cache = LC.layerCache((s) => ({ s, n: ++paints }))
  const a = cache.get('layout|sky', 3)
  assert.equal(cache.get('layout|sky', 3), a)
  assert.equal(paints, 1)
  cache.get('layout|sky', 4)
  assert.equal(paints, 2, 'zoom change repaints')
  cache.get('layout|sky', 4)
  cache.get('layout|rain', 4)
  assert.equal(paints, 3, 'content change repaints')
  assert.equal(cache.repaints(), 3)
  assert.equal(cache.scale(), 4)
  assert.equal(LC.layerScale(6, 400, 270), 6)
  assert.equal(LC.layerScale(12, 400, 270), Math.floor(Math.sqrt(LC.LAYER_BUDGET_PX / (400 * 270))), 'huge scales stay in the pixel budget')
  assert.equal(LC.layerScale(0.5, 400, 270), 1)
})

test('elevator: a floor change can ride straight to the target floor', () => {
  const layout = L.buildLayout(officeMock(NOW))
  const to = { floor: 2, x: 100, pose: 'stand', facing: 1 }
  const ride = B.planPath({ x: 200, y: L.feetY(0) }, 0, to, layout.stairsX, layout.liftX)
  assert.deepEqual(ride, [
    { x: layout.liftX, y: L.feetY(0) },
    { x: layout.liftX, y: L.feetY(2), lift: true },
    { x: 100, y: L.feetY(2) },
  ])
  const stairs = B.planPath({ x: 200, y: L.feetY(0) }, 0, to, layout.stairsX)
  assert.ok(stairs.every((p) => !p.lift))
  assert.ok(layout.liftX > layout.stairsX && layout.liftX < L.FLOOR_X)
  const doors = L.doorsOf(layout)
  assert.equal(doors.filter((d) => d.front).length, 1)
  assert.equal(doors.length, layout.rooms.length + 1)
})
