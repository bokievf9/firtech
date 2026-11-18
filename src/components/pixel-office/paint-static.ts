// The two cached layers of the scene. `paintBack` is everything behind people (sky, building,
// walls, windows, signs, chairs, lounge and meeting furniture); `paintFront` is what a sitting
// person disappears behind (desks, monitors, racks, the builders' terminal). Both are redrawn
// only when the layout, the sky or a few counters change.

import type { OfficeData } from '@/lib/office-view'
import { type Ctx, paintSprite, rect, text } from './draw'
import { canWrite, FONT_H, textWidth } from './font'
import {
  cityWindow,
  type Desk,
  deptKind,
  FEET,
  FLOOR_H,
  feetY,
  floorTop,
  hasBoard,
  type Layout,
  LIFT_W,
  lobbySpots,
  MARGIN,
  type Rack,
  ROOF_H,
  type Room,
  STAIRS_W,
  WINDOW_W,
  windowXs,
} from './layout'
import { BASE, COLORS, hashId, mix, shade, wallColor } from './palette'
import type { Prop } from './props'
import { SPRITES } from './sprites'
import type { Sky } from './sun'
import type { WeatherKind } from '@/lib/office-weather'

// What the static layers show beyond the layout and the sky (Office v2). Part of the cache key.
export type BackEnv = {
  weather: WeatherKind
  plant: number
  pins: number
  props: readonly Prop[]
  issuesByDept: Readonly<Record<string, number>>
  deptOrder: readonly string[]
  uptimePct: number
}

export const NO_ENV: BackEnv = { weather: 'clear', plant: 0, pins: 5, props: [], issuesByDept: {}, deptOrder: [], uptimePct: 100 }

// A pot plant whose leaves grow one step per 10 tasks done today (stage 0..4); `x` is the left
// edge of the pot sprite, `feet` the floor line.
export function paintPlant(ctx: Ctx, x: number, feet: number, stage: number) {
  const s = SPRITES.plant
  const y = feet - s.h
  for (let i = 1; i <= stage; i++) {
    const ly = y - i * 2
    const w = Math.max(1, 5 - Math.floor(i / 2) * 2)
    const lx = x + Math.floor((s.w - w) / 2)
    rect(ctx, lx, ly, w, 2, i % 2 ? BASE.n! : BASE.N!)
    rect(ctx, lx + (i % 2 ? -1 : w), ly + 1, 1, 1, BASE.n!)
  }
  if (stage >= 4) rect(ctx, x + 3, y - stage * 2 - 1, 1, 1, BASE.P!)
  paintSprite(ctx, s, x, y, BASE)
}

const sprite = (ctx: Ctx, name: keyof typeof SPRITES, x: number, y: number, flip = false) => paintSprite(ctx, SPRITES[name], x, y, BASE, flip)

// ---- Geometry shared with the live layer -------------------------------------------------------

export const deskTable = (desk: Desk) => ({ x: desk.x + 10, y: feetY(desk.floor) - 9, w: desk.w - 11 })
export const deskMonitor = (desk: Desk) => ({ x: desk.x + 13, y: feetY(desk.floor) - 19 })
export const deskScreen = (desk: Desk) => ({ x: desk.x + 15, y: feetY(desk.floor) - 17, w: 6, h: 4 })
export const rackRect = (rack: Rack) => ({ x: rack.x, y: feetY(rack.floor) - 34, w: 14, h: 34 })
export const terminalScreen = (room: Room) => ({ x: room.x + 9, y: feetY(room.floor) - 20, w: 14, h: 9 })
export const signRect = (room: Room) => {
  const label = signText(room)
  return { x: room.x + 4, y: floorTop(room.floor) + 6, w: textWidth(label) + 6, h: FONT_H + 4, label }
}
// The part of a room people stand in (lit or dimmed by the room light).
export const roomInterior = (room: Room) => ({ x: room.x, y: floorTop(room.floor) + 3, w: room.w, h: FLOOR_H - 3 })

export function signText(room: Room): string {
  const t = room.title.toUpperCase()
  return canWrite(t) ? t : room.id.replace(/[^a-z0-9]+/gi, ' ').toUpperCase()
}

// ---- Back layer ---------------------------------------------------------------------------------

