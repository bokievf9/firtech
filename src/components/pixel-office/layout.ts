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
// Elevator shaft right of the stairwell (Office v2).
export const LIFT_W = 12
export const FLOOR_X = MARGIN + STAIRS_W + LIFT_W
export const ROOF_H = 18
export const FLOOR_H = 60
export const GROUND_H = 12
// Feet line inside a floor, from the floor's top.
export const FEET = 56
export const SLOT_W = 26
export const ROOM_PAD = 6

export type RoomKind = 'director' | 'meeting' | 'dept' | 'builders' | 'lounge' | 'servers' | 'lobby'

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

// `site` is the firtech.pro rack (uptime from health), the others are HQ products.
export type Rack = { productId: string; title: string; floor: number; x: number; kind: 'product' | 'site' }

export type Layout = {
  width: number
  height: number
  floors: number
  rooms: Room[]
  desks: Desk[]
  racks: Rack[]
  stairsX: number
  // Centre of the elevator shaft.
  liftX: number
  // OmniRoute generator in the servers room (left x), null without a servers room.
  generatorX: number | null
  signature: string
}

export const SITE_RACK = 'firtech.pro'

export const floorTop = (floor: number) => ROOF_H + floor * FLOOR_H
export const feetY = (floor: number) => floorTop(floor) + FEET

// Where a person sits (centre x) and where they stand when they get up.
export const seatX = (desk: Desk) => desk.x + 7
export const standX = (desk: Desk) => desk.x + desk.w - 6

const MIN_W: Record<Exclude<RoomKind, 'dept' | 'servers'>, number> = {
  director: 84,
  meeting: 54,
  builders: 66,
  lounge: 96,
  lobby: 92,
}

// The five known departments by id (a newer HQ may add others; they get no special props).
export type DeptKind = 'marketing' | 'sales' | 'support' | 'production' | 'back-office'

export function deptKind(id: string): DeptKind | null {
  const k = id.toLowerCase().replace(/[^a-z]/g, '')
  if (k.startsWith('marketing')) return 'marketing'
  if (k.startsWith('sales')) return 'sales'
  if (k.startsWith('support')) return 'support'
  if (k.startsWith('production')) return 'production'
  if (k === 'backoffice' || k.startsWith('backoffice')) return 'back-office'
  return null
}

// Floor kept free at the right end of a department room for its standing props (props.ts).
export const PROP_FLOOR_W: Record<DeptKind, number> = {
  marketing: 22,
  sales: 0,
  support: 0,
  production: 13,
  'back-office': 23,
}

export const propFloorW = (room: Pick<Room, 'id' | 'kind'>) => {
  if (room.kind !== 'dept') return 0
  const k = deptKind(room.id)
  return k ? PROP_FLOOR_W[k] : 0
}

