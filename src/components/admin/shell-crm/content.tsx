'use client'

import { ArrowClockwise, CaretLeft, CaretRight, FilmStrip, Image as ImageIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { fill } from '@/components/admin/control/api'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { CAPTION_PLATFORMS, fileUrl, kitBlocks, kitSections, type ContentItem, type KitSection, type ProfileKit, YOUTUBE_BANNER } from '@/lib/shell'
import { Chip, type Tone } from './bits'
import { btn, btnDanger, btnPrimary, CopyButton, Empty, inputClass } from '../hub/ui'
const k = admin.pult.content
export type Action = 'approve' | 'reject' | 'revise' | 'published' | 'rerender'

export const statusTone: Record<ContentItem['status'], Tone> = {
  draft: 'dim',
  pending: 'warn',
  approved: 'accent',
  rendering: 'plain',
  ready: 'accent',
  published: 'plain',
  rejected: 'bad',
}
export const nextStatus: Record<Action, ContentItem['status']> = {
  approve: 'approved',
  reject: 'rejected',
  revise: 'draft',
  published: 'published',
  rerender: 'rendering',
}

export function ContentCard({ item, onOpen, badge }: { item: ContentItem; onOpen: () => void; badge?: React.ReactNode }) {
  const thumb = item.files.find((f) => f.type === 'png')
  return (
    <button type="button" onClick={onOpen} className="block w-full overflow-hidden rounded-xl border border-line bg-inset text-left transition-colors hover:border-line-strong focus-visible:border-accent">
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- a private render behind the session proxy
        <img src={fileUrl(thumb.path)} alt="" loading="lazy" className="aspect-[4/5] w-full bg-surface-2 object-cover" />
      ) : (
        <span className="grid aspect-[4/5] w-full place-items-center bg-surface-2 text-faint">
          {item.files.some((f) => f.type === 'mp4') ? <FilmStrip size={22} aria-hidden="true" /> : <ImageIcon size={22} aria-hidden="true" />}
        </span>
      )}
      <span className="block p-1.5">
        <span className="line-clamp-2 wrap-anywhere text-xs leading-snug">{item.title || k.kinds[item.kind]}</span>
        <span className="mt-1 flex flex-wrap gap-1">
          <Chip tone={statusTone[item.status]}>{k.statuses[item.status]}</Chip>
          {badge}
        </span>
      </span>
    </button>
  )
}