export function paintBack(ctx: Ctx, layout: Layout, data: OfficeData, sky: Sky, env: BackEnv = NO_ENV) {
  const { width, height } = layout
  const night = 1 - sky.daylight

  // Sky behind the building, then the street.
  for (let y = 0; y < height; y++) rect(ctx, 0, y, width, 1, mix(sky.top, sky.bottom, y / height))
  if (sky.cityLights) {
    for (let i = 0; i < 24; i++) {
      const h = hashId(`star${i}`)
      rect(ctx, h % width, (h >>> 8) % (ROOF_H + 10), 1, 1, '#c8d0ff')
    }
  }
  const groundY = height - 12
  rect(ctx, 0, groundY, width, 12, mix(COLORS.ground, COLORS.night, night * 0.5))
  rect(ctx, 0, groundY + 3, width, 1, mix('#55555e', COLORS.night, night * 0.5))
  rect(ctx, 0, groundY + 6, width, 6, mix(COLORS.street, COLORS.night, night * 0.5))
  for (let x = 4; x < width; x += 14) rect(ctx, x, groundY + 8, 6, 1, '#8a8670')

  // Roof with the company sign.
  const shell = mix(COLORS.shell, COLORS.night, night * 0.45)
  const bx = MARGIN - 2
  const bw = width - 2 * MARGIN + 4
  rect(ctx, bx, ROOF_H - 4, bw, 4, mix(COLORS.roof, COLORS.night, night * 0.4))
  rect(ctx, bx, ROOF_H - 5, bw, 1, shade(shell, 0.15))
  const brand = 'FIR.TECH'
  const bwText = textWidth(brand)
  const sx = Math.round(width / 2 - bwText / 2)
  rect(ctx, sx - 3, ROOF_H - 14, bwText + 6, 9, COLORS.sign)
  rect(ctx, sx - 1, ROOF_H - 5, 1, 1, COLORS.sign)
  rect(ctx, sx + bwText, ROOF_H - 5, 1, 1, COLORS.sign)
  text(ctx, brand, sx, ROOF_H - 12, COLORS.lime)
  // Antenna (its light blinks in the live layer).
  rect(ctx, width - MARGIN - 12, ROOF_H - 15, 1, 11, '#6a6278')
  rect(ctx, width - MARGIN - 14, ROOF_H - 11, 5, 1, '#6a6278')

  // Building shell and stairwell.
  for (let f = 0; f < layout.floors; f++) {
    const top = floorTop(f)
    rect(ctx, bx, top, bw, FLOOR_H, shell)
    const stairsEnd = MARGIN + STAIRS_W
    rect(ctx, MARGIN, top + 3, STAIRS_W, FLOOR_H - 3, mix(COLORS.stairs, COLORS.night, night * 0.3))
    for (let s = 0; s < 14; s++) {
      const x = f % 2 ? stairsEnd - 2 - s : MARGIN + 1 + s
      rect(ctx, x, top + FEET - s * 4 - 1, 2, 1, COLORS.stairsEdge)
      rect(ctx, x, top + FEET - s * 4, 2, 3, shade(COLORS.stairs, -0.2))
    }
    rect(ctx, MARGIN, top + FEET, STAIRS_W, FLOOR_H - FEET, COLORS.floor)
    // Elevator shaft: cables, a door frame and the floor number on every floor.
    const lx = stairsEnd
    rect(ctx, lx, top + 3, LIFT_W, FLOOR_H - 3, '#1f1b29')
    rect(ctx, lx + 3, top + 3, 1, FLOOR_H - 3, '#3a3446')
    rect(ctx, lx + LIFT_W - 4, top + 3, 1, FLOOR_H - 3, '#3a3446')
    rect(ctx, lx, top + FEET - 19, LIFT_W, 1, '#6a6278')
    rect(ctx, lx, top + FEET - 19, 1, 19, '#6a6278')
    rect(ctx, lx + LIFT_W - 1, top + FEET - 19, 1, 19, '#6a6278')
    text(ctx, String(layout.floors - f), lx + 4, top + FEET - 26, '#e8b33f')
    rect(ctx, lx, top + FEET, LIFT_W, FLOOR_H - FEET, COLORS.floor)
  }

  for (const room of layout.rooms) paintRoomBack(ctx, layout, room, data, sky, env)

  // Fog: a haze over the whole street side.
  if (env.weather === 'fog') {
    ctx.globalAlpha = 0.22
    rect(ctx, 0, 0, width, ROOF_H - 4, '#c9ccd6')
    rect(ctx, 0, groundY, width, 12, '#c9ccd6')
    ctx.globalAlpha = 1
  }

  // Slabs between floors (drawn last so partitions end cleanly).
  for (let f = 0; f <= layout.floors; f++) {
    const top = floorTop(f)
    rect(ctx, bx, top, bw, 3, COLORS.slab)
    rect(ctx, bx, top + 2, bw, 1, COLORS.slabLine)
  }
}

