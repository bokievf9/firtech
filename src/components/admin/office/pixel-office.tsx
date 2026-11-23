'use client'

import { CornersIn, CornersOut, Lightning, MagnifyingGlassMinus, MagnifyingGlassPlus, SealCheck, Tag, WarningCircle } from '@phosphor-icons/react'
import { deptLabel } from '@/lib/admin-labels'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { deptTheme } from '@/lib/shell-theme'
import type { PanelId } from '@/lib/shell'
import { weatherMock } from '@/lib/office-mock'
import { formatDuration, minutesSince, normalizeScene, type OfficeData } from '@/lib/office-view'
import { looksLikeWeather, type OfficeWeather, WEATHER_KINDS, type WeatherKind } from '@/lib/office-weather'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { fitZoom, ZOOM_MAX, ZOOM_MIN } from '@/components/pixel-office/camera'
import { formatTemp } from '@/components/pixel-office/environment'
import { officePeople } from '@/components/pixel-office/model'
import { createScene, type HitTarget, type Scene } from '@/components/pixel-office/scene'

const t = admin.office
const WEATHER_POLL = 10 * 60_000
// Wheel delta that makes one zoom step (a mouse notch is about 100; trackpads send many small ones).
const WHEEL_STEP = 60
const PAN_KEY = 40

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))

const deptName = (id: string, fallback: string) => (t.depts as Record<string, string>)[id] ?? fallback

export const sameTarget = (a: HitTarget | null, b: HitTarget | null) =>
  a === b ||
  (!!a && !!b && a.kind === b.kind && ('id' in a ? a.id : '') === ('id' in b ? (b as { id: string }).id : ''))

type Hover = { target: HitTarget; left: number; top: number }

export type OfficePeople = { nowOf: (id: string) => string | undefined; onPerson: (id: string) => void }

// Пульт v3: rooms as clickable zones with counters over them and a lamp glow on their desks.
export type ZoneBadge = { approvals: number; alerts: number; running: number }
export type OfficeZones = {
  // Room id (layout.ts) -> 0 calm, 0.5 work queued, 1 something waits for the owner.
  glow: Record<string, number>
  badges: Record<string, ZoneBadge | undefined>
  // Room id -> the department panel it opens (its colour tints the lamp, the hover frame and the badge).
  depts: Record<string, PanelId | undefined>
  // Name shown on hover; rooms without a name are not zones.
  names: Record<string, string | undefined>
  onZone: (roomId: string) => void
}

// CSS colour of each zone's department (the fill is the same in both themes), for the canvas.
function zoneColors(zones: OfficeZones | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!zones || typeof document === 'undefined') return out
  const style = getComputedStyle(document.documentElement)
  for (const [room, id] of Object.entries(zones.depts)) {
    const v = id ? style.getPropertyValue(deptTheme(id).vars.fill).trim() : ''
    if (v) out[room] = v
  }
  return out
}

// The department colour of a zone as a CSS variable the badge / bubble shadow reads.
const hueVar = (id: PanelId | undefined): React.CSSProperties => (id ? ({ '--zone-hue': deptTheme(id).css.fill } as React.CSSProperties) : {})

type Info = { title: string; rows: [string, string][]; status?: string }

// Dev switches: ?office=rain,night,stats (any of the weather kinds, night or day, stats).
type Flags = { weather: WeatherKind | null; hour: number | null; stats: boolean }

const subscribeNever = () => () => {}
const flagsRaw = () => new URLSearchParams(window.location.search).get('office') ?? ''

function parseFlags(raw: string): Flags {
  const parts = raw.split(',').map((s) => s.trim().toLowerCase())
  const weather = (parts.find((p) => (WEATHER_KINDS as readonly string[]).includes(p)) as WeatherKind | undefined) ?? null
  const hour = parts.includes('night') ? 1.5 : parts.includes('day') ? 13 : null
  return { weather, hour, stats: parts.includes('stats') }
}

