'use client'

import { CheckCircle, WarningCircle, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { cn } from '@/components/admin/kit'
import { admin } from '@/content/admin'
import { fade, spring } from '@/lib/motion'
import { useReducedMotion } from '@/lib/use-reduced-motion'

export type ToastMessage = {
  id: number
  text: string
  tone: 'info' | 'error'
  // One optional button, used for "Undo".
  action?: { label: string; run: () => void }
}

const SHOW_MS = { info: 7000, error: 9000 }

// A short message floating above the layout (and above the Echo bar and the tab bar, so it never
// covers the buttons of a card) so nothing shifts: an error, or a done action with an
// undo button. The container is always in the page (a live region); the message clears itself.
export function Toast({ message, onClose }: { message: ToastMessage | null; onClose: () => void }) {
  const reduce = useReducedMotion()
  const id = message?.id
  const tone = message?.tone
  useEffect(() => {
    if (id === undefined || !tone) return
    const timer = setTimeout(onClose, SHOW_MS[tone])
    return () => clearTimeout(timer)
  }, [id, tone, onClose])
  const Glyph = tone === 'error' ? WarningCircle : CheckCircle
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className="pointer-events-none fixed inset-x-4 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-[70] flex justify-center"
    >
      <AnimatePresence mode="popLayout">
        {message ? (
          <motion.p
            key={message.id}
            // Enters and leaves along the same path (from below); a new message retargets from where the old one is.
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.98 }}
            transition={reduce ? fade : spring.snappy}
            className={cn(
              'material-thick pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full py-1 pr-1 pl-4 text-callout shadow-float',
              message.tone === 'error' ? 'text-danger' : 'text-fg',
            )}
          >
            <Glyph size={18} weight="fill" aria-hidden="true" className={message.tone === 'error' ? 'text-danger' : 'text-accent-text'} />
            <span className="py-1.5 break-words">{message.text}</span>
            {message.action ? (
              <button
                type="button"
                onClick={() => {
                  message.action?.run()
                  onClose()
                }}
                className="pressable inline-flex h-9 shrink-0 items-center rounded-full px-3.5 font-medium text-accent-text hover:bg-fill-strong"
              >
                {message.action.label}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label={admin.pulse.tasks.close}
              className="pressable grid size-9 shrink-0 place-items-center rounded-full text-faint hover:bg-fill-strong hover:text-fg"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
