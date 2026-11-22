'use client'

import { Eye, EyeSlash } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { admin } from '@/content/admin'

const t = admin.login
type ErrorCode = keyof typeof t.errors

function errorText(code: unknown) {
  return typeof code === 'string' && code in t.errors ? t.errors[code as ErrorCode] : t.errors.network
}

// One password field. The password goes only to POST /api/admin/login and is cleared after a wrong try.
export function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(configured ? '' : t.errors.not_configured)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setError('')
    let code: unknown = 'network'
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: unknown } | null
      if (response.ok && body?.ok) {
        router.replace('/admin/dashboard')
        router.refresh()
        return
      }
      code = body?.error ?? 'network'
    } catch (failure) {
      console.warn('[admin] login request failed', failure instanceof Error ? failure.name : 'error')
    }
    setBusy(false)
    setPassword('')
    setError(errorText(code))
  }

  return (
    <form onSubmit={submit} className="mt-7" noValidate>
      <label htmlFor="admin-password" className="text-sm text-muted">
        {t.password}
      </label>
      <div className="relative mt-2">
        <input
          id="admin-password"
          name="password"
          type={visible ? 'text' : 'password'}
          autoComplete="current-password"
          autoFocus={configured}
          disabled={!configured}
          maxLength={256}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="ym-disable-keys w-full rounded-xl border border-line-strong bg-field py-3.5 pl-4 pr-12 text-base text-fg outline-none focus:border-accent disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={!configured}
          aria-label={visible ? t.hide : t.show}
          aria-pressed={visible}
          aria-controls="admin-password"
          className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-muted transition-colors hover:text-fg disabled:opacity-60"
        >
          {visible ? <EyeSlash size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      <button
        type="submit"
        disabled={busy || !configured || !password}
        aria-busy={busy}
        className="mt-4 w-full rounded-full bg-accent px-5 py-3.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-strong disabled:opacity-50"
      >
        {busy ? t.checking : t.submit}
      </button>
      <p role="alert" aria-live="polite" className="mt-4 min-h-5 text-sm text-danger">
        {error}
      </p>
    </form>
  )
}
