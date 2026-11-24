import { cn } from '@/lib/cn'

// Brand: "fir" (from the founder's name) with a lime dot, set in Manrope 800 (design v5). The dot alone is the
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
      className={cn('font-brand text-[20px] leading-none font-extrabold tracking-[-0.03em] md:text-[22px]', className)}
    >
      <span className="sr-only">Fir Tech</span>
      <span aria-hidden="true">
        fir<span className="text-accent-text">.</span>tech
      </span>
    </span>
  )
}
