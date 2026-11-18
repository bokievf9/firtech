// What each person does for a given status: where they go, which pose they hold there, how they
// get there and how lit each room is. Pure module, covered by tests/pixel-office.test.mjs.

import type { AgentStatus } from '@/lib/office-view'
import { buildersSpot, type Desk, feetY, type Layout, type Room, seatX, standX } from './layout'
import { planOffice, type Pose, type Target } from './life'
import type { Person } from './model'
import { hashId } from './palette'

export type { Pose, Target } from './life'

// Blocked agents visit the builders' corner now and then while builder issues are open: about a
// quarter of a 60 to 80 s cycle, phase-shifted per agent so they do not all walk at once.
export function errandActive(id: string, time: number): boolean {
  const h = hashId(id)
  const period = 60_000 + (h % 20) * 1000
  const phase = (time + (h % 9973) * 37) % period
  return phase > period * 0.6 && phase < period * 0.85
}

export type Crowd = {
  // Order of idle people in the lounge and blocked people at the terminal (by id, stable).
  idle: ReadonlyMap<string, number>
  blocked: ReadonlyMap<string, number>
  builderIssues: number
  time: number
  people: readonly Person[]
  // Reduced motion: activities change half as often and nobody paces back and forth.
  slow: boolean
  // Plan of idle and sleeping people (life.ts), made once per crowd on first use.
  memo: { layout: Layout; plan: Map<string, Target> } | null
}

export function crowdOf(people: readonly Person[], builderIssues: number, time: number, slow = false): Crowd {
  const order = (status: AgentStatus) =>
    new Map(
      people
        .filter((p) => p.status === status && p.role !== 'director')
        .map((p) => p.id)
        .sort()
        .map((id, i) => [id, i] as const),
    )
  return { idle: order('idle'), blocked: order('blocked'), builderIssues, time, people, slow, memo: null }
}

export function targetFor(person: Person, desk: Desk, layout: Layout, crowd: Crowd): Target {
  const atDesk = (pose: Pose, facing: 1 | -1 = 1): Target => ({ floor: desk.floor, x: seatX(desk), pose, facing })
  const byDesk = (pose: Pose): Target => ({ floor: desk.floor, x: standX(desk), pose, facing: -1 })
  switch (person.status) {
    case 'working':
      return atDesk('type')
    case 'waiting':
      return byDesk('hand')
    case 'blocked': {
      if (crowd.builderIssues > 0 && errandActive(person.id, crowd.time)) {
        const spot = buildersSpot(layout, crowd.blocked.get(person.id) ?? 0)
        return { ...spot, pose: 'stand', facing: -1 }
      }
      return byDesk('stand')
    }
    case 'idle':
    case 'sleeping': {
      if (crowd.memo?.layout !== layout) {
        crowd.memo = { layout, plan: planOffice({ people: crowd.people, layout, time: crowd.time, slow: crowd.slow }) }
      }
      return crowd.memo.plan.get(person.id) ?? atDesk(person.status === 'idle' ? 'read' : 'lean')
    }
    case 'paused':
    case 'offline':
      return { floor: desk.floor, x: layout.stairsX, pose: 'absent', facing: -1 }
  }
}

// `lift` marks a ride in the elevator cabin (the vertical move waits for the cabin).
export type Point = { x: number; y: number; lift?: boolean }

// Straight walks on a floor; a change of floor goes through the stairwell, or by elevator when
// `liftX` is given (one vertical ride straight to the target floor).
export function planPath(from: Point, fromFloor: number, to: Target, stairsX: number, liftX?: number): Point[] {
  const end = { x: to.x, y: feetY(to.floor) }
  if (fromFloor === to.floor) return [end]
  if (liftX !== undefined) return [{ x: liftX, y: from.y }, { x: liftX, y: feetY(to.floor), lift: true }, end]
  const path: Point[] = [{ x: stairsX, y: from.y }]
  const step = to.floor > fromFloor ? 1 : -1
  for (let f = fromFloor + step; f !== to.floor + step; f += step) path.push({ x: stairsX, y: feetY(f) })
  path.push(end)
  return path
}

// Room lighting: 'off' when everyone in it is paused (a pause sign hangs there), 'dim' when
// nobody in it is awake or quiet hours are on, 'on' otherwise. Rooms without people follow quiet hours.
export type Light = 'on' | 'dim' | 'off'

export function roomLight(room: Room, statusOf: (id: string) => AgentStatus | undefined, quietHours: boolean): Light {
  const statuses = room.agentIds.map(statusOf).filter((s): s is AgentStatus => s !== undefined)
  if (statuses.length && statuses.every((s) => s === 'paused')) return 'off'
  const awake = statuses.some((s) => s === 'working' || s === 'waiting' || s === 'blocked' || s === 'idle')
  if (quietHours || (statuses.length > 0 && !awake)) return 'dim'
  return 'on'
}
