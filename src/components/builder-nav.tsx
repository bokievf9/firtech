'use client'

import { ArrowLeft, ArrowRight, Eye, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Button, IconButton, Sheet } from '@/components/ui'
import { cn } from '@/lib/cn'
import { fade, spring } from '@/lib/motion'
import { useReducedMotion } from '@/lib/use-reduced-motion'

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
    <div className="material-thick sticky top-16 z-30 rounded-none border-x-0 border-t-0 md:top-[72px]">
      <div className="mx-auto site-container pt-3 pb-2.5 md:pt-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="truncate text-callout font-medium">
            <span className="mr-2 text-caption font-medium text-accent-text">
              {eyebrow}
            </span>
            <span className="text-muted">{title}</span>
          </h1>
          <span className="shrink-0 text-footnote text-muted md:hidden">
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
                    'group flex w-full flex-col gap-2 rounded-md py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text',
                    !can && 'cursor-not-allowed',
                  )}
                >
                  <span className="relative block h-1 overflow-hidden rounded-full bg-line-strong">
                    <span
                      className={cn(
                        'absolute inset-0 origin-left rounded-full transition-[transform,background-color] duration-300 ease-drawer motion-reduce:transition-none',
                        i <= step ? 'scale-x-100' : 'scale-x-0',
                        i === step ? 'bg-accent' : 'bg-accent/45',
                      )}
                    />
                  </span>
                  <span
                    className={cn(
                      'hidden truncate text-footnote transition-colors md:block',
                      i === step
                        ? 'text-fg'
                        : can
                          ? 'text-faint group-hover:text-muted'
                          : 'text-faint/50',
                    )}
                  >
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
          transition={reduce ? fade : spring.sheet}
          data-fira-avoid=""
          className="print-hidden material-thick fixed inset-x-0 bottom-0 z-40 rounded-none border-x-0 border-b-0"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto flex site-container items-center gap-2 py-3 md:gap-4">
            <Button
              variant="secondary"
              onClick={onBack}
              disabled={!onBack}
              aria-label={backLabel}
              className="size-12 shrink-0 px-0 md:w-auto md:px-5 disabled:opacity-30"
            >
              <ArrowLeft size={16} />
              <span className="hidden md:inline">{backLabel}</span>
            </Button>
            <div className="flex-none px-1 md:min-w-0 md:flex-1">{center}</div>
            {onPreview && previewLabel && (
              <IconButton label={previewLabel} tone="outline" onClick={onPreview} className="size-12 lg:hidden">
                <Eye size={18} />
              </IconButton>
            )}
            {primary}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Phones and tablets: the mockup in a sheet from the bottom (shared Sheet: focus trap, Esc, scroll lock).
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
  return (
    <Sheet open={open} onClose={onClose} label={title} side="bottom" className="lg:hidden">
      <div className="flex items-center justify-between gap-4 px-4 pt-4 pb-2">
        <p className="text-headline">{title}</p>
        <IconButton label={closeLabel} tone="outline" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">{children}</div>
    </Sheet>
  )
}

// `blocked` keeps the button pressable: a press explains what is missing instead of doing nothing.
export function NextButton({
  label,
  blocked,
  onClick,
}: {
  label: string
  blocked?: boolean
  onClick: () => void
}) {
  return (
    <Button
      aria-disabled={blocked || undefined}
      onClick={onClick}
      className={cn('min-w-0 px-5 max-sm:h-auto max-sm:min-h-12 max-sm:py-2 max-sm:whitespace-normal max-sm:text-center max-sm:leading-tight md:shrink-0 md:px-7', blocked && 'opacity-50')}
    >
      {label}
      <ArrowRight size={16} />
    </Button>
  )
}
