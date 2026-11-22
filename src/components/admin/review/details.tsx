'use client'

import { ArrowSquareOut, Warning } from '@phosphor-icons/react'
import Link from 'next/link'
import { RateButtons } from '@/components/admin/hq/rate-buttons'
import { isReplyKind } from '@/lib/quality-hq'
import { btn, btnPrimary, inputClass } from '@/components/admin/hub/ui'
import { Chip } from '@/components/admin/shell-crm/bits'
import { LeadBreakdown } from '@/components/admin/shell-crm/lead-breakdown'
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

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')

// The right column: the text fields (read-only until «Edit»), versions, the revise note, meta and
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
        <h2 className="text-base leading-snug font-semibold wrap-anywhere">{item.title || item.summary}</h2>
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
        <a href={url} className="inline-flex items-center gap-1.5 text-sm text-accent-text underline">
          <ArrowSquareOut size={14} aria-hidden="true" />
          Open the published item
        </a>
      ) : null}
      {revision?.state ? (
        <p className="rounded-xl border border-dashed border-line-strong p-3 text-sm text-muted">
          {revision.state === 'delivered' && revision.reviewId ? (
            <>
              The department delivered a new version from your edits.{' '}
              <button type="button" onClick={() => p.onOpenId(revision.reviewId!)} className="text-accent-text underline">
                Open
              </button>
            </>
          ) : (
            'The department is redoing the material from your edits. This one stays until you decide.'
          )}
        </p>
      ) : null}

      {isReplyKind(item.kind) ? <RateButtons messageId={item.id} thread="review" /> : null}

      {item.versions.length > 1 ? (
        <section aria-label="Versions" className="grid gap-2">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Text version">
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
                  <span className="text-xs opacity-70">{v.author === 'owner' ? 'you' : 'department'}</span>
                </button>
              )
            })}
          </div>
          {pair ? <p className="text-xs text-muted">{versionSummary(pair[0], pair[1])}</p> : null}
          {version?.note ? <p className="text-xs text-faint">Version note: {version.note}</p> : null}
          {pair ? (
            <div className="hidden gap-2 min-[1440px]:grid">
              {versionChanges(pair[0], pair[1]).map((c) => (
                <div key={c.key} className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-line bg-inset p-2">
                    <p className="mb-1 text-faint">v{pair[0].v}: {c.label}</p>
                    <p className="whitespace-pre-wrap">{c.before || 'empty'}</p>
                  </div>
                  <div className="rounded-xl border border-accent/40 bg-inset p-2">
                    <p className="mb-1 text-accent-text">v{pair[1].v}: {c.label}</p>
                    <p className="whitespace-pre-wrap">{c.after || 'empty'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section aria-label="Texts" className="grid gap-4">
        {version ? <p className="rounded-xl bg-surface-2 p-2 text-xs text-muted">Showing version v{version.v}. Only the current one can be edited.</p> : null}
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
                <p id={`f-${f.key}`} className="rounded-xl bg-inset px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere">{f.value || 'empty'}</p>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted">Read the text in the center of the screen.</p>
        )}
        {editing ? (
          <div className="flex gap-2">
            <button type="button" onClick={p.onSave} disabled={p.busy} className={btnPrimary}>Save edit</button>
            <button type="button" onClick={p.onCancelEdit} className={btn}>Cancel</button>
          </div>
        ) : null}
      </section>

      {p.reviseOpen ? (
        <section aria-label="Edits" className="grid gap-2 rounded-2xl border border-accent/40 bg-inset p-3">
          <label htmlFor="revise-note" className="text-sm font-medium">What to fix</label>
          <p className="text-xs text-muted">The department will write new material from your note. This one stays until you decide.</p>
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
            placeholder="For example: shorter hook, remove the second slide"
            className={cn(inputClass, 'resize-y')}
          />
          <div className="flex gap-2">
            <button type="button" disabled={!p.note.trim() || p.busy} onClick={p.onSendRevise} className={btnPrimary}>Send revisions</button>
            <button type="button" onClick={p.onCancelRevise} className={btn}>Cancel</button>
          </div>
        </section>
      ) : null}

      {chips.length ? (
        <section aria-label="Data" className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <Chip key={c.id}>{c.label}: {c.value}</Chip>
          ))}
        </section>
      ) : null}

      {breakdown ? <LeadBreakdown input={breakdown} /> : null}

      {cards.map((c) => (
        <section key={c.id} className="grid gap-1.5 rounded-2xl border border-line bg-inset p-3">
          <h3 className="text-sm font-medium wrap-anywhere">{c.title}</h3>
          {c.lines.map((l) => (
            <p key={l} className="text-xs break-words text-muted">{l}</p>
          ))}
          {c.href ? (
            c.href.startsWith('/') ? (
              <Link href={c.href} className="inline-flex min-h-9 items-center gap-1 self-start text-sm text-accent-text underline">
                {c.linkLabel}
              </Link>
            ) : (
              <a href={c.href} className="inline-flex min-h-9 items-center gap-1 self-start text-sm text-accent-text underline">
                {c.linkLabel}
              </a>
            )
          ) : null}
        </section>
      ))}

      {item.versions[0]?.note && item.meta.source === 'owner_link' ? (
        <section className="grid gap-1.5">
          <h3 className="text-xs text-faint">Link breakdown</h3>
          <p className="rounded-xl bg-inset px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere">{item.versions[0].note}</p>
        </section>
      ) : null}
    </div>
  )
}
