'use client'

import { ArrowSquareOut, Warning } from '@phosphor-icons/react'
import Link from 'next/link'
import { btn, btnPrimary, inputClass } from '@/components/admin/hub/ui'
import { Chip } from '@/components/admin/pult/bits'
import { LeadBreakdown } from '@/components/admin/pult/lead-breakdown'
import { cn } from '@/lib/cn'
import {
  comparePair,
  fieldsOf,
  leadBreakdownInput,
  metaCards,
  metaChips,
  publishedUrl,
  versionChanges,
  versionSummary,
  type FieldKey,
  type ReviewItem,
} from '@/lib/review'

export type DetailsProps = {
  item: ReviewItem
  editing: boolean
  values: Partial<Record<FieldKey, string>>
  onValue: (key: FieldKey, value: string) => void
  onSave: () => void
  onCancelEdit: () => void
  viewVersion: number | null
  onViewVersion: (v: number | null) => void
  reviseOpen: boolean
  note: string
  onNote: (v: string) => void
  onSendRevise: () => void
  onCancelRevise: () => void
  busy: boolean
  onOpenId: (id: string) => void
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')

// The right column: the text fields (read-only until «Править»), versions, the revise note, meta and
// the cards of the lead / ticket / invoice the material is about.
export function Details(p: DetailsProps) {
  const { item } = p
  const version = p.viewVersion === null ? null : item.versions.find((v) => v.v === p.viewVersion) ?? null
  const shown: ReviewItem = version ? { ...item, text: version.text, actions: [] } : item
  const fields = fieldsOf(shown)
  const pair = comparePair(item)
  const cards = metaCards(item)
  const chips = metaChips(item)
  const url = publishedUrl(item)
  const revision = item.meta.revision as { state?: string; reviewId?: string | null } | undefined
  const editing = p.editing && !version
  const breakdown = leadBreakdownInput(item)

  return (
    <div className="grid content-start gap-5 p-4">
      <header className="grid gap-1.5">
        <h2 className="text-base leading-snug font-semibold">{item.title || item.summary}</h2>
        {item.summary && item.summary !== item.title ? <p className="text-sm text-muted">{item.summary}</p> : null}
        <p className="font-mono text-xs text-faint">
          {item.id} · {when(item.createdAt)}
        </p>
      </header>

      {item.error ? (
        <p role="alert" className="flex gap-2 rounded-xl border border-danger/50 p-3 text-sm text-danger">
          <Warning size={18} weight="fill" aria-hidden="true" className="mt-0.5 shrink-0" />
          {item.error}
        </p>
      ) : null}
      {url ? (
        <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-sm text-accent-text underline">
          <ArrowSquareOut size={14} aria-hidden="true" />
          Открыть опубликованное
        </a>
      ) : null}
      {revision?.state ? (
        <p className="rounded-xl border border-dashed border-line-strong p-3 text-sm text-muted">
          {revision.state === 'delivered' && revision.reviewId ? (
            <>
              Отдел сдал новую версию по вашим правкам.{' '}
              <button type="button" onClick={() => p.onOpenId(revision.reviewId!)} className="text-accent-text underline">
                Открыть
              </button>
            </>
          ) : (
            'Отдел переделывает материал по вашим правкам. Этот останется, пока вы не решите.'
          )}
        </p>
      ) : null}

      {item.versions.length > 1 ? (
        <section aria-label="Версии" className="grid gap-2">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Версия текста">
            {item.versions.map((v) => {
              const active = (p.viewVersion ?? item.currentVersion) === v.v
              return (
                <button
                  key={v.v}
                  type="button"
                  aria-pressed={active}
                  onClick={() => p.onViewVersion(v.v === item.currentVersion ? null : v.v)}
                  className={cn('inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm', active ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-muted hover:text-fg')}
                >
                  v{v.v}
                  <span className="text-xs opacity-70">{v.author === 'owner' ? 'вы' : 'отдел'}</span>
                </button>
              )
            })}
          </div>
          {pair ? <p className="text-xs text-muted">{versionSummary(pair[0], pair[1])}</p> : null}
          {version?.note ? <p className="text-xs text-faint">Заметка к версии: {version.note}</p> : null}
          {pair ? (
            <div className="hidden gap-2 min-[1440px]:grid">
              {versionChanges(pair[0], pair[1]).map((c) => (
                <div key={c.key} className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-line bg-inset p-2">
                    <p className="mb-1 text-faint">v{pair[0].v}: {c.label}</p>
                    <p className="whitespace-pre-wrap">{c.before || 'пусто'}</p>
                  </div>
                  <div className="rounded-xl border border-accent/40 bg-inset p-2">
                    <p className="mb-1 text-accent-text">v{pair[1].v}: {c.label}</p>
                    <p className="whitespace-pre-wrap">{c.after || 'пусто'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section aria-label="Тексты" className="grid gap-4">
        {version ? <p className="rounded-xl bg-surface-2 p-2 text-xs text-muted">Показана версия v{version.v}. Править можно только текущую.</p> : null}
        {fields.length ? (
          fields.map((f) => (
            <div key={f.key} className="grid gap-1.5">
              <label htmlFor={`f-${f.key}`} className="text-xs text-faint">{f.label}</label>
              {editing && f.editable ? (
                <textarea
                  id={`f-${f.key}`}
                  rows={f.rows}
                  value={p.values[f.key] ?? f.value}
                  onChange={(e) => p.onValue(f.key, e.target.value)}
                  className={cn(inputClass, 'resize-y leading-relaxed')}
                />
              ) : (
                <p id={`f-${f.key}`} className="rounded-xl bg-inset px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">{f.value || 'пусто'}</p>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted">Текст смотрите в центре экрана.</p>
        )}
        {editing ? (
          <div className="flex gap-2">
            <button type="button" onClick={p.onSave} disabled={p.busy} className={btnPrimary}>Сохранить правку</button>
            <button type="button" onClick={p.onCancelEdit} className={btn}>Отмена</button>
          </div>
        ) : null}
      </section>

      {p.reviseOpen ? (
        <section aria-label="Правки" className="grid gap-2 rounded-2xl border border-accent/40 bg-inset p-3">
          <label htmlFor="revise-note" className="text-sm font-medium">Что поправить</label>
          <p className="text-xs text-muted">Отдел напишет новый материал по вашему замечанию. Этот останется, пока вы не решите.</p>
          <textarea
            id="revise-note"
            rows={4}
            value={p.note}
            maxLength={4000}
            onChange={(e) => p.onNote(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                p.onSendRevise()
              }
            }}
            placeholder="Например: хук короче, убери второй слайд"
            className={cn(inputClass, 'resize-y')}
          />
          <div className="flex gap-2">
            <button type="button" disabled={!p.note.trim() || p.busy} onClick={p.onSendRevise} className={btnPrimary}>Отправить правки</button>
            <button type="button" onClick={p.onCancelRevise} className={btn}>Отмена</button>
          </div>
        </section>
      ) : null}

      {chips.length ? (
        <section aria-label="Данные" className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <Chip key={c.id}>{c.label}: {c.value}</Chip>
          ))}
        </section>
      ) : null}

      {breakdown ? <LeadBreakdown input={breakdown} /> : null}

      {cards.map((c) => (
        <section key={c.id} className="grid gap-1.5 rounded-2xl border border-line bg-inset p-3">
          <h3 className="text-sm font-medium">{c.title}</h3>
          {c.lines.map((l) => (
            <p key={l} className="text-xs break-words text-muted">{l}</p>
          ))}
          {c.href ? (
            c.href.startsWith('/') ? (
              <Link href={c.href} className="inline-flex min-h-9 items-center gap-1 self-start text-sm text-accent-text underline">
                {c.linkLabel}
              </Link>
            ) : (
              <a href={c.href} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-9 items-center gap-1 self-start text-sm text-accent-text underline">
                {c.linkLabel}
              </a>
            )
          ) : null}
        </section>
      ))}

      {item.versions[0]?.note && item.meta.source === 'owner_link' ? (
        <section className="grid gap-1.5">
          <h3 className="text-xs text-faint">Разбор ссылки</h3>
          <p className="rounded-xl bg-inset px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">{item.versions[0].note}</p>
        </section>
      ) : null}
    </div>
  )
}
