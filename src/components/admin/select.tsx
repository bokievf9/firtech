import { CaretDown } from '@phosphor-icons/react/ssr'
import type { ComponentPropsWithRef } from 'react'
import { cn, inputClass } from '@/components/admin/kit'

// The one Shell select (v4): a native <Select> (keyboard, screen readers and the mobile picker stay free) inside a
// styled wrapper with a caret. Same 40 px height, 12 px radius, border and focus ring as `inputClass` fields.
// Width classes (`w-auto`, `sm:w-48`, `flex-1`, `min-w-0`, `max-w-full`) move to the wrapper so the field still fills it.
const WRAP = /^(?:(?:sm|md|lg):)?(?:w-|min-w-|max-w-|flex-|grow|shrink|basis-|self-|col-span)/

export function Select({ className, children, ...rest }: ComponentPropsWithRef<'select'>) {
  const parts = (className ?? '').split(/\s+/).filter(Boolean)
  const outer = parts.filter((p) => WRAP.test(p))
  const inner = parts.filter((p) => !WRAP.test(p))
  const auto = outer.some((p) => /^(?:(?:sm|md|lg):)?w-/.test(p))
  return (
    <span className={cn('relative min-w-0', auto ? 'inline-block' : 'block', outer.join(' '))}>
      <select {...rest} className={cn(inputClass, 'min-h-10 cursor-pointer appearance-none py-1.5 pr-9 disabled:cursor-not-allowed disabled:opacity-60', inner.join(' '))}>
        {children}
      </select>
      <CaretDown size={14} aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-faint" />
    </span>
  )
}
