// Clients in the reception (Office v2). Every active client chat in `scene.visitors` is a visitor
// who comes in through the front door. The state machine below turns the data plus what the
// scene remembers about each visitor into a stage, and stages into places to stand or sit.
// Pure module, covered by tests/pixel-office.test.mjs ("visitor lifecycle").
//
//   chat            > wait    (bench; a queue left of it when the bench is full)
//   intake/contact  > talk    (at the counter, alternating bubbles with the receptionist)
//   done            > deliver (walks to Sales with a folder; a Sales worker gets the 📨 bubble)
//                     then leave after DELIVER_MS
//   human           > human   (bench; a bell rings above the Director's door)
//   gone from data, or since + 30 min passed > leave (walks out of the front door)

import type { OfficeVisitor, VisitorChannel } from '@/lib/office-view'
import { type Layout, lobbyQueueX, lobbySpots, roomOf, standX } from './layout'
import type { Target } from './life'

export type VisitorStage = 'wait' | 'talk' | 'deliver' | 'human' | 'leave'

export const VISITOR_MAX_MS = 30 * 60_000
export const DELIVER_MS = 45_000
// How long a visitor who left the data is kept for the walk out.
export const LEAVE_MS = 40_000
export const MAX_VISITORS = 12

export type VisitorMemo = {
  id: string
  channel: VisitorChannel
  since: number
  firstSeen: number
  // When the scene first saw the visitor as done (the delivery clock), null before.
  doneAt: number | null
  // When the visitor disappeared from the data, null while present.
  goneAt: number | null
  state: OfficeVisitor['state']
}

// Updates what the scene remembers: new visitors start now, done starts the delivery clock,
// missing ones get a goneAt and are dropped LEAVE_MS later. Newest first in the data; at most
// MAX_VISITORS are drawn (the newest).
export function trackVisitors(
  prev: ReadonlyMap<string, VisitorMemo>,
  visitors: readonly OfficeVisitor[],
  now: number,
): Map<string, VisitorMemo> {
  const next = new Map<string, VisitorMemo>()
  const present = new Set<string>()
  for (const v of visitors.slice(0, MAX_VISITORS)) {
    present.add(v.id)
    const old = prev.get(v.id)
    const since = Date.parse(v.since)
    next.set(v.id, {
      id: v.id,
      channel: v.channel,
      since: Number.isNaN(since) ? now : since,
      firstSeen: old?.firstSeen ?? now,
      doneAt: v.state === 'done' ? (old?.doneAt ?? now) : null,
      goneAt: null,
      state: v.state,
    })
  }
  for (const [id, m] of prev) {
    if (present.has(id)) continue
    const goneAt = m.goneAt ?? now
    if (now - goneAt < LEAVE_MS) next.set(id, { ...m, goneAt })
  }
  return next
}

export function visitorStage(m: VisitorMemo, now: number): VisitorStage {
  if (m.goneAt !== null) return 'leave'
  if (now - m.since > VISITOR_MAX_MS) return 'leave'
  switch (m.state) {
    case 'done':
      return m.doneAt !== null && now - m.doneAt < DELIVER_MS ? 'deliver' : 'leave'
    case 'human':
      return 'human'
    case 'intake':
    case 'contact':
      return 'talk'
    default:
      return 'wait'
  }
}

// Where a done visitor hands the folder: by the first Sales worker's desk (or its head's).
export function salesDrop(layout: Layout): { floor: number; x: number; agentId: string } | null {
  const room = layout.rooms.find((r) => r.kind === 'dept' && /sales/i.test(r.id)) ?? null
  if (!room) return null
  const desks = layout.desks.filter((d) => d.roomId === room.id)
  const desk = desks[1] ?? desks[0]
  if (!desk) return null
  return { floor: desk.floor, x: Math.min(room.x + room.w - 6, standX(desk) + 4), agentId: desk.agentId }
}

export type VisitorPlace = Target & { stage: VisitorStage; counterIndex: number | null }

// Stage per visitor to a place: the counter has two spots (talkers first, in arrival order),
// the bench three seats, everybody else queues standing.
export function visitorPlaces(
  memos: readonly VisitorMemo[],
  layout: Layout,
  now: number,
): Map<string, VisitorPlace> {
  const out = new Map<string, VisitorPlace>()
  const s = lobbySpots(layout)
  if (!s) return out
  const order = [...memos].sort((a, b) => a.firstSeen - b.firstSeen || (a.id < b.id ? -1 : 1))
  const counter = [...s.counter]
  const bench = [...s.bench]
  let queue = 0
  const drop = salesDrop(layout)
  const lobby = roomOf(layout, 'lobby')!
  const place = (m: VisitorMemo, stage: VisitorStage) => {
    if (stage === 'leave') {
      out.set(m.id, { floor: s.floor, x: s.door, pose: 'absent', facing: 1, stage, counterIndex: null })
      return
    }
    if (stage === 'deliver') {
      if (drop) out.set(m.id, { floor: drop.floor, x: drop.x, pose: 'hand', facing: -1, stage, counterIndex: null })
      else out.set(m.id, { floor: s.floor, x: s.counter[0]!, pose: 'stand', facing: -1, stage, counterIndex: 0 })
      return
    }
    if (stage === 'talk' && counter.length) {
      const index = s.counter.length - counter.length
      out.set(m.id, { floor: s.floor, x: counter.shift()!, pose: 'chat', facing: -1, stage, counterIndex: index, side: 1 })
      return
    }
    if (bench.length) {
      out.set(m.id, { floor: s.floor, x: bench.shift()!, pose: 'sit', facing: -1, stage, counterIndex: null })
      return
    }
    const x = Math.min(lobby.x + lobby.w - 8, lobbyQueueX(s, queue++))
    out.set(m.id, { floor: s.floor, x, pose: 'stand', facing: -1, stage, counterIndex: null })
  }
  // Talkers claim the counter before anyone takes a bench seat.
  const staged = order.map((m) => [m, visitorStage(m, now)] as const)
  for (const [m, stage] of staged) if (stage === 'talk') place(m, stage)
  for (const [m, stage] of staged) if (stage !== 'talk') place(m, stage)
  return out
}

// True while a visitor waits for the owner (the bell above the Director's door rings).
export const needsHuman = (memos: Iterable<VisitorMemo>, now: number) =>
  [...memos].some((m) => visitorStage(m, now) === 'human')
