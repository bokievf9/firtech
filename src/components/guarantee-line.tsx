import { ShieldCheck } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'

// The money-back guarantee as one line with a shield (pricing section, builder summary). The text
// is `guarantee.line`; the exact rule is the `guarantee` section of the terms.
export function GuaranteeLine({
  dict,
  locale,
  className,
  short = false,
}: {
  dict: Dict
  locale: string
  className?: string
  short?: boolean
}) {
  return (
    <p className={cn('flex items-start gap-2.5 text-sm leading-relaxed text-muted', className)}>
      <ShieldCheck size={18} weight="duotone" aria-hidden="true" className="mt-0.5 shrink-0 text-accent-text" />
      <span>
        {short ? dict.guarantee.short : dict.guarantee.line}{' '}
        <Link
          href={`/${locale}/terms#terms-guarantee`}
          className="text-fg underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent-text hover:decoration-accent-text"
        >
          {dict.guarantee.more}
        </Link>
      </span>
    </p>
  )
}
