'use client'

import { ArrowClockwise, ArrowLeft, CaretLeft, CaretRight, FilmSlate, Sparkle, Warning } from '@phosphor-icons/react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { errText, fill, hq } from '@/components/admin/control/api'
import { Chip } from '@/components/admin/shell-crm/bits'
import { statusTone, type Action } from '@/components/admin/shell-crm/content'
import { btn, btnDanger, btnPrimary, CopyButton, inputClass, modalOpen, typingIn, useHqView, useHub } from '@/components/admin/hub/ui'
import { Pending } from '@/components/ui/pending'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { canReorder, orderBody, pendingReason, STUDIO_NICHES, STUDIO_TYPES, studioPreview, type FeedItem, type OrderInput, type PreviewMedia, type StudioPreview } from '@/lib/content-studio'
import { editPayload, fieldsOf, normalizeItem, normalizeReview, replaceItem, withText, type FieldKey, type ReviewItem } from '@/lib/review'
import { CAPTION_PLATFORMS, type ContentItem } from '@/lib/shell'

const k = admin.pult.content
const s = k.studio

// Posts one order to the Content Maker; the toast says what happened, the caller reacts to `true`.
export function useOrder() {
  const { notify } = useHub()
  return async (input: OrderInput, done: string) => {
    const body = orderBody(input)
    if (!body) return false
    const res = await hq<{ order?: unknown }>('content/orders', body)
    if (res.ok) {
      notify(done)
      return true
    }
    notify(fill(s.failed, { e: errText(res.error) }), 'error')
    return false
  }
}

// «Prompt»: a new material from scratch. Inline (no drawer): a textarea, the format and the send button.
export function PromptBox({ onSent, className }: { onSent?: () => void; className?: string }) {
  const order = useOrder()
  const [text, setText] = useState('')
  const [type, setType] = useState<(typeof STUDIO_TYPES)[number]>('clip')
  const [busy, setBusy] = useState(false)
  const ok = text.trim().length >= 3
  return (
    <form
      className={cn('grid gap-2 rounded-xl border border-line bg-inset p-3', className)}
      aria-label={s.promptBoxTitle}
      data-studio="prompt"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!ok || busy) return
        setBusy(true)
        const sent = await order({ mode: 'prompt', prompt: text, type }, s.sent)
        setBusy(false)
        if (sent) {
          setText('')
          onSent?.()
        }
      }}
    >
      <div className="flex items-center gap-1.5">
        <Sparkle size={15} weight="fill" aria-hidden="true" className="text-accent-text" />
        <h3 className="text-sm font-medium">{s.promptBoxTitle}</h3>
      </div>
      <p className="text-xs text-muted">{s.promptBoxHint}</p>
      <label className="grid gap-1.5 text-xs text-muted">
        {s.promptLabel}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') e.currentTarget.form?.requestSubmit()
          }}
          rows={3}
          maxLength={1000}
          placeholder={s.promptPlaceholder}
          className={cn(inputClass, 'resize-y')}
        />
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid min-w-32 gap-1.5 text-xs text-muted">
          {s.typeLabel}
          <select value={type} onChange={(e) => setType(e.target.value as (typeof STUDIO_TYPES)[number])} className={cn(inputClass, 'w-auto')}>
            {STUDIO_TYPES.map((t) => (
              <option key={t} value={t}>
                {k.kinds[t]}
              </option>
            ))}
          </select>
        </label>
        <Pending type="submit" pending={busy} pendingLabel={admin.hq.loading} disabled={!ok} className={btnPrimary}>
          {s.send}
        </Pending>
      </div>
    </form>
  )
}

