// The live pixel office on a <canvas>. Owns its own animation-frame loop and state; React only
// hands it new data (setData) and asks it what is under the pointer (hitTest). Nothing here
// re-renders React. The loop stops while the tab is hidden; with reduced motion people move
// without walking and the frames change slowly.

import type { AgentStatus, OfficeData } from '@/lib/office-view'
import { crowdOf, planPath, type Point, type Pose, roomLight, type Target, targetFor } from './behaviour'
import { context, type Ctx, makeCanvas, rect, spriteCache, text } from './draw'
import { textWidth } from './font'
import {
  buildLayout,
  type Desk,
  FEET,
  FLOOR_H,
  feetY,
  floorTop,
  type Layout,
  layoutSignature,
  ROOF_H,
  type Room,
  SCENE_MIN_W,
} from './layout'
import { officePeople, type Person } from './model'
import {
  deskScreen,
  deskTable,
  paintBack,
  paintFront,
  rackRect,
  roomInterior,
  signRect,
  terminalScreen,
} from './paint-static'
import { agentLook, COLORS, hashId, type Look, mix } from './palette'
import { PERSON_W, SIT_H, type SpriteName, SPRITES, STAND_H } from './sprites'
import { localHour, skyAt } from './sun'

export type HitTarget = { kind: 'agent'; id: string } | { kind: 'product'; id: string } | { kind: 'builders' }
export type Rect = { x: number; y: number; w: number; h: number }

export type Scene = {
  setData(data: OfficeData): void
  setReducedMotion(on: boolean): void
  setHover(target: HitTarget | null): void
  setSelected(target: HitTarget | null): void
  // Logical pixel coordinates (CSS pixels divided by the CSS scale).
  hitTest(x: number, y: number): HitTarget | null
  anchorOf(target: HitTarget): Rect | null
  size(): { width: number; height: number }
  resize(cssScale: number): void
  // Public hero: rebuild the building for a new box width (logical px); no-op when unchanged.
  setMinWidth(minWidth: number): void
  // Stops the animation loop (offscreen, or the hero scrolled away); resumes when false.
  setPaused(paused: boolean): void
  destroy(): void
}

type Actor = {
  id: string
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
}

const WALK_SPEED = 30 // logical px per second
const CLIMB_SPEED = 26
const REDUCED_STEP_MS = 800

const sameTarget = (a: Target | null, b: Target) =>
  !!a && a.floor === b.floor && a.x === b.x && a.pose === b.pose && a.facing === b.facing

const floorOfY = (y: number) => Math.round((y - ROOF_H - FEET) / FLOOR_H)

const within = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h

const deskRect = (desk: Desk): Rect => ({ x: desk.x, y: deskTable(desk).y - 12, w: desk.w, h: 21 })

export const sameHit = (a: HitTarget | null, b: HitTarget | null) =>
  a === b || (!!a && !!b && a.kind === b.kind && (a.kind === 'builders' || a.id === (b as { id: string }).id))

