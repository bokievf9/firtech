'use client'

import { MagnifyingGlass } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { hq } from '@/components/admin/control/api'
import { admin } from '@/content/admin'
import { normalizeProjects } from '@/lib/admin-crm-hq'
import { cn } from '@/lib/cn'
import { normalizeInvoices, normalizeLeads, searchPalette, type PaletteEntry } from '@/lib/pult'

const p = admin.hub.palette

export type PaletteItem = PaletteEntry & { run: () => void }

type Raw = Record<string, unknown>
const DEBOUNCE_MS = 250

// Searches HQ for the query (leads, clients, projects, invoices; `?q=` on each list, 8 rows each).
async function remote(q: string, open: (panel: string, tab: string, focus: string) => void): Promise<PaletteItem[]> {
  const enc = encodeURIComponent(q)
  const [leads, clients, projects, invoices] = await Promise.all([
    hq<Raw>(`crm/leads?q=${enc}&limit=8`),
    hq<Raw>(`crm/clients?q=${enc}&limit=8`),
    hq<Raw>(`crm/projects?q=${enc}&limit=8`),
    hq<Raw>(`crm/invoices?q=${enc}&limit=8`),
  ])
  const out: PaletteItem[] = []
  if (leads.ok)
    for (const l of normalizeLeads(leads)?.items ?? [])
      out.push({ id: `lead:${l.id}`, group: p.groups.leads, title: l.name || l.contact, hint: [l.service, l.contact].filter(Boolean).join(' · '), keywords: q, run: () => open('sales', 'leads', String(l.id)) })
  if (clients.ok && Array.isArray(clients.items))
    for (const raw of clients.items.slice(0, 8)) {
      const r = (raw && typeof raw === 'object' ? raw : {}) as Raw
      const id = typeof r.id === 'string' || typeof r.id === 'number' ? String(r.id) : null
      const name = typeof r.name === 'string' ? r.name.slice(0, 120) : ''
      if (!id || !name) continue
      out.push({ id: `client:${id}`, group: p.groups.clients, title: name, hint: typeof r.contact === 'string' ? r.contact.slice(0, 80) : '', keywords: q, run: () => open('sales', 'clients', id) })
    }
  if (projects.ok)
    for (const pr of normalizeProjects(projects)?.items ?? [])
      out.push({ id: `project:${pr.id}`, group: p.groups.projects, title: [pr.client, pr.what].filter(Boolean).join(' · '), hint: pr.status, keywords: q, run: () => open('production', 'projects', String(pr.id)) })
  if (invoices.ok)
    for (const inv of normalizeInvoices(invoices)?.items ?? [])
      out.push({ id: `invoice:${inv.id}`, group: p.groups.invoices, title: `${inv.number} · ${inv.client}`, hint: inv.title, keywords: q, run: () => open('backoffice', 'invoices', inv.id) })
  return out
}

// ⌘K: one input over everything. Local entries (departments, commands, loaded content) filter as you
// type; HQ is asked after a short pause. Arrows move, Enter runs, Escape closes.
export function CommandPalette({
  open,
  onClose,
  entries,
  onOpen,
}: {
  open: boolean
  onClose: () => void
  entries: PaletteItem[]
  onOpen: (panel: string, tab: string, focus: string) => void
}) {
  return <AnimatePresence>{open ? <PaletteBody key="palette" onClose={onClose} entries={entries} onOpen={onOpen} /> : null}</AnimatePresence>
}

// Mounted only while open, so every opening starts with an empty query.
function PaletteBody({
  onClose,
  entries,
  onOpen,
}: {
  onClose: () => void
  entries: PaletteItem[]
  onOpen: (panel: string, tab: string, focus: string) => void
}) {
  const open = true
  const [q, setQ] = useState('')
  const [found, setFound] = useState<{ q: string; items: PaletteItem[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const openRef = useRef(onOpen)
  useEffect(() => {
    openRef.current = onOpen
  })

  useEffect(() => {
    requestAnimationFrame(() => input.current?.focus())
  }, [])

  useEffect(() => {
    const term = q.trim()
    if (!open || term.length < 2) return
    let alive = true
    const id = setTimeout(async () => {
      setBusy(true)
      const items = await remote(term, (...a) => openRef.current(...a))
      if (!alive) return
      setBusy(false)
      setFound({ q: term, items })
    }, DEBOUNCE_MS)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [q, open])

  const results = useMemo(() => {
    const local = searchPalette(entries, q, 30)
    const term = q.trim()
    const extra = term.length >= 2 && found?.q === term ? found.items.filter((r) => !local.some((l) => l.id === r.id)) : []
    return [...local, ...extra]
  }, [entries, q, found])
  const current = Math.min(active, Math.max(0, results.length - 1))

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${current}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [current])

  const run = (item: PaletteItem | undefined) => {
    if (!item) return
    onClose()
    item.run()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(results.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(results[current])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
  }

  let lastGroup = ''
  return (
        <motion.div
          className="fixed inset-0 z-[75] flex items-start justify-center bg-black/50 p-3 pt-[12vh] sm:p-6 sm:pt-[14vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={p.label}
            initial={{ y: -8, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-card border border-line-strong bg-surface shadow-2xl"
          >
            <label className="flex items-center gap-3 border-b border-line px-4">
              <MagnifyingGlass size={18} aria-hidden="true" className="shrink-0 text-muted" />
              <span className="sr-only">{p.label}</span>
              <input
                ref={input}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setActive(0)
                }}
                onKeyDown={onKey}
                placeholder={p.placeholder}
                role="combobox"
                aria-expanded="true"
                aria-controls="hub-palette-list"
                aria-activedescendant={results[current] ? `hub-palette-${current}` : undefined}
                className="ym-disable-keys h-14 min-w-0 flex-1 bg-transparent text-base text-fg outline-none"
              />
              {busy ? <span className="text-xs text-faint">{p.searching}</span> : null}
            </label>
            <ul ref={list} id="hub-palette-list" role="listbox" className="min-h-0 flex-1 overflow-y-auto p-2">
              {results.map((r, i) => {
                const head = r.group !== lastGroup ? r.group : null
                lastGroup = r.group
                return (
                  <li key={r.id} role="presentation">
                    {head ? <p className="px-3 pt-2 pb-1 text-xs text-faint">{head}</p> : null}
                    <button
                      type="button"
                      role="option"
                      id={`hub-palette-${i}`}
                      data-index={i}
                      aria-selected={i === current}
                      onMouseMove={() => setActive(i)}
                      onClick={() => run(r)}
                      className={cn('flex w-full items-baseline gap-3 rounded-xl px-3 py-2 text-left text-sm', i === current && 'bg-surface-2')}
                    >
                      <span className="min-w-0 flex-1 truncate">{r.title}</span>
                      {r.hint ? <span className="max-w-[45%] shrink-0 truncate text-xs text-faint">{r.hint}</span> : null}
                    </button>
                  </li>
                )
              })}
              {!results.length ? <li className="px-3 py-6 text-center text-sm text-muted">{busy ? p.searching : p.empty}</li> : null}
            </ul>
            <p className="border-t border-line px-4 py-2 text-xs text-faint">{p.hint}</p>
          </motion.div>
        </motion.div>
  )
}