function paintRoomBack(ctx: Ctx, layout: Layout, room: Room, data: OfficeData, sky: Sky, env: BackEnv) {
  const top = floorTop(room.floor)
  const feet = top + FEET
  const wall = wallColor(room.id)
  rect(ctx, room.x, top + 3, room.w, FEET - 3, wall)
  rect(ctx, room.x, feet - 12, room.w, 12, shade(wall, -0.18))
  rect(ctx, room.x, feet - 13, room.w, 1, shade(wall, 0.18))
  // Floor boards.
  rect(ctx, room.x, feet, room.w, FLOOR_H - FEET, COLORS.floor)
  for (let x = room.x + ((room.floor * 7) % 9); x < room.x + room.w; x += 9) rect(ctx, x, feet + 1, 1, 2, COLORS.floorLine)
  // Partition on the left of every room.
  rect(ctx, room.x, top + 3, 1, FEET - 3, shade(wall, -0.45))
  rect(ctx, room.x + 1, top + 3, 1, FEET - 3, shade(wall, 0.1))
  // Ceiling lamps.
  for (let x = room.x + 12; x < room.x + room.w - 6; x += 30) {
    rect(ctx, x, top + 3, 1, 2, '#1f1b29')
    rect(ctx, x - 2, top + 5, 5, 1, '#1f1b29')
    rect(ctx, x - 1, top + 6, 3, 1, COLORS.cityLit)
  }

  if (room.kind !== 'servers') paintWindows(ctx, room, sky, env.weather)
  paintSign(ctx, room)
  const props = env.props.filter((p) => p.roomId === room.id)

  switch (room.kind) {
    case 'director': {
      // Bookshelf on the left wall.
      const bx = room.x + 4
      rect(ctx, bx, feet - 26, 8, 26, BASE.O!)
      for (let s = 0; s < 3; s++) {
        rect(ctx, bx + 1, feet - 25 + s * 8, 6, 7, shade(BASE.O!, -0.35))
        for (let b = 0; b < 3; b++) rect(ctx, bx + 1 + b * 2, feet - 23 + s * 8, 1, 5, ['#c45b5b', '#5b8def', '#e8b33f'][(b + s) % 3]!)
      }
      paintPlant(ctx, room.x + room.w - 10, feet, env.plant)
      // Wide window onto the city, the framed award, the bin by the desk.
      const win = cityWindow(room)
      paintWindow(ctx, win.x, win.y, win.w, win.h, sky, hashId('city'), env.weather)
      for (const p of props) {
        if (p.kind === 'award') {
          sprite(ctx, 'award', p.x, p.y)
          rect(ctx, p.x + 2, p.y - 2, 2, 1, '#8d93a3')
        }
        if (p.kind === 'bin') sprite(ctx, 'bin', p.x, p.y)
      }
      break
    }
    case 'meeting': {
      // Whiteboard with today's task counts as bars.
      const wx = room.x + Math.floor(room.w / 2) - 14
      const wy = top + 16
      rect(ctx, wx, wy, 28, 16, '#8d93a3')
      rect(ctx, wx + 1, wy + 1, 26, 14, '#f4f1ea')
      const c = data.tasks.counts
      const bars: [number, string][] = [
        [c.running ?? 0, '#5b8def'],
        [c.review ?? 0, '#e8b33f'],
        [c.approval ?? 0, COLORS.lime],
        [c.blocked ?? 0, COLORS.red],
        [c.done ?? 0, '#4fb08a'],
      ]
      const max = Math.max(1, ...bars.map(([n]) => n))
      bars.forEach(([n, color], i) => {
        const h = Math.max(1, Math.round((n / max) * 10))
        rect(ctx, wx + 3 + i * 5, wy + 13 - h, 3, h, color)
      })
      // Table and chairs.
      const tx = room.x + Math.floor(room.w / 2) - 15
      rect(ctx, tx, feet - 9, 30, 2, BASE.o!)
      rect(ctx, tx, feet - 7, 30, 1, BASE.O!)
      rect(ctx, tx + 3, feet - 6, 2, 6, BASE.O!)
      rect(ctx, tx + 25, feet - 6, 2, 6, BASE.O!)
      paintSprite(ctx, SPRITES.chair, tx - 7, feet - 12, BASE)
      paintSprite(ctx, SPRITES.chair, tx + 29, feet - 12, BASE, true)
      break
    }
    case 'dept': {
      const extraFloor = props.some((p) => p.y + p.h === feet && p.kind !== 'deskPhone' && p.kind !== 'headset')
      if (!extraFloor && room.w - (room.agentIds.length * 26 + 12) >= 10) paintPlant(ctx, room.x + room.w - 9, feet, env.plant)
      for (const desk of layout.desks) {
        if (desk.roomId !== room.id) continue
        paintSprite(ctx, SPRITES.chair, desk.x, feet - 12, BASE)
      }
      paintDeptProps(ctx, room, props, env)
      break
    }
    case 'builders': {
      // Issue board: one red sticky per open builder issue (up to 8), a number when more.
      // Sticky notes: one per open builder issue (up to 8), coloured by department when HQ
      // says which; red otherwise.
      const n = data.director.openBuilderIssues
      const bx = room.x + room.w - 22
      const by = top + 18
      rect(ctx, bx, by, 18, 12, '#6b4a3a')
      rect(ctx, bx + 1, by + 1, 16, 10, '#c9a77a')
      const inks = ['#ffd166', '#e86fa0', '#7fc4ff', '#b5eb6a', '#f08a5d']
      const notes: string[] = []
      env.deptOrder.forEach((id, i) => {
        for (let k = 0; k < (env.issuesByDept[id] ?? 0); k++) notes.push(inks[i % inks.length]!)
      })
      while (notes.length < n) notes.push(COLORS.red)
      notes.slice(0, 8).forEach((ink, i) => {
        const nx = bx + 2 + (i % 4) * 4
        const ny = by + 2 + Math.floor(i / 4) * 4
        rect(ctx, nx, ny, 3, 3, ink)
        rect(ctx, nx, ny + 2, 3, 1, shade(ink, -0.2))
      })
      if (n === 0) text(ctx, '0', bx + 7, by + 3, '#6b4a3a')
      // Loose stickies on the wall too.
      for (let i = 0; i < Math.min(3, n); i++) rect(ctx, bx - 4 - i * 3, by + 3 + (i % 2) * 4, 2, 2, inks[i]!)
      paintSprite(ctx, SPRITES.chair, room.x + 1, feet - 12, BASE)
      // Frame of the issue monitor (the scene writes «MKT #2» lines into it).
      for (const p of props) if (p.kind === 'issueMonitor') paintScreenFrame(ctx, p)
      break
    }
    case 'lounge': {
      paintSprite(ctx, SPRITES.coffeeMachine, room.x + 6, feet - 14, BASE)
      rect(ctx, room.x + 4, feet - 15, 14, 1, BASE.O!)
      paintSprite(ctx, SPRITES.cooler, room.x + 17, feet - 12, BASE)
      // Sofa on the right.
      const sw = Math.min(30, room.w - 60)
      if (sw >= 18) {
        const sx = room.x + room.w - sw - 4
        rect(ctx, sx, feet - 12, sw, 5, BASE.u!)
        rect(ctx, sx, feet - 7, sw, 5, shade(BASE.u!, 0.15))
        rect(ctx, sx - 2, feet - 9, 3, 7, BASE.U!)
        rect(ctx, sx + sw - 1, feet - 9, 3, 7, BASE.U!)
        rect(ctx, sx + 1, feet - 2, 2, 2, '#1a1626')
        rect(ctx, sx + sw - 3, feet - 2, 2, 2, '#1a1626')
      }
      paintPlant(ctx, room.x + room.w - 9 - (sw >= 18 ? sw + 6 : 0), feet, env.plant)
      for (const p of props) {
        if (p.kind === 'tv') {
          paintScreenFrame(ctx, p)
          rect(ctx, p.x + Math.floor(p.w / 2) - 3, p.y + p.h, 6, 1, '#3a3446')
        }
        if (p.kind === 'noticeBoard') {
          rect(ctx, p.x, p.y, p.w, p.h, '#6b4a3a')
          rect(ctx, p.x + 1, p.y + 1, p.w - 2, p.h - 2, '#c9a77a')
          rect(ctx, p.x + 2, p.y + 2, 6, 3, BASE.w!)
          rect(ctx, p.x + p.w - 8, p.y + 2, 5, 4, '#ffd166')
          rect(ctx, p.x + 4, p.y + 2, 1, 1, COLORS.red)
          rect(ctx, p.x + p.w - 6, p.y + 2, 1, 1, '#5b8def')
        }
        if (p.kind === 'clock') paintClockFace(ctx, p)
      }
      break
    }
    case 'lobby': {
      paintLobbyBack(ctx, layout, room, props, env)
      break
    }
    case 'servers': {
      for (const rack of layout.racks) {
        const label = rack.kind === 'site' ? 'SITE' : rack.title.toUpperCase()
        if (canWrite(label)) text(ctx, label, rack.x + 7 - Math.floor(textWidth(label) / 2), feet - 42, '#9aa3b5')
        if (rack.kind === 'site') {
          const pct = `${Math.round(env.uptimePct)}%`
          text(ctx, pct, rack.x + 7 - Math.floor(textWidth(pct) / 2), feet - 48, env.uptimePct >= 99 ? COLORS.ledOn : '#e8b33f')
        }
      }
      if (layout.generatorX !== null) text(ctx, 'OMNI', layout.generatorX + 1, feet - 22, '#9aa3b5')
      break
    }
  }
}

