import { Fragment } from 'react'
import { parseMarkdown, type MdBlock, type Span } from '@/lib/markdown-lite'

// Read-only markdown for the playbook drawer: the parser gives data, this renders it as React text
// nodes (no innerHTML, no raw HTML, no links).
function Spans({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((s, i) =>
        s.kind === 'code' ? (
          <code key={i} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.85em]">{s.text}</code>
        ) : s.kind === 'bold' ? (
          <strong key={i} className="font-semibold">{s.text}</strong>
        ) : s.kind === 'em' ? (
          <em key={i}>{s.text}</em>
        ) : (
          <Fragment key={i}>{s.text}</Fragment>
        ),
      )}
    </>
  )
}

const headings = ['', 'text-lg font-semibold', 'text-base font-semibold', 'text-sm font-semibold', 'text-sm font-medium text-muted']

function Block({ b }: { b: MdBlock }) {
  switch (b.type) {
    case 'heading': {
      const Tag = (`h${Math.min(6, b.level + 2)}`) as 'h3'
      return <Tag className={`mt-2 ${headings[b.level]}`}><Spans spans={b.spans} /></Tag>
    }
    case 'p':
      return <p className="text-sm leading-relaxed"><Spans spans={b.spans} /></p>
    case 'quote':
      return <blockquote className="border-l-2 border-line-strong pl-3 text-sm text-muted"><Spans spans={b.spans} /></blockquote>
    case 'ul':
    case 'ol': {
      const Tag = b.type
      return (
        <Tag className={`grid gap-1 pl-5 text-sm ${b.type === 'ul' ? 'list-disc' : 'list-decimal'}`}>
          {b.items.map((it, i) => (
            <li key={i}><Spans spans={it} /></li>
          ))}
        </Tag>
      )
    }
    case 'code':
      return <pre className="overflow-x-auto rounded-xl border border-line bg-inset p-3 font-mono text-xs">{b.text}</pre>
    case 'hr':
      return <hr className="border-line" />
    case 'table':
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-faint">
                {b.head.map((h, i) => (
                  <th key={i} className="px-2 py-1 font-normal"><Spans spans={h} /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, ri) => (
                <tr key={ri} className="border-t border-line align-top">
                  {r.map((c, ci) => (
                    <td key={ci} className="px-2 py-1.5"><Spans spans={c} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="grid gap-3">
      {parseMarkdown(text).map((b, i) => (
        <Block key={i} b={b} />
      ))}
    </div>
  )
}
