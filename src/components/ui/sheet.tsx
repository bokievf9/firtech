'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { fade, materialize, spring } from '@/lib/motion'
import { useReducedMotion } from '@/lib/use-reduced-motion'

// Sheets and dialogs of design system v4 (docs/design-system-v4.md «Листы и диалоги»).
// A modal surface on the chrome material over a dimming scrim: focus moves in and is trapped, Esc and a
// scrim click close, page scroll is locked, focus returns to the opener. Springs start from the value on
// screen, so a sheet that is closing can be reopened mid-flight without a jump. Enter and exit follow
// the same path (a right sheet leaves to the right). Reduced motion = a short cross-fade.
type Side = 'right' | 'bottom' | 'top'

function useModal(open: boolean, onClose: () => void, panel: React.RefObject<HTMLElement | null>) {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const focusFirst = window.setTimeout(() => {
      const el = panel.current?.querySelector<HTMLElement>('[data-autofocus], a[href], button:not([disabled]), input, textarea, select')
      ;(el ?? panel.current)?.focus()
    }, 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close.current()
        return
      }
      if (e.key !== 'Tab' || !panel.current) return
      const items = [...panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter(
        (el) => el.offsetParent !== null,
      )
      if (!items.length) return
      const first = items[0]!
      const last = items[items.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(focusFirst)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
  }, [open, panel])
}

const offscreen: Record<Side, { x?: string; y?: string }> = {
  right: { x: '100%' },
  bottom: { y: '100%' },
  top: { y: '-4%' },
}

const placement: Record<Side, string> = {
  right: 'inset-y-2 right-2 w-[min(28rem,calc(100vw-1rem))] rounded-panel',
  bottom: 'inset-x-2 bottom-2 max-h-[min(90dvh,48rem)] rounded-panel pb-[env(safe-area-inset-bottom)]',
  top: 'inset-0 rounded-none',
}

export function Sheet({
  open,
  onClose,
  label,
  side = 'right',
  id,
  className,
  children,
  portal = true,
}: {
  open: boolean
  onClose: () => void
  label: string
  side?: Side
  id?: string
  className?: string
  children: ReactNode
  // false keeps the sheet in place in the DOM (the header's mobile menu stays inside <header>, so its
  // links come first in document order); it is `fixed` either way.
  portal?: boolean
}) {
  const reduce = useReducedMotion()
  const panel = useRef<HTMLDivElement>(null)
  useModal(open, onClose, panel)
  if (typeof document === 'undefined') return null
  const tree = (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50" key="sheet">
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fade}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            id={id}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            initial={reduce ? { opacity: 0 } : { ...offscreen[side], opacity: side === 'top' ? 0 : 1 }}
            animate={{ x: 0, y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { ...offscreen[side], opacity: side === 'top' ? 0 : 1 }}
            transition={reduce ? fade : spring.sheet}
            className={cn('material-chrome absolute flex flex-col overflow-hidden overscroll-contain outline-none', placement[side], className)}
          >
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
  return portal ? createPortal(tree, document.body) : tree
}

// Centered dialog: materializes (blur and scale together) from the centre, as Apple's alerts do.
export function Dialog({
  open,
  onClose,
  label,
  className,
  children,
}: {
  open: boolean
  onClose: () => void
  label: string
  className?: string
  children: ReactNode
}) {
  const reduce = useReducedMotion()
  const panel = useRef<HTMLDivElement>(null)
  useModal(open, onClose, panel)
  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" key="dialog">
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fade}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            initial={reduce ? { opacity: 0 } : materialize.hidden}
            animate={materialize.shown}
            exit={reduce ? { opacity: 0 } : materialize.hidden}
            transition={reduce ? fade : spring.ui}
            className={cn('material-chrome relative w-full max-w-lg rounded-panel p-sheet outline-none', className)}
          >
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
