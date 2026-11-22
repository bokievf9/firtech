'use client'

import { FileText, PencilSimpleLine } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { admin } from '@/content/admin'
import { formatUsd, groupDocumentsByKind, relativeDate, statusChips, visibleDocuments, type CrmDocument } from '@/lib/admin-crm-hq'
import { DocEditor } from '@/components/admin/review/doc-editor'
import { cn } from '@/components/admin/kit'
import { btn, useHqView, useHub } from '@/components/admin/hub/ui'
import { targetBase, targetForRow, versionSavePayload, whyNotEditable, withDocText, type DocTarget } from '@/lib/doc-editor'
import { normalizeItem, normalizeReview, replaceItem } from '@/lib/review'
import { errText, fill, hq } from './api'
import { CcPanel } from './cc-panel'
import type { CrmFeed } from './crm-hq-data'
import { CabinetDocsBlock } from './cabinet-docs-block'
import { Chips, Count, FeedBody, label, Pill, Search, t } from './crm-hq-ui'

const k = admin.crm.hq.documents

// The Director's view: the newest documents first, one group per client.
function groupByClient(docs: CrmDocument[]) {
  const groups = new Map<string, CrmDocument[]>()
  for (const d of docs) groups.set(d.client || k.noClient, [...(groups.get(d.client || k.noClient) ?? []), d])
  return [...groups.entries()].map(([client, items]) => ({ key: client, title: client, items }))
}

