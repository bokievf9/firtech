'use client'

import { PaperPlaneTilt } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { admin, fillAdmin } from '@/content/admin'

type ApiError = {
  ok: false
  error: keyof typeof admin.login.errors
  retryAfter?: number
  attemptsLeft?: number
}

const t = admin.login

function errorText(result: ApiError) {
  const template = t.errors[result.error] ?? t.errors.network
  return fillAdmin(template, {
    s: result.retryAfter ?? 60,
    m: Math.ceil((result.retryAfter ?? 60) / 60),
    n: result.attemptsLeft ?? 0,
  })
}

async function post(url: string, body: unknown = {}) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    return (await response.json()) as { ok: true } | ApiError
  } catch {
    return { ok: false, error: 'network' } as ApiError
  }
}

export function LoginForm() {
  const router = useRouter()
  const [stage, setStage] = useState<'start' | 'code'>('start')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [wait, setWait] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  async function requestCode() {
    setBusy(true)
    setError('')
    const result = await post('/api/admin/code')
    setBusy(false)
    if (result.ok) {
      setStage('code')
      setCode('')
      setWait(60)
      setTimeout(() => input.current?.focus(), 0)
      return
    }
    if (result.retryAfter) setWait(result.retryAfter)
    setError(errorText(result))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (code.length !== 6) return
    setBusy(true)
    setError('')
    const result = await post('/api/admin/login', { code })
    if (result.ok) {
      router.replace('/admin/office')
      router.refresh()
      return
    }
    setBusy(false)
    setCode('')
    setError(errorText(result))
    if (result.error === 'locked' || result.error === 'expired' || result.error === 'no_code')
      setStage('start')
  }

  return (
    <div className="mt-7">
      {stage === 'start' ? (
        <button
          type="button"
          onClick={requestCode}
          disabled={busy || wait > 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-strong disabled:opacity-60"
        >
          <PaperPlaneTilt size={18} weight="fill" aria-hidden="true" />
          {busy ? t.sending : wait > 0 ? fillAdmin(t.resendIn, { s: wait }) : t.request}
        </button>
      ) : (
        <form onSubmit={submit}>
          <p className="mb-4 rounded-xl border border-accent/30 bg-pine/40 px-3.5 py-3 text-sm text-fg">
            {t.sent}
          </p>
          <label htmlFor="admin-code" className="text-sm text-muted">
            {t.codeLabel}
          </label>
          <input
            ref={input}
            id="admin-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="mt-2 w-full rounded-xl border border-line-strong bg-bg px-4 py-3.5 text-center font-mono text-2xl tracking-[0.5em] text-fg outline-none focus:border-accent"
            placeholder="000000"
          />
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="mt-4 w-full rounded-full bg-accent px-5 py-3.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {busy ? t.checking : t.submit}
          </button>
          <button
            type="button"
            onClick={requestCode}
            disabled={busy || wait > 0}
            className="mt-3 w-full rounded-full px-5 py-2.5 text-sm text-muted transition-colors hover:text-fg disabled:opacity-60"
          >
            {wait > 0 ? fillAdmin(t.resendIn, { s: wait }) : t.resend}
          </button>
        </form>
      )}
      <p role="alert" aria-live="polite" className="mt-4 min-h-5 text-sm text-danger">
        {error}
      </p>
    </div>
  )
}