// «Another variant» and «For a niche» for the open material, inline.
function VariantBox({ item, onOrdered }: { item: FeedItem; onOrdered: () => void }) {
  const order = useOrder()
  const [niche, setNiche] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'variant' | 'niche' | null>(null)
  const id = Number(item.id)
  const send = async (input: OrderInput, done: string, kind: 'variant' | 'niche') => {
    setBusy(kind)
    const sent = await order(input, done)
    setBusy(null)
    if (sent) {
      setNote('')
      onOrdered()
    }
  }
  if (!canReorder(item)) return null
  return (
    <section className="grid gap-3 rounded-xl border border-line bg-inset p-3" aria-label={s.studioTitle} data-studio="variants">
      <label className="grid gap-1.5 text-xs text-muted">
        {s.noteLabel}
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={inputClass} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid content-start gap-1.5">
          <h3 className="text-sm font-medium">{s.variantTitle}</h3>
          <p className="text-xs text-faint">{s.anotherHint}</p>
          <Pending
            pending={busy === 'variant'}
            pendingLabel={admin.hq.loading}
            disabled={busy !== null}
            className={cn(btn, 'justify-self-start')}
            onClick={() => void send({ mode: 'variant', fromItemId: id, note }, s.sentVariant, 'variant')}
          >
            {s.another}
          </Pending>
        </div>
        <div className="grid content-start gap-1.5">
          <h3 className="text-sm font-medium">{s.nicheTitle}</h3>
          <p className="text-xs text-faint">{s.nicheHint}</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              list="studio-niches"
              maxLength={60}
              placeholder={s.pickNiche}
              aria-label={s.nicheLabel}
              className={cn(inputClass, 'min-w-0 flex-1 basis-36')}
            />
            <datalist id="studio-niches">
              {STUDIO_NICHES.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <Pending
              pending={busy === 'niche'}
              pendingLabel={admin.hq.loading}
              disabled={busy !== null || !niche.trim()}
              className={btn}
              onClick={() => void send({ mode: 'niche', fromItemId: id, niche, note }, fill(s.sentNiche, { n: niche.trim() }), 'niche')}
            >
              {s.nicheSend}
            </Pending>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---- the preview ---------------------------------------------------------------------------------------

function PendingStage({ preview, item }: { preview: StudioPreview; item: ContentItem }) {
  return (
    <div className="grid h-full place-items-center p-4" data-studio="render-pending">
      <div className="flex max-w-xs flex-col items-center gap-2.5 text-center">
        <FilmSlate size={34} weight="duotone" aria-hidden="true" className="text-faint" />
        <p className="text-sm font-medium">{s.renderPending}</p>
        <p className="text-sm text-muted">{pendingReason(item, preview.state)}</p>
        <p className="font-mono text-xs text-faint" data-studio="render-state">
          {fill(s.renderState, { s: s.renderStates[preview.state] })}
        </p>
      </div>
    </div>
  )
}

function Slides({ media }: { media: PreviewMedia[] }) {
  const [i, setI] = useState(0)
  const at = Math.min(i, media.length - 1)
  return (
    <div className="relative h-full" data-studio="carousel">
      {/* eslint-disable-next-line @next/next/no-img-element -- a private render behind the session proxy */}
      <img src={media[at]!.src} alt={fill(s.slide, { n: at + 1, total: media.length })} className="size-full object-contain" />
      <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-2">
        <button type="button" className={cn(btn, 'min-h-9 bg-surface/90 px-2.5')} disabled={at === 0} onClick={() => setI(at - 1)} aria-label={k.prevSlide}>
          <CaretLeft size={16} aria-hidden="true" />
        </button>
        <span className="rounded-full bg-surface/90 px-2.5 py-1 font-mono text-xs text-muted">
          {at + 1} / {media.length}
        </span>
        <button type="button" className={cn(btn, 'min-h-9 bg-surface/90 px-2.5')} disabled={at >= media.length - 1} onClick={() => setI(at + 1)} aria-label={k.nextSlide}>
          <CaretRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function Video({ media }: { media: PreviewMedia }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="relative size-full">
      <video
        key={media.src}
        controls
        preload="metadata"
        playsInline
        poster={media.poster ?? undefined}
        onError={() => setFailed(true)}
        className="size-full bg-surface-3 object-contain"
        data-studio="player"
      >
        <source src={media.src} type="video/mp4" onError={() => setFailed(true)} />
      </video>
      {failed ? (
        <p role="alert" className="absolute inset-x-2 top-2 flex items-center gap-1.5 rounded-lg bg-surface/95 px-2.5 py-1.5 text-xs text-danger">
          <Warning size={14} aria-hidden="true" /> {s.videoFailed}
        </p>
      ) : null}
    </div>
  )
}

function Stage({ preview, item }: { preview: StudioPreview; item: ContentItem }) {
  const m = preview.media[0]
  switch (preview.mode) {
    case 'video':
      return <Video media={m!} />
    case 'carousel':
      return <Slides media={preview.media} />
    case 'image':
      // eslint-disable-next-line @next/next/no-img-element -- a private render behind the session proxy
      return <img src={m!.src} alt={item.title} className="size-full object-contain" />
    case 'pdf':
      return <iframe src={m!.src} title={item.title || s.previewLabel} className="size-full" />
    case 'html':
      return <iframe src={m!.src} title={item.title || s.previewLabel} sandbox="" className="size-full bg-surface" />
    default:
      return <PendingStage preview={preview} item={item} />
  }
}

// ---- the text: editable in place -----------------------------------------------------------------------

function TextFields({ item, review, loading, onSaved }: { item: ContentItem; review: ReviewItem | null; loading: boolean; onSaved: (next: ReviewItem) => void }) {
  const { notify } = useHub()
  const [values, setValues] = useState<Partial<Record<FieldKey, string>>>({})
  const [busy, setBusy] = useState(false)
  const fields = useMemo(() => (review ? fieldsOf(review) : []), [review])
  const payload = review ? editPayload(review, values) : null
  const editable = fields.some((f) => f.editable)

  async function save() {
    if (!review || !payload || busy) return
    setBusy(true)
    const res = await hq<{ item?: unknown }>(`review/${encodeURIComponent(review.id)}`, {
      action: 'edit',
      ...payload,
    })
    setBusy(false)
    if (res.ok) {
      const next = normalizeItem(res.item) ?? withText(review, payload.text)
      setValues({})
      onSaved(next)
      notify(s.textSaved)
    } else notify(fill(s.textFailed, { e: errText(res.error) }), 'error')
  }

  if (!review) {
    // No approval card (or not loaded): the captions of the feed row, to be read and copied.
    const captions = CAPTION_PLATFORMS.filter((p) => item.caption[p])
    return (
      <section className="grid gap-2" aria-label={s.textTitle}>
        <h3 className="text-sm font-medium">{s.textTitle}</h3>
        {loading ? <p className="text-xs text-faint">{s.textLoading}</p> : null}
        {item.hook ? <p className="text-sm text-muted">{item.hook}</p> : null}
        {captions.map((p) => (
          <div key={p} className="grid gap-1 rounded-xl border border-line bg-inset p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-faint">{k.platforms[p]}</span>
              <CopyButton text={item.caption[p]} />
            </div>
            <p className="text-sm wrap-anywhere whitespace-pre-wrap">{item.caption[p]}</p>
          </div>
        ))}
        {!captions.length && !loading ? <p className="text-xs text-faint">{k.noCaptions}</p> : null}
      </section>
    )
  }
  return (
    <section className="grid gap-3" aria-label={s.textTitle} data-studio="text">
      <h3 className="text-sm font-medium">{s.textTitle}</h3>
      {!editable ? <p className="text-xs text-faint">{s.textReadOnly}</p> : null}
      {fields.map((f) => (
        <div key={f.key} className="grid gap-1.5">
          <label htmlFor={`st-${f.key}`} className="text-xs text-faint">
            {f.label}
          </label>
          {f.editable ? (
            <textarea
              id={`st-${f.key}`}
              rows={f.rows}
              value={values[f.key] ?? f.value}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className={cn(inputClass, 'resize-y leading-relaxed')}
            />
          ) : (
            <p id={`st-${f.key}`} className="rounded-xl bg-inset px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere">
              {f.value || '-'}
            </p>
          )}
        </div>
      ))}
      {payload ? (
        <div className="flex flex-wrap gap-2">
          <Pending pending={busy} pendingLabel={admin.hq.loading} className={btnPrimary} onClick={() => void save()} data-save-text>
            {s.saveText}
          </Pending>
          <button type="button" className={btn} disabled={busy} onClick={() => setValues({})}>
            {s.discard}
          </button>
        </div>
      ) : null}
    </section>
  )
}

// ---- the screen ----------------------------------------------------------------------------------------

type Act = (item: ContentItem, action: Action, extra?: { note?: string; platform?: string }) => Promise<boolean>

// One screen for one material: the preview on the left, the text, the decision, «Prompt», «Another variant» and
// «For a niche» on the right (stacked below the preview on a phone). No drawer. Keys: A approve, E edit the text,
// R revise, Esc back (Shell owns the digits).
export function StudioScreen({ item, onBack, onAct, onChanged }: { item: FeedItem; onBack: () => void; onAct: Act; onChanged: () => void }) {
  const cards = useHqView('review?status=all&limit=200', normalizeReview, {
    visible: 60_000,
    hidden: 300_000,
  })
  const { mutate } = cards
  const review = useMemo(() => cards.view?.items.find((i) => i.id === item.reviewId) ?? null, [cards.view, item.reviewId])
  const preview = studioPreview(item, review)
  const [revise, setRevise] = useState<string | null>(null)
  const [platform, setPlatform] = useState(item.platform && item.platform !== 'all' ? item.platform : 'instagram')
  const [busy, setBusy] = useState(false)
  const run = async (action: Action, extra?: { note?: string; platform?: string }) => {
    setBusy(true)
    const ok = await onAct(item, action, extra)
    setBusy(false)
    return ok
  }
  const keys = useRef({ run, back: onBack, item, revise })
  useEffect(() => {
    keys.current = { run, back: onBack, item, revise }
  })
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (modalOpen() || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const typing = typingIn(e.target)
      const cur = keys.current
      if (e.key === 'Escape') {
        if (typing) (e.target as HTMLElement).blur()
        else cur.back()
        return
      }
      if (typing) return
      if (e.code === 'KeyA' && cur.item.status !== 'approved') {
        e.preventDefault()
        void cur.run('approve')
      } else if (e.code === 'KeyE') {
        e.preventDefault()
        document.querySelector<HTMLElement>('[data-studio="text"] textarea')?.focus()
      } else if (e.code === 'KeyR') {
        e.preventDefault()
        setRevise((v) => (v === null ? '' : v))
        requestAnimationFrame(() => document.getElementById('studio-revise')?.focus())
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])

  const approvals = item.status === 'pending' && item.reviewId
  return (
    <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] lg:items-start lg:gap-6" data-studio="screen" aria-label={s.screenLabel}>
      <div className="grid min-w-0 gap-2 lg:sticky lg:top-3">
        <div
          className="mx-auto w-full max-w-[min(100%,360px)] overflow-hidden rounded-2xl border border-line-strong bg-surface-2"
          style={preview.mode === 'pending' ? { minHeight: '13rem' } : { aspectRatio: preview.ratio, maxHeight: '72svh' }}
          data-studio="preview"
          data-mode={preview.mode}
        >
          <Stage preview={preview} item={item} />
        </div>
        <p className="text-center font-mono text-xs text-faint">
          {fill(s.renderState, { s: s.renderStates[preview.state] })}
          {review ? ` · ${review.id}` : ''}
        </p>
      </div>

      <div className="grid min-w-0 content-start gap-4">
        <header className="grid gap-2">
          <button type="button" onClick={onBack} className={cn(btn, 'min-h-9 justify-self-start px-3')} data-studio="back">
            <ArrowLeft size={14} aria-hidden="true" /> {s.back}
          </button>
          <h2 className="text-lg leading-snug font-semibold wrap-anywhere">{item.title || k.kinds[item.kind]}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={statusTone[item.status]}>{k.statuses[item.status]}</Chip>
            <span className="text-xs text-faint">
              {k.kinds[item.kind]} · {item.platform === 'all' ? k.allPlatforms : item.platform}
            </span>
            {item.origin ? <Chip tone="accent">{s.fromOrder}</Chip> : null}
            {item.sourceSlug ? <span className="text-xs text-faint">{fill(k.fromArticle, { slug: item.sourceSlug })}</span> : null}
            {item.publishedUrl ? (
              <a href={item.publishedUrl} className="text-xs text-accent-text underline-offset-4 hover:underline">
                {k.openPublished}
              </a>
            ) : null}
          </div>
          {item.error ? (
            <p role="alert" className="flex gap-2 rounded-xl border border-danger/40 p-3 text-sm text-danger">
              <Warning size={16} weight="fill" aria-hidden="true" className="mt-0.5 shrink-0" />
              {item.error}
            </p>
          ) : null}
          {approvals ? (
            <Link href={`/admin/approvals?tab=content&id=${item.reviewId}`} className="text-xs text-accent-text underline-offset-4 hover:underline">
              {s.toApprovals}
            </Link>
          ) : null}
        </header>

        <TextFields
          key={item.reviewId ?? String(item.id)}
          item={item}
          review={review}
          loading={!cards.view && !cards.error}
          onSaved={(next) => {
            mutate((v) => ({ ...v, items: replaceItem(v.items, next) }))
            onChanged()
          }}
        />

        <section className="grid gap-2 border-t border-line pt-4" aria-label={s.decideTitle}>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} disabled={busy || item.status === 'approved'} onClick={() => void run('approve')}>
              {k.approve}
            </button>
            <button type="button" className={btn} disabled={busy} onClick={() => setRevise(revise === null ? '' : null)} aria-expanded={revise !== null}>
              {k.revise}
            </button>
            <button type="button" className={btnDanger} disabled={busy || item.status === 'rejected'} onClick={() => void run('reject')}>
              {k.reject}
            </button>
            <button type="button" className={btn} disabled={busy} onClick={() => void run('rerender')}>
              <ArrowClockwise size={14} aria-hidden="true" /> {k.rerender}
            </button>
          </div>
          {revise !== null ? (
            <div className="grid gap-2">
              <textarea id="studio-revise" value={revise} onChange={(e) => setRevise(e.target.value)} rows={3} maxLength={2000} placeholder={k.revisePlaceholder} className={inputClass} />
              <button
                type="button"
                className={cn(btn, 'justify-self-start')}
                disabled={busy || !revise.trim()}
                onClick={async () => {
                  if (await run('revise', { note: revise.trim() })) setRevise(null)
                }}
              >
                {k.reviseSend}
              </button>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label={k.platform} className={cn(inputClass, 'w-auto')}>
              {['instagram', 'tiktok', 'youtube', 'dzen'].map((p) => (
                <option key={p} value={p}>
                  {(k.platforms as Record<string, string>)[p] ?? p}
                </option>
              ))}
            </select>
            <button type="button" className={btn} disabled={busy || item.status === 'published'} onClick={() => void run('published', { platform })}>
              {k.published}
            </button>
          </div>
          <p className="hidden text-xs text-faint lg:block">{s.keysHint}</p>
        </section>

        <VariantBox item={item} onOrdered={onBack} />
        <PromptBox onSent={onBack} />
      </div>
    </div>
  )
}
