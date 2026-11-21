'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ErrorNote } from '@/components/ui/error-note'
import { PanelLoading } from '@/components/ui/spinner'
import { describeError, type ErrorLocale } from '@/lib/errors'
import { isLocale } from '@/lib/i18n'

const loadingText = { ru: 'Загружаем...', en: 'Loading...' } as const
const reload = { ru: 'Обновить страницу', en: 'Reload the page' } as const

function useRouteLocale(forced?: ErrorLocale): ErrorLocale {
  const params = useParams<{ locale?: string }>()
  if (forced) return forced
  return params?.locale && isLocale(params.locale) ? params.locale : 'ru'
}

// `loading.tsx` of the segments that wait for data: the shared ring and one polite status line.
export function RouteLoading({ locale }: { locale?: ErrorLocale }) {
  const l = useRouteLocale(locale)
  return <PanelLoading label={loadingText[l]} className="mx-auto max-w-3xl px-4 py-24" />
}

// `error.tsx` of a segment: what happened in plain words, the support code (the Next.js digest or
// the time-based reference) and «Повторить» that re-renders the segment. The error itself is
// logged to the console for us; the visitor never sees a stack.
export function RouteError({
  error,
  reset,
  locale,
}: {
  error: Error & { digest?: string }
  reset: () => void
  locale?: ErrorLocale
}) {
  const l = useRouteLocale(locale)
  useEffect(() => {
    console.error('[route-error]', error.digest ?? '', error.message)
  }, [error])
  const info = describeError({ code: 'server_error', locale: l })
  const withRef = { ...info, ref: error.digest ? `E-${error.digest}` : describeError({ locale: l }).ref }
  return (
    <div className="mx-auto max-w-xl px-4 py-24">
      <ErrorNote error={withRef} locale={l} onRetry={reset} />
      <p className="mt-4 text-sm text-muted">
        <button type="button" onClick={() => window.location.reload()} className="underline underline-offset-4 hover:text-fg">
          {reload[l]}
        </button>
      </p>
    </div>
  )
}
