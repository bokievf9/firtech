// Geometry of the pixel office: a side-view cross-section of a building, floors stacked top to
// bottom, rooms packed left to right, a stairwell on the left. All numbers are logical pixels (the
// scene scales them by an integer). The layout depends only on the structure of the data (ids
// and order of departments, agents and products), never on statuses, so a desk stays put while
// its agent comes and goes. Pure module, covered by tests/pixel-office.test.mjs.

import type { OfficeData } from '@/lib/office-view'
import { officePeople } from './model'

export const SCENE_MIN_W = 400
export const MARGIN = 6
export const STAIRS_W = 16
export const FLOOR_X = MARGIN + STAIRS_W
export const ROOF_H = 18
export const FLOOR_H = 60
export const GROUND_H = 12
// Feet line inside a floor, from the floor's top.
export const FEET = 56
export const SLOT_W = 26
export const ROOM_PAD = 6

export type RoomKind = 'director' | 'meeting' | 'dept' | 'builders' | 'lounge' | 'servers'

export type Room = {
  id: string
  kind: RoomKind
  title: string
  floor: number
  x: number
  w: number
  agentIds: string[]
}

export type Desk = {
  agentId: string
  roomId: string
  floor: number
  x: number
  w: number
  director: boolean
}

export type Rack = { productId: string; title: string; floor: number; x: number }

export type Layout = {
  width: number
  height: number
  floors: number
  rooms: Room[]
  desks: Desk[]
  racks: Rack[]
  stairsX: number
  signature: string
}

export const floorTop = (floor: number) => ROOF_H + floor * FLOOR_H
export const feetY = (floor: number) => floorTop(floor) + FEET

// Where a person sits (centre x) and where they stand when they get up.
export const seatX = (desk: Desk) => desk.x + 7
export const standX = (desk: Desk) => desk.x + desk.w - 6

const MIN_W: Record<Exclude<RoomKind, 'dept' | 'servers'>, number> = {
  director: 80,
  meeting: 54,
  builders: 44,
  lounge: 80,
}

type Draft = Omit<Room, 'floor' | 'x'>

// The structure the layout is built from; two data snapshots with the same signature share a layout.
export function layoutSignature(data: OfficeData, minWidth = SCENE_MIN_W): string {
  const base = JSON.stringify([
    data.director.id,
    data.departments.map((d) => [d.id, d.title, d.head.id, d.workers.map((w) => w.id)]),
    data.products.map((p) => [p.id, p.title]),
  ])
  return minWidth === SCENE_MIN_W ? base : `${base}|${minWidth}`
}

// `minWidth` (logical px) widens the building so fewer floors are needed: the public hero passes
// its box width divided by the CSS scale, the admin page keeps the default.
export function buildLayout(data: OfficeData, minWidth = SCENE_MIN_W): Layout {
  const people = officePeople(data)
  const drafts: Draft[] = [
    { id: 'director', kind: 'director', title: 'Director', w: MIN_W.director, agentIds: [data.director.id] },
    { id: 'meeting', kind: 'meeting', title: 'Meeting', w: MIN_W.meeting, agentIds: [] },
  ]
  for (const dept of data.departments) {
    const ids = people.filter((p) => p.deptId === dept.id && p.role !== 'director').map((p) => p.id)
    drafts.push({ id: dept.id, kind: 'dept', title: dept.title, w: ROOM_PAD * 2 + Math.max(1, ids.length) * SLOT_W, agentIds: ids })
  }
  drafts.push(
    { id: 'builders', kind: 'builders', title: 'Builders', w: MIN_W.builders, agentIds: [] },
    { id: 'lounge', kind: 'lounge', title: 'Lounge', w: MIN_W.lounge, agentIds: [] },
    { id: 'servers', kind: 'servers', title: 'Servers', w: 12 + 22 * Math.max(1, data.products.length), agentIds: [] },
  )

  const floorW = Math.max(Math.max(SCENE_MIN_W, minWidth) - FLOOR_X - MARGIN, ...drafts.map((d) => d.w))

  // Greedy first fit in order, then each floor's spare width is shared evenly between its rooms.
  const floors: Draft[][] = [[]]
  let used = 0
  for (const d of drafts) {
    if (used + d.w > floorW && floors[floors.length - 1]!.length) {
      floors.push([])
      used = 0
    }
    floors[floors.length - 1]!.push(d)
    used += d.w
  }

  const rooms: Room[] = []
  floors.forEach((list, floor) => {
    const spare = floorW - list.reduce((s, d) => s + d.w, 0)
    const each = Math.floor(spare / list.length)
    let x = FLOOR_X
    list.forEach((d, i) => {
      const w = d.w + each + (i === list.length - 1 ? spare - each * list.length : 0)
      rooms.push({ ...d, floor, x, w })
      x += w
    })
  })

  const desks: Desk[] = []
  const racks: Rack[] = []
  for (const room of rooms) {
    if (room.kind === 'director') {
      desks.push({ agentId: data.director.id, roomId: room.id, floor: room.floor, x: room.x + Math.floor((room.w - 40) / 2), w: 40, director: true })
    } else if (room.kind === 'dept') {
      const n = room.agentIds.length
      const slot = (room.w - ROOM_PAD * 2) / Math.max(1, n)
      room.agentIds.forEach((agentId, i) => {
        const x = Math.round(room.x + ROOM_PAD + i * slot + (slot - SLOT_W) / 2)
        desks.push({ agentId, roomId: room.id, floor: room.floor, x, w: SLOT_W, director: false })
      })
    } else if (room.kind === 'servers') {
      const n = data.products.length
      const slot = (room.w - 12) / Math.max(1, n)
      data.products.forEach((p, i) => {
        racks.push({ productId: p.id, title: p.title, floor: room.floor, x: Math.round(room.x + 6 + i * slot + (slot - 14) / 2) })
      })
    }
  }

  return {
    width: FLOOR_X + floorW + MARGIN,
    height: ROOF_H + floors.length * FLOOR_H + GROUND_H,
    floors: floors.length,
    rooms,
    desks,
    racks,
    stairsX: MARGIN + STAIRS_W / 2,
    signature: layoutSignature(data, minWidth),
  }
}

