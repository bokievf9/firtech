'use client'

import { UserPlus } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { hq } from '@/components/admin/control/api'
import { btn, btnPrimary, inputClass, useHub } from '@/components/admin/hub/ui'
import { cn } from '@/components/admin/kit'
import { Pending } from '@/components/ui/pending'
import { admin } from '@/content/admin'
import { requestError } from '@/lib/content-studio'
import { fade, spring } from '@/lib/motion'
import { normalizeOwnerAnswer, ownerBody, ownerErrors, OWNER_LIMITS, type OwnerErrors, type OwnerForm } from '@/lib/owner-client'
import { useReducedMotion } from '@/lib/use-reduced-motion'

const p = admin.pult.leads.owner

// «Client from owner»: a button in the funnel header and a dialog (same frame as the purge dialog). `clientRef` is made once per open,
// so a double click or a retry after a lost answer never creates a second lead.
export function OwnerClientButton({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={btn} onClick={() => setOpen(true)} data-owner-client="open">
        <UserPlus size={16} aria-hidden="true" /> {p.open}
      </button>
      {open ? <OwnerClientDialog onClose={() => setOpen(false)} onDone={onDone} /> : null}
    </>
  )
}

const EMPTY: OwnerForm = { name: '', contact: '', need: '', links: '' }

function OwnerClientDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { notify } = useHub()
  const reduce = useReducedMotion()
  const [form, setForm] = useState<OwnerForm>(EMPTY)
  const [errors, setErrors] = useState<OwnerErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [closing, setClosing] = useState(false)
  const [clientRef] = useState(() => crypto.randomUUID())
  const nameRef = useRef<HTMLInputElement>(null)
  const busyRef = useRef(false)

  const close = useCallback(() => setClosing(true), [])
  const set = (key: keyof OwnerForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  useEffect(() => {
    if (closing) return
    nameRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        if (!busyRef.current) close()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [closing, close])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busyRef.current) return
    const found = ownerErrors(form)
    setErrors(found)
    setError(null)
    if (Object.keys(found).length) return
    busyRef.current = true
    setBusy(true)
    const res = await hq<Record<string, unknown>>('leads/owner', ownerBody(form, clientRef))
    const done = res.ok ? normalizeOwnerAnswer(res) : null
    busyRef.current = false
    setBusy(false)
    if (!done) {
      const msg = requestError(p.failed, res.ok ? { error: 'hq_bad_response' } : res)
      setError(msg)
      notify(msg, 'error')
      return
    }
    notify(p.done)
    onDone()
    close()
  }

  const field = (key: keyof OwnerErrors) => (errors[key] ? { 'aria-invalid': true as const, 'aria-describedby': `owner-${key}-err` } : {})
  const err = (key: keyof OwnerErrors) =>
    errors[key] ? (
      <p id={`owner-${key}-err`} className="mt-1 text-footnote text-danger" data-owner-error={key}>
        {p.errors[errors[key]!]}
      </p>
    ) : null

  return (
    <motion.div
      className={cn('fixed inset-0 z-[80] grid place-items-center bg-scrim p-4', closing && 'pointer-events-none')}
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={fade}
      onAnimationComplete={() => {
        if (closing) onClose()
      }}
    >
      <motion.form
        role="dialog"
        aria-modal={closing ? undefined : 'true'}
        aria-hidden={closing || undefined}
        aria-label={p.title}
        data-owner-client="dialog"
        noValidate
        onSubmit={(e) => void submit(e)}
        className="material-chrome max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-card p-5 shadow-dialog"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }}
        animate={closing ? (reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }) : { opacity: 1, scale: 1, y: 0 }}
        transition={reduce || closing ? fade : spring.snappy}
      >
        <h2 className="text-callout font-medium">{p.title}</h2>
        <p className="mt-1.5 text-footnote text-muted">{p.intro}</p>
        <div className="mt-4 grid gap-3.5">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-faint">{p.name}</span>
            <input ref={nameRef} value={form.name} onChange={(e) => set('name', e.target.value)} disabled={busy} maxLength={OWNER_LIMITS.name + 50} className={inputClass} data-owner-field="name" {...field('name')} />
            {err('name')}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-faint">{p.contact}</span>
            <input value={form.contact} onChange={(e) => set('contact', e.target.value)} disabled={busy} className={inputClass} data-owner-field="contact" {...field('contact')} />
            <span className="mt-1 block text-footnote text-faint">{p.contactHint}</span>
            {err('contact')}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-faint">{p.need}</span>
            <textarea value={form.need} onChange={(e) => set('need', e.target.value)} disabled={busy} rows={5} className={cn(inputClass, 'resize-y')} data-owner-field="need" {...field('need')} />
            <span className="mt-1 block text-footnote text-faint">{p.needHint}</span>
            {err('need')}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-faint">{p.links}</span>
            <textarea value={form.links} onChange={(e) => set('links', e.target.value)} disabled={busy} rows={3} placeholder="https://" className={cn(inputClass, 'resize-y')} data-owner-field="links" {...field('links')} />
            <span className="mt-1 block text-footnote text-faint">{p.linksHint}</span>
            {err('links')}
          </label>
        </div>
        <div aria-live="polite">
          {error ? (
            <p className="mt-3 text-sm text-danger" data-owner-error="request">
              {error}
            </p>
          ) : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={close} className="pressable inline-flex min-h-10 items-center rounded-full px-4 text-sm text-muted hover:bg-fill-strong hover:text-fg disabled:opacity-50" data-owner-client="cancel">
            {p.cancel}
          </button>
          <Pending type="submit" pending={busy} pendingLabel={p.sending} className={btnPrimary} data-owner-client="submit">
            {p.submit}
          </Pending>
        </div>
      </motion.form>
    </motion.div>
  )
}