function describe(data: OfficeData, target: HitTarget, now: number): Info | null {
  if (target.kind === 'builders') {
    return { title: t.scene.builders, rows: [[t.strip.issues, String(data.director.openBuilderIssues)]] }
  }
  if (target.kind === 'product') {
    const p = data.products.find((x) => x.id === target.id)
    if (target.id === 'firtech.pro') return { title: 'firtech.pro', rows: [[t.strip.uptime, `${data.health.firtech.pct24h}%`]] }
    return p ? { title: p.title, status: p.status, rows: [[t.scene.dept, t.scene.product]] } : null
  }
  if (target.kind === 'room') return null
  const scene = data.scene ? normalizeScene(data.scene) : null
  if (target.kind === 'reception') {
    const rows: [string, string][] = [[t.scene.chatsNow, String(data.visitorsActive ?? scene?.visitors.length ?? 0)]]
    if (scene?.visitorsTotalToday) rows.push([t.scene.chatsToday, String(scene.visitorsTotalToday)])
    return { title: t.scene.reception, rows }
  }
  if (target.kind === 'visitor') {
    const v = scene?.visitors.find((x) => x.id === target.id)
    if (!v) return { title: t.scene.visitor, rows: [] }
    const rows: [string, string][] = [
      [t.scene.channel, t.scene.channels[v.channel]],
      [t.scene.state, t.scene.states[v.state]],
    ]
    const m = minutesSince(v.since, now)
    if (m !== null) rows.push([t.scene.inChat, formatDuration(m)])
    return { title: t.scene.visitor, rows }
  }
  const person = officePeople(data).find((p) => p.id === target.id)
  if (!person) return null
  // Hover shows the name (HQ's English role title) and the department, nothing to act on.
  return {
    title: person.role === 'head' ? `${person.title} · ${t.head.toLowerCase()}` : person.title,
    status: person.status,
    rows: [[t.scene.dept, person.role === 'director' ? t.scene.director : deptName(person.deptId, deptLabel(person.deptTitle))]],
  }
}

const toolButton =
  'grid size-9 place-items-center rounded-full text-fg transition-colors hover:bg-surface-3 disabled:opacity-40 aria-pressed:bg-accent aria-pressed:text-accent-ink'