export function createScene(
  canvas: HTMLCanvasElement,
  initial: OfficeData,
  opts: { reducedMotion: boolean; minWidth?: number },
): Scene {
  const ctx = context(canvas)
  const sprite = spriteCache()

  let data = initial
  let people: Person[] = []
  let byId = new Map<string, Person>()
  let minWidth = opts.minWidth ?? SCENE_MIN_W
  let paused = false
  let layout: Layout = buildLayout(initial, minWidth)
  let deskById = new Map<string, Desk>()
  const actors = new Map<string, Actor>()
  let reduced = opts.reducedMotion
  let hover: HitTarget | null = null
  let selected: HitTarget | null = null
  let cssScale = 3
  let k = 3

  let back: HTMLCanvasElement | null = null
  let front: HTMLCanvasElement | null = null
  let backKey = ''
  let frontKey = ''

  let raf = 0
  let last = 0
  let lastStep = 0
  let destroyed = false

  // ---- Data ---------------------------------------------------------------------------------

  function apply(next: OfficeData, first: boolean) {
    data = next
    people = officePeople(next)
    byId = new Map(people.map((p) => [p.id, p]))
    const relayout = first || layoutSignature(next, minWidth) !== layout.signature
    if (relayout) {
      layout = buildLayout(next, minWidth)
      deskById = new Map(layout.desks.map((d) => [d.agentId, d]))
    }
    for (const id of [...actors.keys()]) if (!byId.has(id)) actors.delete(id)
    for (const p of people) {
      if (!actors.has(p.id)) {
        actors.set(p.id, {
          id: p.id,
          look: agentLook(p.id, p.role),
          x: layout.stairsX,
          y: feetY(deskById.get(p.id)?.floor ?? 0),
          visible: false,
          path: [],
          pose: 'absent',
          facing: 1,
          walking: false,
          stride: 0,
          target: null,
        })
      }
    }
    retarget(Date.now(), first || relayout)
  }

  // Works out every person's target; on a change they walk there (or jump with reduced motion).
  function retarget(now: number, snap: boolean) {
    const crowd = crowdOf(people, data.director.openBuilderIssues, now)
    for (const p of people) {
      const actor = actors.get(p.id)
      const desk = deskById.get(p.id)
      if (!actor || !desk) continue
      const t = targetFor(p, desk, layout, crowd)
      if (sameTarget(actor.target, t)) continue
      actor.target = t
      if (snap || reduced) {
        actor.x = t.x
        actor.y = feetY(t.floor)
        actor.path = []
        actor.walking = false
        actor.pose = t.pose
        actor.facing = t.facing
        actor.visible = t.pose !== 'absent'
        continue
      }
      if (!actor.visible) {
        if (t.pose === 'absent') continue
        // Arrives by the stairs of their own floor.
        actor.visible = true
        actor.x = layout.stairsX
        actor.y = feetY(t.floor)
      }
      actor.path = planPath({ x: actor.x, y: actor.y }, floorOfY(actor.y), t, layout.stairsX)
      actor.walking = true
    }
  }

  function step(dt: number) {
    for (const a of actors.values()) {
      if (!a.walking) continue
      let budget = dt
      while (budget > 0 && a.path.length) {
        const next = a.path[0]!
        const dx = next.x - a.x
        const dy = next.y - a.y
        if (dy !== 0) {
          const move = Math.min(Math.abs(dy), CLIMB_SPEED * budget)
          a.y += Math.sign(dy) * move
          budget -= move / CLIMB_SPEED
          a.stride += move
        } else if (dx !== 0) {
          const move = Math.min(Math.abs(dx), WALK_SPEED * budget)
          a.x += Math.sign(dx) * move
          a.facing = dx > 0 ? 1 : -1
          budget -= move / WALK_SPEED
          a.stride += move
        }
        if (Math.abs(next.x - a.x) < 0.01 && Math.abs(next.y - a.y) < 0.01) {
          a.x = next.x
          a.y = next.y
          a.path.shift()
        }
      }
      if (!a.path.length && a.target) {
        a.walking = false
        a.pose = a.target.pose
        a.facing = a.target.facing
        if (a.pose === 'absent') a.visible = false
      }
    }
  }

  // ---- Layers -------------------------------------------------------------------------------

  function ensureLayers(now: number) {
    const hour = localHour(now, data.tz || 'Asia/Tashkent')
    const c = data.tasks.counts
    const bk = [
      layout.signature,
      Math.round(hour * 10),
      data.director.openBuilderIssues,
      c.running, c.review, c.approval, c.blocked, c.done,
    ].join('|')
    if (bk !== backKey || !back) {
      back = makeCanvas(layout.width, layout.height)
      paintBack(context(back), layout, data, skyAt(hour))
      backKey = bk
    }
    const fk = `${layout.signature}|${data.director.pendingApprovals}`
    if (fk !== frontKey || !front) {
      front = makeCanvas(layout.width, layout.height)
      paintFront(context(front), layout, data)
      frontKey = fk
    }
  }

  // ---- Drawing ------------------------------------------------------------------------------

  // 0/1 alternating at `rate` changes per second; slow and steady with reduced motion.
  const beat = (now: number, rate: number, seed = 0) =>
    reduced ? (Math.floor(now / REDUCED_STEP_MS) + seed) % 2 : Math.floor(now / 1000 * rate + seed * 0.37) % 2
  const wave = (now: number, period: number) => (reduced ? 0 : Math.sin((now / period) * Math.PI * 2))

  function spriteFor(a: Actor, now: number): SpriteName {
    if (a.walking) return reduced ? 'stand' : Math.floor(a.stride / 4) % 2 ? 'walkA' : 'walkB'
    switch (a.pose) {
      case 'type':
        return beat(now, 5, hashId(a.id) % 7) ? 'typeA' : 'typeB'
      case 'sit':
        return 'sit'
      case 'sleep':
        return 'sleep'
      case 'hand':
        return 'hand'
      case 'coffee':
        return 'coffee'
      default:
        return 'stand'
    }
  }

  const seated = (a: Actor) => !a.walking && (a.pose === 'type' || a.pose === 'sit' || a.pose === 'sleep')

  function actorRect(a: Actor): Rect {
    const h = seated(a) ? SIT_H : STAND_H
    return { x: Math.round(a.x) - PERSON_W / 2, y: Math.round(a.y) - h, w: PERSON_W, h }
  }

  function drawActor(c: Ctx, a: Actor, now: number) {
    const name = spriteFor(a, now)
    const s = SPRITES[name]
    const r = actorRect(a)
    c.drawImage(sprite(name, s, a.look.palette, a.look.key, a.facing < 0), r.x, Math.round(a.y) - s.h)
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

  function drawBubble(c: Ctx, cx: number, bottom: number, fill: string, glyph: string, ink: string) {
    const tw = textWidth(glyph)
    const w = Math.max(7, tw + 4)
    const x = Math.round(cx - w / 2)
    const y = bottom - 9
    rect(c, x, y, w, 8, '#1a1626')
    rect(c, x + 1, y + 1, w - 2, 6, fill)
    rect(c, x + 1, y, w - 2, 1, '#1a1626')
    rect(c, x, y + 1, 1, 6, '#1a1626')
    rect(c, x + w - 1, y + 1, 1, 6, '#1a1626')
    rect(c, Math.round(cx), y + 8, 1, 1, '#1a1626')
    text(c, glyph, x + Math.floor((w - tw) / 2), y + 2, ink)
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
    if (a.walking) return r.y
    if (p.status === 'waiting') {
      drawBubble(c, cx + 1, r.y - 2 + bob, '#f4f1ea', '!', '#1a1626')
      return r.y - 11
    }
    if (p.status === 'blocked') {
      drawBubble(c, cx, r.y - 1 + bob, COLORS.red, 'X', '#f4f1ea')
      return r.y - 10
    }
    if (p.status === 'sleeping') {
      for (let i = 0; i < 3; i++) {
        const phase = reduced ? i / 3 : ((now / 2600 + i / 3) % 1)
        c.globalAlpha = 1 - phase * 0.8
        text(c, 'Z', cx + 4 + Math.round(phase * 8), r.y + 2 - Math.round(phase * 14), '#dfe6ff')
      }
      c.globalAlpha = 1
      return r.y - 10
    }
    if (a.pose === 'coffee') {
      const cupX = a.facing > 0 ? r.x + 9 : r.x + 1
      const phase = reduced ? 0 : (now / 1200) % 1
      c.globalAlpha = 0.6 * (1 - phase)
      rect(c, cupX + (Math.floor(now / 400) % 2), r.y + 6 - Math.round(phase * 4), 1, 1, '#e8e8e8')
      c.globalAlpha = 1
    }
    if (a.pose === 'chat' && beat(now, 1, hashId(a.id) % 3)) {
      drawBubble(c, cx + 2, r.y - 1, '#f4f1ea', '...', '#1a1626')
      return r.y - 10
    }
    return r.y
  }

  function drawRooms(c: Ctx, now: number, quiet: boolean) {
    const statusOf = (id: string) => byId.get(id)?.status
    for (const room of layout.rooms) {
      // Sign glows while someone in the room waits for the owner.
      const waiting = room.agentIds.some((id) => statusOf(id) === 'waiting')
      if (waiting) {
        const s = signRect(room)
        c.globalAlpha = reduced ? 0.8 : 0.55 + 0.35 * (0.5 + 0.5 * wave(now, 2400))
        c.strokeStyle = COLORS.lime
        c.lineWidth = 1
        c.strokeRect(s.x - 0.5, s.y - 0.5, s.w + 1, s.h + 1)
        c.globalAlpha = 1
      }
      const light = room.kind === 'dept' || room.kind === 'director' ? roomLight(room, statusOf, quiet) : quiet ? 'dim' : 'on'
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
      const status = product?.status
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

  function draw(now: number) {
    ensureLayers(now)
    const c = ctx
    c.setTransform(k, 0, 0, k, 0, 0)
    c.imageSmoothingEnabled = false
    c.clearRect(0, 0, layout.width, layout.height)
    if (back) c.drawImage(back, 0, 0)

    // Antenna light.
    if (beat(now, 0.8)) rect(c, layout.width - 6 - 12, ROOF_H - 16, 1, 1, COLORS.red)

    const list = [...actors.values()].filter((a) => a.visible)
    for (const a of list) if (seated(a)) drawActor(c, a, now)
    if (front) c.drawImage(front, 0, 0)
    for (const desk of layout.desks) drawScreen(c, desk, byId.get(desk.agentId)?.status, now)
    drawProducts(c, now)
    drawTerminal(c, now)
    const standing = list.filter((a) => !seated(a)).sort((a, b) => a.y - b.y || a.x - b.x)
    for (const a of standing) drawActor(c, a, now)

    drawRooms(c, now, data.quietHours)

    for (const a of list) {
      const p = byId.get(a.id)
      if (!p) continue
      const top = drawStatusMarks(c, a, p, now)
      if (sameHit(hover, { kind: 'agent', id: a.id }) || sameHit(selected, { kind: 'agent', id: a.id })) drawArrow(c, a.x, top - 1, now)
    }
    for (const t of [hover, selected]) {
      if (!t) continue
      if (t.kind === 'agent' && actors.get(t.id)?.visible) continue
      const r = anchorOf(t)
      if (r) drawArrow(c, r.x + r.w / 2, r.y - 1, now)
    }
  }

  // ---- Loop ---------------------------------------------------------------------------------

  let lastRetarget = 0

  function frame(t: number) {
    raf = 0
    if (destroyed) return
    const now = Date.now()
    if (reduced) {
      if (t - lastStep >= REDUCED_STEP_MS) {
        lastStep = t
        retarget(now, false)
        draw(now)
      }
    } else {
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0
      if (now - lastRetarget > 500) {
        lastRetarget = now
        retarget(now, false)
      }
      step(dt)
      draw(now)
    }
    last = t
    schedule()
  }

  function schedule() {
    if (!raf && !destroyed && !paused && !document.hidden) raf = requestAnimationFrame(frame)
  }

  function onVisibility() {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    } else {
      last = 0
      schedule()
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
    if (target.kind === 'product') {
      const rack = layout.racks.find((r) => r.productId === target.id)
      return rack ? rackRect(rack) : null
    }
    const room = layout.rooms.find((r) => r.kind === 'builders')
    if (!room) return null
    const s = terminalScreen(room)
    return { x: s.x - 2, y: s.y - 2, w: s.w + 4, h: feetY(room.floor) - s.y + 2 }
  }

  function hitTest(x: number, y: number): HitTarget | null {
    const visible = [...actors.values()].filter((a) => a.visible).sort((a, b) => b.y - a.y)
    for (const a of visible) if (within(actorRect(a), x, y)) return { kind: 'agent', id: a.id }
    for (const desk of layout.desks) {
      if (within(deskRect(desk), x, y)) return { kind: 'agent', id: desk.agentId }
    }
    for (const rack of layout.racks) if (within(rackRect(rack), x, y)) return { kind: 'product', id: rack.productId }
    const b = anchorOf({ kind: 'builders' })
    if (b && within(b, x, y)) return { kind: 'builders' }
    return null
  }

  function resize(scale: number) {
    cssScale = scale
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    k = Math.max(1, Math.round(cssScale * dpr))
    canvas.width = layout.width * k
    canvas.height = layout.height * k
    canvas.style.width = `${layout.width * cssScale}px`
    canvas.style.height = `${layout.height * cssScale}px`
    draw(Date.now())
  }

  apply(initial, true)
  resize(cssScale)
  schedule()

  return {
    setData(next) {
      const before = layout.signature
      apply(next, false)
      if (layout.signature !== before) resize(cssScale)
      else if (reduced || document.hidden) draw(Date.now())
    },
    setReducedMotion(on) {
      reduced = on
      if (on) {
        for (const a of actors.values()) a.target = null
        retarget(Date.now(), true)
      }
      draw(Date.now())
    },
    setHover(t) {
      hover = t
    },
    setSelected(t) {
      selected = t
      if (reduced) draw(Date.now())
    },
    hitTest,
    anchorOf,
    size: () => ({ width: layout.width, height: layout.height }),
    resize,
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
        if (raf) cancelAnimationFrame(raf)
        raf = 0
      } else {
        last = 0
        schedule()
      }
    },
    destroy() {
      destroyed = true
      if (raf) cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibility)
    },
  }
}
