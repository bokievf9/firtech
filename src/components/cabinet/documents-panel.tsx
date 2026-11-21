'use client'

import { ArrowLeft, DownloadSimple, FileText } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Dict } from '@/content'
import { formatDate } from '@/lib/cabinet-data'
import { REJECT_REASON_MAX, docActions, docNeedsClient, docStateKey, docsNeedingClient, sortDocs, type PublicDoc, type SignaturePayload } from '@/lib/cabinet-docs'
import { buttonStyles, cn } from '@/lib/cn'
import { COUNTS_EVENT } from './cabinet-tabs'
import { useWide } from './use-wide'
import { SignaturePad } from './signature-pad'
import { TabLink } from './tab-link'
import { Chip, Empty, FormMessage, fill, inputClass } from './ui'

// «Документы» (cabinet v3): the list with its states, the viewer (the PDF in an iframe through the
// session-checked proxy, or the HTML version), «Принять КП», «Подписать» with the signature pad, «Оплатить»
// and the download. States: ждёт вас, принято, ждёт подписи, подписано, выставлен, оплачен. On wide
// screens the list and the viewer sit side by side, on phones the viewer replaces the list.
const toneOf = (d: Pick<PublicDoc, 'state' | 'kind'>) =>
  d.state === 'awaiting_client' || d.state === 'awaiting_signature' || (d.state === 'issued' && d.kind === 'invoice')
    ? ('warn' as const)
    : d.state === 'accepted' || d.state === 'signed' || d.state === 'paid'
      ? ('accent' as const)
      : ('muted' as const)

// Documents of an old HQ (invoices and documents without the v3 endpoint) have no file to open.
const isReal = (d: PublicDoc) => !d.id.startsWith('inv:') && !d.id.startsWith('doc:')

const knownErrors = ['invalid', 'not_awaiting', 'not_found', 'unauthorized', 'no_signature', 'bad_signature', 'too_big', 'name', 'consent']
const errorKey = (code: unknown): string => (typeof code === 'string' && knownErrors.includes(code) ? code : 'hq')