// The profile start kit: one card, a tab per platform, every text block with its own copy button.
function KitCard({ kit }: { kit: ProfileKit }) {
  const sections = kitSections(kit)
  const [tab, setTab] = useState<KitSection>(sections[0] ?? 'instagram')
  const blocks = kitBlocks(kit[tab])
  return (
    <section className="grid gap-2 rounded-xl border border-line bg-inset p-3" aria-label={k.kitTitle}>
      <h3 className="text-sm font-medium">{k.kitTitle}</h3>
      <div role="tablist" aria-label={k.kitTitle} className="flex flex-wrap gap-1.5">
        {sections.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            id={`kit-tab-${s}`}
            aria-selected={tab === s}
            aria-controls="kit-panel"
            onClick={() => setTab(s)}
            className={cn('min-h-9 rounded-full border px-3 text-xs', tab === s ? 'border-accent bg-accent/10 text-accent-text' : 'border-line-strong text-muted hover:border-accent')}
          >
            {k.kitTabs[s]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="kit-panel" aria-labelledby={`kit-tab-${tab}`} className="grid gap-2">
        {tab === 'youtube' ? (
          <p className="text-xs text-muted">{fill(k.kitBanner, { w: YOUTUBE_BANNER.w, h: YOUTUBE_BANNER.h, sw: YOUTUBE_BANNER.safeW, sh: YOUTUBE_BANNER.safeH })}</p>
        ) : null}
        {blocks.length ? (
          <>
            <div className="flex justify-end">
              <CopyButton text={kit[tab]} label={k.kitCopyAll} />
            </div>
            {blocks.map((b, i) => (
              <div key={i} className="rounded-lg border border-line p-2.5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs text-faint">{fill(k.kitBlock, { n: i + 1 })}</span>
                  <CopyButton text={b} />
                </div>
                <p className="text-sm wrap-anywhere whitespace-pre-wrap">{b}</p>
              </div>
            ))}
          </>
        ) : (
          <p className="text-xs text-faint">{k.kitEmpty}</p>
        )}
      </div>
    </section>
  )
}

export function ContentBody({ item, onAct, extra }: { item: ContentItem; extra?: React.ReactNode; onAct: (item: ContentItem, action: Action, extra?: { note?: string; platform?: string }) => Promise<boolean> }) {
  const [slide, setSlide] = useState(0)
  const [revise, setRevise] = useState<string | null>(null)
  const [platform, setPlatform] = useState(item.platform || 'instagram')
  const [busy, setBusy] = useState(false)
  const video = item.files.find((f) => f.type === 'mp4')
  const slides = item.files.filter((f) => f.type === 'png')
  const current = slides[Math.min(slide, slides.length - 1)]
  const run = async (action: Action, extra?: { note?: string; platform?: string }) => {
    setBusy(true)
    const ok = await onAct(item, action, extra)
    setBusy(false)
    return ok
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={statusTone[item.status]}>{k.statuses[item.status]}</Chip>
        {item.sourceSlug ? <span className="text-xs text-faint">{fill(k.fromArticle, { slug: item.sourceSlug })}</span> : null}
        {item.publishedUrl ? (
          <a href={item.publishedUrl} target="_blank" rel="noreferrer noopener" className="text-xs text-accent-text underline-offset-4 hover:underline">
            {k.openPublished}
          </a>
        ) : null}
      </div>
      {item.error ? <p className="rounded-xl border border-danger/40 p-3 text-sm text-danger">{item.error}</p> : null}
      {item.hook ? <p className="text-sm text-muted">{item.hook}</p> : null}

      {video ? (
        <video key={video.path} controls preload="metadata" playsInline poster={slides[0] ? fileUrl(slides[0].path) : undefined} className="max-h-[60vh] w-full rounded-xl bg-surface-3">
          <source src={fileUrl(video.path)} type="video/mp4" />
        </video>
      ) : null}
      {!video && current ? (
        <div className="grid gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- a private render behind the session proxy */}
          <img src={fileUrl(current.path)} alt={fill(k.slide, { n: slide + 1, total: slides.length })} className="w-full rounded-xl bg-surface-2" />
          {slides.length > 1 ? (
            <div className="flex items-center justify-between gap-2">
              <button type="button" className={btn} disabled={slide === 0} onClick={() => setSlide((s) => s - 1)} aria-label={k.prevSlide}>
                <CaretLeft size={16} aria-hidden="true" />
              </button>
              <span className="font-mono text-xs text-faint">
                {slide + 1} / {slides.length}
              </span>
              <button type="button" className={btn} disabled={slide >= slides.length - 1} onClick={() => setSlide((s) => s + 1)} aria-label={k.nextSlide}>
                <CaretRight size={16} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {!video && !current ? <Empty>{k.noFiles}</Empty> : null}

      {item.kit ? <KitCard kit={item.kit} /> : null}
      <section className={cn('grid gap-2', item.kit && !CAPTION_PLATFORMS.some((p) => item.caption[p]) && 'hidden')}>
        <h3 className="text-sm font-medium">{k.captions}</h3>
        {CAPTION_PLATFORMS.filter((p) => item.caption[p]).map((p) => (
          <div key={p} className="rounded-xl border border-line bg-inset p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-xs text-faint">{k.platforms[p]}</span>
              <CopyButton text={item.caption[p]} />
            </div>
            <p className="text-sm whitespace-pre-wrap">{item.caption[p]}</p>
          </div>
        ))}
        {!item.kit && !CAPTION_PLATFORMS.some((p) => item.caption[p]) ? <p className="text-xs text-faint">{k.noCaptions}</p> : null}
      </section>

      <section className="grid gap-2 border-t border-line pt-4">
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
            <textarea value={revise} onChange={(e) => setRevise(e.target.value)} rows={3} maxLength={2000} placeholder={k.revisePlaceholder} className={inputClass} />
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
      </section>
      {extra}
    </>
  )
}
