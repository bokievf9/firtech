// The life of the office: what idle and sleeping people do, chosen with a seeded random and a slowly
// changing time bucket, so every page that draws the same data at the same time shows the same
// office. Pure module, covered by tests/pixel-office.test.mjs.
//
// Vocabulary: an "activity" (tag) is what a person is doing; the plan maps every idle or sleeping
// person to a Target that carries the tag. behaviour.ts hands these targets to the scene.

import {
  boardX,
  type Desk,
  hasBoard,
  type Layout,
  loungeSpots,
  lookWindows,
  type Room,
  roomOf,
  seatX,
  standX,
  WINDOW_W,
} from './layout'
import type { Person } from './model'
import { hashId } from './palette'

export type Pose =
  | 'type'
  | 'sit'
  | 'sleep'
  | 'hand'
  | 'stand'
  | 'coffee'
  | 'chat'
  | 'absent'
  | 'read'
  | 'stretch'
  | 'lean'
  | 'water'

export type Activity =
  | 'read'
  | 'stretch'
  | 'coffee'
  | 'cooler'
  | 'sofa'
  | 'plant'
  | 'window'
  | 'walk'
  | 'stairs'
  | 'chat'
  | 'board'
  | 'visit'
  | 'meeting'
  | 'pace'
  | 'tea'
  | 'nightread'
  | 'nightwalk'
  | 'rest'
  | 'snooze'

export type Target = {
  floor: number
  x: number
  pose: Pose
  facing: 1 | -1
  tag?: Activity
  // Chat turn: 0 or 1; the person speaks while the turn of the pair is theirs. Absent = silent.
  side?: 0 | 1
  // Night: small desk lamp on, lamp cone on (reading), drifting Z (at most two people).
  lamp?: boolean
  cone?: boolean
  z?: boolean
}

// ---- Seeded random and time buckets -------------------------------------------------------------

