'use client'

import { CaretLeft, CaretRight, FileText, FilmSlate, Pause, PencilSimpleLine, Play, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react'
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { Markdown } from '@/components/admin/pult/markdown'
import { cn } from '@/lib/cn'
import { editableTargets, type PackDoc } from '@/lib/doc-editor'
import { documentText, emptyMediaReason, renderState, renderStateText, type ReviewItem, type ReviewMedia } from '@/lib/review'

// The centre of the review screen: what the owner looks at. A 9:16 video with its own controls, a
// carousel (native scroll-snap, so a swipe works), a single image, or the document text. Space,
// M and the arrows are driven from the page through the handle.
export type StageHandle = { toggle: () => void; mute: () => void; seek: (dir: 1 | -1) => void }

const MARKDOWN_KINDS = ['article', 'seo_proposal', 'content_pack', 'pm_spec', 'bo_document', 'onboarding_guide']
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const iconBtn = 'grid size-11 shrink-0 place-items-center rounded-full border border-line-strong bg-elevated text-fg transition-colors hover:border-accent'

const VideoPlayer = forwardRef<StageHandle, { media: ReviewMedia }>(function VideoPlayer({ media }, handle) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [time, setTime] = useState(0)
  const [dur, setDur] = useState(media.durationS ?? 0)
  const [failed, setFailed] = useState(false)

  const toggle = useCallback(() => {
    const v = ref.current
    if (!v || failed) return
    if (v.paused) void v.play().catch(() => setPlaying(false))
    else v.pause()
  }, [failed])
  useImperativeHandle(
    handle,
    () => ({
      toggle,
      mute: () => setMuted((m) => !m),
      seek: (dir) => {
        const v = ref.current
        if (v) v.currentTime = Math.min(v.duration || 0, Math.max(0, v.currentTime + dir * 5))
      },
    }),
    [toggle],
  )

  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-3">
      <div className="flex min-h-0 w-full flex-1 justify-center">
      <div className="relative aspect-[9/16] h-full max-w-full overflow-hidden rounded-2xl border border-line-strong bg-surface-3">
        {failed ? (
          <>
            {media.poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media.poster} alt="Кадр из видео" className="size-full object-cover" />
            ) : null}
            <p role="status" className="absolute inset-x-3 bottom-3 rounded-xl border border-line-strong bg-elevated/95 p-2.5 text-center text-xs text-muted">
              Видео не загрузилось. Показан кадр.
            </p>
          </>
        ) : (
          <video
            ref={ref}
            src={media.src}
            poster={media.poster ?? undefined}
            muted={muted}
            playsInline
            preload="metadata"
            loop
            onClick={toggle}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDur(e.currentTarget.duration || media.durationS || 0)}
            onError={() => setFailed(true)}
            className="size-full cursor-pointer object-contain"
          />
        )}
      </div>
      </div>
      <div className="flex w-full max-w-[26rem] items-center gap-2">
        <button type="button" onClick={toggle} disabled={failed} aria-label={playing ? 'Пауза (Пробел)' : 'Играть (Пробел)'} className={cn(iconBtn, 'disabled:opacity-40')}>
          {playing ? <Pause size={18} weight="fill" aria-hidden="true" /> : <Play size={18} weight="fill" aria-hidden="true" />}
        </button>
        <input
          type="range"
          min={0}
          max={dur || 1}
          step={0.1}
          value={Math.min(time, dur || 1)}
          disabled={failed}
          aria-label="Перемотка"
          onChange={(e) => {
            const v = ref.current
            if (v) v.currentTime = Number(e.target.value)
            setTime(Number(e.target.value))
          }}
          className="h-11 min-w-0 flex-1 accent-accent disabled:opacity-40"
        />
        <span className="w-[5.5rem] shrink-0 text-right font-mono text-xs whitespace-nowrap tabular-nums text-muted">
          {clock(time)} / {clock(dur)}
        </span>
        <button type="button" onClick={() => setMuted((m) => !m)} aria-pressed={muted} aria-label={muted ? 'Включить звук (M)' : 'Выключить звук (M)'} className={iconBtn}>
          {muted ? <SpeakerSlash size={18} aria-hidden="true" /> : <SpeakerHigh size={18} aria-hidden="true" />}
        </button>
      </div>
    </div>
  )
})

