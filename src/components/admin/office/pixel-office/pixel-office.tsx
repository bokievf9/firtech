'use client'

import { X } from '@phosphor-icons/react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { admin } from '@/content/admin'
import { formatDuration, minutesSince, type OfficeData } from '@/lib/office-view'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { officePeople } from './model'
import { createScene, type HitTarget, type Scene } from './scene'

const t = admin.office
const MIN_SCALE = 2
const MAX_SCALE = 4

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))

const deptName = (id: string, fallback: string) => (t.depts as Record<string, string>)[id] ?? fallback

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export const sameTarget = (a: HitTarget | null, b: HitTarget | null) =>
  a === b ||
  (!!a && !!b && a.kind === b.kind && (a.kind === 'builders' || ('id' in a && 'id' in b && a.id === b.id)))

type Hover = { target: HitTarget; left: number; top: number }

type Info = { title: string; rows: [string, string][]; status?: string }

function describe(data: OfficeData, target: HitTarget, now: number): Info | null {
  if (target.kind === 'builders') {
    return { title: t.scene.builders, rows: [[t.strip.issues, String(data.director.openBuilderIssues)]] }
  }
  if (target.kind === 'product') {
    const p = data.products.find((x) => x.id === target.id)
    return p ? { title: p.title, status: p.status, rows: [[t.scene.dept, t.scene.product]] } : null
  }
  const person = officePeople(data).find((p) => p.id === target.id)
  if (!person) return null
  const rows: [string, string][] = [
    [t.scene.dept, person.role === 'director' ? t.scene.director : deptName(person.deptId, person.deptTitle)],
  ]
  const task = person.agent.currentTask
  rows.push([t.scene.task, task ? task.title : t.noTask])
  if (task) {
    const m = minutesSince(task.since, now)
    if (m !== null) rows.push(['', fill(t.since, { t: formatDuration(m) })])
  }
  if (person.agent.tasksToday !== undefined) rows.push([t.scene.tasksToday, String(person.agent.tasksToday)])
  const last = minutesSince(person.agent.lastActiveAt, now)
  if (last !== null) rows.push([t.scene.lastActive, fill(t.scene.ago, { t: formatDuration(last) })])
  return {
    title: person.role === 'head' ? `${person.title} · ${t.head.toLowerCase()}` : person.title,
    status: person.status,
    rows,
  }
}

