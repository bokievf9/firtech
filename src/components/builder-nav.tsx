'use client'

import { ArrowLeft, ArrowRight, Eye, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { buttonStyles, cn } from '@/lib/cn'
import { useReducedMotion } from '@/lib/use-reduced-motion'

const ease = [0.16, 1, 0.3, 1] as const

// Top of every builder screen: the page title and the steps, each clickable once reachable.
export function StepBar({
  eyebrow,
  title,
  steps,
  step,
  reachable,
  onGo,
}: {
  eyebrow: string
  title: string
  steps: readonly string[]
  step: number
  reachable: (i: number) => boolean
  onGo: (i: number) => void
}) {
  return (
    <div className="sticky top-16 z-30 border-b border-line bg-bg/85 backdrop-blur-xl md:top-[72px]">
      <div className="mx-auto max-w-7xl px-4 pt-3 pb-2.5 md:px-8 md:pt-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="truncate text-sm font-medium">
            <span className="mr-2 font-mono text-[11px] tracking-[0.14em] text-accent uppercase">
              {eyebrow}
            </span>
            <span className="text-muted">{title}</span>
          </h1>
          <span className="shrink-0 font-mono text-xs text-faint md:hidden">
            {steps[step]}
          </span>
        </div>
        <ol className="mt-3 flex gap-1.5 md:gap-2">
          {steps.map((label, i) => {
            const can = reachable(i)
            return (
              <li key={label} className="min-w-0 flex-1">
                <button
                  type="button"
                  disabled={!can}
                  onClick={() => onGo(i)}
                  aria-current={i === step ? 'step' : undefined}
                  aria-label={`${i + 1}. ${label}`}
                  className={cn(
                    'group flex w-full flex-col gap-2 py-1 text-left',
                    !can && 'cursor-not-allowed',
                  )}
                >
                  <span className="relative block h-1 overflow-hidden rounded-full bg-line-strong">
                    <span
                      className={cn(
                        'absolute inset-0 origin-left rounded-full transition-[transform,background-color] duration-500 ease-out-expo motion-reduce:transition-none',
                        i <= step ? 'scale-x-100' : 'scale-x-0',
                        i === step ? 'bg-accent' : 'bg-accent/45',
                      )}
                    />
                  </span>
                  <span
                    className={cn(
                      'hidden truncate text-xs transition-colors md:block',
                      i === step
                        ? 'text-fg'
                        : can
                          ? 'text-faint group-hover:text-muted'
                          : 'text-faint/50',
                    )}
                  >
                    <span className="mr-1.5 font-mono">{String(i + 1).padStart(2, '0')}</span>
                    {label}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

// Back and Next, fixed at the bottom on every screen size, with the running total between them.
export function BottomNav({
  show,
  backLabel,
  onBack,
  center,
  previewLabel,
  onPreview,
  primary,
}: {
  show: boolean
  backLabel: string
  onBack?: () => void
  center: ReactNode
  previewLabel?: string
  onPreview?: () => void
  primary: ReactNode
}) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={reduce ? { opacity: 0 } : { y: 96, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { y: 96, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          className="print-hidden fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-bg/85 backdrop-blur-xl"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-3 md:gap-4 md:px-8">
            <button
              type="button"
              onClick={onBack}
              disabled={!onBack}
              aria-label={backLabel}
              className={cn(
                buttonStyles.secondary,
                'size-12 shrink-0 px-0 md:w-auto md:px-5 disabled:opacity-30',
              )}
            >
              <ArrowLeft size={16} />
              <span className="hidden md:inline">{backLabel}</span>
            </button>
            <div className="min-w-0 flex-1 px-1">{center}</div>
            {onPreview && previewLabel && (
              <button
                type="button"
                onClick={onPreview}
                aria-label={previewLabel}
                className={cn(buttonStyles.secondary, 'size-12 shrink-0 px-0 lg:hidden')}
              >
                <Eye size={18} />
              </button>
            )}
            {primary}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Phones and tablets: the mockup in a sheet from the bottom.
export function PreviewSheet({
  open,
  title,
  closeLabel,
  onClose,
  children,
}: {
  open: boolean
  title: string
  closeLabel: string
  onClose: () => void
  children: ReactNode
}) {
  const reduce = useReducedMotion()
  const close = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    close.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
          <motion.button
            type="button"
            aria-label={closeLabel}
            tabIndex={-1}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={{ duration: 0.45, ease }}
            className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-card border-t border-line-strong bg-surface px-4 pt-3 pb-6"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
          >
            <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-fg/20" />
            <div className="mb-4 flex items-center justify-between gap-4">
              <p className="font-medium">{title}</p>
              <button
                ref={close}
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="grid size-10 place-items-center rounded-full border border-line-strong"
              >
                <X size={16} />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function NextButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(buttonStyles.primary, 'h-12 shrink-0 px-5 md:px-7 disabled:opacity-40')}
    >
      {label}
      <ArrowRight size={16} />
    </button>
  )
}
