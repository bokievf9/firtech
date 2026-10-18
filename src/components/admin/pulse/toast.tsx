'use client'

import { X } from '@phosphor-icons/react'
import { useEffect } from 'react'
import { admin } from '@/content/admin'

// A failed change reports here, floating above the layout so nothing shifts. The container is
// always in the page (a live region), the message appears and clears itself after a while.
export function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return
    const id = setTimeout(onClose, 8000)
    return () => clearTimeout(id)
  }, [message, onClose])
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex justify-center lg:bottom-6 lg:left-8 lg:justify-start"
    >
      {message ? (
        <p className="pointer-events-auto flex max-w-md items-center gap-3 rounded-card border border-danger/50 bg-surface-2 py-2.5 pr-2.5 pl-4 text-sm text-danger shadow-2xl">
          <span>{message}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={admin.pulse.tasks.close}
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:text-fg"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </p>
      ) : null}
    </div>
  )
}
