// Where the furniture and gadgets of every room go (Office v2). One list of placed props per
// room, in logical pixels; paint-static.ts draws the static ones, scene.ts animates the live ones
// (TV, printer, generator light, clocks, issue monitor). Pure module, covered by
// tests/pixel-office.test.mjs ("props per department present").

import { signRect } from './paint-static'
import {
  boardX,
  cityWindow,
  deptKind,
  type DeptKind,
  feetY,
  floorTop,
  hasBoard,
  type Layout,
  lobbySpots,
  propFloorW,
  ROOM_PAD,
  type Room,
  WINDOW_W,
  windowXs,
} from './layout'

export type PropKind =
  // Marketing
  | 'poster'
  | 'ringLight'
  | 'tripod'
  // Sales
  | 'deskPhone'
  | 'wallMap'
  // Support
  | 'headset'
  | 'ticketBoard'
  // Production
  | 'codeBoard'
  | 'miniRack'
  // Back office
  | 'cabinet'
  | 'printer'
  | 'safe'
  // Director
  | 'award'
  | 'cityWindow'
  | 'bin'
  | 'bell'
  // Builders
  | 'issueMonitor'
  // Lounge
  | 'tv'
  | 'noticeBoard'
  | 'clock'
  // Reception
  | 'counter'
  | 'bench'
  | 'frontDoor'

export type Prop = {
  kind: PropKind
  roomId: string
  x: number
  y: number
  w: number
  h: number
  // Index for props that repeat (posters), the agent for desk props.
  n?: number
  agentId?: string
  // The department whiteboard itself (painted by paintWindows); marks where the code is.
  board?: true
}

// Sizes of the props (w x h); floor props stand on the feet line.
export const PROP_SIZE: Record<PropKind, [number, number]> = {
  poster: [7, 10],
  ringLight: [7, 22],
  tripod: [9, 18],
  deskPhone: [5, 3],
  wallMap: [13, 9],
  headset: [5, 7],
  ticketBoard: [13, 10],
  codeBoard: [14, 10],
  miniRack: [10, 20],
  cabinet: [9, 19],
  printer: [9, 5],
  safe: [10, 10],
  award: [6, 8],
  cityWindow: [28, 14],
  bin: [5, 6],
  bell: [5, 6],
  issueMonitor: [28, 12],
  tv: [32, 19],
  noticeBoard: [26, 13],
  clock: [9, 9],
  counter: [22, 13],
  bench: [27, 7],
  frontDoor: [3, 18],
}

// What every known department must show (tests check these are placed in the mock office).
export const DEPT_PROPS: Record<DeptKind, PropKind[]> = {
  marketing: ['ringLight', 'tripod', 'poster'],
  sales: ['deskPhone', 'wallMap'],
  support: ['headset', 'ticketBoard'],
  production: ['codeBoard', 'miniRack'],
  'back-office': ['cabinet', 'printer', 'safe'],
}

type Span = [number, number]

// Free stretches of the window band of a room's back wall (between windows and boards).
export function wallGaps(room: Room): Span[] {
  const left = room.x + 4
  const right = room.x + room.w - 3
  const taken: Span[] = windowXs(room).map((x) => [x - 3, x + WINDOW_W + 3])
  taken.sort((a, b) => a[0] - b[0])
  const gaps: Span[] = []
  let at = left
  for (const [a, b] of taken) {
    if (a > at) gaps.push([at, a])
    at = Math.max(at, b)
  }
  if (right > at) gaps.push([at, right])
  return gaps
}

// Places wall props left to right into the gaps, centred in what is left of each gap. A prop
// that fits no gap goes up to the strip right of the room sign (above the windows).
function placeOnWall(room: Room, kinds: PropKind[], y: number): Prop[] {
  const gaps = wallGaps(room).map(([a, b]) => ({ a, b }))
  const out: Prop[] = []
  const counts = new Map<PropKind, number>()
  const sign = signRect(room)
  let upper = sign.x + sign.w + 4
  for (const kind of kinds) {
    const [w, h] = PROP_SIZE[kind]
    const gap = gaps.find((g) => g.b - g.a >= w)
    if (!gap) {
      if (h <= 10 && upper + w <= room.x + room.w - 4) {
        out.push({ kind, roomId: room.id, x: upper, y: floorTop(room.floor) + 7, w, h, n: counts.get(kind) ?? 0 })
        counts.set(kind, (counts.get(kind) ?? 0) + 1)
        upper += w + 3
      }
      continue
    }
    const n = counts.get(kind) ?? 0
    counts.set(kind, n + 1)
    // A single prop sits in the middle of its gap; several are packed from the left.
    const x = kinds.length === 1 ? Math.round((gap.a + gap.b - w) / 2) : gap.a
    out.push({ kind, roomId: room.id, x, y, w, h, n })
    gap.a = x + w + 3
  }
  return out
}

