// The live pixel office on a <canvas>. Owns its own animation loop and state; React only hands it
// new data (setData), the weather, the camera input, and asks it what is under the pointer
// (hitTest). Nothing here re-renders React. The loop pauses while the tab is hidden and idles at
// about 10 fps while nothing moves; with reduced motion people move without walking and the
// frames change slowly.
//
// Office v2 adds: the reception with visitors, approvals carried to the Director, reactions,
// props per department, weather, clocks, the lounge TV, an elevator, doors, growing plants, a
// camera (zoom, pan, follow) and a dev stats overlay. Static layers are cached per zoom level
// (layer-cache.ts).

import { normalizeScene, type AgentStatus, type NormalScene, type OfficeData } from '@/lib/office-view'
import {
  approvalsTotal,
  type Carry,
  diffApprovals,
  type Effect,
  ERRAND_MAX_MS,
  type ErrandKind,
  type ErrandStep,
  errandSteps,
  freshReactions,
  type Icon,
  reactionPlan,
  visibleStack,
} from './approvals'
import { crowdOf, planPath, type Point, type Pose, roomLight, type Target, targetFor } from './behaviour'
import {
  type Camera,
  centerOn,
  clampPan,
  ease,
  homeCamera,
  panBy as panCamera,
  sameCamera,
  type Size,
  toWorld,
  zoomAround,
} from './camera'
import { context, type Ctx, makeCanvas, rect, spriteCache, text } from './draw'
import {
  animatedWeather,
  CLEAR,
  clockHands,
  cloudsAt,
  lightning,
  rainDrops,
  snowFlakes,
  tvSlideAt,
  tvSlides,
  type Weather,
  weatherSky,
} from './environment'
import { canWrite, forEachTextPixel, textWidth } from './font'
import {
  buildLayout,
  type Desk,
  type Door,
  doorsOf,
  FEET,
  FLOOR_H,
  feetY,
  floorTop,
  type Layout,
  layoutSignature,
  LIFT_W,
  lobbySpots,
  ROOF_H,
  type Room,
  roomOf,
  SCENE_MIN_W,
} from './layout'
import { layerCache, layerScale } from './layer-cache'
import { speaks, thinkCue } from './life'
import { officePeople, type Person } from './model'
import {
  type BackEnv,
  clockCentre,
  deskScreen,
  deskTable,
  paintBack,
  paintFront,
  rackRect,
  roomInterior,
  screenOf,
  signRect,
  terminalScreen,
  windowRects,
} from './paint-static'
import { agentLook, BASE, COLORS, hashId, type Look, mix, shade } from './palette'
import { allProps, issueLines, mapPins, plantStage, type Prop } from './props'
import { PERSON_W, SIT_H, type SpriteName, SPRITES, STAND_H } from './sprites'
import { localHour, skyAt } from './sun'
import { needsHuman, trackVisitors, type VisitorMemo, type VisitorPlace, visitorPlaces } from './visitors'

export type HitTarget =
  | { kind: 'agent'; id: string }
  | { kind: 'product'; id: string }
  | { kind: 'builders' }
  | { kind: 'room'; id: string }
  | { kind: 'reception' }
  | { kind: 'visitor'; id: string }
export type Rect = { x: number; y: number; w: number; h: number }

export type SceneStats = {
  fps: number
  drawMs: number
  maxDrawMs: number
  mode: 'busy' | 'weather' | 'idle' | 'reduced' | 'paused'
  layerRepaints: number
  layerScale: number
  actors: number
  visitors: number
}

export type Scene = {
  setData(data: OfficeData): void
  setReducedMotion(on: boolean): void
  setHover(target: HitTarget | null): void
  setSelected(target: HitTarget | null): void
  // Logical pixel coordinates (CSS pixels divided by the CSS scale, or toWorld in camera mode).
  hitTest(x: number, y: number): HitTarget | null
  anchorOf(target: HitTarget): Rect | null
  size(): { width: number; height: number }
  resize(cssScale: number): void
  // Public hero: rebuild the building for a new box width (logical px); no-op when unchanged.
  setMinWidth(minWidth: number): void
  // Dev only: pretend it is this local hour (sky and city lights); null follows the clock.
  setHour(hour: number | null): void
  // Stops the animation loop (offscreen, or the hero scrolled away); resumes when false.
  setPaused(paused: boolean): void
  destroy(): void
  // ---- Office v2 ----
  setWeather(weather: Weather): void
  setNameTags(on: boolean): void
  setStats(on: boolean): void
  stats(): SceneStats
  // Camera mode (admin): the canvas becomes a view of w x h CSS px onto the building.
  setViewport(w: number, h: number): void
  camera(): Camera
  setCamera(cam: Camera): void
  zoomAt(zoom: number, px: number, py: number): void
  panBy(dx: number, dy: number): void
  resetView(): void
  follow(id: string | null): void
  following(): string | null
  // CSS px inside the view to logical px, and a logical rect to CSS px inside the view.
  toWorld(px: number, py: number): { x: number; y: number }
  toView(r: Rect): Rect
  // Called after the camera moved (pan, zoom, follow); overlays reposition themselves.
  onView(cb: (() => void) | null): void
  // ---- Пульт v3 (office hub) ----
  // Whole rooms become click targets ({ kind: 'room' } anywhere inside, after people and desks).
  setZoneHits(on: boolean): void
  // A soft lamp on the desks of a room while something waits: room id -> 0 (calm), 0.5, 1 (waits).
  setZoneGlow(glow: Record<string, number>): void
  // The rooms of the current layout and the interior rectangle of one (for badges over the scene).
  rooms(): { id: string; kind: string }[]
  zoneRect(roomId: string): Rect | null
}

type Actor = {
  id: string
  kind: 'agent' | 'visitor'
  look: Look
  x: number
  y: number
  visible: boolean
  path: Point[]
  pose: Pose
  facing: 1 | -1
  walking: boolean
  stride: number
  target: Target | null
  carry: Carry
  riding: boolean
  trips: number
}

type Errand = {
  kind: ErrandKind
  steps: ErrandStep[]
  index: number
  arrivedAt: number | null
  started: number
  done: Set<number>
}

type Fx = { kind: Effect; agent: string; start: number; until: number }

const WALK_SPEED = 30 // logical px per second
const CLIMB_SPEED = 26
const LIFT_SPEED = 36
const REDUCED_STEP_MS = 800
const IDLE_MS = 100
const WEATHER_MS = 50
const RECEPTIONIST = 'reception:bot'

const sameTarget = (a: Target | null, b: Target) =>
  !!a &&
  a.floor === b.floor &&
  a.x === b.x &&
  a.pose === b.pose &&
  a.facing === b.facing &&
  a.tag === b.tag &&
  a.side === b.side &&
  a.z === b.z

const floorOfY = (y: number) => Math.round((y - ROOF_H - FEET) / FLOOR_H)

const within = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h

const deskRect = (desk: Desk): Rect => ({ x: desk.x, y: deskTable(desk).y - 12, w: desk.w, h: 21 })

export const sameHit = (a: HitTarget | null, b: HitTarget | null) =>
  a === b ||
  (!!a && !!b && a.kind === b.kind && ('id' in a ? a.id : '') === ('id' in b ? (b as { id: string }).id : ''))

// Visitors wear coats in muted colours, never a tie.
const COATS = ['#8a6f5a', '#5f6f8a', '#6f8a6a', '#8a5f6f', '#7a7a7a', '#a0784f']
function visitorLook(id: string): Look {
  const base = agentLook(`visitor:${id}`, 'worker')
  const coat = COATS[hashId(id) % COATS.length]!
  return { palette: { ...base.palette, c: coat, d: shade(coat, -0.25), t: shade(coat, -0.1) }, key: `visitor:${coat}:${base.key}` }
}
const RECEPTION_LOOK: Look = (() => {
  const base = agentLook(RECEPTIONIST, 'worker')
  return { palette: { ...base.palette, c: '#3d4a2c', d: '#2c3620', t: COLORS.lime }, key: 'receptionist' }
})()

const CARRY_SPRITE: Partial<Record<NonNullable<Carry>, SpriteName>> = { box: 'box' }
const ICON_SPRITE: Record<Icon, SpriteName> = { check: 'iconCheck', mail: 'iconMail', thumb: 'iconThumb' }

