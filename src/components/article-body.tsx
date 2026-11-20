import { ArrowRight, Lightbulb, SquaresFour } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import type { Block, ListItem } from '@/content/blog'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'

function Item({ item }: { item: ListItem }) {
  if (typeof item === 'string') return <>{item}</>
  return (
    <>
      <span className="font-medium text-fg">{item.title}</span> {item.text}
    </>
  )
}

// Renders an article's blocks in a readable editorial column.
export function ArticleBody({
  blocks,
  dict,
  locale,
}: {
  blocks: Block[]
  dict: Dict
  locale: Locale
}) {
  const t = dict.blog
  return (
    <div className="text-[1.0625rem] leading-[1.75] text-fg/85 md:text-lg">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'p':
            return (
              <p key={i} className="mt-6 first:mt-0">
                {block.text}
              </p>
            )
          case 'h2':
            return (
              <h2
                key={i}
                id={`section-${i}`}
                className="mt-14 text-2xl leading-tight font-semibold tracking-[-0.025em] text-fg md:text-[1.9rem]"
              >
                {block.text}
              </h2>
            )
          case 'list':
            return block.ordered ? (
              <ol key={i} className="mt-6 grid gap-4">
                {block.items.map((item, n) => (
                  <li key={n} className="flex gap-4">
                    <span className="mt-[0.2em] flex size-7 shrink-0 items-center justify-center rounded-full border border-accent-text/40 font-mono text-xs text-accent-text">
                      {n + 1}
                    </span>
                    <span className="min-w-0">
                      <Item item={item} />
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <ul key={i} className="mt-6 grid gap-3">
                {block.items.map((item, n) => (
                  <li key={n} className="flex gap-4">
                    <span
                      aria-hidden="true"
                      className="mt-[0.72em] size-1.5 shrink-0 rounded-full bg-accent"
                    />
                    <span className="min-w-0">
                      <Item item={item} />
                    </span>
                  </li>
                ))}
              </ul>
            )
          case 'callout':
            return (
              <aside
                key={i}
                className="mt-8 flex gap-4 rounded-card border border-accent-text/25 bg-accent/[0.06] p-6"
              >
                <Lightbulb size={22} weight="duotone" className="mt-1 shrink-0 text-accent-text" />
                <div className="min-w-0">
                  {block.title && <p className="font-medium text-fg">{block.title}</p>}
                  <p className={cn(block.title && 'mt-1', 'text-fg/80')}>{block.text}</p>
                </div>
              </aside>
            )
          case 'cta':
            return (
              <aside
                key={i}
                className="dot-grid mt-10 overflow-hidden rounded-card border border-line-strong bg-surface p-6 md:p-8"
              >
                <SquaresFour size={26} weight="duotone" className="text-accent-text" />
                <p className="mt-4 text-xl leading-snug font-semibold tracking-tight text-fg md:text-2xl">
                  {block.title ?? t.ctaTitle}
                </p>
                <p className="mt-2 text-base leading-relaxed text-muted">
                  {block.text ?? t.ctaText}
                </p>
                <Link
                  href={`/${locale}/builder`}
                  data-cta="article_builder"
                  className={cn(buttonStyles.primary, 'group mt-6 w-full sm:w-auto')}
                >
                  {t.ctaButton}
                  <ArrowRight
                    size={16}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                </Link>
              </aside>
            )
        }
      })}
    </div>
  )
}

export function DraftBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-danger/50 bg-danger/10 px-3 py-1 font-mono text-[11px] tracking-[0.12em] text-danger uppercase">
      {label}
    </span>
  )
}