function deptProps(room: Room, layout: Layout): Prop[] {
  const kind = deptKind(room.id)
  if (!kind) return []
  const top = floorTop(room.floor)
  const feet = feetY(room.floor)
  const extra = propFloorW(room)
  // Floor props stand in the strip kept free at the right end (layout.ts PROP_FLOOR_W).
  const fx = room.x + room.w - ROOM_PAD - extra + 1
  const floor = (k: PropKind, x: number): Prop => {
    const [w, h] = PROP_SIZE[k]
    return { kind: k, roomId: room.id, x, y: feet - h, w, h }
  }
  const desks = layout.desks.filter((d) => d.roomId === room.id)
  const onDesk = (k: PropKind, dx: number): Prop[] =>
    desks.map((d) => {
      const [w, h] = PROP_SIZE[k]
      // Table top is at feet - 9; the prop stands on it, right of the monitor's stand.
      return { kind: k, roomId: room.id, x: d.x + dx, y: feet - 9 - h, w, h, agentId: d.agentId }
    })
  const wallY = top + 18
  switch (kind) {
    case 'marketing':
      return [floor('ringLight', fx), floor('tripod', fx + 9), ...placeOnWall(room, ['poster', 'poster'], wallY + 1)]
    case 'sales':
      return [...onDesk('deskPhone', 19), ...placeOnWall(room, ['wallMap'], wallY + 2)]
    case 'support':
      return [...onDesk('headset', 21), ...placeOnWall(room, ['ticketBoard'], wallY + 1)]
    case 'production':
      // A department with a whiteboard already writes code on it; the others get a code board.
      return [
        floor('miniRack', fx + 1),
        ...(hasBoard(room)
          ? [{ kind: 'codeBoard' as const, roomId: room.id, x: boardX(room), y: wallY, w: WINDOW_W, h: 14, board: true as const }]
          : placeOnWall(room, ['codeBoard'], wallY + 1)),
      ]
    case 'back-office': {
      const cab = floor('cabinet', fx)
      const [pw, ph] = PROP_SIZE.printer
      return [cab, { kind: 'printer', roomId: room.id, x: fx, y: cab.y - ph, w: pw, h: ph }, floor('safe', fx + 11)]
    }
  }
}

export function roomProps(room: Room, layout: Layout): Prop[] {
  const top = floorTop(room.floor)
  const feet = feetY(room.floor)
  const at = (kind: PropKind, x: number, y: number, extra: Partial<Prop> = {}): Prop => {
    const [w, h] = PROP_SIZE[kind]
    return { kind, roomId: room.id, x, y, w, h, ...extra }
  }
  switch (room.kind) {
    case 'dept':
      return deptProps(room, layout)
    case 'director': {
      const win = cityWindow(room)
      const desk = layout.desks.find((d) => d.roomId === room.id)
      const props = [at('cityWindow', win.x, win.y), at('award', room.x + 16, top + 22), at('bell', room.x + 3, top + 4)]
      if (desk) props.push(at('bin', desk.x + desk.w + 6, feet - PROP_SIZE.bin[1]))
      return props
    }
    case 'builders':
      return [at('issueMonitor', room.x + 6, top + 18)]
    case 'lounge':
      return [at('noticeBoard', room.x + 5, top + 18), at('tv', room.x + 34, top + 16), at('clock', room.x + room.w - 44, top + 6)]
    case 'lobby': {
      const s = lobbySpots(layout)!
      return [
        at('counter', s.counterX, feet - PROP_SIZE.counter[1]),
        at('bench', s.benchX, feet - PROP_SIZE.bench[1]),
        at('clock', s.clockX, top + 6),
        at('frontDoor', room.x + room.w - 2, feet - PROP_SIZE.frontDoor[1]),
      ]
    }
    default:
      return []
  }
}

export function allProps(layout: Layout): Prop[] {
  return layout.rooms.flatMap((r) => roomProps(r, layout))
}

// ---- Data the props show ------------------------------------------------------------------------

// Plants grow one step per 10 tasks done today, up to four steps.
export const PLANT_STEP_TASKS = 10
export const PLANT_MAX = 4

export function plantStage(doneToday: number): number {
  if (!Number.isFinite(doneToday) || doneToday <= 0) return 0
  return Math.min(PLANT_MAX, Math.floor(doneToday / PLANT_STEP_TASKS))
}

// Pins on the sales map: prospects contacted today when HQ sends the number, else a static five.
export function mapPins(prospects: Record<string, number> | undefined): { count: number; live: boolean } {
  const n = prospects?.contactedToday
  if (typeof n === 'number' && Number.isFinite(n) && n >= 0) return { count: Math.min(12, Math.floor(n)), live: true }
  return { count: 5, live: false }
}

// Short department labels for the builders' issue monitor.
const ABBR: Record<DeptKind, string> = {
  marketing: 'MKT',
  sales: 'SLS',
  support: 'SUP',
  production: 'PRD',
  'back-office': 'BO',
}

export function deptAbbr(id: string): string {
  const k = deptKind(id)
  return k ? ABBR[k] : id.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase()
}

// Lines of the issue monitor, departments with open issues in HQ order, one shown at a time.
export function issueLines(byDept: Record<string, number>, order: readonly string[]): string[] {
  const ids = [...order, ...Object.keys(byDept).filter((k) => !order.includes(k)).sort()]
  return ids.filter((id) => (byDept[id] ?? 0) > 0).map((id) => `${deptAbbr(id)} #${Math.min(99, byDept[id]!)}`)
}