export function createScene(
  canvas: HTMLCanvasElement,
  initial: OfficeData,
  opts: { reducedMotion: boolean; minWidth?: number; stats?: boolean },
): Scene {
  const ctx = context(canvas)
  const sprite = spriteCache()

  let data = initial
  let sc: NormalScene | null = null
  let people: Person[] = []
  let byId = new Map<string, Person>()
  let minWidth = opts.minWidth ?? SCENE_MIN_W
  let paused = false
  let layout: Layout = buildLayout(initial, minWidth)
  let deskById = new Map<string, Desk>()
  let props: Prop[] = []
  let doors: Door[] = []
  let windows: ReturnType<typeof windowRects> = []
  const actors = new Map<string, Actor>()
  let reduced = opts.reducedMotion
  let hover: HitTarget | null = null
  let selected: HitTarget | null = null
  let cssScale = 3
  let k = 3
  let hourOverride: number | null = null
  let weather: Weather = CLEAR
  let nameTags = false
  let showStats = opts.stats === true

  // Camera mode: null view = the canvas is the whole building at cssScale (public hero).
  let view: Size | null = null
  let cam: Camera = { zoom: 3, x: 0, y: 0 }
  let followId: string | null = null
  let viewCb: (() => void) | null = null
  let zoneHits = false
  let zoneGlow: Record<string, number> = {}

  // Visitors, approvals, errands, reactions.
  let visitors = new Map<string, VisitorMemo>()
  let places = new Map<string, VisitorPlace>()
  const walkedOut = new Set<string>()
  const delivered = new Set<string>()
  let prevApprovals: Record<string, number> | null = null
  const errands = new Map<string, Errand>()
  const errandQueue = new Map<string, ErrandKind[]>()
  const icons = new Map<string, { icon: Icon; until: number }>()
  let fx: Fx[] = []
  const seenReactions = new Set<string>()
  let firstReactions = true
  const lift = { y: feetY(0), rider: null as string | null, reserved: null as string | null, moving: false }

  // Static layers per zoom level.
  let backContent = ''
  let frontContent = ''
  let env: BackEnv | null = null
  const back = layerCache((s) => {
    const c = makeCanvas(layout.width * s, layout.height * s)
    const g = context(c)
    g.setTransform(s, 0, 0, s, 0, 0)
    paintBack(g, layout, data, weatherSky(skyAt(hourNow(Date.now())), weather.kind), env!)
    return c
  })
  const front = layerCache((s) => {
    const c = makeCanvas(layout.width * s, layout.height * s)
    const g = context(c)
    g.setTransform(s, 0, 0, s, 0, 0)
    paintFront(g, layout, data, props)
    return c
  })
  let noticeCanvas: HTMLCanvasElement | null = null
  let noticeText = ''

  let raf = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let last = 0
  let lastStep = 0
  let lastDraw = 0
  let dirty = true
  let destroyed = false

  // Stats.
  const frameTimes: number[] = []
  const drawTimes: number[] = []
  let mode: SceneStats['mode'] = 'idle'

  const hourNow = (now: number) => hourOverride ?? localHour(now, data.tz || 'Asia/Tashkent')

  // ---- Data ---------------------------------------------------------------------------------

  function relayoutDerived() {
    deskById = new Map(layout.desks.map((d) => [d.agentId, d]))
    props = allProps(layout)
    doors = doorsOf(layout)
    windows = windowRects(layout)
    const s = lobbySpots(layout)
    lift.y = feetY(s?.floor ?? 0)
    lift.rider = null
    lift.reserved = null
  }

  function apply(next: OfficeData, first: boolean) {
    data = next
    sc = next.scene ? normalizeScene(next.scene) : null
    people = officePeople(next)
    byId = new Map(people.map((p) => [p.id, p]))
    const relayout = first || layoutSignature(next, minWidth) !== layout.signature
    if (relayout) {
      layout = buildLayout(next, minWidth)
      relayoutDerived()
    }
    for (const [id, a] of [...actors]) if (a.kind === 'agent' && !byId.has(id)) actors.delete(id)
    for (const p of people) {
      if (!actors.has(p.id)) actors.set(p.id, newActor(p.id, 'agent', agentLook(p.id, p.role), layout.stairsX, feetY(deskById.get(p.id)?.floor ?? 0)))
    }
    const now = Date.now()
    applyScene(now, first)
    retarget(now, first || relayout)
    dirty = true
  }

  function newActor(id: string, kind: Actor['kind'], look: Look, x: number, y: number): Actor {
    return { id, kind, look, x, y, visible: false, path: [], pose: 'absent', facing: 1, walking: false, stride: 0, target: null, carry: null, riding: false, trips: 0 }
  }

  // Visitors in and out, papers to the Director, reactions played once.
  function applyScene(now: number, first: boolean) {
    visitors = trackVisitors(visitors, sc?.visitors ?? [], now)
    for (const id of [...walkedOut]) if (!visitors.has(id)) walkedOut.delete(id)
    for (const id of [...delivered]) if (!visitors.has(id)) delivered.delete(id)

    const byAgent = sc?.approvalsByAgent ?? {}
    if (!first) {
      for (const d of diffApprovals(prevApprovals, byAgent)) {
        if (d.delta > 0) for (let i = 0; i < Math.min(3, d.delta); i++) queueErrand(d.agent, 'deliver')
      }
    }
    prevApprovals = { ...byAgent }

    const fresh = freshReactions(sc?.reactions ?? [], seenReactions, now)
    // The first snapshot plays only the newest reaction or two, not a burst of history.
    const play = firstReactions ? fresh.slice(-2) : fresh
    firstReactions = false
    for (const r of play) {
      const plan = reactionPlan(r.kind)
      if (plan.errand) queueErrand(r.agent, plan.errand)
      if (plan.icon) icons.set(r.agent, { icon: plan.icon, until: now + plan.ms })
      if (plan.effect) fx.push({ kind: plan.effect, agent: r.agent, start: now, until: now + plan.ms })
    }
  }

  function queueErrand(agent: string, kind: ErrandKind) {
    const p = byId.get(agent)
    if (!p || p.role === 'director' || p.status === 'paused' || p.status === 'offline') return
    const list = errandQueue.get(agent) ?? []
    if (list.length < 4) list.push(kind)
    errandQueue.set(agent, list)
  }

  // Starts queued errands and moves running ones on to their next step.
  function tickErrands(now: number) {
    const directorDesk = deskById.get(data.director.id)
    for (const [agent, list] of errandQueue) {
      if (errands.has(agent) || !list.length) continue
      const desk = deskById.get(agent)
      const kind = list.shift()!
      if (!desk) continue
      const steps = errandSteps(kind, desk, directorDesk, layout, hashId(agent) % 3)
      if (steps.length) errands.set(agent, { kind, steps, index: 0, arrivedAt: null, started: now, done: new Set() })
    }
    for (const [agent, e] of errands) {
      const a = actors.get(agent)
      const p = byId.get(agent)
      const gone = !a || !p || p.status === 'paused' || p.status === 'offline'
      if (gone || now - e.started > ERRAND_MAX_MS) {
        errands.delete(agent)
        if (a) a.carry = null
        continue
      }
      const step = e.steps[e.index]!
      if (e.arrivedAt === null) {
        // Reduced motion snaps: arrival is immediate.
        if (!a.walking && a.target && a.target.x === step.x && a.target.floor === step.floor && Math.abs(a.x - step.x) < 0.5) e.arrivedAt = now
        continue
      }
      if (!e.done.has(e.index)) {
        e.done.add(e.index)
        if (step.arrive === 'drop') a.carry = null
        if (step.arrive === 'pick') a.carry = 'paper'
      }
      if (now - e.arrivedAt >= step.holdMs) {
        e.index++
        e.arrivedAt = null
        if (e.index >= e.steps.length) {
          errands.delete(agent)
          a.carry = null
        } else a.carry = e.steps[e.index]!.carry
      }
    }
  }

  // Papers still in a hand on the way up, and approved papers not fetched yet.
  function stackCount(): number {
    let carrying = 0
    let fetching = 0
    for (const e of errands.values()) {
      if (e.kind === 'deliver' && !e.done.has(0)) carrying++
      if (e.kind === 'fetch' && !e.done.has(0)) fetching++
    }
    for (const list of errandQueue.values()) for (const k2 of list) if (k2 === 'deliver') carrying++
    return visibleStack(approvalsTotal(sc?.approvalsByAgent, data.director.pendingApprovals), carrying, fetching)
  }

  function errandTarget(agent: string): Target | null {
    const e = errands.get(agent)
    if (!e) return null
    const s = e.steps[e.index]!
    return { floor: s.floor, x: s.x, pose: s.pose, facing: s.facing, tag: 'walk' }
  }

  // Works out every person's target; on a change they walk there (or jump with reduced motion).
  function retarget(now: number, snap: boolean) {
    const crowd = crowdOf(people, data.director.openBuilderIssues, now, reduced)
    for (const p of people) {
      const actor = actors.get(p.id)
      const desk = deskById.get(p.id)
      if (!actor || !desk) continue
      const t = errandTarget(p.id) ?? targetFor(p, desk, layout, crowd)
      const e = errands.get(p.id)
      if (e && e.arrivedAt === null && !e.done.has(e.index)) actor.carry = e.steps[e.index]!.carry
      moveTo(actor, t, snap, !!e)
    }

    // Visitors: arrive through the front door, leave through it.
    places = visitorPlaces([...visitors.values()].filter((m) => !walkedOut.has(m.id)), layout, now)
    const s = lobbySpots(layout)
    for (const [id, a] of [...actors]) if (a.kind === 'visitor' && !places.has(id.slice(2))) actors.delete(id)
    if (!s) return
    for (const [id, place] of places) {
      const key = `v:${id}`
      let a = actors.get(key)
      if (!a) {
        if (place.stage === 'leave') continue
        a = newActor(key, 'visitor', visitorLook(id), s.door, feetY(s.floor))
        a.visible = true
        a.facing = -1
        actors.set(key, a)
      }
      a.carry = place.stage === 'deliver' ? 'folder' : null
      moveTo(a, place, snap, true)
    }
  }

  function moveTo(actor: Actor, t: Target, snap: boolean, preferLift: boolean) {
    if (sameTarget(actor.target, t)) return
    // Riding the elevator: finish the ride first.
    if (actor.riding || lift.rider === actor.id) return
    if (lift.reserved === actor.id) lift.reserved = null
    actor.target = t
    if (snap || reduced) {
      actor.x = t.x
      actor.y = feetY(t.floor)
      actor.path = []
      actor.walking = false
      actor.pose = t.pose
      actor.facing = t.facing
      actor.visible = t.pose !== 'absent'
      return
    }
    if (!actor.visible) {
      if (t.pose === 'absent') return
      // Arrives by the stairs of their own floor.
      actor.visible = true
      actor.x = layout.stairsX
      actor.y = feetY(t.floor)
    }
    const fromFloor = floorOfY(actor.y)
    // The elevator when it is free: visitors and errands always, others every second trip.
    let liftX: number | undefined
    if (fromFloor !== t.floor && lift.rider === null && lift.reserved === null && (preferLift || (hashId(actor.id) + actor.trips) % 2 === 0)) {
      liftX = layout.liftX
      lift.reserved = actor.id
    }
    if (fromFloor !== t.floor) actor.trips++
    actor.path = planPath({ x: actor.x, y: actor.y }, fromFloor, t, layout.stairsX, liftX)
    actor.walking = true
  }

  function step(dt: number, now: number) {
    // A night shift walks slowly.
    const calm = data.quietHours ? 0.6 : 1
    lift.moving = false
    for (const a of actors.values()) {
      if (!a.walking) continue
      let budget = dt
      while (budget > 0 && a.path.length) {
        const next = a.path[0]!
        if (next.lift) {
          if (lift.rider !== a.id) {
            if (lift.rider !== null || (lift.reserved !== null && lift.reserved !== a.id)) break
            lift.rider = a.id
            lift.reserved = null
          }
          if (Math.abs(lift.y - a.y) > 0.01) {
            // The cabin comes to this floor first.
            const move = Math.min(Math.abs(a.y - lift.y), LIFT_SPEED * budget)
            lift.y += Math.sign(a.y - lift.y) * move
            lift.moving = true
            budget = 0
            break
          }
          a.riding = true
          const move = Math.min(Math.abs(next.y - a.y), LIFT_SPEED * budget)
          a.y += Math.sign(next.y - a.y) * move
          lift.y = a.y
          lift.moving = true
          budget -= move / LIFT_SPEED
          if (Math.abs(next.y - a.y) < 0.01) {
            a.y = next.y
            lift.y = next.y
            a.path.shift()
            a.riding = false
            lift.rider = null
          }
          continue
        }
        const dx = next.x - a.x
        const dy = next.y - a.y
        const speed = a.kind === 'visitor' ? WALK_SPEED * 0.9 : WALK_SPEED
        if (dy !== 0) {
          const move = Math.min(Math.abs(dy), CLIMB_SPEED * calm * budget)
          a.y += Math.sign(dy) * move
          budget -= move / (CLIMB_SPEED * calm)
          a.stride += move
        } else if (dx !== 0) {
          const move = Math.min(Math.abs(dx), speed * calm * budget)
          a.x += Math.sign(dx) * move
          a.facing = dx > 0 ? 1 : -1
          budget -= move / (speed * calm)
          a.stride += move
        }
        if (Math.abs(next.x - a.x) < 0.01 && Math.abs(next.y - a.y) < 0.01) {
          a.x = next.x
          a.y = next.y
          a.path.shift()
        }
      }
      if (!a.path.length && a.target) arrive(a, now)
    }
  }

  function arrive(a: Actor, now: number) {
    if (!a.target) return
    a.walking = false
    a.pose = a.target.pose
    a.facing = a.target.facing
    if (a.pose === 'absent') {
      a.visible = false
      if (a.kind === 'visitor') walkedOut.add(a.id.slice(2))
    }
    if (a.kind === 'visitor') {
      const id = a.id.slice(2)
      const place = places.get(id)
      if (place?.stage === 'deliver' && !delivered.has(id)) {
        delivered.add(id)
        a.carry = null
        const sales = layout.rooms.find((r) => r.kind === 'dept' && /sales/i.test(r.id))
        const worker = sales ? (layout.desks.filter((d) => d.roomId === sales.id)[1] ?? layout.desks.find((d) => d.roomId === sales.id)) : undefined
        if (worker) icons.set(worker.agentId, { icon: 'mail', until: now + 6000 })
      }
    }
  }

  // ---- Layers -------------------------------------------------------------------------------

  function deviceScale() {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    return view ? cam.zoom * dpr : k
  }

  function backKeyNow(now: number) {
    const hour = hourNow(now)
    const c = data.tasks.counts
    const done = c.done ?? data.departments.reduce((s, d) => s + (d.tasks?.doneToday ?? 0), 0)
    const pins = mapPins(data.funnel?.prospects)
    env = {
      weather: weather.kind,
      plant: plantStage(done),
      pins: pins.count,
      props,
      issuesByDept: sc?.builderIssuesByDept ?? {},
      deptOrder: data.departments.map((d) => d.id),
      uptimePct: data.health?.firtech?.pct24h ?? 100,
    }
    return [
      layout.signature,
      Math.round(hour * 10),
      data.director.openBuilderIssues,
      c.running, c.review, c.approval, c.blocked, c.done,
      weather.kind, env.plant, env.pins, env.uptimePct,
      JSON.stringify(env.issuesByDept),
    ].join('|')
  }

  function layers(now: number) {
    const s = layerScale(deviceScale(), layout.width, layout.height)
    backContent = backKeyNow(now)
    frontContent = layout.signature
    return { back: back.get(backContent, s), front: front.get(frontContent, s) }
  }

  // ---- Drawing ------------------------------------------------------------------------------

  // 0/1 alternating at `rate` changes per second; slow and steady with reduced motion.
  const beat = (now: number, rate: number, seed = 0) =>
    reduced ? (Math.floor(now / REDUCED_STEP_MS) + seed) % 2 : Math.floor(now / 1000 * rate + seed * 0.37) % 2
  const wave = (now: number, period: number) => (reduced ? 0 : Math.sin((now / period) * Math.PI * 2))

  function spriteFor(a: Actor, now: number): SpriteName {
    if (a.walking && !a.riding) return reduced ? 'stand' : Math.floor(a.stride / 4) % 2 ? 'walkA' : 'walkB'
    if (a.walking) return 'stand'
    switch (a.pose) {
      case 'type':
        return beat(now, 5, hashId(a.id) % 7) ? 'typeA' : 'typeB'
      case 'sit':
        return 'sit'
      case 'sleep':
        return 'sleep'
      case 'read':
        return 'read'
      case 'lean':
        return 'lean'
      case 'stretch':
        return 'stretch'
      case 'hand':
        return 'hand'
      case 'coffee':
      case 'water':
        return 'coffee'
      default:
        return 'stand'
    }
  }

  const seated = (a: Actor) =>
    !a.walking && (a.pose === 'type' || a.pose === 'sit' || a.pose === 'sleep' || a.pose === 'read' || a.pose === 'lean')

  function actorRect(a: Actor): Rect {
    const h = seated(a) ? SIT_H : STAND_H
    return { x: Math.round(a.x) - PERSON_W / 2, y: Math.round(a.y) - h, w: PERSON_W, h }
  }

  function drawActor(c: Ctx, a: Actor, now: number) {
    const name = spriteFor(a, now)
    const s = SPRITES[name]
    const r = actorRect(a)
    c.drawImage(sprite(name, s, a.look.palette, a.look.key, a.facing < 0), r.x, Math.round(a.y) - s.h)
    if (a.carry) drawCarry(c, a, r)
  }

  function drawCarry(c: Ctx, a: Actor, r: Rect) {
    const hx = a.facing > 0 ? r.x + 9 : r.x - 1
    const hy = r.y + 9
    if (a.carry === 'paper') {
      rect(c, hx, hy - 1, 4, 3, BASE.w!)
      rect(c, hx, hy + 2, 4, 1, BASE.W!)
    } else if (a.carry === 'folder') {
      rect(c, hx, hy - 1, 5, 4, '#e8b33f')
      rect(c, hx, hy - 1, 5, 1, '#b5862a')
      rect(c, hx + 1, hy, 3, 1, BASE.w!)
    } else {
      const name = CARRY_SPRITE[a.carry!]
      if (name) c.drawImage(sprite(name, SPRITES[name], BASE, 'base', false), Math.round(r.x + 3), hy - 2)
    }
  }

  function drawScreen(c: Ctx, desk: Desk, status: AgentStatus | undefined, now: number) {
    const s = deskScreen(desk)
    if (status === 'working') {
      const glow = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(now / 420 + hashId(desk.agentId))
      rect(c, s.x, s.y, s.w, s.h, mix(COLORS.screenOn, COLORS.screenOn2, glow))
      const shift = reduced ? Math.floor(now / REDUCED_STEP_MS) : Math.floor(now / 350)
      for (let line = 0; line < 3; line++) {
        const len = 1 + ((hashId(desk.agentId) >>> ((line + shift) % 20)) % 4)
        rect(c, s.x + 1, s.y + line + 1, Math.min(len, s.w - 2), 1, COLORS.screenCode)
      }
      // Soft glow on the desk.
      c.globalAlpha = 0.18 + glow * 0.08
      rect(c, s.x - 2, s.y + s.h + 4, s.w + 4, 1, COLORS.screenOn)
      c.globalAlpha = 1
    } else if (status === 'offline' || status === 'paused' || status === undefined) {
      rect(c, s.x, s.y, s.w, s.h, COLORS.screenOff)
    } else if (status === 'sleeping') {
      rect(c, s.x, s.y, s.w, s.h, COLORS.screenDim)
      const p = reduced ? 0 : Math.floor(now / 600) % (s.w * s.h)
      rect(c, s.x + (p % s.w), s.y + Math.floor(p / s.w), 1, 1, '#4a5a8a')
    } else {
      rect(c, s.x, s.y, s.w, s.h, COLORS.screenDim)
      if (status === 'blocked') rect(c, s.x + s.w - 2, s.y + 1, 1, 1, COLORS.red)
      if (status === 'waiting') rect(c, s.x + s.w - 2, s.y + 1, 1, 1, COLORS.lime)
    }
  }

  function bubbleBox(c: Ctx, cx: number, bottom: number, w: number, h: number, fill: string) {
    const x = Math.round(cx - w / 2)
    const y = bottom - h - 1
    rect(c, x, y, w, h, '#1a1626')
    rect(c, x + 1, y + 1, w - 2, h - 2, fill)
    rect(c, x + 1, y, w - 2, 1, '#1a1626')
    rect(c, Math.round(cx), y + h, 1, 1, '#1a1626')
    return { x, y }
  }

  function drawBubble(c: Ctx, cx: number, bottom: number, fill: string, glyph: string, ink: string) {
    const tw = textWidth(glyph)
    const w = Math.max(7, tw + 4)
    const { x, y } = bubbleBox(c, cx, bottom, w, 8, fill)
    text(c, glyph, x + Math.floor((w - tw) / 2), y + 2, ink)
  }

  function drawIconBubble(c: Ctx, cx: number, bottom: number, name: SpriteName) {
    const s = SPRITES[name]
    const { x, y } = bubbleBox(c, cx, bottom, s.w + 4, s.h + 4, '#f4f1ea')
    c.drawImage(sprite(name, s, BASE, 'base', false), x + 2, y + 2)
  }

  function drawArrow(c: Ctx, cx: number, bottom: number, now: number) {
    const y = bottom - 4 + Math.round(wave(now, 900))
    const x = Math.round(cx) - 2
    rect(c, x, y, 5, 1, COLORS.lime)
    rect(c, x + 1, y + 1, 3, 1, COLORS.lime)
    rect(c, x + 2, y + 2, 1, 1, COLORS.lime)
  }

  function drawStatusMarks(c: Ctx, a: Actor, p: Person, now: number) {
    const r = actorRect(a)
    const cx = r.x + PERSON_W / 2
    const bob = Math.round(wave(now, 1400 + (hashId(a.id) % 400)))
    const icon = icons.get(a.id)
    if (icon && icon.until > now) {
      drawIconBubble(c, cx + 1, r.y - 1 + bob, ICON_SPRITE[icon.icon])
      return r.y - 11
    }
    if (a.walking) return r.y
    if (p.status === 'waiting') {
      drawBubble(c, cx + 1, r.y - 2 + bob, '#f4f1ea', '!', '#1a1626')
      return r.y - 11
    }
    if (p.status === 'blocked') {
      drawBubble(c, cx, r.y - 1 + bob, COLORS.red, 'X', '#f4f1ea')
      return r.y - 10
    }
    if (a.target?.z) {
      // At most two people doze for real: a few drifting Zs.
      for (let i = 0; i < 3; i++) {
        const phase = reduced ? i / 3 : ((now / 3600 + i / 3) % 1)
        c.globalAlpha = 1 - phase * 0.8
        text(c, 'Z', cx + 4 + Math.round(phase * 8), r.y + 2 - Math.round(phase * 14), '#dfe6ff')
      }
      c.globalAlpha = 1
      return r.y - 10
    }
    if (p.thinking && p.status !== 'sleeping') {
      // Thinking: a little dot circling above the head.
      const ox = Math.round(cx)
      const oy = r.y - 5
      for (const d of thinkCue(now, reduced)) {
        c.globalAlpha = d.alpha
        rect(c, ox + d.dx - 1, oy + d.dy - 1, 1, 1, COLORS.lime)
      }
      c.globalAlpha = 1
      return r.y - 9
    }
    if (a.pose === 'water') {
      // Watering can tipping over the plant, a few drops falling.
      const canX = a.facing > 0 ? r.x + 10 : r.x - 2
      rect(c, canX, r.y + 7, 3, 2, '#8d93a3')
      rect(c, canX + (a.facing > 0 ? 3 : -1), r.y + 6, 1, 1, '#8d93a3')
      const drop = reduced ? 0 : Math.floor(now / 250) % 4
      rect(c, canX + (a.facing > 0 ? 4 : -2), r.y + 8 + drop, 1, 1, BASE['9']!)
    }
    if (a.pose === 'coffee' && a.target?.tag !== 'cooler') {
      const cupX = a.facing > 0 ? r.x + 9 : r.x + 1
      const phase = reduced ? 0 : (now / 1200) % 1
      c.globalAlpha = 0.6 * (1 - phase)
      rect(c, cupX + (Math.floor(now / 400) % 2), r.y + 6 - Math.round(phase * 4), 1, 1, '#e8e8e8')
      c.globalAlpha = 1
    }
    if (a.pose === 'chat' && speaks(a.target?.side, now, reduced)) {
      drawBubble(c, cx + (a.facing > 0 ? 2 : -2), r.y - 1, '#f4f1ea', '...', '#1a1626')
      return r.y - 10
    }
    return r.y
  }

  // Visitors: the channel icon above the head, a bubble while talking at the counter.
  function drawVisitorMarks(c: Ctx, a: Actor, now: number) {
    const id = a.id.slice(2)
    const m = visitors.get(id)
    const place = places.get(id)
    if (!m || !place) return actorRect(a).y
    const r = actorRect(a)
    const cx = r.x + PERSON_W / 2
    if (!a.walking && place.stage === 'talk' && place.counterIndex === 0 && speaks(1, now, reduced)) {
      drawBubble(c, cx - 2, r.y - 1, '#f4f1ea', '...', '#1a1626')
      return r.y - 10
    }
    const icon = m.channel === 'telegram' ? 'iconPlane' : 'iconGlobe'
    c.drawImage(sprite(icon, SPRITES[icon], BASE, 'base', false), cx - 2, r.y - 7)
    return r.y - 7
  }

  function drawReceptionist(c: Ctx, now: number) {
    const s = lobbySpots(layout)
    if (!s) return
    const talking = [...places.values()].some((p) => p.stage === 'talk' && p.counterIndex === 0)
    const at = actors.get(`v:${[...places].find(([, p]) => p.stage === 'talk' && p.counterIndex === 0)?.[0] ?? ''}`)
    const listening = talking && at && !at.walking
    const name: SpriteName = listening ? 'stand' : beat(now, 0.5, 3) ? 'hand' : 'stand'
    const sp = SPRITES[name]
    const x = s.receptionist - PERSON_W / 2
    const y = feetY(s.floor) - sp.h
    c.drawImage(sprite(name, sp, RECEPTION_LOOK.palette, `${RECEPTION_LOOK.key}`, false), x, y)
    // Headset.
    rect(c, x + 8, y + 3, 1, 3, '#1a1626')
    rect(c, x + 8, y + 5, 2, 1, COLORS.lime)
    if (listening && speaks(0, now, reduced)) drawBubble(c, s.receptionist + 2, y - 1, COLORS.lime, '...', '#1a1626')
  }

  // Night lamp on the desk of everybody who rests or reads: it blinks slowly, the one subtle
  // sleeping cue left. Readers get a faint cone of light over the desk.
  function drawLamps(c: Ctx, now: number) {
    for (const desk of layout.desks) {
      const p = byId.get(desk.agentId)
      const a = actors.get(desk.agentId)
      if (!p || p.status !== 'sleeping' || !a?.target?.lamp || a.target.pose === 'hand') continue
      if (a.walking || !a.visible) continue
      const t = deskTable(desk)
      const lx = t.x + 7
      const ly = t.y - 5
      const seed = hashId(desk.agentId) % 7
      const glow = reduced ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now / 1500 + seed))
      rect(c, lx + 1, ly + 2, 1, 3, '#6a6278')
      rect(c, lx, ly + 4, 3, 1, '#6a6278')
      c.globalAlpha = glow
      rect(c, lx - 1, ly, 4, 2, '#ffd166')
      if (a.target.cone) {
        c.globalAlpha = 0.14 + glow * 0.08
        for (let row = 0; row < 5; row++) rect(c, lx - 2 - row, ly + 2 + row, 4 + row * 2, 1, '#ffd166')
      }
      c.globalAlpha = 1
    }
  }

  // «Очередь пуста» on the director's wall while no task waits in the queue.
  function drawQueueSign(c: Ctx, room: Room) {
    const l1 = 'ОЧЕРЕДЬ'
    const l2 = 'ПУСТА'
    const w = textWidth(l1) + 4
    const x = room.x + room.w - w - 3
    const y = floorTop(room.floor) + 5
    rect(c, x, y, w, 13, COLORS.sign)
    rect(c, x, y + 13, w, 1, '#14121c')
    text(c, l1, x + 2, y + 2, COLORS.lime)
    text(c, l2, x + 2, y + 8, COLORS.lime)
  }

  // Hub: the hovered room gets a faint frame; rooms where something waits for the owner get a
  // slowly breathing lamp light on every desk (amber = waits, lime = work queued).
  function drawZones(c: Ctx, now: number) {
    for (const room of layout.rooms) {
      const level = zoneGlow[room.id] ?? 0
      const hovered = zoneHits && sameHit(hover, { kind: 'room', id: room.id })
      if (hovered) {
        const r = roomInterior(room)
        c.globalAlpha = 0.5
        c.strokeStyle = COLORS.lime
        c.lineWidth = 1
        c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1)
        c.globalAlpha = 1
      }
      if (level <= 0) continue
      const color = level >= 1 ? '#ffb347' : COLORS.lime
      const pulse = reduced ? 0.7 : 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(now / 900 + hashId(room.id)))
      const desks = layout.desks.filter((d) => d.roomId === room.id)
      if (!desks.length) {
        const r = roomInterior(room)
        c.globalAlpha = (level >= 1 ? 0.16 : 0.1) * pulse
        rect(c, r.x + 2, feetY(room.floor) - 2, r.w - 4, 2, color)
        c.globalAlpha = 1
        continue
      }
      for (const desk of desks) {
        const t = deskTable(desk)
        c.globalAlpha = (level >= 1 ? 0.2 : 0.12) * pulse
        for (let row = 0; row < 4; row++) rect(c, t.x - 3 + row, t.y - 3 - row * 2, t.w + 6 - row * 2, 2, color)
        c.globalAlpha = (level >= 1 ? 0.9 : 0.6) * pulse
        rect(c, t.x + t.w - 3, t.y - 12, 2, 2, color)
        c.globalAlpha = 1
      }
    }
  }

  function drawRooms(c: Ctx, now: number, quiet: boolean) {
    const statusOf = (id: string) => byId.get(id)?.status
    drawZones(c, now)
    for (const room of layout.rooms) {
      // Sign glows while someone in the room waits for the owner.
      const waiting = room.agentIds.some((id) => statusOf(id) === 'waiting')
      if (waiting || sameHit(hover, { kind: 'room', id: room.id })) {
        const s = signRect(room)
        c.globalAlpha = reduced ? 0.8 : 0.55 + 0.35 * (0.5 + 0.5 * wave(now, 2400))
        c.strokeStyle = COLORS.lime
        c.lineWidth = 1
        c.strokeRect(s.x - 0.5, s.y - 0.5, s.w + 1, s.h + 1)
        c.globalAlpha = 1
      }
      if (room.kind === 'director' && data.queueEmpty === true) drawQueueSign(c, room)
      const light = room.kind === 'dept' || room.kind === 'director' ? roomLight(room, statusOf, quiet) : quiet && room.kind !== 'lobby' ? 'dim' : 'on'
      if (light === 'on') continue
      const r = roomInterior(room)
      c.globalAlpha = light === 'off' ? 0.7 : 0.38
      rect(c, r.x, r.y, r.w, r.h, '#05061a')
      c.globalAlpha = 1
      if (light === 'off') drawPauseSign(c, room)
    }
  }

  function drawPauseSign(c: Ctx, room: Room) {
    const label = 'PAUSE'
    const w = textWidth(label) + 12
    const x = Math.round(room.x + room.w / 2 - w / 2)
    const y = floorTop(room.floor) + 20
    rect(c, x + Math.floor(w / 2), y - 4, 1, 4, '#8d93a3')
    rect(c, x, y, w, 9, '#e8b33f')
    rect(c, x + 1, y + 1, w - 2, 7, '#1a1626')
    rect(c, x + 3, y + 2, 1, 5, '#e8b33f')
    rect(c, x + 5, y + 2, 1, 5, '#e8b33f')
    text(c, label, x + 8, y + 2, '#e8b33f')
  }

  function drawProducts(c: Ctx, now: number) {
    for (const rack of layout.racks) {
      const product = data.products.find((p) => p.id === rack.productId)
      const status: AgentStatus | undefined =
        rack.kind === 'site' ? (data.health?.firtech?.ok === false ? 'blocked' : 'working') : product?.status
      const r = rackRect(rack)
      for (let u = 0; u < 4; u++) {
        for (let led = 0; led < 3; led++) {
          let color: string = COLORS.ledOff
          const seed = hashId(`${rack.productId}${u}${led}`)
          if (status === 'working') color = beat(now, 3 + (seed % 4), seed % 5) ? COLORS.ledOn : COLORS.ledIdle
          else if (status === 'idle') color = led === 0 ? COLORS.ledOn : COLORS.ledIdle
          else if (status === 'waiting') color = led === 0 ? '#e8b33f' : COLORS.ledIdle
          else if (status === 'blocked') color = beat(now, 1, 0) || led ? COLORS.ledBad : COLORS.ledOff
          else if (status === 'sleeping') color = led === 0 ? COLORS.ledIdle : COLORS.ledOff
          rect(c, r.x + 3 + led * 3, r.y + 5 + u * 7, 2, 1, color)
        }
      }
    }
    // OmniRoute generator: its light blinks faster while any agent is thinking.
    if (layout.generatorX !== null) {
      const room = roomOf(layout, 'servers')!
      const gy = feetY(room.floor) - SPRITES.generator.h
      const thinking = people.some((p) => p.thinking)
      const on = data.health?.omniroute?.ok !== false
      const lit = on && beat(now, thinking ? 4 : 0.7)
      rect(c, layout.generatorX + 12, gy + 3, 2, 2, lit ? (thinking ? COLORS.lime : COLORS.ledOn) : COLORS.ledOff)
      // Fan blades turn.
      const f = reduced ? 0 : Math.floor(now / (thinking ? 60 : 160)) % 2
      rect(c, layout.generatorX + 3 + f * 2, gy + 4, 1, 1, '#8d93a3')
      rect(c, layout.generatorX + 6 - f * 2, gy + 6, 1, 1, '#8d93a3')
    }
  }

  function drawTerminal(c: Ctx, now: number) {
    const room = layout.rooms.find((r) => r.kind === 'builders')
    if (!room) return
    const s = terminalScreen(room)
    rect(c, s.x, s.y, s.w, s.h, COLORS.terminal)
    const n = data.director.openBuilderIssues
    const label = `#${Math.min(99, n)}`
    text(c, label, s.x + 1, s.y + 2, n > 0 ? COLORS.terminalText : '#3d7a4a')
    if (beat(now, 1.5)) rect(c, s.x + 2 + textWidth(label), s.y + 6, 2, 1, COLORS.terminalText)
  }

  function propOf(kind: Prop['kind'], roomKind?: Room['kind']): Prop | undefined {
    return props.find((p) => p.kind === kind && (!roomKind || layout.rooms.find((r) => r.id === p.roomId)?.kind === roomKind))
  }

  // Issue monitor in the builders' corner: «MKT #2», one department at a time.
  function drawIssueMonitor(c: Ctx, now: number) {
    const p = propOf('issueMonitor')
    if (!p) return
    const s = screenOf(p)
    const lines = issueLines(sc?.builderIssuesByDept ?? {}, data.departments.map((d) => d.id))
    const line = lines.length ? lines[Math.floor(now / 3000) % lines.length]! : 'OK'
    text(c, line, s.x + 1, s.y + 1, lines.length ? COLORS.terminalText : '#3d7a4a')
    if (lines.length > 1) {
      const i = Math.floor(now / 3000) % lines.length
      for (let d = 0; d < Math.min(6, lines.length); d++) rect(c, s.x + 1 + d * 2, s.y + s.h - 1, 1, 1, d === i ? COLORS.terminalText : '#3d7a4a')
    }
  }

  // Lounge TV: today's numbers, one every 8 s.
  function drawTv(c: Ctx, now: number) {
    const p = propOf('tv')
    if (!p) return
    const s = screenOf(p)
    const done = data.tasks.counts.done ?? 0
    const slides = tvSlides(sc, data.visitorsActive ?? sc?.visitors.length ?? 0, done, weather)
    const { slide, index } = tvSlideAt(slides, now)
    rect(c, s.x, s.y, s.w, s.h, '#101a2e')
    if (!slide) return
    const label = canWrite(slide.label) ? slide.label : slide.id.toUpperCase()
    text(c, label, s.x + Math.floor((s.w - textWidth(label)) / 2), s.y + 1, '#7fd4ff')
    text(c, slide.value, s.x + Math.floor((s.w - textWidth(slide.value)) / 2), s.y + 8, slide.id === 'weather' ? '#ffd166' : COLORS.lime)
    for (let d = 0; d < slides.length; d++) rect(c, s.x + 1 + d * 2, s.y + s.h - 1, 1, 1, d === index ? '#f4f1ea' : '#3a4a6a')
  }

  // Notice board: scene.notice scrolls along a paper strip.
  function drawNotice(c: Ctx, now: number) {
    const p = propOf('noticeBoard')
    const notice = sc?.notice ?? ''
    if (!p || !notice) return
    if (notice !== noticeText || !noticeCanvas) {
      noticeText = notice
      const w = Math.max(1, textWidth(notice))
      noticeCanvas = makeCanvas(w, 5)
      const g = context(noticeCanvas)
      g.fillStyle = '#1a1626'
      forEachTextPixel(notice, 0, 0, (x, y) => g.fillRect(x, y, 1, 1))
    }
    const x = p.x + 2
    const y = p.y + 6
    const w = p.w - 4
    rect(c, x, y - 1, w, 7, '#f4f1ea')
    const tw = noticeCanvas.width
    const offset = reduced || tw <= w ? 0 : Math.floor(now / 120) % (tw + w) - w
    const sx = Math.max(0, offset)
    const dx = Math.max(0, -offset)
    const len = Math.min(tw - sx, w - dx)
    if (len > 0) c.drawImage(noticeCanvas, sx, 0, len, 5, x + dx, y, len, 5)
  }

  function drawClocks(c: Ctx, now: number) {
    const hour = hourNow(now)
    for (const p of props) {
      if (p.kind !== 'clock') continue
      const o = clockCentre(p)
      const h = clockHands(hour, 4)
      line(c, o.x, o.y, o.x + h.mx, o.y + h.my, '#6a6278')
      line(c, o.x, o.y, o.x + h.hx, o.y + h.hy, '#1a1626')
      rect(c, o.x, o.y, 1, 1, COLORS.red)
    }
  }

  function line(c: Ctx, x0: number, y0: number, x1: number, y1: number, color: string) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
    for (let i = 0; i <= n; i++) rect(c, Math.round(x0 + ((x1 - x0) * i) / Math.max(1, n)), Math.round(y0 + ((y1 - y0) * i) / Math.max(1, n)), 1, 1, color)
  }

  // Printer in the back office prints while the Documents agent works.
  function drawPrinter(c: Ctx, now: number) {
    const p = propOf('printer')
    if (!p) return
    const docs = people.find((q) => /document/i.test(q.id))
    if (docs?.status !== 'working') return
    const out = reduced ? 3 : Math.floor(now / 250) % 6
    rect(c, p.x + 2, p.y - out, 5, out, BASE.w!)
    if (out > 2) rect(c, p.x + 3, p.y - out + 1, 3, 1, '#8d93a3')
  }

  function drawSteam(c: Ctx, now: number) {
    const room = roomOf(layout, 'lounge')
    if (!room) return
    const x = room.x + 10
    const y = feetY(room.floor) - 15
    for (let i = 0; i < 3; i++) {
      const phase = reduced ? i / 3 : ((now / 1800 + i / 3) % 1)
      c.globalAlpha = 0.5 * (1 - phase)
      rect(c, x + Math.round(Math.sin(phase * 6 + i) * 1.5), y - Math.round(phase * 7), 1, 1, '#e8ecf4')
    }
    c.globalAlpha = 1
  }

  // Papers on the Director's desk: one sheet per pending approval (up to STACK_CAP).
  function drawStack(c: Ctx) {
    const desk = deskById.get(data.director.id)
    if (!desk) return
    const t = deskTable(desk)
    const n = stackCount()
    for (let i = 0; i < n; i++) rect(c, t.x + t.w - 10 + (i % 2), t.y - 1 - i, 6, 1, i % 2 ? BASE.W! : BASE.w!)
  }

  function drawDoors(c: Ctx) {
    const list = [...actors.values()].filter((a) => a.visible && a.walking)
    for (const d of doors) {
      const feet = feetY(d.floor)
      const open = list.some((a) => Math.abs(a.y - feet) < 1 && Math.abs(a.x - d.x) < 7)
      if (d.front) {
        rect(c, d.x - 1, feet - 18, 3, 18, '#454c5c')
        if (open) {
          rect(c, d.x - 1, feet - 17, 3, 16, '#0b1030')
        } else {
          rect(c, d.x, feet - 17, 1, 16, '#9fc7d9')
          rect(c, d.x - 1, feet - 9, 1, 2, '#e8b33f')
        }
        continue
      }
      if (open) {
        rect(c, d.x, feet - 16, 2, 16, '#1f1b29')
        rect(c, d.x + 2, feet - 16, 3, 16, '#9a6a44')
        rect(c, d.x + 2, feet - 16, 3, 1, '#7f5533')
      } else {
        rect(c, d.x, feet - 16, 2, 16, '#8a5a3c')
        rect(c, d.x + 1, feet - 8, 1, 1, '#e8b33f')
      }
    }
  }

  // Elevator cabin, drawn around its rider.
  function drawLiftBack(c: Ctx) {
    const x = layout.liftX - LIFT_W / 2
    const y = Math.round(lift.y)
    rect(c, x, y - 18, LIFT_W, 18, '#3a3446')
    rect(c, x + 1, y - 17, LIFT_W - 2, 16, '#5a5068')
    rect(c, x + 2, y - 16, LIFT_W - 4, 1, '#ffd166')
  }

  function drawLiftFront(c: Ctx) {
    const x = layout.liftX - LIFT_W / 2
    const y = Math.round(lift.y)
    rect(c, x, y - 18, LIFT_W, 1, '#1a1626')
    rect(c, x, y - 18, 1, 18, '#1a1626')
    rect(c, x + LIFT_W - 1, y - 18, 1, 18, '#1a1626')
    rect(c, x, y, LIFT_W, 1, '#1a1626')
    // Cable.
    rect(c, layout.liftX, ROOF_H, 1, Math.max(0, y - 18 - ROOF_H), '#2c2738')
  }

  // Bell above the Director's door while a client asks for a human.
  function drawBell(c: Ctx, now: number) {
    if (!needsHuman(visitors.values(), now)) return
    const p = propOf('bell')
    if (!p) return
    const ring = !reduced && now % 6000 < 1400
    const dx = ring ? (Math.floor(now / 90) % 2 ? 1 : -1) : 0
    c.drawImage(sprite('bell', SPRITES.bell, BASE, 'base', false), p.x + dx, p.y)
    if (ring || reduced) {
      rect(c, p.x - 2, p.y + 1, 1, 2, '#ffd166')
      rect(c, p.x + p.w + 1, p.y + 1, 1, 2, '#ffd166')
    }
  }

  function drawEffects(c: Ctx, now: number) {
    fx = fx.filter((f) => f.until > now)
    const desk = deskById.get(data.director.id)
    for (const f of fx) {
      const age = now - f.start
      if (f.kind === 'confetti' && desk) {
        const t = deskTable(desk)
        const inks = [COLORS.lime, '#e86fa0', '#ffd166', '#7fc4ff', '#f08a5d']
        for (let i = 0; i < 18; i++) {
          const h = hashId(`conf${f.start}${i}`)
          const sec = reduced ? 0.6 : age / 1000
          const x = t.x + (h % 30) - 4 + Math.round(Math.sin(sec * 3 + i) * 2)
          const y = t.y - 26 + Math.round(sec * sec * 9 + (h >>> 8) % 6)
          if (y > t.y) continue
          rect(c, x, y, 1, 1, inks[i % inks.length]!)
        }
      } else if (f.kind === 'crumple' && desk) {
        const bin = propOf('bin')
        if (!bin) continue
        const from = { x: desk.x + 20, y: feetY(desk.floor) - 14 }
        const to = { x: bin.x + 2, y: bin.y + 1 }
        const p = reduced ? 1 : Math.min(1, age / 900)
        const x = Math.round(from.x + (to.x - from.x) * p)
        const y = Math.round(from.y + (to.y - from.y) * p - Math.sin(p * Math.PI) * 8)
        rect(c, x, y, 2, 2, BASE.W!)
        rect(c, x, y, 1, 1, BASE.w!)
      } else if (f.kind === 'cloud') {
        const a = actors.get(f.agent)
        if (!a?.visible) continue
        const r = actorRect(a)
        const x = r.x + 1 + Math.round(wave(now, 2400))
        const y = r.y - 9
        rect(c, x + 2, y, 5, 1, '#3a3446')
        rect(c, x, y + 1, 10, 2, '#3a3446')
        rect(c, x + 1, y + 3, 8, 1, '#2c2738')
        const drop = reduced ? 1 : Math.floor(now / 200) % 4
        rect(c, x + 3, y + 4 + drop, 1, 1, BASE['9']!)
        rect(c, x + 7, y + 4 + ((drop + 2) % 4), 1, 1, BASE['9']!)
      }
    }
  }

  // Weather on the windows and in the open sky above the roof.
  function drawWeather(c: Ctx, now: number) {
    const kind = weather.kind
    if (kind === 'clear' || kind === 'fog') return
    const night = skyAt(hourNow(now)).daylight < 0.5
    const cloudInk = kind === 'clouds' ? (night ? '#3a3f55' : '#e6e9f0') : night ? '#2a2e3f' : '#9aa1b0'
    const box = (b: { x: number; y: number; w: number; h: number; seed: number }) => {
      if (kind === 'clouds' || kind === 'rain' || kind === 'thunder' || kind === 'snow') {
        for (const cl of cloudsAt(b.seed, b.w, now, reduced, kind === 'clouds' ? 1 : 2)) {
          const x0 = Math.max(b.x, b.x + cl.x)
          const x1 = Math.min(b.x + b.w, b.x + cl.x + cl.w)
          if (x1 > x0) rect(c, x0, b.y + cl.y, x1 - x0, 2, cloudInk)
          const y0 = Math.max(b.x, b.x + cl.x + 1)
          const y1 = Math.min(b.x + b.w, b.x + cl.x + cl.w - 1)
          if (y1 > y0 && cl.y > 0) rect(c, y0, b.y + cl.y - 1, y1 - y0, 1, cloudInk)
        }
      }
      if (kind === 'rain' || kind === 'thunder') {
        c.globalAlpha = 0.75
        for (const [x, y] of rainDrops(b.seed, b.w, b.h, now, reduced, Math.max(3, Math.round(b.w / 4)))) {
          const top = Math.max(0, y)
          const bottom = Math.min(b.h, y + 2)
          if (bottom > top) rect(c, b.x + x, b.y + top, 1, bottom - top, '#a9c8ff')
        }
        c.globalAlpha = 1
      }
      if (kind === 'snow') {
        for (const [x, y] of snowFlakes(b.seed, b.w, b.h, now, reduced, Math.max(3, Math.round(b.w / 4)))) {
          if (y >= 0 && y < b.h) rect(c, b.x + x, b.y + y, 1, 1, '#f4f6fb')
        }
      }
    }
    for (const w of windows) box(w)
    box({ x: 0, y: 0, w: layout.width, h: ROOF_H - 5, seed: 7 })
    if (kind === 'thunder') {
      const flash = lightning(now, reduced)
      if (flash > 0) {
        c.globalAlpha = flash
        for (const w of windows) rect(c, w.x, w.y, w.w, w.h, '#f4f6ff')
        rect(c, 0, 0, layout.width, ROOF_H - 5, '#f4f6ff')
        c.globalAlpha = flash * 0.12
        rect(c, 0, 0, layout.width, layout.height, '#dfe6ff')
        c.globalAlpha = 1
      }
    }
  }

  function shortName(id: string): string {
    const p = byId.get(id)
    const raw = (p?.title ?? id).toUpperCase().replace(/^HEAD OF /, 'HEAD ')
    const t = canWrite(raw) ? raw : id.toUpperCase().replace(/[^A-Z0-9]+/g, ' ')
    return t.length > 12 ? t.slice(0, 12) : t
  }

  function drawNameTag(c: Ctx, a: Actor, top: number, i: number) {
    const label = shortName(a.id)
    const w = textWidth(label) + 2
    const x = Math.round(a.x - w / 2)
    const y = top - 8 - (i % 2) * 7
    c.globalAlpha = 0.8
    rect(c, x, y, w, 7, '#14121c')
    c.globalAlpha = 1
    text(c, label, x + 1, y + 1, '#f4f1ea')
  }

  function draw(now: number) {
    const t0 = performance.now()
    const L = layers(now)
    const c = ctx
    const dev = deviceScale()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, canvas.width, canvas.height)
    if (view) {
      c.fillStyle = '#0b1030'
      c.fillRect(0, 0, canvas.width, canvas.height)
      c.setTransform(dev, 0, 0, dev, -Math.round(cam.x * dev), -Math.round(cam.y * dev))
    } else c.setTransform(k, 0, 0, k, 0, 0)
    c.imageSmoothingEnabled = false
    c.drawImage(L.back, 0, 0, L.back.width, L.back.height, 0, 0, layout.width, layout.height)
    drawWeather(c, now)

    // Antenna light.
    if (beat(now, 0.8)) rect(c, layout.width - 6 - 12, ROOF_H - 16, 1, 1, COLORS.red)

    drawLiftBack(c)
    drawDoors(c)
    drawClocks(c, now)
    drawSteam(c, now)
    const list = [...actors.values()].filter((a) => a.visible)
    for (const a of list) if (seated(a)) drawActor(c, a, now)
    drawReceptionist(c, now)
    c.drawImage(L.front, 0, 0, L.front.width, L.front.height, 0, 0, layout.width, layout.height)
    for (const desk of layout.desks) drawScreen(c, desk, byId.get(desk.agentId)?.status, now)
    drawStack(c)
    drawLamps(c, now)
    drawProducts(c, now)
    drawTerminal(c, now)
    drawIssueMonitor(c, now)
    drawTv(c, now)
    drawNotice(c, now)
    drawPrinter(c, now)
    const standing = list.filter((a) => !seated(a)).sort((a, b) => a.y - b.y || a.x - b.x)
    for (const a of standing) drawActor(c, a, now)
    drawLiftFront(c)

    drawRooms(c, now, data.quietHours)
    drawBell(c, now)

    let tag = 0
    for (const a of list) {
      let top: number
      if (a.kind === 'visitor') top = drawVisitorMarks(c, a, now)
      else {
        const p = byId.get(a.id)
        if (!p) continue
        top = drawStatusMarks(c, a, p, now)
        if (nameTags) drawNameTag(c, a, top, tag++)
      }
      if (sameHit(hover, hitOfActor(a)) || sameHit(selected, hitOfActor(a))) drawArrow(c, a.x, top - 1, now)
    }
    drawEffects(c, now)
    for (const t of [hover, selected]) {
      if (!t) continue
      if ((t.kind === 'agent' && actors.get(t.id)?.visible) || t.kind === 'visitor' || t.kind === 'room') continue
      const r = anchorOf(t)
      if (r) drawArrow(c, r.x + r.w / 2, r.y - 1, now)
    }

    const ms = performance.now() - t0
    drawTimes.push(ms)
    if (drawTimes.length > 120) drawTimes.shift()
    frameTimes.push(performance.now())
    while (frameTimes.length && frameTimes[0]! < performance.now() - 1000) frameTimes.shift()
    if (showStats) drawStatsOverlay(c)
  }

  const hitOfActor = (a: Actor): HitTarget => (a.kind === 'visitor' ? { kind: 'visitor', id: a.id.slice(2) } : { kind: 'agent', id: a.id })

  function drawStatsOverlay(c: Ctx) {
    const s = stats()
    c.setTransform(2, 0, 0, 2, 0, 0)
    const lines = [
      `FPS ${s.fps} ${s.mode.toUpperCase()}`,
      `DRAW ${s.drawMs.toFixed(2)} MAX ${s.maxDrawMs.toFixed(1)}`,
      `LAYERS ${s.layerRepaints} X${s.layerScale}`,
      `PEOPLE ${s.actors} GUESTS ${s.visitors}`,
    ]
    rect(c, 2, 2, 96, lines.length * 7 + 3, '#000000')
    lines.forEach((l, i) => text(c, l, 4, 4 + i * 7, COLORS.lime))
  }

  function stats(): SceneStats {
    const avg = drawTimes.length ? drawTimes.reduce((s, x) => s + x, 0) / drawTimes.length : 0
    return {
      fps: frameTimes.length,
      drawMs: Math.round(avg * 100) / 100,
      maxDrawMs: Math.round(Math.max(0, ...drawTimes) * 100) / 100,
      mode,
      layerRepaints: back.repaints() + front.repaints(),
      layerScale: back.scale(),
      actors: [...actors.values()].filter((a) => a.visible && a.kind === 'agent').length,
      visitors: [...actors.values()].filter((a) => a.visible && a.kind === 'visitor').length,
    }
  }

  // ---- Loop ---------------------------------------------------------------------------------

  let lastRetarget = 0

  function busyNow(now: number): boolean {
    if (lift.moving) return true
    for (const a of actors.values()) if (a.walking) return true
    if (fx.some((f) => f.until > now && f.kind !== 'cloud')) return true
    if (followId && view) return true
    return false
  }

  function followStep() {
    if (!followId || !view) return
    const a = actors.get(followId) ?? actors.get(`v:${followId}`)
    if (!a?.visible) return
    const world = { w: layout.width, h: layout.height }
    const goal = centerOn(cam, a.x, a.y - 10, view, world)
    const next = reduced ? goal : ease(cam, goal, 0.12)
    if (!sameCamera(next, cam)) {
      cam = next
      viewCb?.()
    }
  }

  function frame(t: number) {
    raf = 0
    if (destroyed) return
    const now = Date.now()
    let interval: number
    if (reduced) {
      mode = 'reduced'
      if (t - lastStep >= REDUCED_STEP_MS) {
        lastStep = t
        retarget(now, false)
        tickErrands(now)
        followStep()
        draw(now)
        lastDraw = t
      } else if (dirty) draw(now)
      interval = REDUCED_STEP_MS
    } else {
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0
      if (now - lastRetarget > 500) {
        lastRetarget = now
        retarget(now, false)
      }
      tickErrands(now)
      step(dt, now)
      followStep()
      const busy = busyNow(now)
      interval = busy ? 0 : animatedWeather(weather.kind) ? WEATHER_MS : IDLE_MS
      mode = busy ? 'busy' : interval === WEATHER_MS ? 'weather' : 'idle'
      if (dirty || t - lastDraw >= interval - 4) {
        draw(now)
        lastDraw = t
      }
    }
    dirty = false
    last = t
    schedule(interval)
  }

  function schedule(wait = 0) {
    if (raf || timer || destroyed || paused || document.hidden) return
    if (wait <= 16) raf = requestAnimationFrame(frame)
    else
      timer = setTimeout(() => {
        timer = null
        if (!destroyed && !paused && !document.hidden) raf = requestAnimationFrame(frame)
      }, wait - 8)
  }

  function cancel() {
    if (raf) cancelAnimationFrame(raf)
    if (timer) clearTimeout(timer)
    raf = 0
    timer = null
  }

  // Redraw soon (input, camera, data) without waiting for the idle timer.
  function poke() {
    dirty = true
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    schedule(0)
  }

  function onVisibility() {
    if (document.hidden) {
      cancel()
      mode = 'paused'
    } else {
      last = 0
      poke()
    }
  }

  document.addEventListener('visibilitychange', onVisibility)

  // ---- Queries ------------------------------------------------------------------------------

  function anchorOf(target: HitTarget): Rect | null {
    if (target.kind === 'agent') {
      const a = actors.get(target.id)
      if (a?.visible) return actorRect(a)
      const desk = deskById.get(target.id)
      return desk ? deskRect(desk) : null
    }
    if (target.kind === 'visitor') {
      const a = actors.get(`v:${target.id}`)
      return a?.visible ? actorRect(a) : null
    }
    if (target.kind === 'product') {
      const rack = layout.racks.find((r) => r.productId === target.id)
      return rack ? rackRect(rack) : null
    }
    if (target.kind === 'room') {
      const room = layout.rooms.find((r) => r.id === target.id)
      return room ? signRect(room) : null
    }
    if (target.kind === 'reception') {
      const s = lobbySpots(layout)
      if (!s) return null
      return { x: s.receptionist - 7, y: feetY(s.floor) - 18, w: s.counterW + 12, h: 18 }
    }
    const room = layout.rooms.find((r) => r.kind === 'builders')
    if (!room) return null
    const s = terminalScreen(room)
    return { x: s.x - 2, y: s.y - 2, w: s.w + 4, h: feetY(room.floor) - s.y + 2 }
  }

  function hitTest(x: number, y: number): HitTarget | null {
    const visible = [...actors.values()].filter((a) => a.visible).sort((a, b) => b.y - a.y)
    for (const a of visible) if (within(actorRect(a), x, y)) return hitOfActor(a)
    for (const desk of layout.desks) {
      if (within(deskRect(desk), x, y)) return { kind: 'agent', id: desk.agentId }
    }
    for (const rack of layout.racks) if (within(rackRect(rack), x, y)) return { kind: 'product', id: rack.productId }
    const b = anchorOf({ kind: 'builders' })
    if (b && within(b, x, y)) return { kind: 'builders' }
    const rc = anchorOf({ kind: 'reception' })
    if (rc && within(rc, x, y)) return { kind: 'reception' }
    for (const room of layout.rooms) if (within(signRect(room), x, y)) return { kind: 'room', id: room.id }
    if (zoneHits) for (const room of layout.rooms) if (within(roomInterior(room), x, y)) return { kind: 'room', id: room.id }
    return null
  }

  function sizeCanvas() {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    if (view) {
      canvas.width = Math.max(1, Math.round(view.w * dpr))
      canvas.height = Math.max(1, Math.round(view.h * dpr))
      canvas.style.width = `${view.w}px`
      canvas.style.height = `${view.h}px`
      return
    }
    k = Math.max(1, Math.round(cssScale * dpr))
    canvas.width = layout.width * k
    canvas.height = layout.height * k
    canvas.style.width = `${layout.width * cssScale}px`
    canvas.style.height = `${layout.height * cssScale}px`
  }

  function resize(scale: number) {
    cssScale = scale
    sizeCanvas()
    draw(Date.now())
  }

  const world = () => ({ w: layout.width, h: layout.height })

  function setCam(next: Camera) {
    if (!view) return
    const c2 = clampPan(next, view, world())
    if (sameCamera(c2, cam)) return
    cam = c2
    viewCb?.()
    poke()
  }

  apply(initial, true)
  resize(cssScale)
  schedule()

  return {
    setData(next) {
      const before = layout.signature
      apply(next, false)
      if (layout.signature !== before) {
        if (view) cam = clampPan(cam, view, world())
        resize(cssScale)
      } else poke()
    },
    setReducedMotion(on) {
      reduced = on
      if (on) {
        for (const a of actors.values()) {
          a.target = null
          a.riding = false
        }
        lift.rider = null
        lift.reserved = null
        retarget(Date.now(), true)
      }
      poke()
    },
    setHover(t) {
      hover = t
      poke()
    },
    setSelected(t) {
      selected = t
      poke()
    },
    hitTest,
    anchorOf,
    size: () => ({ width: layout.width, height: layout.height }),
    resize,
    setHour(hour) {
      hourOverride = hour
      poke()
    },
    setMinWidth(next) {
      const w = Math.max(SCENE_MIN_W, Math.round(next))
      if (w === minWidth) return
      minWidth = w
      apply(data, true)
      resize(cssScale)
    },
    setPaused(on) {
      if (on === paused) return
      paused = on
      if (on) {
        cancel()
        mode = 'paused'
      } else {
        last = 0
        poke()
      }
    },
    destroy() {
      destroyed = true
      cancel()
      document.removeEventListener('visibilitychange', onVisibility)
    },
    setWeather(w) {
      if (w.kind === weather.kind && w.tempC === weather.tempC) return
      weather = w
      poke()
    },
    setNameTags(on) {
      nameTags = on
      poke()
    },
    setStats(on) {
      showStats = on
      poke()
    },
    stats,
    setViewport(w, h) {
      const next = { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) }
      const first = !view
      if (view && view.w === next.w && view.h === next.h) return
      view = next
      cam = first ? homeCamera(view, world()) : clampPan(cam, view, world())
      sizeCanvas()
      viewCb?.()
      draw(Date.now())
    },
    camera: () => ({ ...cam }),
    setCamera: setCam,
    zoomAt(zoom, px, py) {
      if (!view) return
      setCam(zoomAround(cam, zoom, px, py, view, world()))
    },
    panBy(dx, dy) {
      if (!view) return
      followId = null
      setCam(panCamera(cam, dx, dy, view, world()))
    },
    resetView() {
      if (!view) return
      followId = null
      setCam(homeCamera(view, world()))
    },
    follow(id) {
      followId = id
      if (id && view && cam.zoom < 4) cam = { ...cam, zoom: 4 }
      poke()
    },
    following: () => followId,
    toWorld(px, py) {
      if (!view) return { x: px / cssScale, y: py / cssScale }
      return toWorld(cam, px, py)
    },
    toView(r) {
      if (!view) return { x: r.x * cssScale, y: r.y * cssScale, w: r.w * cssScale, h: r.h * cssScale }
      return { x: (r.x - cam.x) * cam.zoom, y: (r.y - cam.y) * cam.zoom, w: r.w * cam.zoom, h: r.h * cam.zoom }
    },
    onView(cb) {
      viewCb = cb
    },
    setZoneHits(on) {
      zoneHits = on
      poke()
    },
    setZoneGlow(next) {
      zoneGlow = { ...next }
      poke()
    },
    rooms: () => layout.rooms.map((r) => ({ id: r.id, kind: r.kind })),
    zoneRect(roomId) {
      const room = layout.rooms.find((r) => r.id === roomId)
      return room ? roomInterior(room) : null
    },
  }
}