function paintWindows(ctx: Ctx, room: Room, sky: Sky, weather: WeatherKind) {
  const top = floorTop(room.floor)
  const wy = top + 18
  const xs = windowXs(room)
  xs.forEach((wx, i) => {
    if (i === 0 && hasBoard(room)) paintBoard(ctx, wx, wy, WINDOW_W, 14, hashId(room.id), deptKind(room.id) === 'production')
    else paintWindow(ctx, wx, wy, WINDOW_W, 14, sky, hashId(`${room.id}${i}`), weather)
  })
}

// Inside of a window (where weather is drawn live), for every window of the layout.
export function windowRects(layout: Layout): { x: number; y: number; w: number; h: number; seed: number }[] {
  const out: { x: number; y: number; w: number; h: number; seed: number }[] = []
  for (const room of layout.rooms) {
    if (room.kind === 'servers') continue
    const wy = floorTop(room.floor) + 18
    windowXs(room).forEach((wx, i) => {
      if (i === 0 && hasBoard(room)) return
      out.push({ x: wx + 1, y: wy + 1, w: WINDOW_W - 2, h: 12, seed: hashId(`${room.id}${i}`) })
    })
    if (room.kind === 'director') {
      const c = cityWindow(room)
      out.push({ x: c.x + 1, y: c.y + 1, w: c.w - 2, h: c.h - 2, seed: hashId('city') })
    }
  }
  return out
}