const Carousel = forwardRef<StageHandle, { media: ReviewMedia[] }>(function Carousel({ media }, handle) {
  const box = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const go = useCallback((to: number) => {
    const el = box.current
    if (!el) return
    const clamped = Math.min(media.length - 1, Math.max(0, to))
    el.scrollTo({ left: clamped * el.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [media.length])
  useImperativeHandle(handle, () => ({ toggle: () => {}, mute: () => {}, seek: (dir) => go(index + dir) }), [go, index])
  const ratio = media[0]?.w && media[0]?.h ? `${media[0].w} / ${media[0].h}` : '4 / 5'
  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-3">
      <div className="relative min-h-0 max-w-full flex-1" style={{ aspectRatio: ratio }}>
        <div
          ref={box}
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
          role="group"
          aria-roledescription="карусель"
          aria-label={`Слайд ${index + 1} из ${media.length}`}
          className="flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl border border-line-strong bg-surface-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {media.map((m, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.src} src={m.src} alt={`Слайд ${i + 1}`} draggable={false} className="size-full shrink-0 snap-center object-contain" />
          ))}
        </div>
        {media.length > 1 ? (
          <>
            <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Предыдущий слайд" className={cn(iconBtn, 'absolute top-1/2 left-2 -translate-y-1/2 disabled:opacity-0')}>
              <CaretLeft size={18} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => go(index + 1)} disabled={index === media.length - 1} aria-label="Следующий слайд" className={cn(iconBtn, 'absolute top-1/2 right-2 -translate-y-1/2 disabled:opacity-0')}>
              <CaretRight size={18} aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>
      {media.length > 1 ? (
        <div className="flex items-center gap-1" role="tablist" aria-label="Слайды">
          {media.map((m, i) => (
            <button key={m.src} type="button" role="tab" aria-selected={i === index} aria-label={`Слайд ${i + 1}`} onClick={() => go(i)} className="grid size-8 place-items-center">
              <span className={cn('block h-2 rounded-full transition-[width,background-color] duration-150', i === index ? 'w-6 bg-accent' : 'w-2 bg-line-strong')} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
})

function Empty({ item }: { item: ReviewItem }) {
  const state = renderState(item)
  return (
    <div className="grid h-full place-items-center p-4">
      <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong p-6 text-center">
        <FilmSlate size={36} weight="duotone" aria-hidden="true" className="text-faint" />
        <p className="text-sm font-medium">Файлов пока нет</p>
        <p className="text-sm text-muted">{emptyMediaReason(item)}</p>
        {state ? <p className="font-mono text-xs text-faint">рендер: {renderStateText(state)}</p> : null}
      </div>
    </div>
  )
}

function Doc({ item, onEditDoc }: { item: ReviewItem; onEditDoc?: (doc: PackDoc) => void }) {
  const text = documentText(item)
  // A pack's КП is also the item's body, shown above: list only the other documents then.
  const docs = (item.text.documents ?? []).filter((d) => !(d.key === 'kp' && d.body === text))
  const editable = new Set(editableTargets(item).flatMap((t) => (t.doc ? [t.doc] : [])))
  const markdown = MARKDOWN_KINDS.includes(item.kind)
  return (
    <article className="mx-auto h-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-5 sm:p-7">
      <p className="flex items-center gap-1.5 text-xs text-faint">
        <FileText size={14} aria-hidden="true" />
        {item.kind === 'article' ? 'Статья в блог' : 'Текст'}
      </p>
      <h2 className="mt-1 mb-4 text-lg leading-snug font-semibold wrap-anywhere">{item.text.subject || item.title}</h2>
      {markdown ? <Markdown text={text} /> : <p className="text-[0.95rem] leading-relaxed whitespace-pre-wrap wrap-anywhere">{text}</p>}
      {onEditDoc && editable.has('kp') ? (
        <button type="button" onClick={() => onEditDoc('kp')} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm text-muted hover:border-accent hover:text-fg">
          <PencilSimpleLine size={14} aria-hidden="true" /> Править КП
        </button>
      ) : null}
      {docs.map((d) => (
        <section key={d.key} className="mt-6 border-t border-line pt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <h3 className="min-w-0 text-sm font-semibold wrap-anywhere">{d.title}</h3>
            {onEditDoc && editable.has(d.key as PackDoc) ? (
              <button type="button" onClick={() => onEditDoc(d.key as PackDoc)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm text-muted hover:border-accent hover:text-fg">
                <PencilSimpleLine size={14} aria-hidden="true" /> Править
              </button>
            ) : null}
          </div>
          <Markdown text={d.body} />
        </section>
      ))}
    </article>
  )
}

export const MediaStage = forwardRef<StageHandle, { item: ReviewItem; onEditDoc?: (doc: PackDoc) => void }>(function MediaStage({ item, onEditDoc }, handle) {
  const video = item.media.find((m) => m.type === 'video')
  const images = item.media.filter((m) => m.type === 'image')
  const inner = useRef<StageHandle>(null)
  useImperativeHandle(handle, () => ({ toggle: () => inner.current?.toggle(), mute: () => inner.current?.mute(), seek: (d) => inner.current?.seek(d) }), [])
  if (video) return <VideoPlayer key={item.id} ref={inner} media={video} />
  if (images.length > 1) return <Carousel key={item.id} ref={inner} media={images} />
  if (images.length === 1)
    return (
      <div className="grid h-full place-items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[0]!.src} alt={item.title} className="max-h-full max-w-full rounded-2xl border border-line-strong object-contain" />
      </div>
    )
  if (item.kind === 'content_item') return <Empty item={item} />
  return <Doc item={item} onEditDoc={onEditDoc} />
})
