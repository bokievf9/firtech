// A small, safe markdown subset for client documents (cabinet): headings (#..###), paragraphs, bullet and
// numbered lists, **bold**, *italic*, horizontal rules. It returns a plain tree that React renders as text
// nodes, so no HTML, no links, no images and no attributes from the document ever reach the page.
// Anything else (HTML tags, `[x](javascript:...)`, tables) stays literal text. Pure: tests import it.

export type Inline = { kind: 'text' | 'strong' | 'em'; text: string }
export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; inline: Inline[] }
  | { kind: 'paragraph'; inline: Inline[] }
  | { kind: 'list'; ordered: boolean; items: Inline[][] }
  | { kind: 'rule' }

export const MAX_DOC_TEXT = 60_000

// Control characters (but not newline or tab) and bidi overrides are dropped.
const clean = (s: string) => s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f‪-‮⁦-⁩]/g, '')

export function parseInline(src: string): Inline[] {
  const out: Inline[] = []
  const push = (kind: Inline['kind'], text: string) => {
    if (!text) return
    const last = out[out.length - 1]
    if (kind === 'text' && last?.kind === 'text') last.text += text
    else out.push({ kind, text })
  }
  let i = 0
  while (i < src.length) {
    if (src.startsWith('**', i)) {
      const end = src.indexOf('**', i + 2)
      if (end > i + 2) {
        push('strong', src.slice(i + 2, end))
        i = end + 2
        continue
      }
    } else if (src[i] === '*' && src[i + 1] !== ' ' && src[i + 1] !== '*') {
      const end = src.indexOf('*', i + 1)
      if (end > i + 1 && src[end - 1] !== ' ') {
        push('em', src.slice(i + 1, end))
        i = end + 1
        continue
      }
    }
    push('text', src[i]!)
    i += 1
  }
  return out
}

const HEADING = /^(#{1,3})\s+(.+?)\s*#*\s*$/
const BULLET = /^\s{0,3}[-*+]\s+(.*)$/
const NUMBERED = /^\s{0,3}\d{1,3}[.)]\s+(.*)$/
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/

export function parseMarkdown(input: unknown): Block[] {
  if (typeof input !== 'string' || !input.trim()) return []
  const lines = clean(input.slice(0, MAX_DOC_TEXT)).split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  let current: { ordered: boolean; items: Inline[][] } | null = null
  const flushPara = () => {
    if (para.length) blocks.push({ kind: 'paragraph', inline: parseInline(para.join(' ')) })
    para = []
  }
  const flushList = () => {
    if (current) blocks.push({ kind: 'list', ordered: current.ordered, items: current.items })
    current = null
  }
  for (const line of lines) {
    if (!line.trim()) {
      flushPara()
      flushList()
      continue
    }
    const h = HEADING.exec(line)
    if (h) {
      flushPara()
      flushList()
      blocks.push({ kind: 'heading', level: h[1]!.length as 1 | 2 | 3, inline: parseInline(h[2]!) })
      continue
    }
    if (RULE.test(line)) {
      flushPara()
      flushList()
      blocks.push({ kind: 'rule' })
      continue
    }
    const b = BULLET.exec(line)
    const n = b ? null : NUMBERED.exec(line)
    const item = b ?? n
    if (item) {
      flushPara()
      const ordered = n !== null
      if (current && current.ordered !== ordered) flushList()
      current ??= { ordered, items: [] }
      current.items.push(parseInline(item[1]!))
      continue
    }
    flushList()
    para.push(line.trim())
  }
  flushPara()
  flushList()
  return blocks
}