// Department whiteboard: a few scribbles and a marker tray; Production writes indented code.
function paintBoard(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number, code = false) {
  rect(ctx, x - 1, y - 1, w + 2, h + 2, '#8d93a3')
  rect(ctx, x, y, w, h, '#f4f1ea')
  const inks = ['#5b8def', '#c45b5b', '#4fb08a']
  if (code) {
    paintCode(ctx, x + 1, y + 1, w - 2, h - 2, seed)
  } else {
    for (let line = 0; line < 4; line++) {
      const len = 4 + ((seed >>> (line * 3)) % 8)
      rect(ctx, x + 2, y + 2 + line * 3, Math.min(len, w - 4), 1, inks[(line + seed) % 3]!)
    }
  }
  rect(ctx, x + 2, y + h, w - 4, 1, '#6a6278')
}

// Code lines with indentation: braces in blue, names in green, strings in red.
function paintCode(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number) {
  const indents = [0, 2, 2, 4, 4, 2, 0]
  for (let line = 0; line * 2 + 1 < h && line < indents.length; line++) {
    const ind = indents[line]!
    const len = 3 + ((seed >>> (line * 3)) % 6)
    rect(ctx, x + 1 + ind, y + 1 + line * 2 - (line ? 0 : 0), Math.min(len, w - 2 - ind), 1, line % 3 === 0 ? '#5b8def' : '#4fb08a')
    if (line % 2 && ind + len + 3 < w - 1) rect(ctx, x + 2 + ind + len, y + 1 + line * 2, 2, 1, '#c45b5b')
  }
}

