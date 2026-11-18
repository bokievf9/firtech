// The two cached layers of the scene. `paintBack` is everything behind people (sky, building,
// walls, windows, signs, chairs, lounge and meeting furniture); `paintFront` is what a sitting
// person disappears behind (desks, monitors, racks, the builders' terminal). Both are redrawn
// only when the layout, the sky or a few counters change.

import type { OfficeData } from '@/lib/office-view'
import { type Ctx, paintSprite, rect, text } from './draw'
import { canWrite, FONT_H, textWidth } from './font'
import {
  type Desk,
  FEET,
  FLOOR_H,
  FLOOR_X,
  feetY,
  floorTop,
  type Layout,
  MARGIN,
  type Rack,
  ROOF_H,
  type Room,
} from './layout'
import { BASE, COLORS, hashId, mix, shade, wallColor } from './palette'
import { SPRITES } from './sprites'
import type { Sky } from './sun'

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

export function paintBack(ctx: Ctx, layout: Layout, data: OfficeData, sky: Sky) {
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
    rect(ctx, MARGIN, top + 3, FLOOR_X - MARGIN, FLOOR_H - 3, mix(COLORS.stairs, COLORS.night, night * 0.3))
    for (let s = 0; s < 14; s++) {
      const x = f % 2 ? FLOOR_X - 2 - s : MARGIN + 1 + s
      rect(ctx, x, top + FEET - s * 4 - 1, 2, 1, COLORS.stairsEdge)
      rect(ctx, x, top + FEET - s * 4, 2, 3, shade(COLORS.stairs, -0.2))
    }
    rect(ctx, MARGIN, top + FEET, FLOOR_X - MARGIN, FLOOR_H - FEET, COLORS.floor)
  }

  for (const room of layout.rooms) paintRoomBack(ctx, layout, room, data, sky)

  // Slabs between floors (drawn last so partitions end cleanly).
  for (let f = 0; f <= layout.floors; f++) {
    const top = floorTop(f)
    rect(ctx, bx, top, bw, 3, COLORS.slab)
    rect(ctx, bx, top + 2, bw, 1, COLORS.slabLine)
  }
}

function paintRoomBack(ctx: Ctx, layout: Layout, room: Room, data: OfficeData, sky: Sky) {
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

  if (room.kind !== 'servers') paintWindows(ctx, room, sky)
  paintSign(ctx, room)

  switch (room.kind) {
    case 'director': {
      // Bookshelf on the left wall.
      const bx = room.x + 4
      rect(ctx, bx, feet - 26, 8, 26, BASE.O!)
      for (let s = 0; s < 3; s++) {
        rect(ctx, bx + 1, feet - 25 + s * 8, 6, 7, shade(BASE.O!, -0.35))
        for (let b = 0; b < 3; b++) rect(ctx, bx + 1 + b * 2, feet - 23 + s * 8, 1, 5, ['#c45b5b', '#5b8def', '#e8b33f'][(b + s) % 3]!)
      }
      paintSprite(ctx, SPRITES.plant, room.x + room.w - 10, feet - 11, BASE)
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
      for (const desk of layout.desks) {
        if (desk.roomId !== room.id) continue
        paintSprite(ctx, SPRITES.chair, desk.x, feet - 12, BASE)
      }
      if (room.w - (room.agentIds.length * 26 + 12) >= 10) paintSprite(ctx, SPRITES.plant, room.x + room.w - 9, feet - 11, BASE)
      break
    }
    case 'builders': {
      // Issue board: one red sticky per open builder issue (up to 8), a number when more.
      const n = data.director.openBuilderIssues
      const bx = room.x + room.w - 22
      const by = top + 18
      rect(ctx, bx, by, 18, 12, '#6b4a3a')
      rect(ctx, bx + 1, by + 1, 16, 10, '#c9a77a')
      for (let i = 0; i < Math.min(8, n); i++) rect(ctx, bx + 2 + (i % 4) * 4, by + 2 + Math.floor(i / 4) * 4, 3, 3, COLORS.red)
      if (n === 0) text(ctx, '0', bx + 7, by + 3, '#6b4a3a')
      paintSprite(ctx, SPRITES.chair, room.x + 1, feet - 12, BASE)
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
      paintSprite(ctx, SPRITES.plant, room.x + room.w - 9 - (sw >= 18 ? sw + 6 : 0), feet - 11, BASE)
      break
    }
    case 'servers': {
      for (const rack of layout.racks) {
        const label = rack.title.toUpperCase()
        if (canWrite(label)) text(ctx, label, rack.x + 7 - Math.floor(textWidth(label) / 2), feet - 42, '#9aa3b5')
      }
      break
    }
  }
}

function paintWindows(ctx: Ctx, room: Room, sky: Sky) {
  const top = floorTop(room.floor)
  const sign = signRect(room)
  const wy = top + 18
  const ww = 16
  const wh = 14
  let count = Math.max(1, Math.floor((room.w - 10) / 30))
  if (room.kind === 'builders' || room.kind === 'meeting') count = 1
  const gap = (room.w - count * ww) / (count + 1)
  for (let i = 0; i < count; i++) {
    let wx = Math.round(room.x + gap + i * (ww + gap))
    if (room.kind === 'builders') wx = room.x + 5
    if (room.kind === 'meeting') wx = room.x + room.w - ww - 4
    // Leave the meeting room's whiteboard visible.
    if (room.kind === 'meeting' && room.w < 70) continue
    if (wy < sign.y + sign.h) continue
    paintWindow(ctx, wx, wy, ww, wh, sky, hashId(`${room.id}${i}`))
  }
}

function paintWindow(ctx: Ctx, x: number, y: number, w: number, h: number, sky: Sky, seed: number) {
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
  // Cross bars of the frame.
  rect(ctx, x + Math.floor(w / 2), y, 1, h, COLORS.frame)
}

function paintSign(ctx: Ctx, room: Room) {
  const s = signRect(room)
  rect(ctx, s.x, s.y, s.w, s.h, COLORS.sign)
  rect(ctx, s.x, s.y + s.h, s.w, 1, shade(COLORS.sign, -0.4))
  text(ctx, s.label, s.x + 3, s.y + 2, room.kind === 'builders' ? COLORS.terminalText : COLORS.signText)
}

// ---- Front layer --------------------------------------------------------------------------------

export function paintFront(ctx: Ctx, layout: Layout, data: OfficeData) {
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
      const sheets = Math.min(6, data.director.pendingApprovals)
      for (let i = 0; i < sheets; i++) rect(ctx, t.x + t.w - 10 + (i % 2), t.y - 1 - i, 6, 1, i % 2 ? BASE.W! : BASE.w!)
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
