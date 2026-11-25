import { AddressBook, AppWindow, Buildings, Plugs, Table } from '@phosphor-icons/react/ssr'
import type { ComponentType } from 'react'
import { integrationIds, integrationsCopy, pickBi, type IntegrationId } from '@/content/langs-integrations'
import { cn } from '@/lib/cn'

const icons: Record<IntegrationId, ComponentType<{ size?: number; weight?: 'duotone'; 'aria-hidden'?: 'true'; className?: string }>> = {
  bitrix24: Buildings,
  amocrm: AddressBook,
  sheets: Table,
  miniapp: AppWindow,
  api: Plugs,
}

// «Подключаем»: a plain text list with monochrome icons (no third-party logos). `compact` = one row of names and the
// honest line, for the builder step and the home agents section.
export function IntegrationsList({ locale, compact, className }: { locale: string; compact?: boolean; className?: string }) {
  const c = integrationsCopy
  return (
    <div data-integrations-list data-compact={compact ? 'true' : undefined} className={cn(className)}>
      <h2 className={compact ? 'text-callout font-semibold' : 'text-headline font-semibold'}>{pickBi(c.title, locale)}</h2>
      <ul className={cn(compact ? 'mt-2 flex flex-wrap gap-x-4 gap-y-1.5' : 'mt-3 grid border-t border-line sm:grid-cols-2 sm:gap-x-8')}>
        {integrationIds.map((id) => {
          const Glyph = icons[id]
          return (
            <li
              key={id}
              data-integration={id}
              className={cn(
                'inline-flex items-center gap-2',
                compact ? 'text-footnote text-muted' : 'border-b border-line py-3 text-callout',
              )}
            >
              <Glyph size={compact ? 14 : 18} weight="duotone" aria-hidden="true" className="shrink-0 text-accent-text" />
              {pickBi(c.names[id], locale)}
            </li>
          )
        })}
      </ul>
      <p className={cn('max-w-[60ch] text-muted', compact ? 'mt-2 text-footnote' : 'mt-3 text-callout')}>{pickBi(c.line, locale)}</p>
    </div>
  )
}
