import { Fragment } from 'react'
import { parseMarkdown, type Inline } from '@/lib/cabinet-markdown'

// The readable body of a cabinet document: the safe markdown subset from `lib/cabinet-markdown.ts` rendered as
// React text nodes (no dangerouslySetInnerHTML, no links), so the document's words never become markup.
function Spans({ inline }: { inline: Inline[] }) {
  return (
    <>
      {inline.map((s, i) =>
        s.kind === 'strong' ? (
          <strong key={i} className="font-semibold text-fg">
            {s.text}
          </strong>
        ) : s.kind === 'em' ? (
          <em key={i}>{s.text}</em>
        ) : (
          <Fragment key={i}>{s.text}</Fragment>
        ),
      )}
    </>
  )
}

export function DocumentText({ text, label }: { text: string; label: string }) {
  const blocks = parseMarkdown(text)
  return (
    <article aria-label={label} className="grid gap-3 text-callout leading-relaxed text-muted" data-doc-text>
      {blocks.map((b, i) => {
        if (b.kind === 'heading')
          return b.level === 1 ? (
            <h4 key={i} className="font-display text-title-3 font-semibold text-fg">
              <Spans inline={b.inline} />
            </h4>
          ) : (
            <h5 key={i} className="mt-2 text-body font-semibold text-fg">
              <Spans inline={b.inline} />
            </h5>
          )
        if (b.kind === 'rule') return <hr key={i} className="border-line" />
        if (b.kind === 'list') {
          const Tag = b.ordered ? 'ol' : 'ul'
          return (
            <Tag key={i} className={b.ordered ? 'ml-5 grid list-decimal gap-1.5' : 'ml-5 grid list-disc gap-1.5'}>
              {b.items.map((it, j) => (
                <li key={j}>
                  <Spans inline={it} />
                </li>
              ))}
            </Tag>
          )
        }
        return (
          <p key={i}>
            <Spans inline={b.inline} />
          </p>
        )
      })}
    </article>
  )
}
