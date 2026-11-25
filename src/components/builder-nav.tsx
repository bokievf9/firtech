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
    <div className="sticky top-16 z-30 bg-gradient-to-b from-bg from-70% to-transparent md:top-[72px]">
      <div className="mx-auto max-w-7xl px-4 pt-3 pb-2 md:px-8 md:pt-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="truncate text-callout font-semibold">
            <span className="mr-2 text-caption font-semibold text-accent-text">
              {eyebrow}
            </span>
            <span className="text-muted">{title}</span>
          </h1>
          <span className="shrink-0 text-footnote font-semibold text-fg md:hidden">
            {steps[step]}
          </span>
        </div>
        <ol className="nav-capsule mt-3 max-w-full gap-0.5 overflow-x-auto [scrollbar-width:none] md:w-fit">
          {steps.map((label, i) => {
            const can = reachable(i)
            const on = i === step
            return (
              <li key={label} className="min-w-0 flex-1 md:flex-none">
                <button
                  type="button"
                  disabled={!can}
                  onClick={() => onGo(i)}
                  aria-current={on ? 'step' : undefined}
                  aria-label={`${i + 1}. ${label}`}
                  className={cn(
                    'pressable flex h-10 w-full items-center justify-center gap-2 rounded-full px-0 text-[14px] font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text md:px-4',
                    on
                      ? 'bg-accent text-accent-ink shadow-[var(--shadow-lime)]'
                      : can
                        ? 'text-muted hover:bg-tab-hover hover:text-fg'
                        : 'cursor-not-allowed text-faint/60',
                  )}
                >
                  <span className="font-mono text-[13px] md:text-[12px]">{i + 1}</span>
                  <span className="hidden max-w-[9rem] truncate md:inline">{label}</span>
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
          className="print-hidden pointer-events-none fixed inset-x-0 bottom-0 z-40 px-2 pt-2 md:px-6"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          <div className="nav-capsule pointer-events-auto mx-auto w-full max-w-5xl gap-2 p-2 md:gap-4 md:pl-3" data-builder-bar>
            <Button
              variant="glass"
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
              <IconButton label={previewLabel} tone="outline" onClick={onPreview} className="btn-glass size-12 lg:hidden">
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
