import { Translate } from '@phosphor-icons/react/ssr'
import { languagesCopy, pickBi } from '@/content/langs-integrations'
import { cn } from '@/lib/cn'

// «На каких языках»: one honest line for every agent page, AI-team page and the builder agent step. With `example`
// (agent pages only) a collapsible Uzbek dialogue of three lines follows.
export function LanguagesNote({ locale, example, className }: { locale: string; example?: boolean; className?: string }) {
  const c = languagesCopy
  return (
    <div data-languages-note className={cn('grid gap-3', className)}>
      <p className="flex gap-2.5 text-callout text-muted">
        <Translate size={18} weight="duotone" aria-hidden="true" className="mt-0.5 shrink-0 text-accent-text" />
        <span>{pickBi(c.note, locale)}</span>
      </p>
      {example && (
        <details data-languages-example className="rounded-tile border border-hairline border-line px-4 py-3 text-callout">
          <summary className="cursor-pointer font-medium">{pickBi(c.exampleSummary, locale)}</summary>
          <ul lang="uz" className="mt-3 grid gap-2">
            {c.example.map((line) => (
              <li key={line.text} className="grid gap-0.5 sm:grid-cols-[5.5rem_1fr] sm:gap-3">
                <span lang={locale} className="text-footnote text-faint">{pickBi(c.roles[line.who], locale)}</span>
                <span>{line.text}</span>
              </li>
            ))}
          </ul>
          <p lang={locale} className="mt-3 text-footnote text-faint">{pickBi(c.exampleHint, locale)}</p>
        </details>
      )}
    </div>
  )
}
