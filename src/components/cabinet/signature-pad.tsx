'use client'

import { Eraser } from '@phosphor-icons/react'
import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Dict } from '@/content'
import { buildSignaturePayload, checkSignaturePng, type SignatureError, type SignaturePayload } from '@/lib/cabinet-docs'
import { buttonStyles, cn } from '@/lib/cn'
import { Field, FormMessage, inputClass } from './ui'

// The e-signature pad (owner 2026-11-22: «электронная подпись мышкой», no code): a canvas for mouse,
// finger and pen (Pointer Events, `touch-action: none` so a stroke never scrolls the page), a name
// field, the consent sentence and the submit button. Strokes are kept in coordinates relative to the
// pad's width, so resizing redraws them and the exported PNG (transparent, dark ink, fixed width) does
// not depend on the screen. The image is checked against the 200 KB limit before it is sent.
type Pt = { x: number; y: number }
type Stroke = Pt[]

const ASPECT = 0.3125 // height = width * 16:5
const INK = '#14171a'
const PAPER = '#f6f5ef'
const LINE_W = 0.0048 // relative to the width
const EXPORT_WIDTHS = [800, 560, 400]

function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[], width: number, background: string | null) {
  const height = width * ASPECT
  ctx.clearRect(0, 0, width, height)
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)
  }
  ctx.strokeStyle = INK
  ctx.fillStyle = INK
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(1.8, width * LINE_W)
  for (const stroke of strokes) {
    if (stroke.length === 1) {
      ctx.beginPath()
      ctx.arc(stroke[0]!.x * width, stroke[0]!.y * width, ctx.lineWidth / 2, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    ctx.beginPath()
    ctx.moveTo(stroke[0]!.x * width, stroke[0]!.y * width)
    for (let i = 1; i < stroke.length - 1; i++) {
      const a = stroke[i]!
      const b = stroke[i + 1]!
      ctx.quadraticCurveTo(a.x * width, a.y * width, ((a.x + b.x) / 2) * width, ((a.y + b.y) / 2) * width)
    }
    const last = stroke[stroke.length - 1]!
    ctx.lineTo(last.x * width, last.y * width)
    ctx.stroke()
  }
}

// The PNG of the strokes, as small as it takes to stay under the limit.
function exportPng(strokes: Stroke[]): string | null {
  for (const width of EXPORT_WIDTHS) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = Math.round(width * ASPECT)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    paint(ctx, strokes, width, null)
    const url = canvas.toDataURL('image/png')
    if (checkSignaturePng(url).ok) return url
  }
  return null
}

export function SignaturePad({
  dict,
  defaultName,
  onSubmit,
  onCancel,
  error,
  busy,
}: {
  dict: Dict
  defaultName: string
  onSubmit: (payload: SignaturePayload) => void
  onCancel: () => void
  // An error key of `cabinet.v3.docs.errors` from the server side of the submit.
  error: string
  busy: boolean
}) {
  const t = dict.cabinet.v3.docs.signPad
  const errors = dict.cabinet.v3.docs.errors as Record<string, string>
  const uid = useId()
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Stroke[]>([])
  const drawing = useRef(false)
  const size = useRef(0)
  const [hasInk, setHasInk] = useState(false)
  const [name, setName] = useState(defaultName)
  const [consent, setConsent] = useState(false)
  const [localError, setLocalError] = useState<SignatureError | ''>('')

  const redraw = useCallback(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx || size.current === 0) return
    paint(ctx, strokes.current, size.current, PAPER)
  }, [])

  // The canvas follows the width of its box and the screen's pixel ratio.
  useEffect(() => {
    const box = wrap.current
    const el = canvas.current
    if (!box || !el) return
    const fit = () => {
      const width = Math.floor(box.clientWidth)
      if (width <= 0) return
      const ratio = Math.min(window.devicePixelRatio || 1, 3)
      size.current = width
      el.width = Math.round(width * ratio)
      el.height = Math.round(width * ASPECT * ratio)
      el.style.height = `${Math.round(width * ASPECT)}px`
      el.getContext('2d')?.setTransform(ratio, 0, 0, ratio, 0, 0)
      redraw()
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    return () => observer.disconnect()
  }, [redraw])

  const point = (e: ReactPointerEvent<HTMLCanvasElement>): Pt => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.width }
  }

  function onDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    strokes.current.push([point(e)])
    setLocalError('')
    setHasInk(true)
    redraw()
  }
  function onMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const current = strokes.current[strokes.current.length - 1]
    if (!current) return
    const events = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : []
    const rect = e.currentTarget.getBoundingClientRect()
    for (const ev of events.length > 0 ? events : [e.nativeEvent]) {
      current.push({ x: (ev.clientX - rect.left) / rect.width, y: (ev.clientY - rect.top) / rect.width })
    }
    redraw()
  }
  function onUp(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    drawing.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }
  function clear() {
    strokes.current = []
    setHasInk(false)
    setLocalError('')
    redraw()
  }

  function submit() {
    if (strokes.current.length === 0) return setLocalError('no_signature')
    const png = exportPng(strokes.current)
    const built = buildSignaturePayload({ png, name, consent })
    if (!built.ok) return setLocalError(built.error)
    setLocalError('')
    onSubmit(built.payload)
  }

  const shown = localError || error
  return (
    <div className="rounded-xl border border-accent-text/40 bg-surface p-5 md:p-6" data-signature-pad>
      <h3 className="font-display text-lg font-semibold tracking-tight">{t.title}</h3>
      <p className="mt-1 text-sm text-muted">{t.draw}</p>

      <div ref={wrap} className="relative mt-4 overflow-hidden rounded-xl border border-line-strong" style={{ background: PAPER }}>
        <canvas
          ref={canvas}
          role="img"
          aria-label={t.canvas}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="block w-full cursor-crosshair"
          style={{ touchAction: 'none', aspectRatio: '16 / 5' }}
          data-signature-canvas
        />
        {!hasInk && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm"
            style={{ color: '#5d626a' }}
          >
            {t.placeholder}
          </span>
        )}
        <span aria-hidden="true" className="pointer-events-none absolute right-5 bottom-[22%] left-5 border-b border-dashed" style={{ borderColor: '#9a9ea5' }} />
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={clear}
          disabled={!hasInk || busy}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg disabled:opacity-50"
        >
          <Eraser size={16} aria-hidden="true" />
          {t.clear}
        </button>
      </div>

      <div className="mt-3 grid gap-4">
        <Field id={`${uid}-name`} label={t.name}>
          <input
            id={`${uid}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            autoComplete="name"
            className={inputClass}
          />
        </Field>
        <label className="flex items-start gap-3 text-sm leading-relaxed text-muted">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
          />
          {t.consent}
        </label>
        {shown && <FormMessage kind="error">{errors[shown] ?? errors.hq}</FormMessage>}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={busy || !hasInk || !consent || name.trim().length < 2}
            className={cn(buttonStyles.primary, 'px-8 py-4 text-base')}
          >
            {busy ? t.submitting : t.submit}
          </button>
          <button type="button" onClick={onCancel} disabled={busy} className={buttonStyles.secondary}>
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  )
}
