'use client'

import { useRef, useState } from 'react'
import { errText, fill, hq } from '@/components/admin/control/api'
import { btn, btnPrimary, Empty, inputClass, Loading, Offline, useConfirm, useHqView, useHub } from '@/components/admin/hub/ui'
import { RichEditor, type RichHandle } from '@/components/admin/review/rich-editor'
import { Markdown } from '@/components/admin/shell-crm/markdown'
import { Pending } from '@/components/ui/pending'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { MAX_RULES, normalizeRules } from '@/lib/marketing-chat'

const m = admin.pult.content.marketing.rules
const stamp = (iso: string) => (iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '')

// `/admin/content?tab=rules`: the marketing rules text (the instructions of Head of Marketing), read as markdown, edited in the
// rich editor, saved as a version, with the history and a rollback. A rollback adds a new version, so nothing is lost.
export function MarketingRules() {
  const { notify } = useHub()
  const { ask, dialog } = useConfirm()
  const feed = useHqView('marketing/rules', normalizeRules, { visible: 30_000, hidden: 300_000 })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'save' | number | null>(null)
  const rich = useRef<RichHandle>(null)

  if (!feed.view) return feed.error ? <Offline error={feed.error} onRetry={() => feed.reload()} /> : <Loading />
  const rules = feed.view
  const trimmed = draft.trim()
  const problem = !trimmed ? m.empty : trimmed.length > MAX_RULES ? fill(m.tooLong, { max: MAX_RULES }) : trimmed === rules.text.trim() ? m.unchanged : null

  async function save() {
    if (problem || busy) return
    setBusy('save')
    const res = await hq<Record<string, unknown>>('marketing/rules', { text: trimmed, ...(note.trim() ? { note: note.trim() } : {}) }, 'PUT')
    if (!res.ok) {
      setBusy(null)
      return notify(fill(m.saveFailed, { e: errText(res.error) }), 'error')
    }
    await feed.reload()
    setBusy(null)
    setEditing(false)
    setNote('')
    notify(fill(m.saved, { n: normalizeRules(res)?.version ?? '' }))
  }

  async function rollback(version: number) {
    if (busy || !(await ask(fill(m.confirmRollback, { n: version }), { yes: m.confirmYes }))) return
    setBusy(version)
    const res = await hq<Record<string, unknown>>('marketing/rules/rollback', { version })
    if (!res.ok) {
      setBusy(null)
      return notify(fill(m.rollbackFailed, { e: errText(res.error) }), 'error')
    }
    await feed.reload()
    setBusy(null)
    setEditing(false)
    notify(fill(m.rolledBack, { n: normalizeRules(res)?.version ?? '' }), 'info')
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-3 sm:p-4" data-marketing-rules>
      <div className="grid gap-1">
        <h2 className="text-base font-medium">{m.title}</h2>
        <p className="text-xs text-muted">{m.hint}</p>
      </div>
      <section className="grid gap-3 rounded-xl border border-line bg-inset p-3 sm:p-4" aria-label={m.title}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-ink" data-rules-version>
            {fill(m.version, { n: rules.version })}
          </span>
          {!editing ? (
            <button
              type="button"
              className={cn(btn, 'ml-auto')}
              onClick={() => {
                setDraft(rules.text)
                setEditing(true)
              }}
              data-rules-edit
            >
              {m.edit}
            </button>
          ) : null}
        </div>
        {editing ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label={m.editorLabel}>
              {(['bold', 'italic', 'heading', 'list'] as const).map((kind) => (
                <button key={kind} type="button" className={cn(btn, '!min-h-8 !px-3 !text-xs')} onMouseDown={(e) => e.preventDefault()} onClick={() => rich.current?.format(kind)}>
                  {m[kind]}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-line bg-field p-3" data-rules-editor>
              <RichEditor ref={rich} value={draft} onChange={setDraft} label={m.editorLabel} />
            </div>
            <label className="grid gap-1.5 text-xs text-muted">
              {m.noteLabel}
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={inputClass} data-rules-note />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Pending pending={busy === 'save'} pendingLabel={admin.hq.loading} disabled={problem !== null} onClick={() => void save()} className={btnPrimary} data-rules-save>
                {m.save}
              </Pending>
              <button type="button" className={btn} onClick={() => setEditing(false)}>
                {m.cancel}
              </button>
              {problem ? <span className="text-xs text-muted">{problem}</span> : null}
            </div>
          </div>
        ) : (
          <div className="grid gap-2 wrap-anywhere" data-rules-text>
            <Markdown text={rules.text} />
          </div>
        )}
      </section>
      <section className="grid gap-2" aria-label={m.historyTitle}>
        <h3 className="text-sm font-medium">{m.historyTitle}</h3>
        {rules.history.length ? (
          <ul className="grid gap-1" data-rules-history>
            {rules.history.map((v) => (
              <li key={v.version} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-xs" data-rules-version-row={v.version}>
                <span className="font-mono">v{v.version}</span>
                {v.version === rules.version ? <span className="rounded-full bg-accent px-1.5 text-[10px] text-accent-ink">{m.current}</span> : null}
                <span className="min-w-0 flex-1 truncate text-muted">{v.note}</span>
                <span className="text-faint">{stamp(v.at)}</span>
                {v.version !== rules.version ? (
                  <button type="button" className={cn(btn, '!min-h-8 !px-3 !text-xs')} onClick={() => void rollback(v.version)} aria-busy={busy === v.version} data-rules-rollback={v.version}>
                    {m.rollback}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{m.noHistory}</Empty>
        )}
      </section>
      {dialog}
    </div>
  )
}