// The canvas scene plus a hover bubble and a small details panel. React renders only when the
// hover target, the selection or the data change; the scene animates on its own.
export function PixelOffice({
  data,
  now,
  selected,
  onSelect,
}: {
  data: OfficeData
  now: number
  selected: HitTarget | null
  onSelect: (target: HitTarget | null) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const scaleRef = useRef(3)
  const latest = useRef(data)
  const reduced = useReducedMotion()
  const reducedRef = useRef(reduced)
  const [hover, setHover] = useState<Hover | null>(null)

  // Integer CSS scale that fits the box (2 to 4); narrower boxes scroll the scene sideways.
  const fit = useCallback(() => {
    const scene = sceneRef.current
    const wrap = wrapRef.current
    if (!scene || !wrap) return
    const { width } = scene.size()
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.floor(wrap.clientWidth / width)))
    if (next !== scaleRef.current) {
      scaleRef.current = next
      scene.resize(next)
    }
  }, [])

  useEffect(() => {
    latest.current = data
    sceneRef.current?.setData(data)
    fit()
  }, [data, fit])

  useEffect(() => {
    reducedRef.current = reduced
    sceneRef.current?.setReducedMotion(reduced)
  }, [reduced])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const scene = createScene(canvas, latest.current, { reducedMotion: reducedRef.current })
    sceneRef.current = scene
    scaleRef.current = 0
    fit()
    const ro = new ResizeObserver(() => fit())
    ro.observe(wrap)
    return () => {
      ro.disconnect()
      scene.destroy()
      sceneRef.current = null
    }
  }, [fit])

  useEffect(() => {
    sceneRef.current?.setSelected(selected)
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSelect(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, onSelect])

  // Places the panel next to the selected person (or desk, rack, terminal) inside the scene.
  useLayoutEffect(() => {
    const scene = sceneRef.current
    const panel = panelRef.current
    if (!scene || !panel || !selected) return
    const r = scene.anchorOf(selected)
    if (!r) return
    const s = scaleRef.current
    const { width, height } = scene.size()
    const w = panel.offsetWidth
    const h = panel.offsetHeight
    const left = Math.min(Math.max(8, (r.x + r.w / 2) * s - w / 2), width * s - w - 8)
    const below = (r.y + r.h) * s + 10
    const top = below + h <= height * s - 4 ? below : Math.max(4, r.y * s - h - 10)
    panel.style.left = `${Math.round(left)}px`
    panel.style.top = `${Math.round(top)}px`
    panel.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  }, [selected, data, reduced])

  const toLogical = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const s = scaleRef.current
    return { x: (e.clientX - box.left) / s, y: (e.clientY - box.top) / s }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const scene = sceneRef.current
    if (!scene || e.pointerType === 'touch') return
    const p = toLogical(e)
    const hit = scene.hitTest(p.x, p.y)
    if (sameTarget(hit, hover?.target ?? null)) return
    scene.setHover(hit)
    if (!hit) {
      setHover(null)
      return
    }
    const r = scene.anchorOf(hit)
    const s = scaleRef.current
    setHover(r ? { target: hit, left: (r.x + r.w / 2) * s, top: r.y * s - 14 } : null)
  }

  const onPointerLeave = () => {
    sceneRef.current?.setHover(null)
    setHover(null)
  }

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const scene = sceneRef.current
    if (!scene) return
    const box = e.currentTarget.getBoundingClientRect()
    const s = scaleRef.current
    const hit = scene.hitTest((e.clientX - box.left) / s, (e.clientY - box.top) / s)
    onSelect(sameTarget(hit, selected) ? null : hit)
  }

  const people = useMemo(() => officePeople(data), [data])
  const count = (s: string) => people.filter((p) => p.status === s).length
  const label = fill(t.scene.label, {
    n: people.length,
    working: count('working'),
    waiting: count('waiting'),
    blocked: count('blocked'),
  })

  const hoverInfo = hover && !sameTarget(hover.target, selected) ? describe(data, hover.target, now) : null
  const selectedInfo = selected ? describe(data, selected, now) : null
  const statusText = (s?: string) => (s ? ((t.status as Record<string, string>)[s] ?? s) : '')

  const bubbleText = (() => {
    if (!hover || !hoverInfo) return null
    if (hover.target.kind === 'agent') {
      const id = hover.target.id
      const task = people.find((p) => p.id === id)?.agent.currentTask
      return { title: hoverInfo.title, line: task ? truncate(task.title, 42) : statusText(hoverInfo.status) }
    }
    return { title: hoverInfo.title, line: hoverInfo.status ? statusText(hoverInfo.status) : (hoverInfo.rows[0]?.join(': ') ?? '') }
  })()

  return (
    <div
      ref={wrapRef}
      className="office-scene min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-card border border-line bg-[#0b1030]"
    >
      <div className="relative w-max">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          onClick={onClick}
          className="block [image-rendering:pixelated]"
          style={{ cursor: hover ? 'pointer' : 'default' }}
        />

        {bubbleText && hover ? (
          <div
            aria-hidden="true"
            className="office-bubble pointer-events-none absolute z-10 max-w-60 -translate-x-1/2 -translate-y-full border-2 border-[#1a1626] bg-[#f4f1ea] px-2 py-1 font-mono text-[11px] leading-tight text-[#1a1626] shadow-[3px_3px_0_#1a1626]"
            style={{ left: hover.left, top: hover.top }}
          >
            <p className="font-semibold">{bubbleText.title}</p>
            {bubbleText.line ? <p className="mt-0.5">{bubbleText.line}</p> : null}
          </div>
        ) : null}

        {selected && selectedInfo ? (
          <div
            ref={panelRef}
            aria-live="polite"
            className="office-in absolute z-20 w-60 rounded-xl border-2 border-[#1a1626] bg-[#f4f1ea] p-3 text-[#1a1626] shadow-[4px_4px_0_#1a1626]"
            style={{ left: 8, top: 8 }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{selectedInfo.title}</p>
                {selectedInfo.status ? (
                  <p className="mt-0.5 font-mono text-xs uppercase tracking-wide text-[#4a3f5c]">
                    {statusText(selectedInfo.status)}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onSelect(null)}
                aria-label={t.scene.close}
                className="-m-1.5 grid size-8 shrink-0 place-items-center rounded-full hover:bg-black/10"
              >
                <X size={14} weight="bold" aria-hidden="true" />
              </button>
            </div>
            <dl className="mt-2 grid gap-1 text-xs">
              {selectedInfo.rows.map(([k, v], i) => (
                <div key={i} className="flex gap-2">
                  {k ? <dt className="shrink-0 text-[#5a5068]">{k}</dt> : null}
                  <dd className={k ? 'min-w-0 text-right ml-auto' : 'text-[#5a5068]'}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  )
}
