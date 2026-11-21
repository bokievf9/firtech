import { cn } from '@/lib/cn'

// Placeholder bars for lists and cards while data loads. Uses the shared `.skeleton` shimmer
// (still under prefers-reduced-motion). The wrapper is one polite status for screen readers.
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('skeleton block h-4 w-full', className)} />
}

export function SkeletonList({ rows = 4, label, className }: { rows?: number; label: string; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={cn('grid gap-3', className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="grid gap-2 rounded-xl border border-line bg-surface p-4">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className={cn('h-3', i % 2 ? 'w-4/5' : 'w-3/5')} />
        </div>
      ))}
    </div>
  )
}

export function SkeletonCard({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={cn('grid gap-3 rounded-card border border-line bg-surface p-6', className)}>
      <span className="sr-only">{label}</span>
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}