// «Документы»: contracts, offers, estimates and invoices, grouped by kind. Invoices show the amount
// and number; every row shows the excerpt HQ sends (the file itself is not in the database).
export function DocumentsPanel({
  feed,
  badge,
  now,
  className,
  by = 'kind',
  focus = null,
}: {
  feed: CrmFeed<CrmDocument>
  badge: string | null
  now: number
  className?: string
  // `kind`: the back-office tab (grouped by kind). `client`: the Director's tab, the latest documents grouped by client.
  by?: 'kind' | 'client'
  // A document id from a link or ⌘K: its row is scrolled into view and highlighted.
  focus?: string | null
}) {
  const scrolled = useRef<string | null>(null)
  const listItems = feed.list
  useEffect(() => {
    if (!focus || scrolled.current === focus || !listItems) return
    const el = document.querySelector<HTMLElement>(`[data-document="${focus.replace(/["\\]/g, '')}"]`)
    if (!el) return
    scrolled.current = focus
    el.scrollIntoView({ block: 'center' })
  }, [focus, listItems])
  const [kind, setKind] = useState('all')
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  // Every row opens in the same full-screen editor as the review centre: the review item behind it is
  // found among all items (pending and decided), HQ's `actions` say whether it may be edited now.
  const { notify } = useHub()
  const review = useHqView('review?status=all&limit=200', normalizeReview, { visible: 30_000, hidden: 120_000 })
  const [editing, setEditing] = useState<string | null>(null)
  const all = useMemo(() => review.view?.items ?? [], [review.view])
  const editTarget: DocTarget | null = useMemo(() => {
    if (!editing) return null
    const row = (feed.list?.items ?? []).find((d) => d.id === editing)
    return row ? targetForRow(row, all) : null
  }, [editing, feed.list, all])
  const saveDoc = async (target: DocTarget, text: string) => {
    const it = target.item
    const payload = versionSavePayload(it, text, target.doc)
    if (!payload) {
      notify('The text did not change')
      return true
    }
    const res = await hq<{ item?: unknown }>(`review/${encodeURIComponent(it.id)}`, payload)
    if (!res.ok) {
      notify(fill('Failed: {e}.', { e: errText(res.error) }), 'error')
      return false
    }
    const fresh = normalizeItem(res.item)
    review.mutate((v) => ({ ...v, items: fresh ? replaceItem(v.items, fresh) : v.items.map((x) => (x.id === it.id ? withDocText(x, text, target.doc) : x)) }))
    notify(fresh ? `Saved as version v${fresh.currentVersion}` : 'Edit saved, version added')
    feed.reload()
    return true
  }
  const items = useMemo(() => feed.list?.items ?? [], [feed.list])
  const shown = useMemo(() => visibleDocuments(items, { kind, status, q }), [items, kind, status, q])
  const groups = useMemo(() => (by === 'client' ? groupByClient(shown) : groupDocumentsByKind(shown).map((g) => ({ key: g.kind, title: label(k.kinds, g.kind), items: g.items }))), [shown, by])
  const kinds = useMemo(() => groupDocumentsByKind(items).map((g) => g.kind), [items])
  const statuses = useMemo(() => statusChips(items, []).map((c) => c.status), [items])

  return (
    <CcPanel id="documents" title={k.title} icon={<FileText size={18} aria-hidden="true" />} badge={badge} className={className}>
      <div className="grid gap-3 p-3 sm:p-4">
        <p className="text-xs text-faint">{k.hint}</p>
        {by === 'kind' ? <CabinetDocsBlock now={now} /> : null}
        <FeedBody feed={feed}>
          {(list) => (
            <>
              <Chips name={k.kind} value={kind} onChange={setKind} chips={[{ key: 'all', label: t.all }, ...kinds.map((x) => ({ key: x, label: label(k.kinds, x) }))]} />
              <Chips
                name={t.status}
                value={status}
                onChange={setStatus}
                chips={[{ key: 'all', label: t.all }, ...statuses.map((x) => ({ key: x, label: label(k.statuses, x) }))]}
              />
              <Search value={q} onChange={setQ} placeholder={k.search} />
              {!items.length ? <p className="p-3 text-sm text-muted">{t.empty}</p> : null}
              {items.length && !shown.length ? <p className="p-3 text-sm text-muted">{t.nothing}</p> : null}
              {shown.length ? (
                <>
                  <Count shown={shown.length} list={list} />
                  <div className="grid max-h-[34rem] gap-3 overflow-y-auto overscroll-contain">
                    {groups.map((g) => (
                      <section key={g.key} aria-label={g.title}>
                        <h3 className="mb-1 px-3 text-xs text-faint">{g.title}</h3>
                        <ul className="grid grid-cols-[minmax(0,1fr)] gap-0.5">
                          {g.items.map((d) => (
                            <li key={d.id} data-document={d.id} aria-current={d.id === focus ? 'true' : undefined} className={cn('rounded-xl px-3 py-2.5 hover:bg-surface-3', d.id === focus && 'bg-accent/10 ring-1 ring-accent-text/50')}>
                              <span className="flex items-center justify-between gap-3">
                                <span className="min-w-0 truncate text-sm font-medium">{d.title || label(k.kindOne, d.kind)}</span>
                                <Pill tone={d.status === 'pending' || d.status === 'draft' || d.status === 'issued' ? 'accent' : 'plain'}>
                                  {label(k.statuses, d.status)}
                                </Pill>
                              </span>
                              <span className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-muted">
                                <span className="truncate">{d.client || k.noClient}</span>
                                {d.amountUsd !== null ? <span className="font-mono tabular-nums text-fg">{formatUsd(d.amountUsd)}</span> : null}
                              </span>
                              {(() => {
                                const target = targetForRow(d, all)
                                return (
                                  <button
                                    type="button"
                                    className={`${btn} mt-2 min-h-9`}
                                    disabled={!target}
                                    title={target ? undefined : review.view ? whyNotEditable(d) : 'Loading document cards'}
                                    onClick={() => setEditing(d.id)}
                                  >
                                    <PencilSimpleLine size={15} aria-hidden="true" />
                                    Edit
                                  </button>
                                )
                              })()}
                              {d.excerpt && d.excerpt !== d.title ? <span className="mt-1 line-clamp-2 block text-sm text-faint">{d.excerpt}</span> : null}
                              <span className="mt-1 block font-mono text-xs text-faint">
                                {[d.number ? fill(k.number, { n: d.number }) : '', relativeDate(d.createdAt, now)].filter(Boolean).join(' · ')}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          )}
        </FeedBody>
      </div>
      {editTarget ? (
        <DocEditor
          key={editTarget.storageId}
          title={editTarget.doc ? `${editTarget.item.title || editTarget.item.summary}: ${editTarget.title}` : editTarget.title}
          subtitle="Document"
          initial={editTarget.value}
          baseText={targetBase(editTarget)}
          storageId={editTarget.storageId}
          onSave={(text) => saveDoc(editTarget, text)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </CcPanel>
  )
}
