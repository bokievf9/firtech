'use client'

import { X } from '@phosphor-icons/react'
import { useEffect } from 'react'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'

export type ToastMessage = {
  id: number
  text: string
  tone: 'info' | 'error'
  // One optional button, used for "Undo".
  action?: { label: string; run: () => void }
}

const SHOW_MS = { info: 7000, error: 9000 }

// A short message floating above the layout so nothing shifts: an error, or a done action with an
// undo button. The container is always in the page (a live region); the message clears itself.
export function Toast({ message, onClose }: { message: ToastMessage | null; onClose: () => void }) {
  const id = message?.id
  const tone = message?.tone
  useEffect(() => {
    if (id === undefined || !tone) return
    const timer = setTimeout(onClose, SHOW_MS[tone])
    return () => clearTimeout(timer)
  }, [id, tone, onClose])
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className="pointer-events-none fixed inset-x-4 bottom-24 z-[70] flex justify-center lg:bottom-6 lg:left-8 lg:justify-start"
    >
      {message ? (
        <p
          className={cn(
            'pointer-events-auto flex max-w-md items-center gap-2 rounded-card border bg-surface-2 py-1.5 pr-1.5 pl-4 text-sm shadow-2xl',
            message.tone === 'error'
              ? 'border-danger/50 text-danger'
              : 'border-line-strong text-fg',
          )}
        >
          <span className="py-1.5 break-words">{message.text}</span>
          {message.action ? (
            <button
              type="button"
              onClick={() => {
                message.action?.run()
                onClose()
              }}
              className="inline-flex h-11 shrink-0 items-center rounded-full px-4 font-medium text-accent-text transition-colors hover:bg-surface"
            >
              {message.action.label}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label={admin.pulse.tasks.close}
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:text-fg"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </p>
      ) : null}
    </div>
  )
}
