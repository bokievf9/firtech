import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Reveal } from '../reveal'

// Section shell of design system v4 (docs/design-system-v4.md «Секции»): the page container, the section
// rhythm (py-section) and the anchor offset under the floating header. `bleed` drops the container for
// sections that draw their own full-width background.
export function Section({ className, bleed = false, children, ...rest }: { bleed?: boolean } & ComponentPropsWithoutRef<'section'>) {
  return (
    <section className={cn('relative scroll-mt-24 py-section', !bleed && 'mx-auto site-container', className)} {...rest}>
      {children}
    </section>
  )
}

// The header of a section: optional eyebrow, the title (display face, section size), the lead under it.
// Stacked, never split into a headline plus a floating side paragraph. Eyebrows are rationed: at most one
// per three sections on a page (the home page keeps them on the hero, the demo and the prices).
export function SectionHeader({
  eyebrow,
  title,
  lead,
  align = 'start',
  as: Tag = 'h2',
  titleClassName,
  className,
  children,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  lead?: ReactNode
  align?: 'start' | 'center'
  as?: 'h1' | 'h2'
  titleClassName?: string
  className?: string
  children?: ReactNode
}) {
  return (
    <Reveal className={cn(align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow ? <p className="mb-4 text-footnote font-medium text-accent-text">{eyebrow}</p> : null}
      <Tag className={cn('max-w-[22ch] font-display text-title font-semibold', align === 'center' && 'mx-auto', titleClassName)}>{title}</Tag>
      {lead ? <p className={cn('mt-5 max-w-[56ch] text-lead text-muted', align === 'center' && 'mx-auto')}>{lead}</p> : null}
      {children}
    </Reveal>
  )
}