// mulberry32 over a string seed: returns a function giving 0..1.
export function rng(seed: string): () => number {
  let a = hashId(seed) || 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Mode = 'day' | 'night'

// Index of the person's current time bucket. Each person re-rolls every 30 to 90 s by day (a
// 90 to 180 s night shift, twice as long with reduced motion), phase-shifted per person so
// nobody changes activity at the same moment.
export function bucketOf(id: string, time: number, mode: Mode = 'day', slow = false): number {
  const base = mode === 'day' ? 30_000 + (hashId(`${id}:p`) % 61) * 1000 : 90_000 + (hashId(`${id}:p`) % 91) * 1000
  const period = base * (slow ? 2 : 1)
  const phase = hashId(`${id}:ph`) % period
  return Math.floor((time + phase) / period)
}

type Weighted<T> = readonly (readonly [T, number])[]

function weighted<T>(list: Weighted<T>, r: number): T {
  const total = list.reduce((s, [, w]) => s + w, 0)
  let at = r * total
  for (const [item, w] of list) {
    at -= w
    if (at < 0) return item
  }
  return list[list.length - 1]![0]
}

// What an idle worker would like to do (before the lounge cap and free spots have their say).
export const WORKER_REPERTOIRE: Weighted<Activity> = [
  ['read', 14],
  ['stretch', 10],
  ['coffee', 14],
  ['chat', 18],
  ['sofa', 8],
  ['plant', 7],
  ['window', 12],
  ['walk', 9],
  ['cooler', 8],
]

export const LOUNGE_ACTIVITIES: readonly Activity[] = ['coffee', 'cooler', 'sofa', 'plant', 'tea']
const FALLBACK: Weighted<Activity> = [
  ['read', 4],
  ['stretch', 3],
  ['window', 3],
  ['walk', 2],
]

export function idleRoll(id: string, bucket: number): Activity {
  return weighted(WORKER_REPERTOIRE, rng(`${id}:${bucket}:idle`)())
}

export const LOUNGE_SHARE = 0.4
export const NIGHT_AWAKE_SHARE = 0.2
export const MAX_Z = 2
export const MEET_PERIOD = 240_000
export const MEET_LEN = 70_000
const PATROL_MS = 7000

// ---- Plans --------------------------------------------------------------------------------------

export type PlanInput = {
  people: readonly Person[]
  layout: Layout
  time: number
  // Reduced motion: re-roll half as often, no patrolling back and forth.
  slow: boolean
}

type Plan = Map<string, Target>

const turn = (time: number, slow: boolean) => Math.floor(time / (slow ? 2800 : 1500)) % 2

// True while this side of a chat has the floor (its bubble is up).
export function speaks(side: 0 | 1 | undefined, time: number, slow = false): boolean {
  return side !== undefined && turn(time, slow) === side
}

export function planOffice({ people, layout, time, slow }: PlanInput): Plan {
  const plan: Plan = new Map()
  const deskOf = new Map(layout.desks.map((d) => [d.agentId, d]))
  const roomById = new Map(layout.rooms.map((r) => [r.id, r]))
  const idle = people.filter((p) => p.status === 'idle')
  const sleepers = people.filter((p) => p.status === 'sleeping')

  const ctx: Ctx = { plan, deskOf, roomById, layout, time, slow }
  if (idle.length) planDay(ctx, idle, people)
  if (sleepers.length) planNight(ctx, sleepers)
  return plan
}

type Ctx = {
  plan: Plan
  deskOf: Map<string, Desk>
  roomById: Map<string, Room>
  layout: Layout
  time: number
  slow: boolean
}

const atSeat = (d: Desk, pose: Pose, tag: Activity): Target => ({ floor: d.floor, x: seatX(d), pose, facing: 1, tag })
const atStand = (d: Desk, pose: Pose, tag: Activity): Target => ({ floor: d.floor, x: standX(d), pose, facing: -1, tag })

// Back and forth between two points of a room; stands still with reduced motion.
function patrol(room: Room, id: string, time: number, slow: boolean, tag: Activity, period = PATROL_MS): Target {
  const a = room.x + 14 + (hashId(id) % 5)
  const b = room.x + room.w - 12 - (hashId(`${id}b`) % 5)
  const second = !slow && Math.floor((time + (hashId(id) % period)) / period) % 2 === 1
  return { floor: room.floor, x: second ? b : a, pose: 'stand', facing: second ? 1 : -1, tag }
}

function planDay(ctx: Ctx, idle: readonly Person[], all: readonly Person[]) {
  const { plan, deskOf, roomById, layout, time, slow } = ctx
  const taken = new Set<string>()
  const cap = Math.floor(idle.length * LOUNGE_SHARE)

  // Heads, and the director, meet in the Meeting room every few minutes.
  const meeting = meetingOf(ctx, idle)
  const inMeeting = new Set<string>()
  if (meeting) {
    const room = roomOf(layout, 'meeting')!
    const mid = room.x + Math.floor(room.w / 2)
    meeting.forEach((p, i) => {
      inMeeting.add(p.id)
      plan.set(p.id, { floor: room.floor, x: mid + (i ? 15 : -15), pose: 'chat', facing: i ? -1 : 1, tag: 'meeting', side: i as 0 | 1 })
    })
  }

  for (const p of idle) {
    if (inMeeting.has(p.id)) continue
    const desk = deskOf.get(p.id)
    if (!desk) continue
    const room = roomById.get(desk.roomId)
    const bucket = bucketOf(p.id, time, 'day', slow)
    const r = rng(`${p.id}:${bucket}:role`)
    if (p.role === 'director') {
      const act = weighted<Activity>([['pace', 45], ['read', 55]], r())
      plan.set(p.id, act === 'pace' && room ? patrol(room, p.id, time, slow, 'pace', 9000) : atSeat(desk, 'read', 'read'))
    } else if (p.role === 'head') {
      const dept = all.filter((q) => q.deptId === p.deptId && q.role === 'worker' && (q.status === 'idle' || q.status === 'working') && !taken.has(q.id))
      const options: [string, number][] = [['read', 35]]
      if (room && hasBoard(room)) options.push(['board', 25])
      if (dept.length) options.push(['visit', 30])
      const act = weighted(options, r())
      if (act === 'board' && room) {
        plan.set(p.id, { floor: room.floor, x: boardX(room) + WINDOW_W / 2, pose: 'hand', facing: 1, tag: 'board' })
      } else if (act === 'visit') {
        const w = dept[Math.floor(r() * dept.length)]!
        const wd = deskOf.get(w.id)
        if (wd && room) {
          taken.add(w.id)
          plan.set(p.id, { ...atStand(wd, 'chat', 'visit'), side: 0 })
          if (w.status === 'idle') {
            plan.set(w.id, { floor: wd.floor, x: Math.max(room.x + 5, standX(wd) - 11), pose: 'chat', facing: 1, tag: 'visit', side: 1 })
          }
        } else plan.set(p.id, atSeat(desk, 'read', 'read'))
      } else plan.set(p.id, atSeat(desk, 'read', 'read'))
    }
  }

  // Workers: roll, pair the chatters per department, then hand out lounge spots up to the cap.
  const workers = idle.filter((p) => p.role === 'worker' && !plan.has(p.id))
  const rolled = new Map(workers.map((p) => [p.id, idleRoll(p.id, bucketOf(p.id, time, 'day', slow))]))
  const priority = (p: Person) => hashId(`${p.id}:${bucketOf(p.id, time, 'day', slow)}:prio`)
  const byPriority = [...workers].sort((a, b) => priority(a) - priority(b) || (a.id < b.id ? -1 : 1))

  const chatters = new Map<string, Person[]>()
  for (const p of byPriority) if (rolled.get(p.id) === 'chat') chatters.set(p.deptId, [...(chatters.get(p.deptId) ?? []), p])
  for (const list of chatters.values()) {
    for (let i = 0; i + 1 < list.length; i += 2) {
      const a = list[i]!
      const b = list[i + 1]!
      const da = deskOf.get(a.id)
      const room = da && roomById.get(da.roomId)
      if (!da || !room) continue
      const right = standX(da) + 11 <= room.x + room.w - 4
      plan.set(a.id, { ...atStand(da, 'chat', 'chat'), facing: right ? 1 : -1, side: 0 })
      plan.set(b.id, { floor: da.floor, x: right ? standX(da) + 11 : standX(da) - 11, pose: 'chat', facing: right ? -1 : 1, tag: 'chat', side: 1 })
    }
  }

  const spots = loungeSpots(layout)
  const free = {
    coffee: spots ? [spots.coffee] : [],
    cooler: spots ? [spots.cooler] : [],
    plant: spots ? [spots.plant] : [],
    sofa: spots ? [...spots.sofa] : [],
  }
  let inLounge = 0
  for (const p of byPriority) {
    if (plan.has(p.id)) continue
    const desk = deskOf.get(p.id)
    if (!desk) continue
    const room = roomById.get(desk.roomId)
    const bucket = bucketOf(p.id, time, 'day', slow)
    let act: Activity = rolled.get(p.id)!
    const r = rng(`${p.id}:${bucket}:pick`)
    const lounge = (a: Activity): boolean => LOUNGE_ACTIVITIES.includes(a)
    const hasFree = (a: Activity) => ((free as Record<string, number[]>)[a]?.length ?? 0) > 0
    if (act === 'chat' || (lounge(act) && (inLounge >= cap || !spots || !hasFree(act)))) act = weighted(FALLBACK, r())
    if (act === 'window' && !(room && lookWindows(room).length)) act = 'read'
    if (act === 'stairs') act = 'walk'
    switch (act) {
      case 'stretch':
        plan.set(p.id, atStand(desk, 'stretch', 'stretch'))
        break
      case 'coffee':
      case 'cooler': {
        const x = (free[act] as number[]).shift()!
        inLounge++
        plan.set(p.id, { floor: spots!.floor, x, pose: 'coffee', facing: -1, tag: act })
        break
      }
      case 'sofa': {
        const x = free.sofa.shift()!
        inLounge++
        plan.set(p.id, { floor: spots!.floor, x, pose: 'sit', facing: -1, tag: 'sofa' })
        break
      }
      case 'plant': {
        const x = free.plant.shift()!
        inLounge++
        plan.set(p.id, { floor: spots!.floor, x, pose: 'water', facing: 1, tag: 'plant' })
        break
      }
      case 'window': {
        const ws = lookWindows(room!)
        const wx = ws[Math.floor(r() * ws.length)]! + WINDOW_W / 2 + Math.floor(r() * 7) - 3
        plan.set(p.id, { floor: desk.floor, x: wx, pose: 'stand', facing: r() < 0.5 ? 1 : -1, tag: 'window' })
        break
      }
      case 'walk': {
        // A third of the walkers take the stairs to the next floor and stand on its landing.
        if (layout.floors > 1 && r() < 0.35) {
          const floor = desk.floor + (desk.floor + 1 < layout.floors ? 1 : -1)
          plan.set(p.id, { floor, x: layout.stairsX, pose: 'stand', facing: 1, tag: 'stairs' })
        } else if (room) plan.set(p.id, patrol(room, p.id, time, slow, 'walk'))
        else plan.set(p.id, atSeat(desk, 'read', 'read'))
        break
      }
      default:
        plan.set(p.id, atSeat(desk, 'read', 'read'))
    }
  }
}

// Two idle heads (or a head and the director) in the Meeting room for MEET_LEN of every MEET_PERIOD.
function meetingOf(ctx: Ctx, idle: readonly Person[]): [Person, Person] | null {
  const { layout, time, slow } = ctx
  if (!roomOf(layout, 'meeting')) return null
  const period = slow ? MEET_PERIOD * 2 : MEET_PERIOD
  const slot = Math.floor(time / period)
  if (time % period > MEET_LEN) return null
  const heads = idle.filter((p) => p.role === 'head').sort((a, b) => (a.id < b.id ? -1 : 1))
  const director = idle.find((p) => p.role === 'director')
  const pool = director && (heads.length < 2 || hashId(`meet:${slot}`) % 3 === 0) ? [...heads, director] : heads
  if (pool.length < 2) return null
  const ranked = [...pool].sort((a, b) => hashId(`${a.id}:meet:${slot}`) - hashId(`${b.id}:meet:${slot}`))
  return [ranked[0]!, ranked[1]!]
}

function planNight(ctx: Ctx, sleepers: readonly Person[]) {
  const { plan, deskOf, roomById, layout, time, slow } = ctx
  const n = sleepers.length
  const awakeMax = Math.floor(n * NIGHT_AWAKE_SHARE)
  const rank = (p: Person) => hashId(`${p.id}:${bucketOf(p.id, time, 'night', slow)}:night`)
  const sorted = [...sleepers].sort((a, b) => rank(a) - rank(b) || (a.id < b.id ? -1 : 1))
  const awake = new Set<string>()

  // One or two heads at their whiteboard.
  const slot = Math.floor(time / (slow ? 360_000 : 180_000))
  const headsWithBoard = sorted.filter((p) => {
    if (p.role !== 'head') return false
    const d = deskOf.get(p.id)
    const room = d && roomById.get(d.roomId)
    return !!room && hasBoard(room)
  })
  const boardCount = Math.min(awakeMax, headsWithBoard.length, 1 + (hashId(`board:${slot}`) % 2))
  for (const p of headsWithBoard.slice(0, boardCount)) {
    const d = deskOf.get(p.id)!
    const room = roomById.get(d.roomId)!
    awake.add(p.id)
    plan.set(p.id, { floor: room.floor, x: boardX(room) + WINDOW_W / 2, pose: 'hand', facing: 1, tag: 'board', lamp: true })
  }

  // A few workers stay up: reading under a lamp, tea at the coffee machine, a slow walk.
  const spots = loungeSpots(layout)
  let teaFree = spots ? 1 : 0
  for (const p of sorted) {
    if (awake.size >= awakeMax) break
    if (p.role !== 'worker') continue
    const d = deskOf.get(p.id)
    const room = d && roomById.get(d.roomId)
    if (!d || !room) continue
    awake.add(p.id)
    const act = weighted<Activity>([['nightread', 50], ['tea', 25], ['nightwalk', 25]], rng(`${p.id}:${bucketOf(p.id, time, 'night', slow)}:nact`)())
    if (act === 'tea' && teaFree > 0 && spots) {
      teaFree--
      plan.set(p.id, { floor: spots.floor, x: spots.coffee, pose: 'coffee', facing: -1, tag: 'tea' })
    } else if (act === 'nightwalk') {
      plan.set(p.id, patrol(room, p.id, time, slow, 'nightwalk', 15_000))
    } else {
      plan.set(p.id, { ...atSeat(d, 'read', 'nightread'), lamp: true, cone: true })
    }
  }

  // Everybody else rests at the desk; two of them at most really doze with a Z.
  const resting = sorted.filter((p) => !awake.has(p.id))
  const zMax = Math.min(MAX_Z, Math.floor(n * 0.1))
  resting.forEach((p, i) => {
    const d = deskOf.get(p.id)
    if (!d) return
    plan.set(p.id, i < zMax ? { ...atSeat(d, 'sleep', 'snooze'), lamp: true, z: true } : { ...atSeat(d, 'lean', 'rest'), lamp: true })
  })
}

// ---- Thinking cue ---------------------------------------------------------------------------------

const ORBIT: readonly (readonly [number, number])[] = [
  [0, -2],
  [2, 0],
  [0, 2],
  [-2, 0],
]

// Three dots of a small orbit around a centre: the lead dot bright, the two behind it fading.
// Frames change every 180 ms, or every 800 ms with reduced motion.
export function thinkCue(time: number, reduced: boolean): { dx: number; dy: number; alpha: number }[] {
  const frame = Math.floor(time / (reduced ? 800 : 180))
  return [0, 1, 2].map((i) => {
    const [dx, dy] = ORBIT[(frame - i + 400) % 4]!
    return { dx, dy, alpha: 1 - i * 0.35 }
  })
}
