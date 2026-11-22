'use client'

import { useHub } from '@/components/admin/hub/ui'
import { ArrowSquareOut, Copy, Phone, TelegramLogo, X } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { admin, fillAdmin } from '@/content/admin'
import { describeError } from '@/lib/errors'
import {
  adminStatuses,
  contactLinks,
  formatDateTime,
  formatSlot,
  leadPageLink,
  type AdminLead,
} from '@/lib/admin-data'
import { cn } from '@/lib/cn'
import { estimateAsText } from '@/lib/lead'
import type { LeadStatus } from '@/lib/store'

const t = admin.drawer

export type Action =
  | { action: 'status'; status: LeadStatus }
  | { action: 'notes'; notes: string }
  | { action: 'booking'; op: 'ok' | 'move' }

export async function send(id: number, body: Action) {
  const response = await fetch(`/api/admin/leads/${id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (response.status === 401) {
    throw new Error('unauthorized')
  }
  const data = (await response.json()) as {
    ok: boolean
    lead?: AdminLead
    reply?: string
    warning?: string
  }
  if (!data.ok || !data.lead) throw new Error('failed')
  return data as { lead: AdminLead; reply?: string; warning?: string }
}

const quick =
  'inline-flex items-center gap-2 rounded-full border border-line-strong px-3.5 py-2 text-sm text-fg transition-colors hover:border-accent hover:text-accent-text'

export function LeadDrawer({
  lead,
  onClose,
  onChange,
}: {
  lead: AdminLead | null
  onClose: () => void
  onChange: (lead: AdminLead) => void
}) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!lead) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [lead, onClose])

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 transition-[visibility] duration-300',
        lead ? 'visible' : 'invisible',
      )}
      aria-hidden={!lead}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={t.close}
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-scrim transition-opacity duration-300',
          lead ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={lead ? fillAdmin(t.title, { id: lead.id }) : undefined}
        tabIndex={-1}
        className={cn(
          'absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-line-strong bg-surface shadow-panel outline-none transition-transform duration-300 ease-out-expo',
          lead ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {lead ? (
          <DrawerBody key={lead.id} lead={lead} onClose={onClose} onChange={onChange} />
        ) : null}
      </div>
    </div>
  )
}

function DrawerBody({
  lead,
  onClose,
  onChange,
}: {
  lead: AdminLead
  onClose: () => void
  onChange: (lead: AdminLead) => void
}) {
  const router = useRouter()
  const { notify } = useHub()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null)
  const [notes, setNotes] = useState(lead.notes ?? '')
  const [copied, setCopied] = useState(false)
  const links = contactLinks(lead.contact)
  const page = leadPageLink(lead.page)
  const booking = lead.booking

  async function run(body: Action) {
    setBusy(true)
    setMessage(null)
    try {
      const result = await send(lead.id, body)
      onChange(result.lead)
      if (result.warning) {
        setMessage({ text: t.telegramFailed, bad: true })
        notify(t.telegramFailed, 'error')
      } else {
        const text = body.action === 'notes' ? t.saved : (result.reply ?? t.saved)
        setMessage({ text })
        notify(text)
      }
    } catch (error) {
      // Session expired or revoked on another device: back to the login screen.
      if (String(error).includes('unauthorized')) router.replace('/admin/login')
      // The reason (HQ down, timeout...) next to the generic line.
      const failed = `${t.failed} ${describeError({ code: String(error instanceof Error ? error.message : error).replace(/^Error: /, '') }).message}`
      setMessage({ text: failed, bad: true })
      notify(failed, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(lead.contact)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked (insecure page or no permission): say so instead of staying silent.
      setMessage({ text: t.failed, bad: true })
    }
  }

  const rows: [string, string][] = [
    [t.fields.created, formatDateTime(lead.createdAt)],
    [t.fields.service, admin.services[lead.service]],
    [t.fields.budget, lead.budget],
    [t.fields.message, lead.message],
    [t.fields.locale, lead.locale.toUpperCase()],
    [t.fields.inBot, lead.inBot ? t.yes : t.no],
    [t.fields.botNote, lead.note ?? ''],
  ]

  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="font-mono text-xs text-faint">{fillAdmin(t.title, { id: lead.id })}</p>
          <h2 className="mt-1 truncate text-xl font-semibold tracking-tight">{lead.name}</h2>
          <p className="mt-0.5 truncate text-sm text-muted">{lead.contact}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="rounded-full border border-line p-2 text-muted transition-colors hover:text-fg"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="flex flex-wrap gap-2">
          {links.telegram ? (
            <a href={links.telegram} className={quick}>
              <TelegramLogo size={16} aria-hidden="true" />
              {t.openTelegram}
            </a>
          ) : null}
          {links.phone ? (
            <a href={links.phone} className={quick}>
              <Phone size={16} aria-hidden="true" />
              {t.call}
            </a>
          ) : null}
          <button type="button" onClick={copy} className={quick}>
            <Copy size={16} aria-hidden="true" />
            {copied ? t.copied : t.copy}
          </button>
          {page ? (
            <a href={page.url} className={quick}>
              <ArrowSquareOut size={16} aria-hidden="true" />
              {page.builder ? t.openBuilder : t.openPage}
            </a>
          ) : null}
        </div>

        <section>
          <h3 className="mb-2 text-xs text-faint">{t.status}</h3>
          <div className="flex flex-wrap gap-1.5">
            {adminStatuses.map((status) => (
              <button
                key={status}
                type="button"
                disabled={busy || lead.status === status}
                aria-pressed={lead.status === status}
                onClick={() => run({ action: 'status', status })}
                className={cn(
                  'rounded-full border px-3.5 py-2 text-sm transition-colors',
                  lead.status === status
                    ? 'border-accent bg-accent text-accent-ink'
                    : 'border-line-strong text-muted hover:border-accent hover:text-fg disabled:opacity-50',
                )}
              >
                {admin.statuses[status]}
              </button>
            ))}
          </div>
          <p
            role="status"
            className={cn(
              'text-sm empty:hidden',
              message && 'mt-2',
              message?.bad ? 'text-danger' : 'text-accent-text',
            )}
          >
            {message?.text}
          </p>
        </section>

        <section className="rounded-card border border-line bg-inset p-4">
          <h3 className="mb-2 text-xs text-faint">{t.booking}</h3>
          {booking ? (
            <>
              <p className="text-sm">
                <span className="font-mono">{formatSlot(booking.slot)}</span>
                <span className="text-muted"> · {admin.bookings[booking.state]}</span>
              </p>
              {booking.state !== 'released' ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {booking.state === 'pending' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run({ action: 'booking', op: 'ok' })}
                      className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent-strong disabled:opacity-50"
                    >
                      {t.confirm}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      window.confirm(t.rescheduleConfirm) && run({ action: 'booking', op: 'move' })
                    }
                    className="rounded-full border border-line-strong px-4 py-2 text-sm text-fg hover:border-accent disabled:opacity-50"
                  >
                    {t.reschedule}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-faint">{t.noBooking}</p>
          )}
        </section>

        <dl className="grid grid-cols-[8.5rem_1fr] gap-x-4 gap-y-3 text-sm">
          {rows
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-faint">{label}</dt>
                <dd className="break-words whitespace-pre-wrap">{value}</dd>
              </div>
            ))}
        </dl>

        {lead.estimate ? (
          <section>
            <h3 className="mb-2 text-xs text-faint">
              {lead.service === 'bundle' ? t.fields.bundle : t.fields.estimate}
            </h3>
            <pre className="rounded-xl border border-line bg-field p-4 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-muted">
              {estimateAsText(lead.estimate)}
            </pre>
          </section>
        ) : null}

        <section>
          <label htmlFor={`notes-${lead.id}`} className="mb-2 block text-xs text-faint">
            {t.notes}
          </label>
          <textarea
            id={`notes-${lead.id}`}
            value={notes}
            maxLength={4000}
            rows={4}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t.notesPlaceholder}
            className="w-full resize-y rounded-xl border border-line-strong bg-field px-3.5 py-3 text-base text-fg outline-none md:text-sm focus:border-accent"
          />
          <button
            type="button"
            disabled={busy || notes === (lead.notes ?? '')}
            onClick={() => run({ action: 'notes', notes })}
            className="mt-2 rounded-full border border-line-strong px-4 py-2 text-sm text-fg transition-colors hover:border-accent disabled:opacity-40"
          >
            {t.saveNotes}
          </button>
        </section>
      </div>
    </>
  )
}
