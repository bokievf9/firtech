import { cn } from '@/lib/cn'

// Brand: "fir" (from the founder's name) with a lime dot, set in Unbounded. The dot alone is the
// small mark, e.g. next to "Fir Tech" in the compare table.
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-2.5 shrink-0 rounded-full bg-accent', className)}
    />
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn('font-brand text-[1.25rem] leading-none font-bold tracking-[-0.05em]', className)}
    >
      <span className="sr-only">Fir Tech</span>
      <span aria-hidden="true">
        fir<span className="mr-[0.035em] ml-[0.02em] text-accent-text">.</span>tech
      </span>
    </span>
  )
}