export function roomOf(layout: Layout, kind: RoomKind): Room | undefined {
  return layout.rooms.find((r) => r.kind === kind)
}

// Spots in the lounge, left to right after the coffee machine; more people than spots stand
// a little offset from the first ones.
export function loungeSpot(layout: Layout, index: number): { floor: number; x: number } {
  const room = roomOf(layout, 'lounge')
  if (!room) return { floor: 0, x: layout.stairsX }
  const first = room.x + 24
  const cap = Math.max(1, Math.floor((room.w - 44) / 11))
  return { floor: room.floor, x: first + (index % cap) * 11 + Math.floor(index / cap) * 5 }
}

// Where a blocked agent stands at the builders' terminal.
export function buildersSpot(layout: Layout, index: number): { floor: number; x: number } {
  const room = roomOf(layout, 'builders')
  if (!room) return { floor: 0, x: layout.stairsX }
  return { floor: room.floor, x: room.x + room.w - 8 - (index % 3) * 6 }
}

// ---- Windows, whiteboards and lounge furniture ------------------------------------------------
// Shared by the painters (paint-static.ts) and by behaviour.ts, so people stand where the
// furniture really is.

export const WINDOW_W = 16

// Left x of every window of a room (the painter draws them 14 px tall at floorTop + 18).
export function windowXs(room: Room): number[] {
  if (room.kind === 'servers') return []
  if (room.kind === 'meeting' && room.w < 70) return []
  let count = Math.max(1, Math.floor((room.w - 10) / 30))
  if (room.kind === 'builders' || room.kind === 'meeting') count = 1
  const gap = (room.w - count * WINDOW_W) / (count + 1)
  return Array.from({ length: count }, (_, i) => {
    if (room.kind === 'builders') return room.x + 5
    if (room.kind === 'meeting') return room.x + room.w - WINDOW_W - 4
    return Math.round(room.x + gap + i * (WINDOW_W + gap))
  })
}

// A department room with two or more window slots gives its first slot to a whiteboard.
export const hasBoard = (room: Room) => room.kind === 'dept' && windowXs(room).length >= 2
export const boardX = (room: Room) => windowXs(room)[0] ?? room.x
// Windows people can look out of.
export const lookWindows = (room: Room) => windowXs(room).slice(hasBoard(room) ? 1 : 0)

export type LoungeSpots = {
  coffee: number
  cooler: number
  plant: number
  sofa: number[]
  floor: number
}

// Where people stand or sit in the lounge, next to the furniture painted in paintRoomBack.
export function loungeSpots(layout: Layout): LoungeSpots | null {
  const room = roomOf(layout, 'lounge')
  if (!room) return null
  const sw = Math.min(30, room.w - 60)
  const sofa = sw >= 18 ? [room.x + room.w - sw - 4 + 6, room.x + room.w - 4 - 7] : []
  const plantX = room.x + room.w - 9 - (sw >= 18 ? sw + 6 : 0)
  return { floor: room.floor, coffee: room.x + 19, cooler: room.x + 29, plant: plantX - 5, sofa }
}
