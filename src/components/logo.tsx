import { cn } from '@/lib/cn'

// Brand mark: three stacked tiers of a fir tree, drawn as simple geometry.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-7', className)}>
      <rect width="32" height="32" rx="9" fill="var(--color-accent)" />
      <path d="M16 6.5 21 12h-10z" fill="var(--color-accent-ink)" />
      <path d="M16 10.5 23 18H9z" fill="var(--color-accent-ink)" />
      <path d="M16 14.5 25 24.5H7z" fill="var(--color-accent-ink)" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight">Fir Tech</span>
    </span>
  )
}