export function DocumentsPanel({
  dict,
  locale,
  initial,
  defaultName,
}: {
  dict: Dict
  locale: string
  initial: PublicDoc[]
  defaultName: string
}) {
  const t = dict.cabinet.v3.docs
  const errors = t.errors as Record<string, string>
  const router = useRouter()
  const search = useSearchParams()
  const [docs, setDocs] = useState(() => sortDocs(initial))
  const [openId, setOpenId] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [busy, setBusy] = useState<'accept' | 'sign' | 'reject' | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [rejectError, setRejectError] = useState('')
  const [error, setError] = useState('')
  const [signError, setSignError] = useState('')
  const [notice, setNotice] = useState('')
  const viewer = useRef<HTMLDivElement>(null)
  const wide = useWide()
  const [seen, setSeen] = useState<string | null>(null)
  const fallback = wide ? (docs.find(docNeedsClient) ?? docs[0] ?? null) : null
  const open = docs.find((d) => d.id === openId) ?? fallback

  // Another document: a half-done signature closes and the messages clear.
  function choose(id: string | null) {
    setOpenId(id)
    setSigning(false)
    setRejecting(false)
    setRejectError('')
    setError('')
    setNotice('')
    setSignError('')
  }

  // `?doc=<id>` (the big button of the home) opens that document. Only a NEW value decides, so the list
  // changing never reopens anything. On wide screens the first document that needs the client is shown
  // when nothing is chosen, so the viewer is never an empty box.
  const wanted = search.get('doc')
  if (wanted !== seen) {
    setSeen(wanted)
    if (wanted && docs.some((d) => d.id === wanted)) choose(wanted)
  }
  useEffect(() => {
    if (wanted) viewer.current?.scrollIntoView({ block: 'start' })
  }, [wanted])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/cabinet/documents', { cache: 'no-store' })
      const body = (await res.json().catch(() => null)) as { ok?: boolean; documents?: PublicDoc[] } | null
      if (res.ok && body?.ok && Array.isArray(body.documents)) {
        setDocs(sortDocs(body.documents))
        window.dispatchEvent(new CustomEvent(COUNTS_EVENT, { detail: { documents: docsNeedingClient(body.documents) } }))
      }
    } catch {
      // The list stays as it is, and the person is told it may be out of date.
      setError('network')
    }
    router.refresh()
  }, [router])

  async function post(path: string, body: unknown) {
    const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    return res.ok && data?.ok ? null : errorKey(data?.error)
  }

  async function accept(doc: PublicDoc) {
    setBusy('accept')
    setError('')
    try {
      const failed = await post(`/api/cabinet/documents/${encodeURIComponent(doc.id)}/accept`, {})
      if (failed) setError(failed)
      else {
        setNotice(t.acceptedDone)
        await refresh()
      }
    } catch {
      setError('network')
    }
    setBusy(null)
  }

  async function reject(doc: PublicDoc, payload: { reason: string; mode: 'decline' | 'discuss' }) {
    setBusy('reject')
    setRejectError('')
    try {
      const failed = await post(`/api/cabinet/documents/${encodeURIComponent(doc.id)}/reject`, payload)
      if (failed) setRejectError(failed)
      else {
        setRejecting(false)
        setNotice(t.reject.done)
        await refresh()
      }
    } catch {
      setRejectError('network')
    }
    setBusy(null)
  }

  async function sign(doc: PublicDoc, payload: SignaturePayload) {
    setBusy('sign')
    setSignError('')
    try {
      const failed = await post(`/api/cabinet/documents/${encodeURIComponent(doc.id)}/sign`, payload)
      if (failed) setSignError(failed)
      else {
        setSigning(false)
        setNotice(t.signPad.done)
        await refresh()
      }
    } catch {
      setSignError('network')
    }
    setBusy(null)
  }

  const waiting = docsNeedingClient(docs)

  if (docs.length === 0) {
    return (
      <section aria-labelledby="cabinet-docs-title" data-cabinet-docs>
        <h2 id="cabinet-docs-title" className="font-display text-2xl font-semibold tracking-tight">
          {t.title}
        </h2>
        <div className="mt-5 rounded-card border border-line bg-surface p-6 md:p-8">
          <Empty>{t.empty}</Empty>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="cabinet-docs-title" data-cabinet-docs>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="cabinet-docs-title" className="font-display text-2xl font-semibold tracking-tight">
          {t.title}
        </h2>
        {waiting > 0 && <Chip tone="warn">{fill(t.needYou, { n: String(waiting) })}</Chip>}
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <ul aria-label={t.listLabel} className={cn('grid gap-2', openId && 'hidden lg:grid')}>
          {docs.map((d) => {
            const needs = docNeedsClient(d)
            const active = d.id === open?.id
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => choose(d.id)}
                  aria-current={active ? 'true' : undefined}
                  data-doc={d.id}
                  data-doc-state={d.state}
                  className={cn(
                    'w-full rounded-xl border p-4 text-left transition-colors',
                    active
                      ? 'border-accent-text bg-accent/[0.07]'
                      : needs
                        ? 'border-accent-text/40 bg-surface hover:border-accent-text'
                        : 'border-line bg-surface hover:border-line-strong',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] tracking-[0.1em] text-faint uppercase">
                      {t.kind[d.kind]}
                      {d.number ? ` ${fill(t.number, { n: d.number })}` : ''}
                    </span>
                    <Chip tone={toneOf(d)}>{t.state[docStateKey(d)]}</Chip>
                  </span>
                  <span className="mt-2 block text-[15px] leading-snug font-medium">{d.title}</span>
                  <span className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-faint">
                    <span className="font-mono">{formatDate(d.deliveredAt ?? d.createdAt, locale)}</span>
                    {d.amountUsd !== null && (
                      <span className="font-mono text-[13px] text-fg">{d.amountUsd.toLocaleString('en-US')} USD</span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <div ref={viewer} className={cn('scroll-mt-28', !openId && 'hidden lg:block')} data-doc-viewer>
          {!open ? (
            <div className="grid place-items-center rounded-card border border-dashed border-line-strong p-10 text-center text-sm text-muted">
              <FileText size={28} aria-hidden="true" className="mb-3 text-faint" />
              {t.pick}
            </div>
          ) : (
            <Viewer
              key={open.id}
              doc={open}
              dict={dict}
              locale={locale}
              signing={signing}
              rejecting={rejecting}
              rejectError={rejectError ? (errors[rejectError] ?? errors.hq ?? '') : ''}
              busy={busy}
              error={error ? (errors[error] ?? errors.hq ?? '') : ''}
              notice={notice}
              onBack={() => choose(null)}
              onAccept={() => void accept(open)}
              onReject={() => {
                setRejecting(true)
                setRejectError('')
              }}
              onRejectCancel={() => setRejecting(false)}
              onRejectSend={(payload) => void reject(open, payload)}
              onSign={() => {
                setSigning(true)
                setSignError('')
              }}
              pad={
                signing ? (
                  <SignaturePad
                    dict={dict}
                    defaultName={defaultName}
                    busy={busy === 'sign'}
                    error={signError}
                    onSubmit={(payload) => void sign(open, payload)}
                    onCancel={() => setSigning(false)}
                  />
                ) : null
              }
            />
          )}
        </div>
      </div>
    </section>
  )
}

function Viewer({
  doc,
  dict,
  locale,
  signing,
  rejecting,
  rejectError,
  busy,
  error,
  notice,
  onBack,
  onAccept,
  onReject,
  onRejectCancel,
  onRejectSend,
  onSign,
  pad,
}: {
  doc: PublicDoc
  dict: Dict
  locale: string
  signing: boolean
  rejecting: boolean
  rejectError: string
  busy: 'accept' | 'sign' | 'reject' | null
  error: string
  notice: string
  onBack: () => void
  onAccept: () => void
  onReject: () => void
  onRejectCancel: () => void
  onRejectSend: (payload: { reason: string; mode: 'decline' | 'discuss' }) => void
  onSign: () => void
  pad: ReactNode
}) {
  const t = dict.cabinet.v3.docs
  const actions = docActions(doc)
  const real = isReal(doc)
  const file = `/api/cabinet/documents/${encodeURIComponent(doc.id)}/file`
  const canPreview = real && doc.hasPdf
  const dates = [
    doc.deliveredAt && fill(t.deliveredOn, { date: formatDate(doc.deliveredAt, locale) }),
    doc.acceptedAt && fill(t.acceptedOn, { date: formatDate(doc.acceptedAt, locale) }),
    doc.signedAt && fill(t.signedOn, { date: formatDate(doc.signedAt, locale) }),
  ].filter(Boolean)
  const hint = (t.hint as Record<string, string>)[doc.state]
  const bigButton = cn(buttonStyles.primary, 'px-8 py-4 text-base')
  return (
    <div className="grid gap-4" aria-label={t.viewer} data-doc-open={doc.id}>
      <div className="rounded-card border border-line bg-surface p-5 md:p-6">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg lg:hidden"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t.back}
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] tracking-[0.1em] text-faint uppercase">
              {t.kind[doc.kind]}
              {doc.number ? ` ${fill(t.number, { n: doc.number })}` : ''}
            </p>
            <h3 className="mt-1 text-lg leading-snug font-medium">{doc.title}</h3>
            {dates.length > 0 && <p className="mt-1 font-mono text-[12px] text-faint">{dates.join(', ')}</p>}
          </div>
          <Chip tone={toneOf(doc)}>{t.state[docStateKey(doc)]}</Chip>
        </div>
        {hint && (docNeedsClient(doc) || doc.state === 'declined' || doc.state === 'expired') && (
          <p className="mt-3 text-sm text-muted" data-doc-hint={doc.state}>
            {hint}
          </p>
        )}
        {real && doc.deliveredAt === null && doc.state !== 'void' && (
          <p className="mt-2 text-[13px] text-faint" data-doc-preparing>
            {t.preparingMail}
          </p>
        )}
        {doc.kind === 'invoice' && doc.state === 'issued' && (
          <p className="mt-2 text-[13px] leading-relaxed text-muted" data-pay-help>
            <Link
              href={`/${locale}/pay-how`}
              className="text-fg underline decoration-line-strong underline-offset-4 hover:text-accent-text"
            >
              {dict.cabinet.cards.payHow}
            </Link>{' '}
            <Link
              href={`/${locale}/terms#terms-payment`}
              className="text-fg underline decoration-line-strong underline-offset-4 hover:text-accent-text"
            >
              {dict.cabinet.cards.payTerms}
            </Link>
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {actions.includes('accept') && (
            <button type="button" onClick={onAccept} disabled={busy !== null} className={bigButton} data-doc-accept>
              {busy === 'accept' ? t.accepting : t.accept}
            </button>
          )}
          {actions.includes('sign') && !signing && (
            <button type="button" onClick={onSign} className={bigButton} data-doc-sign>
              {t.sign}
            </button>
          )}
          {actions.includes('pay') && doc.payUrl && (
            <a href={doc.payUrl} target="_blank" rel="noopener noreferrer" className={bigButton} data-doc-pay>
              {t.pay}
            </a>
          )}
          {actions.includes('reject') && !rejecting && (
            <button type="button" onClick={onReject} disabled={busy !== null} className={buttonStyles.secondary} data-doc-reject>
              {t.reject.open}
            </button>
          )}
          {doc.kind === 'quote' && (doc.state === 'awaiting_client' || doc.state === 'declined' || doc.state === 'expired') && (
            <TabLink tab="messages" extra={doc.leadId !== null ? { ref: `lead-${doc.leadId}` } : {}} className={buttonStyles.secondary}>
              {t.ask}
            </TabLink>
          )}
          {actions.includes('download') && (
            <a href={`${file}?download=1`} className={buttonStyles.secondary} data-doc-download>
              <DownloadSimple size={18} aria-hidden="true" />
              {t.download}
            </a>
          )}
        </div>
        {error && (
          <div className="mt-3">
            <FormMessage kind="error">{error}</FormMessage>
          </div>
        )}
        {notice && (
          <div className="mt-3">
            <FormMessage kind="ok">{notice}</FormMessage>
          </div>
        )}
      </div>

      {canPreview ? (
        <iframe
          title={`${t.viewer}: ${doc.title}`}
          src={file}
          className="h-[70dvh] min-h-[460px] w-full rounded-card border border-line-strong bg-surface"
          data-doc-frame
        />
      ) : (
        <div className="rounded-card border border-dashed border-line-strong p-8 text-center text-sm text-muted">{t.noPreview}</div>
      )}

      {rejecting && <RejectForm dict={dict} busy={busy === 'reject'} error={rejectError} onSend={onRejectSend} onCancel={onRejectCancel} />}

      {pad}
    </div>
  )
}

// «Отклонить или обсудить»: the mode and the client's words; HQ writes them to the request's thread.
function RejectForm({
  dict,
  busy,
  error,
  onSend,
  onCancel,
}: {
  dict: Dict
  busy: boolean
  error: string
  onSend: (payload: { reason: string; mode: 'decline' | 'discuss' }) => void
  onCancel: () => void
}) {
  const t = dict.cabinet.v3.docs.reject
  const [mode, setMode] = useState<'decline' | 'discuss'>('discuss')
  const [reason, setReason] = useState('')
  const [empty, setEmpty] = useState(false)
  return (
    <form
      className="grid gap-4 rounded-card border border-line bg-surface p-5 md:p-6"
      data-doc-reject-form
      onSubmit={(e) => {
        e.preventDefault()
        if (!reason.trim()) {
          setEmpty(true)
          return
        }
        setEmpty(false)
        onSend({ reason: reason.trim(), mode })
      }}
    >
      <h4 className="text-base font-medium">{t.title}</h4>
      <fieldset className="grid gap-2">
        <legend className="text-sm text-muted">{t.modeLabel}</legend>
        {(['discuss', 'decline'] as const).map((m) => (
          <label key={m} className="flex items-center gap-2 text-[15px]">
            <input type="radio" name="reject-mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
            {t[m]}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-2">
        <label htmlFor="reject-reason" className="text-sm text-muted">
          {t.reason}
        </label>
        <textarea
          id="reject-reason"
          rows={4}
          maxLength={REJECT_REASON_MAX}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={empty}
          className={inputClass}
        />
        <p className="text-[13px] text-faint">{t.reasonHelp}</p>
      </div>
      {empty && <FormMessage kind="error">{t.empty}</FormMessage>}
      {error && <FormMessage kind="error">{error}</FormMessage>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={buttonStyles.primary}>
          {busy ? t.sending : t.submit}
        </button>
        <button type="button" onClick={onCancel} className={buttonStyles.secondary}>
          {t.cancel}
        </button>
      </div>
    </form>
  )
}