// The canvas scene with its camera controls, a hover bubble and a small details card. React
// renders only when the hover target, the selection, the data or a control change; the scene
// animates and moves its camera on its own (overlays follow through onView, without React).
export function PixelOffice({
  data,
  now,
  zones,
  people: team,
  fill: fillBox = false,
}: {
  data: OfficeData
  now: number
  zones?: OfficeZones
  // Team (2026-11-24): the short `now` phrase of an employee (hover) and where a click on a person goes.
  people?: OfficePeople
  // Fill the parent box (the hub) instead of sizing to the building.
  fill?: boolean
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const latest = useRef(data)
  const reduced = useReducedMotion()
  const reducedRef = useRef(reduced)
  const [hover, setHover] = useState<Hover | null>(null)
  const [zoom, setZoom] = useState(3)
  const [names, setNames] = useState(false)
  const [full, setFull] = useState(false)
  const [fetched, setFetched] = useState<OfficeWeather | null>(null)
  const raw = useSyncExternalStore(subscribeNever, flagsRaw, () => '')
  const flags = useMemo(() => parseFlags(raw), [raw])
  const flagsRef = useRef(flags)
  const weather = useMemo(() => (flags.weather ? weatherMock(flags.weather) : fetched), [flags.weather, fetched])
  const zonesRef = useRef(zones)
  useLayoutEffect(() => {
    flagsRef.current = flags
    zonesRef.current = zones
  })

  // Counters over the rooms follow the camera without React: each badge is moved to the top
  // centre of its room's interior.
  const placeBadges = useCallback(() => {
    const scene = sceneRef.current
    const wrap = wrapRef.current
    if (!scene || !wrap) return
    for (const el of wrap.querySelectorAll<HTMLElement>('[data-zone-badge]')) {
      const r = scene.zoneRect(el.dataset.zoneBadge ?? '')
      if (!r) {
        el.style.display = 'none'
        continue
      }
      const v = scene.toView(r)
      const x = v.x + v.w / 2
      const y = v.y + 4
      const off = x < 0 || x > wrap.clientWidth || y < -10 || y > wrap.clientHeight
      el.style.display = off ? 'none' : ''
      el.style.left = `${Math.round(x)}px`
      el.style.top = `${Math.round(Math.max(4, y))}px`
    }
  }, [])

  // Viewport: the box width; the height fits the building at the fit zoom (the whole screen in
  // fullscreen).
  const measure = useCallback(() => {
    const scene = sceneRef.current
    const wrap = wrapRef.current
    if (!scene || !wrap) return
    const { width, height } = scene.size()
    const fs = document.fullscreenElement === wrap
    const w = wrap.clientWidth
    if (fillBox) {
      scene.setViewport(w, Math.max(200, wrap.clientHeight))
      return
    }
    const z = fitZoom({ w, h: 0 }, { w: width, h: height })
    const h = fs ? window.innerHeight : Math.min(Math.max(300, Math.round(window.innerHeight * 0.85)), height * z)
    if (!fs) wrap.style.height = `${h}px`
    else wrap.style.height = ''
    scene.setViewport(w, h)
  }, [fillBox])

  const onViewChange = useCallback(() => {
    const scene = sceneRef.current
    const wrap = wrapRef.current
    if (!scene || !wrap) return
    const cam = scene.camera()
    setZoom(cam.zoom)
    placeBadges()
    if (bubbleRef.current) bubbleRef.current.style.display = 'none'
    const { width, height } = scene.size()
    // One finger pans the office only when there is somewhere to pan to vertically; otherwise
    // vertical swipes scroll the page.
    wrap.style.touchAction = height * cam.zoom > wrap.clientHeight + 1 ? 'none' : 'pan-y'
    void width
  }, [placeBadges])

  useEffect(() => {
    latest.current = data
    sceneRef.current?.setData(data)
    measure()
  }, [data, measure])

  useEffect(() => {
    reducedRef.current = reduced
    sceneRef.current?.setReducedMotion(reduced)
  }, [reduced])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const f = flagsRef.current
    const scene = createScene(canvas, latest.current, { reducedMotion: reducedRef.current, stats: f.stats })
    sceneRef.current = scene
    if (zonesRef.current) {
      scene.setZoneHits(true)
      scene.setZoneGlow(zonesRef.current.glow, zoneColors(zonesRef.current))
    }
    scene.onView(onViewChange)
    if (f.hour !== null) scene.setHour(f.hour)
    measure()
    onViewChange()
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __office?: Scene }).__office = scene
    const ro = new ResizeObserver(() => measure())
    ro.observe(wrap)
    const onFs = () => {
      setFull(document.fullscreenElement === wrap)
      requestAnimationFrame(() => {
        measure()
        scene.resetView()
      })
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      ro.disconnect()
      document.removeEventListener('fullscreenchange', onFs)
      scene.destroy()
      sceneRef.current = null
    }
  }, [measure, onViewChange])

  // Weather for Dushanbe every 10 minutes (the dev switch skips the call).
  useEffect(() => {
    if (flags.weather) return
    let alive = true
    const load = async () => {
      try {
        const res = await fetch('/api/office/weather', { cache: 'no-store' })
        const body: unknown = await res.json()
        if (alive && looksLikeWeather(body)) setFetched(body)
      } catch {
        // Fail soft: the office keeps its last (or clear) weather.
      }
    }
    void load()
    const id = setInterval(load, WEATHER_POLL)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [flags.weather])

  useEffect(() => {
    sceneRef.current?.setStats(flags.stats)
    if (flags.hour !== null) sceneRef.current?.setHour(flags.hour)
  }, [flags])

  useEffect(() => {
    if (weather) sceneRef.current?.setWeather({ kind: weather.kind, tempC: weather.tempC })
  }, [weather])

  useEffect(() => {
    sceneRef.current?.setNameTags(names)
  }, [names])

  const zoneOn = !!zones
  const glow = zones?.glow
  const deptMap = zones?.depts
  useEffect(() => {
    sceneRef.current?.setZoneHits(zoneOn)
  }, [zoneOn])
  useEffect(() => {
    sceneRef.current?.setZoneGlow(glow ?? {}, zoneColors(zonesRef.current))
  }, [glow, deptMap])
  useLayoutEffect(() => {
    placeBadges()
  })

  // ---- Camera input ---------------------------------------------------------------------------

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const drag = useRef<{ x: number; y: number; moved: boolean; pinch: number | null }>({ x: 0, y: 0, moved: false, pinch: null })
  const suppressClick = useRef(false)
  const wheelAcc = useRef(0)

  const local = (e: { clientX: number; clientY: number }) => {
    const box = wrapRef.current!.getBoundingClientRect()
    return { x: e.clientX - box.left, y: e.clientY - box.top }
  }

  const zoomStep = useCallback((dir: 1 | -1, px?: number, py?: number) => {
    const scene = sceneRef.current
    const wrap = wrapRef.current
    if (!scene || !wrap) return false
    const cam = scene.camera()
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cam.zoom + dir))
    if (next === cam.zoom) return false
    scene.zoomAt(next, px ?? wrap.clientWidth / 2, py ?? wrap.clientHeight / 2)
    return true
  }, [])

  // Wheel zoom around the cursor; at the zoom limits the wheel scrolls the page as usual.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const onWheel = (e: WheelEvent) => {
      const scene = sceneRef.current
      if (!scene) return
      const cam = scene.camera()
      const dir = e.deltaY < 0 ? 1 : -1
      if ((dir > 0 && cam.zoom >= ZOOM_MAX) || (dir < 0 && cam.zoom <= ZOOM_MIN)) return
      e.preventDefault()
      wheelAcc.current += e.deltaY * (e.ctrlKey ? 3 : 1)
      if (Math.abs(wheelAcc.current) < WHEEL_STEP) return
      wheelAcc.current = 0
      const p = local(e)
      zoomStep(dir, p.x, p.y)
    }
    wrap.addEventListener('wheel', onWheel, { passive: false })
    return () => wrap.removeEventListener('wheel', onWheel)
  }, [zoomStep])

  const hitAt = (e: { clientX: number; clientY: number }) => {
    const scene = sceneRef.current
    if (!scene) return null
    const p = local(e)
    const w = scene.toWorld(p.x, p.y)
    return scene.hitTest(w.x, w.y)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-office-ui]')) return
    pointers.current.set(e.pointerId, local(e))
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = local(e)
    drag.current = { x: p.x, y: p.y, moved: false, pinch: null }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      drag.current.pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y)
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const scene = sceneRef.current
    if (!scene) return
    if (pointers.current.has(e.pointerId)) {
      const p = local(e)
      pointers.current.set(e.pointerId, p)
      if (pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()]
        const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y)
        const start = drag.current.pinch ?? dist
        const mid = { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 }
        if (dist / start > 1.25 && zoomStep(1, mid.x, mid.y)) drag.current.pinch = dist
        else if (dist / start < 0.8 && zoomStep(-1, mid.x, mid.y)) drag.current.pinch = dist
        drag.current.moved = true
        return
      }
      const dx = p.x - drag.current.x
      const dy = p.y - drag.current.y
      if (!drag.current.moved && Math.hypot(dx, dy) < 4) return
      drag.current.moved = true
      drag.current.x = p.x
      drag.current.y = p.y
      scene.panBy(dx, dy)
      return
    }
    if (e.pointerType === 'touch') return
    const hit = hitAt(e)
    if (sameTarget(hit, hover?.target ?? null)) return
    scene.setHover(hit)
    if (hit?.kind === 'room' && zones?.names[hit.id]) {
      const zr = scene.zoneRect(hit.id)
      const r = zr ? scene.toView(zr) : null
      setHover(r ? { target: hit, left: r.x + r.w / 2, top: r.y + 26 } : null)
      return
    }
    if (!hit || hit.kind === 'room') {
      setHover(hit ? { target: hit, left: -999, top: -999 } : null)
      return
    }
    const anchor = scene.anchorOf(hit)
    const r = anchor ? scene.toView(anchor) : null
    setHover(r ? { target: hit, left: r.x + r.w / 2, top: r.y - 10 } : null)
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.delete(e.pointerId)
    if (drag.current.moved) suppressClick.current = true
    if (pointers.current.size === 0) drag.current.pinch = null
  }

  const onPointerLeave = () => {
    sceneRef.current?.setHover(null)
    setHover(null)
  }

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-office-ui]')) return
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    const hit = hitAt(e)
    if (team && hit?.kind === 'agent') {
      team.onPerson(hit.id)
      return
    }
    if (zones && hit && (hit.kind === 'room' || hit.kind === 'reception' || hit.kind === 'builders')) {
      const room = hit.kind === 'room' ? hit.id : hit.kind === 'reception' ? 'lobby' : 'builders'
      if (zones.names[room]) {
        zones.onZone(room)
      }
    }
  }

  const toggleFull = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void wrap.requestFullscreen?.().catch(() => {})
  }, [])

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const scene = sceneRef.current
    if (!scene || (e.target as HTMLElement).closest('[data-office-ui]')) return
    const key = e.key
    if (key === '+' || key === '=') zoomStep(1)
    else if (key === '-' || key === '_') zoomStep(-1)
    else if (key === '0') scene.resetView()
    else if (key === 'ArrowLeft') scene.panBy(PAN_KEY, 0)
    else if (key === 'ArrowRight') scene.panBy(-PAN_KEY, 0)
    else if (key === 'ArrowUp') scene.panBy(0, PAN_KEY)
    else if (key === 'ArrowDown') scene.panBy(0, -PAN_KEY)
    else if (key === 'f' || key === 'F' || key === 'а' || key === 'А') toggleFull() // i18n-ok: Russian keyboard layout
    else return
    e.preventDefault()
  }

  const people = useMemo(() => officePeople(data), [data])
  const count = (s: string) => people.filter((p) => p.status === s).length
  const label = fill(t.scene.label, {
    n: people.length,
    working: count('working'),
    waiting: count('waiting'),
    blocked: count('blocked'),
  })

  const zoneHover = hover?.target.kind === 'room' ? (zones?.names[hover.target.id] ?? null) : null
  const zoneHoverBadge = hover?.target.kind === 'room' ? zones?.badges[hover.target.id] : undefined
  const hoverInfo = hover && hover.target.kind !== 'room' ? describe(data, hover.target, now) : null
  const statusText = (s?: string) => (s ? ((t.status as Record<string, string>)[s] ?? s) : '')

  const bubbleText = (() => {
    if (zoneHover) {
      const b = zoneHoverBadge
      const parts = b
        ? [
            b.approvals ? fill(t.zones.approvals, { n: b.approvals }) : '',
            b.alerts ? fill(t.zones.alerts, { n: b.alerts }) : '',
            b.running ? fill(t.zones.running, { n: b.running }) : '',
          ].filter(Boolean)
        : []
      const deptId = hover?.target.kind === 'room' ? zones?.depts[hover.target.id] : undefined
      return { title: zoneHover, line: parts.length ? parts.join(' · ') : t.zones.open, dept: deptId }
    }
    if (!hover || !hoverInfo) return null
    if (hover.target.kind === 'agent') return { title: hoverInfo.title, line: team?.nowOf(hover.target.id) ?? hoverInfo.rows[0]?.[1] ?? '', dept: undefined }
    return { title: hoverInfo.title, line: hoverInfo.status ? statusText(hoverInfo.status) : (hoverInfo.rows[0]?.join(': ') ?? ''), dept: undefined }
  })()

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      role="group"
      aria-label={`${label}. ${t.scene.controls}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
      onClick={onClick}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-office-ui]')) return
        sceneRef.current?.resetView()
      }}
      onKeyDown={onKeyDown}
      className={cn(
        'office-scene relative min-w-0 max-w-full select-none overflow-hidden rounded-card border border-line bg-office-night outline-none focus-visible:ring-2 focus-visible:ring-accent',
        (full || fillBox) && 'rounded-none border-0',
        fillBox && 'h-full',
      )}
      style={{ cursor: hover && hover.target.kind !== 'room' ? 'pointer' : hover ? 'pointer' : 'grab' }}
    >
      <canvas ref={canvasRef} role="img" aria-label={label} className="block [image-rendering:pixelated]" />

      {zones
        ? Object.entries(zones.names).map(([room, name]) => {
            const b = zones.badges[room]
            if (!name || !b || b.approvals + b.alerts + b.running === 0) return null
            return (
              <button
                key={room}
                type="button"
                data-office-ui
                data-zone-badge={room}
                onClick={() => zones.onZone(room)}
                aria-label={`${name}: ${[
                  b.approvals ? fill(t.zones.approvals, { n: b.approvals }) : '',
                  b.alerts ? fill(t.zones.alerts, { n: b.alerts }) : '',
                  b.running ? fill(t.zones.running, { n: b.running }) : '',
                ]
                  .filter(Boolean)
                  .join(', ')}`}
                data-dept={zones.depts[room]}
                className="absolute z-10 flex -translate-x-1/2 items-center gap-1 border-2 border-paper-ink bg-paper px-1.5 py-0.5 font-mono text-[11px] leading-none text-paper-ink shadow-[2px_2px_0_var(--zone-hue,var(--color-paper-ink))] transition-transform hover:-translate-y-0.5"
                style={{ display: 'none', ...hueVar(zones.depts[room]) }}
              >
                {b.approvals ? (
                  <span className="inline-flex items-center gap-0.5 text-paper-amber">
                    <SealCheck size={11} weight="fill" aria-hidden="true" />
                    {b.approvals}
                  </span>
                ) : null}
                {b.alerts ? (
                  <span className="inline-flex items-center gap-0.5 text-paper-red">
                    <WarningCircle size={11} weight="fill" aria-hidden="true" />
                    {b.alerts}
                  </span>
                ) : null}
                {b.running ? (
                  <span className="inline-flex items-center gap-0.5 text-paper-green">
                    <Lightning size={11} weight="fill" aria-hidden="true" />
                    {b.running}
                  </span>
                ) : null}
              </button>
            )
          })
        : null}

      <div
        data-office-ui
        className="absolute right-2 top-2 z-30 flex items-center gap-0.5 rounded-full border border-line bg-surface/90 p-0.5 text-fg shadow-sm backdrop-blur"
      >
        <button type="button" className={toolButton} onClick={() => zoomStep(-1)} disabled={zoom <= ZOOM_MIN} aria-label={t.scene.zoomOut} title={t.scene.zoomOut}>
          <MagnifyingGlassMinus size={16} aria-hidden="true" />
        </button>
        <span className="min-w-8 text-center font-mono text-xs tabular-nums text-muted" aria-live="polite" title={fill(t.scene.zoom, { z: zoom })}>
          {zoom}x
        </span>
        <button type="button" className={toolButton} onClick={() => zoomStep(1)} disabled={zoom >= ZOOM_MAX} aria-label={t.scene.zoomIn} title={t.scene.zoomIn}>
          <MagnifyingGlassPlus size={16} aria-hidden="true" />
        </button>
        <button type="button" className={toolButton} onClick={() => setNames((v) => !v)} aria-pressed={names} aria-label={t.scene.names} title={t.scene.names}>
          <Tag size={16} aria-hidden="true" />
        </button>
        <button type="button" className={toolButton} onClick={toggleFull} aria-label={full ? t.scene.exitFullscreen : t.scene.fullscreen} title={full ? t.scene.exitFullscreen : t.scene.fullscreen}>
          {full ? <CornersIn size={16} aria-hidden="true" /> : <CornersOut size={16} aria-hidden="true" />}
        </button>
      </div>

      {weather?.tempC !== null && weather?.tempC !== undefined ? (
        <p className="pointer-events-none absolute bottom-2 right-2 z-20 rounded-full border border-line bg-surface/85 px-2.5 py-0.5 font-mono text-[11px] text-fg backdrop-blur" title={t.scene.weather}>
          {formatTemp(weather.tempC)} · Dushanbe
        </p>
      ) : null}

      {bubbleText && hover ? (
        <div
          ref={bubbleRef}
          aria-hidden="true"
          data-office-bubble
          data-dept={bubbleText.dept}
          className="office-bubble pointer-events-none absolute z-10 max-w-60 -translate-x-1/2 -translate-y-full border-2 border-paper-ink bg-paper px-2 py-1 font-mono text-[11px] leading-tight text-paper-ink shadow-[3px_3px_0_var(--zone-hue,var(--color-paper-ink))]"
          style={{ left: hover.left, top: hover.top, ...hueVar(bubbleText.dept) }}
        >
          <p className="font-semibold">{bubbleText.title}</p>
          {bubbleText.line ? <p className="mt-0.5">{bubbleText.line}</p> : null}
        </div>
      ) : null}

    </div>
  )
}
