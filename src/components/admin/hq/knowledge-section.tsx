'use client'

import { ArrowsClockwise, Plus, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { fill, hq, hqDelete, hqPatch } from '@/components/admin/control/api'
import { btn, btnPrimary, Empty, inputClass, Loading, Offline, useHqView } from '@/components/admin/hub/ui'
import { Pending } from '@/components/ui/pending'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { sectionById } from '@/lib/hq-shell'
import {
  draftProblem,
  emptyDraft,
  emptyKnowledgeFilter,
  isEditable,
  isKnowledgeFilterActive,
  isSource,
  isTier,
  knowledgePath,
  KNOWLEDGE_SOURCES,
  KNOWLEDGE_TIERS,
  normalizeKnowledge,
  normalizeKnowledgeDoc,
  notePatch,
  NOTE_TEXT_MAX,
  NOTE_TITLE_MAX,
  tierCounts,
  type KnowledgeDoc,
  type KnowledgeFilter,
  type KnowledgeItem,
  type KnowledgeTier,
  type NoteDraft,
} from '@/lib/knowledge-hq'
import { Fail, TwoStepDelete, when } from './kq-ui'

const t = admin.hq
const k = admin.hq.knowledge

const field = 'min-h-10 rounded-lg border border-line-strong bg-surface px-2.5 text-sm'
const TIER_STYLE: Record<KnowledgeTier, string> = {
  public: 'border-accent-text/60 text-accent-text',
  internal: 'border-line-strong text-muted',
}

function TierChip({ tier }: { tier: KnowledgeTier }) {
  return (
    <span title={k.tierHints[tier]} className={cn('inline-flex rounded-full border px-2 py-0.5 font-mono text-[11px]', TIER_STYLE[tier])} data-tier={tier}>
      {k.tiers[tier]}
    </span>
  )
}

// The editor of the owner's note: title, level and text. Used for a new note and for an existing one; nothing is cleared on a failure.
function NoteForm({ id, initial, onDone, onCancel }: { id: string | null; initial: NoteDraft; onDone: (savedId: string) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const save = async () => {
    if (busy) return
    const p = draftProblem(draft)
    setProblem(p ? k.problems[p] : null)
    if (p) return
    setBusy(true)
    setError(null)
    const clean = { title: draft.title.trim(), text: draft.text.trim(), tier: draft.tier }
    let res
    if (id) {
      const patch = notePatch(initial, draft)
      if (!patch) {
        setBusy(false)
        setProblem(k.nothingChanged)
        return
      }
      res = await hqPatch<{ item?: { id?: unknown } }>(`knowledge/${encodeURIComponent(id)}`, patch)
    } else {
      res = await hq<{ item?: { id?: unknown } }>('knowledge', clean)
    }
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    const savedId = typeof res.item?.id === 'string' ? res.item.id : (id ?? '')
    onDone(savedId)
  }

  return (
    <form
      className="grid gap-3"
      aria-label={id ? k.edit : k.newNote}
      data-note-form={id ? 'edit' : 'new'}
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <label className="grid gap-1 text-xs text-muted">
        {k.noteTitleLabel}
        <input className={inputClass} value={draft.title} maxLength={NOTE_TITLE_MAX} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        {k.noteTierLabel}
        <select className={field} value={draft.tier} onChange={(e) => setDraft({ ...draft, tier: isTier(e.target.value) ? e.target.value : 'internal' })}>
          {KNOWLEDGE_TIERS.map((x) => (
            <option key={x} value={x}>
              {k.tiers[x]} - {k.tierHints[x]}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs text-muted">
        {k.noteTextLabel}
        <textarea className={cn(inputClass, 'min-h-40')} value={draft.text} maxLength={NOTE_TEXT_MAX} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
      </label>
      {problem ? (
        <p role="alert" className="text-sm text-danger" data-note-problem>
          {problem}
        </p>
      ) : null}
      {error ? <Fail code={error} own={k.errors} onRetry={() => void save()} /> : null}
      <div className="flex flex-wrap gap-2">
        <Pending type="submit" pending={busy} pendingLabel={k.saving} className={btnPrimary}>
          {id ? k.save : k.create}
        </Pending>
        <button type="button" className={btn} onClick={onCancel} disabled={busy}>
          {k.cancel}
        </button>
      </div>
    </form>
  )
}

// One document: its text, and for the owner's notes edit and delete.
function DocPanel({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: (gone?: boolean) => void }) {
  const view = useHqView(`knowledge/${encodeURIComponent(id)}`, normalizeKnowledgeDoc, { visible: 600_000, hidden: 600_000 })
  const [editing, setEditing] = useState(false)
  const [ask, setAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const doc: KnowledgeDoc | null = view.view

  const remove = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    const res = await hqDelete(`knowledge/${encodeURIComponent(id)}`)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onChanged(true)
  }

  return (
    <aside role="dialog" aria-label={k.view} className="rounded-card border border-line bg-surface p-4" data-knowledge-doc={id}>
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1 text-base font-medium break-words">{doc?.title ?? id}</h2>
        <button type="button" className={cn(btn, 'size-10 shrink-0 px-0')} onClick={onClose} aria-label={k.close}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {view.error && !doc ? <Offline error={view.error} onRetry={view.reload} /> : null}
      {!doc && !view.error ? <Loading rows={2} /> : null}
      {doc ? (
        <div className="mt-2 grid gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <TierChip tier={doc.tier} />
            <span>{k.sources[doc.source]}</span>
            <span className="font-mono">{when(doc.updatedAt)}</span>
          </div>
          {editing && isEditable(doc) ? (
            <NoteForm
              id={doc.id}
              initial={{ title: doc.title, text: doc.text, tier: doc.tier }}
              onCancel={() => setEditing(false)}
              onDone={() => {
                setEditing(false)
                void view.reload()
                onChanged()
              }}
            />
          ) : (
            <>
              <pre className="max-h-96 overflow-auto rounded-xl border border-line bg-bg p-3 font-sans text-sm whitespace-pre-wrap" data-doc-text>
                {doc.text}
              </pre>
              {isEditable(doc) ? (
                <div className="grid gap-2">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={btn} onClick={() => setEditing(true)} data-edit-note>
                      {k.edit}
                    </button>
                    <TwoStepDelete
                      open={ask}
                      onOpen={() => setAsk(true)}
                      onCancel={() => setAsk(false)}
                      onConfirm={() => void remove()}
                      pending={busy}
                      testId="note"
                      labels={{ delete: k.delete, ask: fill(k.deleteAsk, { t: doc.title }), yes: k.deleteYes, no: k.deleteNo, busy: k.deleting }}
                    />
                  </div>
                  {error ? <Fail code={error} own={k.errors} onRetry={() => void remove()} /> : null}
                </div>
              ) : (
                <p className="text-xs text-muted">{k.readonly}</p>
              )}
            </>
          )}
        </div>
      ) : null}
    </aside>
  )
}

// Knowledge: the documents of the company package (what the agents may know) with their level, search, the owner's own notes and
// a rebuild of the package. Read from `GET /admin/knowledge`; HQ keeps the texts, the page shows them to the owner only.
export function KnowledgeSection() {
  const info = sectionById('knowledge')!
  const [filter, setFilter] = useState<KnowledgeFilter>(emptyKnowledgeFilter)
  const [q, setQ] = useState('')
  const view = useHqView(knowledgePath(filter), normalizeKnowledge, { visible: 60_000, hidden: 180_000 })
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [rebuildError, setRebuildError] = useState<string | null>(null)
  const [queued, setQueued] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  const data = view.view
  const items: KnowledgeItem[] = data?.items ?? []
  const counts = tierCounts(items)

  const rebuild = async () => {
    if (rebuilding) return
    setRebuilding(true)
    setRebuildError(null)
    setQueued(false)
    const res = await hq<{ queued?: boolean }>('knowledge/rebuild', {})
    setRebuilding(false)
    if (!res.ok) {
      setRebuildError(res.error)
      return
    }
    setQueued(true)
    // HQ answers at once; the new `builtAt` shows up a few seconds later.
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void view.reload(), 4000)
  }

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault()
    setFilter((f) => ({ ...f, q }))
  }
  const reset = () => {
    setQ('')
    setFilter(emptyKnowledgeFilter)
  }

  return (
    <div className="flex min-h-full flex-col" data-section-view="knowledge">
      <div className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
        <div className="flex flex-wrap items-baseline gap-x-3 px-4 pt-3 sm:px-5">
          <h1 className="font-brand text-xl">{info.label}</h1>
          <p className="text-sm text-muted">{t.sectionHints.knowledge}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 px-3 py-2 sm:px-4">
          <form className="flex items-end gap-2" role="search" aria-label={k.search} onSubmit={applySearch}>
            <label className="grid gap-0.5 text-xs text-muted">
              {k.search}
              <input type="search" className={cn(field, 'w-56')} value={q} maxLength={64} placeholder={k.searchPlaceholder} onChange={(e) => setQ(e.target.value)} />
            </label>
            <button type="submit" className={btn}>
              {k.find}
            </button>
          </form>
          <label className="grid gap-0.5 text-xs text-muted">
            {k.tier}
            <select className={field} value={filter.tier} onChange={(e) => setFilter((f) => ({ ...f, tier: isTier(e.target.value) ? e.target.value : '' }))}>
              <option value="">{k.tierAll}</option>
              {KNOWLEDGE_TIERS.map((x) => (
                <option key={x} value={x}>
                  {k.tiers[x]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-0.5 text-xs text-muted">
            {k.source}
            <select className={field} value={filter.source} onChange={(e) => setFilter((f) => ({ ...f, source: isSource(e.target.value) ? e.target.value : '' }))}>
              <option value="">{k.sourceAll}</option>
              {KNOWLEDGE_SOURCES.map((x) => (
                <option key={x} value={x}>
                  {k.sources[x]}
                </option>
              ))}
            </select>
          </label>
          {isKnowledgeFilterActive(filter) || q ? (
            <button type="button" className={btn} onClick={reset}>
              {k.reset}
            </button>
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" className={btn} onClick={() => { setCreating(true); setOpenId(null) }} data-new-note>
              <Plus size={16} aria-hidden="true" />
              {k.newNote}
            </button>
            <Pending pending={rebuilding} pendingLabel={k.rebuilding} onClick={() => void rebuild()} className={btnPrimary} data-rebuild>
              <ArrowsClockwise size={16} aria-hidden="true" />
              {k.rebuild}
            </Pending>
            <button type="button" onClick={() => void view.reload()} className={cn(btn, 'size-10 px-0')} aria-label={k.refresh}>
              <ArrowsClockwise size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {view.error && !data ? <Offline error={view.error} onRetry={view.reload} /> : null}
      {!data && !view.error ? <Loading rows={5} /> : null}
      {data ? (
        <div className={cn('grid gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_26rem]', view.stale && 'opacity-60 transition-opacity')} aria-busy={view.stale}>
          <div className="min-w-0">
            {view.failed ? <Offline error={view.failed} onRetry={view.reload} /> : null}
            {rebuildError ? <Fail code={rebuildError} onRetry={() => void rebuild()} className="mb-3" /> : null}
            {queued ? (
              <p role="status" className="mb-3 rounded-xl border border-accent-text/50 px-3 py-2 text-sm text-accent-text" data-rebuild-queued>
                {k.rebuildQueued}
              </p>
            ) : null}
            <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted" data-built-at>
              <span>{data.builtAt ? fill(k.builtAt, { d: when(data.builtAt) }) : k.neverBuilt}</span>
              <span>
                <TierChip tier="public" /> {counts.public}
              </span>
              <span>
                <TierChip tier="internal" /> {counts.internal}
              </span>
            </p>
            {items.length === 0 ? <Empty>{isKnowledgeFilterActive(filter) ? k.nothing : k.empty}</Empty> : null}
            {items.length > 0 ? (
              <div className="overflow-x-auto rounded-card border border-line bg-surface">
                <table className="w-full min-w-[34rem] text-left text-sm" data-knowledge-list>
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="px-3 py-2 font-normal">{k.columns.title}</th>
                      <th className="px-3 py-2 font-normal">{k.columns.tier}</th>
                      <th className="px-3 py-2 font-normal">{k.columns.source}</th>
                      <th className="px-3 py-2 font-normal">{k.columns.updated}</th>
                      <th className="px-3 py-2 text-right font-normal">{k.columns.size}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((d) => (
                      <tr key={d.id} className={cn('border-t border-line', openId === d.id && 'bg-surface-2')} data-knowledge-item={d.id} data-source={d.source}>
                        <td className="px-3 py-2">
                          <button type="button" className="text-left hover:text-accent-text hover:underline" aria-label={fill(k.open, { t: d.title })} onClick={() => { setOpenId(d.id); setCreating(false) }}>
                            {d.title}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <TierChip tier={d.tier} />
                        </td>
                        <td className="px-3 py-2 text-muted">{k.sources[d.source]}</td>
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-muted tabular-nums">{when(d.updatedAt)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-muted tabular-nums">{d.chars}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <p className="mt-2 text-center text-xs text-faint">{fill(k.shown, { n: items.length, total: data.total })}</p>
            <p className="mt-1 text-center text-[11px] text-faint">{k.note}</p>
          </div>
          <div className="min-w-0">
            {creating ? (
              <section className="rounded-card border border-line bg-surface p-4" aria-label={k.newNote} data-knowledge-new>
                <h2 className="mb-3 text-base font-medium">{k.newNote}</h2>
                <NoteForm
                  id={null}
                  initial={emptyDraft}
                  onCancel={() => setCreating(false)}
                  onDone={(id) => {
                    setCreating(false)
                    if (id) setOpenId(id)
                    void view.reload()
                  }}
                />
              </section>
            ) : null}
            {!creating && openId ? (
              <DocPanel
                key={openId}
                id={openId}
                onClose={() => setOpenId(null)}
                onChanged={(gone) => {
                  if (gone) setOpenId(null)
                  void view.reload()
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
