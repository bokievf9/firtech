'use client'

import { ArrowsClockwise } from '@phosphor-icons/react'
import Link from 'next/link'
import { useState } from 'react'
import { fill, hq } from '@/components/admin/control/api'
import { Empty, Loading, Offline, useHqView, btn } from '@/components/admin/hub/ui'
import { admin } from '@/content/admin'
import { appendEntries, AUDIT_KINDS, auditHref, auditPath, emptyFilter, isAuditKind, isFilterActive, normalizeAudit, type AuditEntry, type AuditFilter, type AuditPage } from '@/lib/audit-hq'
import { cn } from '@/lib/cn'
import { sectionById } from '@/lib/hq-shell'

const t = admin.hq
const a = admin.hq.audit

const field = 'min-h-10 rounded-lg border border-line-strong bg-surface px-2.5 text-sm'
const KIND_DOT: Record<(typeof AUDIT_KINDS)[number], string> = {
  decision: 'bg-dept-sales',
  setting: 'bg-faint',
  instruction: 'bg-dept-marketing',
  trust: 'bg-accent',
  owner: 'bg-dept-production',
}

const when = (iso: string, tz: string) => {
  try {
    return new Intl.DateTimeFormat('ru-RU', { timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(Date.parse(iso))
  } catch {
    return iso.slice(0, 16)
  }
}
const actorName = (id: string) => (a.actors as Record<string, string>)[id] ?? id
const actionName = (e: AuditEntry) => (a.actions as Record<string, string>)[e.action] ?? e.action

// Audit log: decisions, settings, agent instructions, trust levels and owner actions in one list, newest first.
// Read from HQ's `GET /admin/audit`; the list shows ids and kinds only. «Показать ещё» fetches the next page by cursor.
export function AuditSection() {
  const info = sectionById('audit')!
  const [filter, setFilter] = useState<AuditFilter>(emptyFilter)
  const view = useHqView(auditPath(filter), normalizeAudit, { visible: 60_000, hidden: 180_000 })
  // Pages after the first one, loaded by hand; they belong to the filter they were loaded for.
  const [more, setMore] = useState<{ key: string; entries: AuditEntry[]; next: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const key = auditPath(filter)
  const data: AuditPage | null = view.view
  const extra = more && more.key === key ? more : null
  const entries = data ? (extra ? appendEntries(data.entries, extra.entries) : data.entries) : []
  const nextCursor = extra ? extra.next : (data?.nextCursor ?? null)
  const patch = (p: Partial<AuditFilter>) => {
    setMore(null)
    setMoreError(null)
    setFilter((f) => ({ ...f, ...p }))
  }

  const loadMore = async () => {
    if (!nextCursor || busy) return
    setBusy(true)
    setMoreError(null)
    const res = await hq<Record<string, unknown>>(auditPath(filter, nextCursor))
    setBusy(false)
    const page = res.ok ? normalizeAudit(res) : null
    if (!res.ok || !page) {
      setMoreError(res.ok ? 'hq_bad_response' : res.error)
      return
    }
    setMore({ key, entries: appendEntries(extra?.entries ?? [], page.entries), next: page.nextCursor })
  }

  return (
    <div className="flex min-h-full flex-col" data-section-view="audit">
      <div className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
        <div className="flex flex-wrap items-baseline gap-x-3 px-4 pt-3 sm:px-5">
          <h1 className="font-brand text-xl">{info.label}</h1>
          <p className="text-sm text-muted">{t.sectionHints.audit}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 px-3 py-2 sm:px-4" role="group" aria-label={a.filters}>
          <label className="grid gap-0.5 text-xs text-muted">
            {a.kind}
            <select className={field} value={filter.kind} onChange={(e) => patch({ kind: isAuditKind(e.target.value) ? e.target.value : '' })}>
              <option value="">{a.kindAll}</option>
              {AUDIT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {a.kinds[k]}
                  {data ? ` (${data.counts[k]})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-0.5 text-xs text-muted">
            {a.actor}
            <select className={field} value={filter.actor} onChange={(e) => patch({ actor: e.target.value })}>
              <option value="">{a.actorAll}</option>
              {(data?.actors ?? []).map((x) => (
                <option key={x} value={x}>
                  {actorName(x)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-0.5 text-xs text-muted">
            {a.from}
            <input type="date" className={field} value={filter.from} max={filter.to || undefined} onChange={(e) => patch({ from: e.target.value })} />
          </label>
          <label className="grid gap-0.5 text-xs text-muted">
            {a.to}
            <input type="date" className={field} value={filter.to} min={filter.from || undefined} onChange={(e) => patch({ to: e.target.value })} />
          </label>
          {isFilterActive(filter) ? (
            <button type="button" className={btn} onClick={() => patch({ ...emptyFilter })}>
              {a.reset}
            </button>
          ) : null}
          <button type="button" onClick={() => void view.reload()} className={cn(btn, 'ml-auto size-10 px-0')} aria-label={a.refresh}>
            <ArrowsClockwise size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {view.error && !data ? <Offline error={view.error} onRetry={view.reload} /> : null}
      {!data && !view.error ? <Loading rows={5} /> : null}
      {data ? (
        <div className={cn('p-3 sm:p-4', view.stale && 'opacity-60 transition-opacity')} aria-busy={view.stale}>
          {view.failed ? <Offline error={view.failed} onRetry={view.reload} /> : null}
          {entries.length === 0 ? <Empty>{isFilterActive(filter) ? a.nothing : a.empty}</Empty> : null}
          {entries.length > 0 ? (
            <div className="overflow-x-auto rounded-card border border-line bg-surface">
              <table className="w-full min-w-[34rem] text-left text-sm" data-audit-list>
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-normal">{a.columns.when}</th>
                    <th className="px-3 py-2 font-normal">{a.columns.actor}</th>
                    <th className="px-3 py-2 font-normal">{a.columns.what}</th>
                    <th className="px-3 py-2 font-normal">{a.columns.object}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => {
                    const href = auditHref(e)
                    return (
                      <tr key={e.id} className="border-t border-line align-top" data-audit-entry={e.id} data-kind={e.kind}>
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-muted tabular-nums">{when(e.at, data.tz)}</td>
                        <td className="px-3 py-2">{actorName(e.actor)}</td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-1.5">
                            <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', KIND_DOT[e.kind])} />
                            {href ? (
                              <Link href={href} className="hover:text-accent-text hover:underline">
                                {actionName(e)}
                              </Link>
                            ) : (
                              actionName(e)
                            )}
                          </span>
                          <span className="block text-xs text-faint">{a.kinds[e.kind]}</span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs break-all text-muted">
                          {[e.objectType, e.objectId, e.detail].filter(Boolean).join(' ')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
          {moreError ? <Offline error={moreError} onRetry={loadMore} /> : null}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs text-faint">
            <span>{fill(a.shown, { n: entries.length, total: data.total })}</span>
            {nextCursor ? (
              <button type="button" className={btn} onClick={() => void loadMore()} disabled={busy} aria-busy={busy} data-audit-more>
                {busy ? a.loadingMore : a.more}
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-center text-[11px] text-faint">{a.note}</p>
        </div>
      ) : null}
    </div>
  )
}