export const RACK_SLOT = 22
export const GENERATOR_W = 18

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
    const extra = propFloorW({ id: dept.id, kind: 'dept' })
    drafts.push({ id: dept.id, kind: 'dept', title: dept.title, w: ROOM_PAD * 2 + Math.max(1, ids.length) * SLOT_W + extra, agentIds: ids })
  }
  drafts.push(
    { id: 'builders', kind: 'builders', title: 'Builders', w: MIN_W.builders, agentIds: [] },
    { id: 'lounge', kind: 'lounge', title: 'Lounge', w: MIN_W.lounge, agentIds: [] },
    // Products, the firtech.pro rack and the OmniRoute generator.
    { id: 'servers', kind: 'servers', title: 'Servers', w: 12 + RACK_SLOT * (data.products.length + 1) + GENERATOR_W, agentIds: [] },
    // Reception last, so it is the rightmost room of the ground floor, next to the front door.
    { id: 'lobby', kind: 'lobby', title: 'Reception', w: MIN_W.lobby, agentIds: [] },
  )

  const floorW = Math.max(Math.max(SCENE_MIN_W, minWidth) - FLOOR_X - MARGIN, ...drafts.map((d) => d.w))

  // Director, meeting room and departments go in order, greedily. The reception is the ground
  // floor (the last one): it joins the last floor when it fits, else gets a new one. The
  // utility rooms (builders, lounge, servers) then take the first floor with space, or a new
  // floor just above the ground. Each floor's spare width is shared evenly between its rooms.
  const core = drafts.filter((d) => d.kind === 'director' || d.kind === 'meeting' || d.kind === 'dept')
  const utility = drafts.filter((d) => d.kind === 'builders' || d.kind === 'lounge' || d.kind === 'servers')
  const lobby = drafts.find((d) => d.kind === 'lobby')!
  const floors: Draft[][] = [[]]
  const usedOf = (list: Draft[]) => list.reduce((s, d) => s + d.w, 0)
  for (const d of core) {
    const last = floors[floors.length - 1]!
    if (usedOf(last) + d.w > floorW && last.length) floors.push([d])
    else last.push(d)
  }
  const ground: Draft[] = usedOf(floors[floors.length - 1]!) + lobby.w <= floorW ? floors.pop()! : []
  ground.push(lobby)
  let spill: Draft[] | null = null
  for (const d of utility) {
    const home = [...floors, ground].find((list) => usedOf(list) + d.w <= floorW)
    if (home) home.push(d)
    else floors.push((spill = [d]))
  }
  // A spill floor also takes the utility rooms that landed on the ground, so the reception
  // floor is not crowded while the one above stands half empty.
  if (spill) {
    for (const d of ground.filter((x) => x.kind !== 'lobby' && utility.includes(x))) {
      if (usedOf(spill) + d.w > floorW) continue
      ground.splice(ground.indexOf(d), 1)
      spill.push(d)
    }
  }
  // Rooms of a floor left to right in draft order, the reception always rightmost.
  const order = (list: Draft[]) => list.sort((a, b) => (a.kind === 'lobby' ? 1 : 0) - (b.kind === 'lobby' ? 1 : 0) || drafts.indexOf(a) - drafts.indexOf(b))
  floors.push(ground)
  for (const list of floors) order(list)

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
  let generatorX: number | null = null
  for (const room of rooms) {
    if (room.kind === 'director') {
      desks.push({ agentId: data.director.id, roomId: room.id, floor: room.floor, x: room.x + Math.floor((room.w - 40) / 2), w: 40, director: true })
    } else if (room.kind === 'dept') {
      const n = room.agentIds.length
      const slot = (room.w - ROOM_PAD * 2 - propFloorW(room)) / Math.max(1, n)
      room.agentIds.forEach((agentId, i) => {
        const x = Math.round(room.x + ROOM_PAD + i * slot + (slot - SLOT_W) / 2)
        desks.push({ agentId, roomId: room.id, floor: room.floor, x, w: SLOT_W, director: false })
      })
    } else if (room.kind === 'servers') {
      const list: { id: string; title: string; kind: Rack['kind'] }[] = [
        ...data.products.map((p) => ({ id: p.id, title: p.title, kind: 'product' as const })),
        { id: SITE_RACK, title: 'firtech.pro', kind: 'site' },
      ]
      const slot = (room.w - 12 - GENERATOR_W) / list.length
      list.forEach((p, i) => {
        racks.push({ productId: p.id, title: p.title, floor: room.floor, x: Math.round(room.x + 6 + i * slot + (slot - 14) / 2), kind: p.kind })
      })
      generatorX = room.x + room.w - GENERATOR_W - 5
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
    liftX: MARGIN + STAIRS_W + LIFT_W / 2,
    generatorX,
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
  // Lounge: one window over the sofa (TV and notice board take the wall); reception: one by the
  // door; director: one wide city window (props.ts), so no small ones.
  if (room.kind === 'lounge') return [room.x + room.w - WINDOW_W - 10]
  if (room.kind === 'lobby') return [room.x + room.w - WINDOW_W - 12]
  if (room.kind === 'director') return []
  // The builders' corner has no window: the issue monitor and the sticky board take the wall.
  if (room.kind === 'builders') return []
  let count = Math.max(1, Math.floor((room.w - 10 - propFloorW(room)) / 30))
  if (room.kind === 'builders' || room.kind === 'meeting') count = 1
  const span = room.w - propFloorW(room)
  const gap = (span - count * WINDOW_W) / (count + 1)
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

// ---- Office v2: reception, director's city window, doors --------------------------------------

export type LobbySpots = {
  floor: number
  receptionist: number
  counterX: number
  counterW: number
  // Where visitors stand at the counter (facing the receptionist), and the bench seats.
  counter: number[]
  bench: number[]
  benchX: number
  benchW: number
  // Inside the front door; visitors appear and leave here.
  door: number
  clockX: number
}

export function lobbySpots(layout: Layout): LobbySpots | null {
  const room = roomOf(layout, 'lobby')
  if (!room) return null
  const x = room.x
  const benchW = 27
  const benchX = Math.max(x + room.w - benchW - 14, x + 60)
  return {
    floor: room.floor,
    receptionist: x + 12,
    counterX: x + 17,
    counterW: 22,
    counter: [x + 44, x + 53],
    bench: [benchX + 5, benchX + 14, benchX + 23],
    benchX,
    benchW,
    door: x + room.w - 4,
    clockX: x + 49,
  }
}

// Overflow visitors stand in a loose queue in front of the bench.
export function lobbyQueueX(spots: LobbySpots, index: number): number {
  return spots.benchX + 2 + (index % 4) * 7
}

// The director's wide window onto the city.
export function cityWindow(room: Room): { x: number; y: number; w: number; h: number } {
  return { x: room.x + Math.round(room.w / 2) - 14, y: floorTop(room.floor) + 21, w: 28, h: 14 }
}

// Where an agent stands to put a paper on (or take one from) the director's desk.
export function directorDropX(desk: Desk): number {
  return desk.x + desk.w + 3
}

export type Door = { floor: number; x: number; front: boolean }

// A door in the partition left of every room, plus the front door right of the reception.
export function doorsOf(layout: Layout): Door[] {
  const doors: Door[] = layout.rooms.map((r) => ({ floor: r.floor, x: r.x, front: false }))
  const lobby = roomOf(layout, 'lobby')
  if (lobby) doors.push({ floor: lobby.floor, x: lobby.x + lobby.w - 1, front: true })
  return doors
}
