import { cn } from '@/lib/cn'

// The one page header of the Shell (docs/shell-design-audit.md): a sticky bar on the thick material with a
// hairline underneath, a v4 title (`text-title-3`, one h1 per page), a one-line hint, optional actions on
// the right and an optional tab strip below. Every section and full-page view uses it, so the titles line up.
export function PageHeader({
  title,
  hint,
  badge,
  actions,
  children,
  className,
}: {
  title: React.ReactNode
  hint?: React.ReactNode
  badge?: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('material-thick sticky top-0 z-10 border-b border-b-hairline border-line', className)} data-page-header>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-3 pb-2.5 sm:px-6">
        <h1 className="text-title-3 font-semibold">{title}</h1>
        {badge}
        {hint ? <p className="min-w-0 flex-1 truncate text-callout text-muted max-sm:hidden">{hint}</p> : <span className="flex-1" />}
        {actions ? <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="px-3 pb-2.5 sm:px-5">{children}</div> : null}
    </div>
  )
}
