'use client'

import { CloudSlash } from '@phosphor-icons/react'
import { Spinner } from '@/components/ui/spinner'
import { errText } from './api'

// A Пульт panel that has nothing to show yet because HQ did not answer: the reason in words (with
// the support code for unknown failures), and the line that the panel asks again by itself every few
// seconds (usePoll), so there is no dead end and no silent blank.
export function PanelError({ error }: { error: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-danger/40 bg-surface p-3 text-sm">
      <CloudSlash size={20} weight="duotone" aria-hidden="true" className="mt-0.5 shrink-0 text-danger" />
      <div className="min-w-0">
        <p className="font-medium text-danger">{errText(error)}</p>
        <p className="mt-0.5 inline-flex items-center gap-2 text-xs text-muted">
          <Spinner />
          Пробуем снова сами, раз в несколько секунд
        </p>
      </div>
    </div>
  )
}

// Placeholder rows while a Пульт panel waits for its first answer.
export function PanelWait({ height = 'h-40', label = 'Загружаем' }: { height?: string; label?: string }) {
  return <div role="status" aria-busy="true" aria-label={label} className={`skeleton skeleton-block ${height}`} />
}
