import { cn } from '@/lib/cn'

// The site's one loading mark (CSS `.spinner` in globals.css): a soft ring that takes the colour of
// the text around it, slower under prefers-reduced-motion. Decorative; the words come from the
// button or panel that holds it.
export function Spinner({ large = false, className }: { large?: boolean; className?: string }) {
  return <span aria-hidden="true" className={cn('spinner', large && 'spinner-lg', className)} />
}

// A centred loading block for panels and route `loading.tsx` screens.
export function PanelLoading({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn('flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-muted', className)}>
      <Spinner large />
      <span>{label}</span>
    </div>
  )
}