function paintWindow(ctx: Ctx, x: number, y: number, w: number, h: number, sky: Sky, seed: number, weather: WeatherKind = 'clear') {
  rect(ctx, x - 1, y - 1, w + 2, h + 2, COLORS.frameShade)
  rect(ctx, x, y, w, h, COLORS.frame)
  const ix = x + 1
  const iy = y + 1
  const iw = w - 2
  const ih = h - 2
  for (let r = 0; r < ih; r++) rect(ctx, ix, iy + r, iw, 1, mix(sky.top, sky.bottom, r / (ih - 1)))
  if (sky.sun) {
    const sx = ix + Math.round(sky.sun.x * (iw - 2))
    const sy = iy + Math.round((1 - sky.sun.y) * (ih - 6))
    rect(ctx, sx, sy, 2, 2, sky.phase === 'day' ? '#fff3b0' : '#ffb36b')
  } else {
    rect(ctx, ix + 2 + (seed % 6), iy + 2, 2, 2, '#e8ecff')
    rect(ctx, ix + 8, iy + 4, 1, 1, '#c8d0ff')
  }
  // City silhouette with lit windows at night.
  const city = mix(COLORS.city, sky.bottom, sky.daylight * 0.45)
  let cx = ix
  let s = seed
  while (cx < ix + iw) {
    const bw = 2 + (s % 3)
    const bh = 3 + ((s >>> 3) % 5)
    const w2 = Math.min(bw, ix + iw - cx)
    rect(ctx, cx, iy + ih - bh, w2, bh, city)
    if (sky.cityLights) {
      for (let k = 0; k < bh - 1; k += 2) if (((s >>> (k + 5)) & 3) === 0 && w2 > 1) rect(ctx, cx + 1, iy + ih - bh + 1 + k, 1, 1, COLORS.cityLit)
    }
    cx += bw
    s = Math.imul(s ^ (s >>> 13), 0x5bd1e995) >>> 0
  }
  // Snow on the roofs outside, fog over the glass.
  if (weather === 'snow') {
    ctx.globalAlpha = 0.85
    rect(ctx, ix, iy + ih - 1, iw, 1, '#f4f6fb')
    ctx.globalAlpha = 1
  }
  if (weather === 'fog') {
    ctx.globalAlpha = 0.45
    rect(ctx, ix, iy, iw, ih, '#c9ccd6')
    ctx.globalAlpha = 1
  }
  // Cross bars of the frame.
  rect(ctx, x + Math.floor(w / 2), y, 1, h, COLORS.frame)
  if (w > 20) rect(ctx, x, y + Math.floor(h / 2), w, 1, COLORS.frame)
}

function paintScreenFrame(ctx: Ctx, p: Prop) {
  rect(ctx, p.x, p.y, p.w, p.h, '#1a1626')
  rect(ctx, p.x + 1, p.y + 1, p.w - 2, p.h - 2, '#454c5c')
  rect(ctx, p.x + 2, p.y + 2, p.w - 4, p.h - 4, COLORS.terminal)
}

// TV / monitor screen area inside a prop frame (the scene writes into it).
export const screenOf = (p: Prop) => ({ x: p.x + 2, y: p.y + 2, w: p.w - 4, h: p.h - 4 })

function paintClockFace(ctx: Ctx, p: Prop) {
  rect(ctx, p.x + 2, p.y, p.w - 4, p.h, '#1a1626')
  rect(ctx, p.x, p.y + 2, p.w, p.h - 4, '#1a1626')
  rect(ctx, p.x + 1, p.y + 1, p.w - 2, p.h - 2, '#1a1626')
  rect(ctx, p.x + 2, p.y + 1, p.w - 4, p.h - 2, BASE.w!)
  rect(ctx, p.x + 1, p.y + 2, p.w - 2, p.h - 4, BASE.w!)
  for (const [dx, dy] of [[4, 1], [7, 4], [4, 7], [1, 4]] as const) rect(ctx, p.x + dx, p.y + dy, 1, 1, '#6a6278')
}

// Centre of a clock prop (hands are drawn live).
export const clockCentre = (p: Prop) => ({ x: p.x + 4, y: p.y + 4 })

