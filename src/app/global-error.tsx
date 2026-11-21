'use client'

import { useEffect } from 'react'
import { describeError } from '@/lib/errors'

// Last resort: the root layout itself failed, so there is no site chrome and no stylesheet. Plain
// inline styles, both languages (the path tells which one), a retry and the support code.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[global-error]', error.digest ?? '', error.message)
  }, [error])
  const en = typeof window !== 'undefined' && window.location.pathname.startsWith('/en')
  const info = describeError({ code: 'server_error', locale: en ? 'en' : 'ru' })
  const ref = error.digest ? `E-${error.digest}` : describeError({}).ref
  return (
    <html lang={en ? 'en' : 'ru'}>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#fff', color: '#111' }}>
        <main role="alert" style={{ maxWidth: 520, margin: '20vh auto', padding: '0 16px' }}>
          <h1 style={{ fontSize: 24 }}>{info.message}</h1>
          <p style={{ color: '#555' }}>{info.hint}</p>
          <p style={{ fontFamily: 'monospace', fontSize: 13, color: '#777' }}>{ref}</p>
          <button
            type="button"
            onClick={reset}
            style={{ background: '#c6ff3d', color: '#0d1408', border: 0, borderRadius: 999, padding: '12px 24px', fontSize: 15, cursor: 'pointer' }}
          >
            {en ? 'Try again' : 'Повторить'}
          </button>
        </main>
      </body>
    </html>
  )
}
