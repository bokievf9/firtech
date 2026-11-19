// A tiny read-only markdown parser for the Пульт playbook drawer. It returns plain data (blocks and
// inline spans) that React renders as text nodes, so raw HTML in the source can never run: tags are
// just characters. Supported: headings, paragraphs, bullet and numbered lists, tables, fenced code,
// quotes, rules; inline `code`, **bold**, *italic*. Links stay as their visible text.

export type Span = { kind: 'text' | 'code' | 'bold' | 'em'; text: string }
export type MdBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; spans: Span[] }
  | { type: 'p'; spans: Span[] }
  | { type: 'ul' | 'ol'; items: Span[][] }
  | { type: 'quote'; spans: Span[] }
  | { type: 'code'; text: string }
  | { type: 'table'; head: Span[][]; rows: Span[][][] }
  | { type: 'hr' }

const MAX_CHARS = 200_000

export function inlineSpans(src: string): Span[] {
  // [label](url) keeps the label only.
  const text = src.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
  const out: Span[] = []
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|(?<![\w*])\*([^*\s][^*]*)\*(?![\w*])/g
  let last = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ kind: 'text', text: text.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ kind: 'code', text: m[1] })
    else if (m[2] !== undefined) out.push({ kind: 'bold', text: m[2] })
    else out.push({ kind: 'em', text: m[3]! })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}

const cells = (line: string): string[] => {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim())
}
const isDivider = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line) && line.includes('-')
const isTableRow = (line: string) => line.includes('|') && line.trim().length > 1

export function parseMarkdown(source: string): MdBlock[] {
  const lines = source.slice(0, MAX_CHARS).replace(/\r\n?/g, '\n').split('\n')
  const blocks: MdBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (!line.trim()) {
      i++
      continue
    }
    const fence = /^\s*(```|~~~)/.exec(line)
    if (fence) {
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i]!.trim().startsWith(fence[1]!)) body.push(lines[i++]!)
      i++
      blocks.push({ type: 'code', text: body.join('\n') })
      continue
    }
    const h = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (h) {
      blocks.push({ type: 'heading', level: Math.min(4, h[1]!.length) as 1 | 2 | 3 | 4, spans: inlineSpans(h[2]!) })
      i++
      continue
    }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }
    if (isTableRow(line) && i + 1 < lines.length && isDivider(lines[i + 1]!)) {
      const head = cells(line).map(inlineSpans)
      const rows: Span[][][] = []
      i += 2
      while (i < lines.length && isTableRow(lines[i]!)) rows.push(cells(lines[i++]!).map(inlineSpans))
      blocks.push({ type: 'table', head, rows })
      continue
    }
    const li = /^\s*([-*+]|\d{1,3}[.)])\s+(.*)$/.exec(line)
    if (li) {
      const ordered = /\d/.test(li[1]!)
      const items: Span[][] = []
      while (i < lines.length) {
        const m = /^\s*([-*+]|\d{1,3}[.)])\s+(.*)$/.exec(lines[i]!)
        if (m && /\d/.test(m[1]!) === ordered) {
          items.push(inlineSpans(m[2]!))
          i++
        } else if (m === null && /^\s{2,}\S/.test(lines[i]!) && items.length) {
          items[items.length - 1] = [...items[items.length - 1]!, ...inlineSpans(' ' + lines[i]!.trim())]
          i++
        } else break
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items })
      continue
    }
    if (/^\s{0,3}>/.test(line)) {
      const body: string[] = []
      while (i < lines.length && /^\s{0,3}>/.test(lines[i]!)) body.push(lines[i++]!.replace(/^\s{0,3}>\s?/, ''))
      blocks.push({ type: 'quote', spans: inlineSpans(body.join(' ')) })
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i]!.trim() && !/^\s*(```|~~~|#{1,6}\s|>|([-*+]|\d{1,3}[.)])\s)/.test(lines[i]!) && !(isTableRow(lines[i]!) && isDivider(lines[i + 1] ?? ''))) para.push(lines[i++]!.trim())
    if (!para.length) {
      para.push(line.trim())
      i++
    }
    blocks.push({ type: 'p', spans: inlineSpans(para.join(' ')) })
  }
  return blocks
}