function paintDeptProps(ctx: Ctx, room: Room, props: readonly Prop[], env: BackEnv) {
  const posterInks = [['#e86fa0', '#ffd166'], ['#5b8def', '#b5eb6a']] as const
  for (const p of props) {
    switch (p.kind) {
      case 'ringLight':
        sprite(ctx, 'ringLight', p.x, p.y)
        break
      case 'tripod':
        sprite(ctx, 'tripod', p.x, p.y, true)
        break
      case 'poster': {
        const [a, b] = posterInks[(p.n ?? 0) % 2]!
        rect(ctx, p.x, p.y, p.w, p.h, '#1a1626')
        rect(ctx, p.x + 1, p.y + 1, p.w - 2, p.h - 2, a)
        rect(ctx, p.x + 2, p.y + 2, p.w - 4, 3, b)
        rect(ctx, p.x + 2, p.y + 6, p.w - 4, 1, BASE.w!)
        rect(ctx, p.x + 2, p.y + 8, 2, 1, BASE.w!)
        break
      }
      case 'wallMap': {
        rect(ctx, p.x, p.y, p.w, p.h, '#6b4a3a')
        rect(ctx, p.x + 1, p.y + 1, p.w - 2, p.h - 2, BASE.i!)
        // Land masses.
        rect(ctx, p.x + 2, p.y + 2, 4, 3, BASE.a!)
        rect(ctx, p.x + 3, p.y + 5, 2, 2, BASE.a!)
        rect(ctx, p.x + 7, p.y + 2, 4, 2, BASE.a!)
        rect(ctx, p.x + 8, p.y + 4, 3, 3, BASE.a!)
        for (let i = 0; i < env.pins; i++) {
          const h = hashId(`pin${i}`)
          rect(ctx, p.x + 2 + (h % (p.w - 4)), p.y + 2 + ((h >>> 5) % (p.h - 4)), 1, 1, COLORS.red)
        }
        break
      }
      case 'ticketBoard': {
        rect(ctx, p.x, p.y, p.w, p.h, '#8d93a3')
        rect(ctx, p.x + 1, p.y + 1, p.w - 2, p.h - 2, '#f4f1ea')
        // Three columns: new, in progress, done.
        const cols = ['#e0524b', '#e8b33f', '#4fb08a']
        cols.forEach((ink, c) => {
          const cx = p.x + 2 + c * 4
          rect(ctx, cx, p.y + 2, 3, 1, ink)
          for (let k = 0; k < 2 + (hashId(`${room.id}t${c}`) % 2); k++) rect(ctx, cx, p.y + 4 + k * 2, 3, 1, '#c9c3b6')
        })
        break
      }
      case 'codeBoard':
        if (p.board) break
        rect(ctx, p.x, p.y, p.w, p.h, '#8d93a3')
        rect(ctx, p.x + 1, p.y + 1, p.w - 2, p.h - 2, '#f4f1ea')
        paintCode(ctx, p.x + 1, p.y + 1, p.w - 2, p.h - 2, hashId(room.id))
        break
      case 'miniRack':
        sprite(ctx, 'miniRack', p.x, p.y)
        break
      case 'cabinet':
        sprite(ctx, 'cabinet', p.x, p.y)
        break
      case 'safe':
        sprite(ctx, 'safe', p.x, p.y)
        break
      default:
        break
    }
  }
}

function paintLobbyBack(ctx: Ctx, layout: Layout, room: Room, props: readonly Prop[], env: BackEnv) {
  const s = lobbySpots(layout)
  if (!s) return
  const feet = feetY(room.floor)
  // A rug in front of the counter and the brand on the wall behind the receptionist.
  rect(ctx, s.counterX + s.counterW + 2, feet, 24, 1, '#7a3f4a')
  rect(ctx, s.counterX + s.counterW + 3, feet + 1, 22, 1, '#5c2f38')
  const brand = 'FIR.TECH'
  text(ctx, brand, s.counterX + Math.floor((s.counterW - textWidth(brand)) / 2), floorTop(room.floor) + 19, COLORS.lime)
  for (const p of props) {
    if (p.kind === 'bench') {
      rect(ctx, p.x, p.y + 1, p.w, 2, BASE.o!)
      rect(ctx, p.x, p.y + 3, p.w, 1, BASE.O!)
      rect(ctx, p.x + 1, p.y + 4, 1, 3, BASE.O!)
      rect(ctx, p.x + p.w - 2, p.y + 4, 1, 3, BASE.O!)
      rect(ctx, p.x, p.y - 5, p.w, 1, BASE.O!)
      for (let k = 2; k < p.w; k += 6) rect(ctx, p.x + k, p.y - 4, 1, 5, BASE.O!)
    }
    if (p.kind === 'clock') paintClockFace(ctx, p)
    if (p.kind === 'frontDoor') {
      // The door frame; the leaf is drawn live (it opens).
      rect(ctx, p.x - 1, p.y - 2, 4, 2, '#454c5c')
      rect(ctx, p.x - 9, p.y - 7, 9, 5, COLORS.sign)
      text(ctx, 'IN', p.x - 7, p.y - 7, COLORS.lime)
    }
  }
  paintPlant(ctx, room.x + 4, feet, env.plant)
}

function paintSign(ctx: Ctx, room: Room) {
  const s = signRect(room)
  rect(ctx, s.x, s.y, s.w, s.h, COLORS.sign)
  rect(ctx, s.x, s.y + s.h, s.w, 1, shade(COLORS.sign, -0.4))
  text(ctx, s.label, s.x + 3, s.y + 2, room.kind === 'builders' ? COLORS.terminalText : COLORS.signText)
}

// ---- Front layer --------------------------------------------------------------------------------

export function paintFront(ctx: Ctx, layout: Layout, _data: OfficeData, props: readonly Prop[] = []) {
  for (const desk of layout.desks) {
    const t = deskTable(desk)
    rect(ctx, t.x, t.y, t.w, 2, BASE.o!)
    rect(ctx, t.x, t.y + 2, t.w, 1, BASE.O!)
    rect(ctx, t.x + 1, t.y + 3, 1, 6, BASE.O!)
    rect(ctx, t.x + t.w - 2, t.y + 3, 1, 6, BASE.O!)
    if (desk.director) {
      // Drawer block and a paper stack, one sheet per pending approval (up to 6).
      rect(ctx, t.x + t.w - 9, t.y + 3, 7, 6, BASE.O!)
      rect(ctx, t.x + t.w - 8, t.y + 5, 5, 1, BASE.o!)
      // The paper stack is live (scene.ts drawStack): papers arrive and leave.
      rect(ctx, t.x + 14, t.y - 2, 2, 2, '#c45b5b')
    } else {
      // Keyboard and a mug.
      rect(ctx, t.x + 1, t.y - 1, 4, 1, '#3a3446')
      rect(ctx, t.x + t.w - 3, t.y - 2, 2, 2, BASE.w!)
    }
    const m = deskMonitor(desk)
    paintSprite(ctx, SPRITES.imac, m.x, m.y, BASE)
  }

  for (const rack of layout.racks) {
    const r = rackRect(rack)
    rect(ctx, r.x, r.y, r.w, r.h, '#1a1d24')
    rect(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, '#2c313c')
    for (let u = 0; u < 4; u++) {
      rect(ctx, r.x + 2, r.y + 3 + u * 7, r.w - 4, 5, '#1f232b')
      rect(ctx, r.x + 2, r.y + 3 + u * 7, r.w - 4, 1, '#3a404d')
    }
    rect(ctx, r.x + 1, r.y + r.h - 2, 2, 2, '#111')
    rect(ctx, r.x + r.w - 3, r.y + r.h - 2, 2, 2, '#111')
  }

  for (const p of props) {
    if (p.kind === 'deskPhone') sprite(ctx, 'deskPhone', p.x, p.y)
    if (p.kind === 'headset') sprite(ctx, 'headset', p.x, p.y)
    if (p.kind === 'printer') sprite(ctx, 'printer', p.x, p.y)
    if (p.kind === 'counter') {
      rect(ctx, p.x, p.y, p.w, 2, BASE.o!)
      rect(ctx, p.x + 1, p.y + 2, p.w - 2, p.h - 2, '#3a3446')
      rect(ctx, p.x + 1, p.y + 2, p.w - 2, 1, '#4a4458')
      rect(ctx, p.x + 3, p.y + 5, p.w - 6, 4, COLORS.lime)
      rect(ctx, p.x + 4, p.y + 6, p.w - 8, 2, '#3a3446')
      // A tablet and a small bell on the counter.
      rect(ctx, p.x + 2, p.y - 1, 4, 1, '#1a1626')
      rect(ctx, p.x + p.w - 5, p.y - 2, 3, 2, '#e8b33f')
    }
  }
  if (layout.generatorX !== null) {
    const room = layout.rooms.find((r) => r.kind === 'servers')
    if (room) sprite(ctx, 'generator', layout.generatorX, feetY(room.floor) - SPRITES.generator.h)
  }

  const builders = layout.rooms.find((r) => r.kind === 'builders')
  if (builders) {
    const feet = feetY(builders.floor)
    const tx = builders.x + 4
    rect(ctx, tx, feet - 9, 24, 2, '#4a4f5c')
    rect(ctx, tx, feet - 7, 24, 1, '#363a45')
    rect(ctx, tx + 1, feet - 6, 1, 6, '#363a45')
    rect(ctx, tx + 22, feet - 6, 1, 6, '#363a45')
    // Big terminal monitor; the live layer writes into its screen.
    const s = terminalScreen(builders)
    rect(ctx, s.x - 2, s.y - 2, s.w + 4, s.h + 4, '#1a1626')
    rect(ctx, s.x - 1, s.y - 1, s.w + 2, s.h + 2, '#454c5c')
    rect(ctx, s.x + 5, s.y + s.h + 2, 4, 1, '#454c5c')
    rect(ctx, s.x + 3, s.y + s.h + 3, 8, 1, '#1a1626')
  }
}
