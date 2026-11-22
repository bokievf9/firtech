// The rendered view of the document editor: a small markdown <-> rich text layer. No dependencies, no DOM
// in this file (the serializer reads a structural node type, so tests feed it a tiny fake tree).
//
// Markdown stays the one source of truth. `parseDoc` cuts the text into top-level blocks and remembers the exact
// source and the gap before each block, `blockHtml` draws a block as HTML, `docFromDom` turns the (edited) tree
// back into markdown. A block the owner did not touch is written back byte for byte (`keep`), so opening a
// document and typing in one paragraph never reformats the rest. Anything this layer does not know (fenced code)
// is a locked raw block; unknown inline syntax stays literal text, which serializes to itself.

export type RichKind = 'heading' | 'p' | 'ul' | 'ol' | 'quote' | 'table' | 'hr' | 'raw'
export type RichBlock = { kind: RichKind; src: string; gap: string }
export type RichDoc = { blocks: RichBlock[]; tail: string }

// ---- markdown -> blocks ------------------------------------------------------------------------------

const FENCE = /^\s*(```|~~~)/
const HEAD = /^(#{1,6})[ \t]+\S/
const HR = /^ {0,3}([-*_])([ \t]*\1){2,}[ \t]*$/
const LIST = /^([ \t]*)([-*+]|\d{1,9}[.)])[ \t]+\S/
const QUOTE = /^ {0,3}>/
const DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/
const BLANK = /^\s*$/

type Line = { text: string; start: number; end: number }

export function parseDoc(md: string): RichDoc {
  const lines: Line[] = []
  for (let pos = 0; pos <= md.length; ) {
    const nl = md.indexOf('\n', pos)
    const end = nl < 0 ? md.length : nl
    lines.push({ text: md.slice(pos, end).replace(/\r$/, ''), start: pos, end })
    if (nl < 0) break
    pos = nl + 1
  }
  const n = lines.length
  const isTableStart = (i: number) => i + 1 < n && lines[i]!.text.includes('|') && lines[i + 1]!.text.includes('|') && DIVIDER.test(lines[i + 1]!.text) && lines[i + 1]!.text.includes('-')
  const startsBlock = (i: number) => {
    const t = lines[i]!.text
    return FENCE.test(t) || HEAD.test(t) || HR.test(t) || LIST.test(t) || QUOTE.test(t) || isTableStart(i)
  }
  const blocks: RichBlock[] = []
  let prevEnd = 0
  let i = 0
  while (i < n) {
    const t = lines[i]!.text
    if (BLANK.test(t)) {
      i++
      continue
    }
    let kind: RichKind
    let j = i
    if (FENCE.test(t)) {
      kind = 'raw'
      const mark = FENCE.exec(t)![1]!
      j = n - 1
      for (let k = i + 1; k < n; k++)
        if (lines[k]!.text.trim().startsWith(mark)) {
          j = k
          break
        }
    } else if (HEAD.test(t)) kind = 'heading'
    else if (HR.test(t)) kind = 'hr'
    else if (isTableStart(i)) {
      kind = 'table'
      j = i + 1
      while (j + 1 < n && !BLANK.test(lines[j + 1]!.text) && lines[j + 1]!.text.includes('|')) j++
    } else if (QUOTE.test(t)) {
      kind = 'quote'
      while (j + 1 < n && QUOTE.test(lines[j + 1]!.text)) j++
    } else if (LIST.test(t)) {
      kind = /^[ \t]*\d/.test(t) ? 'ol' : 'ul'
      for (;;) {
        let k = j + 1
        while (k < n && BLANK.test(lines[k]!.text)) k++
        if (k >= n) break
        const next = lines[k]!.text
        if (LIST.test(next) && !HR.test(next)) {
          // After a blank line only an item of the same kind (or a nested one) continues the list.
          const indent = /^[ \t]*/.exec(next)![0].length
          if (k === j + 1 || indent > 0 || /^[ \t]*\d/.test(next) === (kind === 'ol')) j = k
          else break
        }
        else if (k === j + 1 && !FENCE.test(next) && !HEAD.test(next) && !HR.test(next) && !QUOTE.test(next) && !isTableStart(k)) j = k
        else break
      }
    } else {
      kind = 'p'
      while (j + 1 < n && !BLANK.test(lines[j + 1]!.text) && !startsBlock(j + 1)) j++
    }
    const src = md.slice(lines[i]!.start, lines[j]!.end)
    blocks.push({ kind, src, gap: md.slice(prevEnd, lines[i]!.start) })
    prevEnd = lines[j]!.end
    i = j + 1
  }
  return { blocks, tail: md.slice(prevEnd) }
}

// ---- inline ------------------------------------------------------------------------------------------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/|#)/i
const INLINE =
  /`([^`\n]+)`|\*\*(\S(?:[\s\S]*?\S)?)\*\*|\*([^\s*](?:[^*\n]*?[^\s*])?)\*|\[([^\]\n]+)\]\(([^)\s]+)\)|(\[[^\]\n]{2,60}\])(?!\()/g

export function inlineHtml(text: string): string {
  let out = ''
  let at = 0
  for (const m of text.matchAll(INLINE)) {
    out += esc(text.slice(at, m.index))
    at = m.index + m[0].length
    if (m[1] !== undefined) out += `<code>${esc(m[1])}</code>`
    else if (m[2] !== undefined) out += `<strong>${inlineHtml(m[2])}</strong>`
    else if (m[3] !== undefined) out += `<em>${inlineHtml(m[3])}</em>`
    else if (m[4] !== undefined && m[5] !== undefined) {
      if (SAFE_HREF.test(m[5])) out += `<a href="${esc(m[5])}">${inlineHtml(m[4])}</a>`
      else out += esc(m[0])
    } else out += `<mark data-ph>${esc(m[6]!)}</mark>`
  }
  return out + esc(text.slice(at))
}

const lineHtml = (text: string) =>
  text
    .split('\n')
    .map((l) => inlineHtml(l.trim()))
    .join('<br>')

// ---- blocks -> html ----------------------------------------------------------------------------------

type Item = { text: string; sub: ListNode | null }
type ListNode = { ordered: boolean; items: Item[] }

function parseList(src: string): ListNode {
  const stack: { indent: number; list: ListNode }[] = []
  let root: ListNode | null = null
  for (const raw of src.split('\n')) {
    if (BLANK.test(raw)) continue
    const m = /^([ \t]*)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/.exec(raw)
    if (!m || HR.test(raw)) {
      // A continuation line belongs to the last item.
      const last = stack.at(-1)?.list.items.at(-1)
      if (last) last.text += `\n${raw.trim()}`
      continue
    }
    const indent = m[1]!.replace(/\t/g, '    ').length
    const ordered = /\d/.test(m[2]!)
    let top = stack.at(-1)
    if (!top) {
      root = { ordered, items: [] }
      top = { indent, list: root }
      stack.push(top)
    } else if (indent > top.indent && top.list.items.length) {
      const list: ListNode = { ordered, items: [] }
      top.list.items.at(-1)!.sub = list
      top = { indent, list }
      stack.push(top)
    } else {
      while (stack.length > 1 && indent < top.indent) {
        stack.pop()
        top = stack.at(-1)!
      }
    }
    top.list.items.push({ text: m[3]!, sub: null })
  }
  return root ?? { ordered: false, items: [] }
}

function listHtml(l: ListNode): string {
  const tag = l.ordered ? 'ol' : 'ul'
  return `<${tag}>${l.items.map((it) => `<li>${lineHtml(it.text)}${it.sub ? listHtml(it.sub) : ''}</li>`).join('')}</${tag}>`
}

// Cells of one table row; `\|` is a pipe inside a cell.
export function splitCells(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  const cells: string[] = []
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') {
      cur += '|'
      i++
    } else if (s[i] === '|') {
      cells.push(cur.trim())
      cur = ''
    } else cur += s[i]
  }
  cells.push(cur.trim())
  return cells
}

export function blockHtml(b: RichBlock): string {
  switch (b.kind) {
    case 'heading': {
      const level = /^#+/.exec(b.src)![0].length
      const text = b.src.replace(/^#{1,6}[ \t]+/, '').replace(/[ \t]+#+[ \t]*$/, '')
      return `<h${level}>${inlineHtml(text.trim())}</h${level}>`
    }
    case 'hr':
      return '<hr>'
    case 'quote':
      return `<blockquote>${lineHtml(b.src.split('\n').map((l) => l.replace(/^ {0,3}>[ ]?/, '')).join('\n'))}</blockquote>`
    case 'ul':
    case 'ol':
      return listHtml(parseList(b.src))
    case 'table': {
      const rows = b.src.split('\n').filter((_, i) => i !== 1).map(splitCells)
      const [head, ...body] = rows
      const cell = (tag: string, c: string) => `<${tag}>${inlineHtml(c)}</${tag}>`
      return `<table><thead><tr>${(head ?? []).map((c) => cell('th', c)).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => cell('td', c)).join('')}</tr>`).join('')}</tbody></table>`
    }
    case 'raw':
      return `<pre data-raw contenteditable="false">${esc(b.src)}</pre>`
    default:
      return `<p>${lineHtml(b.src)}</p>`
  }
}

export const docHtml = (doc: RichDoc): string => doc.blocks.map(blockHtml).join('') || '<p><br></p>'

// ---- tree -> markdown --------------------------------------------------------------------------------

// What the serializer needs of a node: the real DOM satisfies it, the tests use a plain object tree.
export type RichNode = {
  nodeType: number
  nodeName: string
  nodeValue: string | null
  childNodes: ArrayLike<RichNode>
  getAttribute?: (name: string) => string | null
}
const TEXT = 3
const ELEMENT = 1
const BLOCK = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'TABLE', 'HR', 'PRE'])
const kids = (n: RichNode): RichNode[] => Array.from(n.childNodes)
const isBlockEl = (n: RichNode) => n.nodeType === ELEMENT && BLOCK.has(n.nodeName.toUpperCase())

function wrapMark(mark: string, inner: string): string {
  if (!inner.trim()) return inner
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner)!
  return `${m[1]}${mark}${m[2]}${mark}${m[3]}`
}

export function inlineMd(el: RichNode): string {
  const list = kids(el)
  let out = ''
  list.forEach((c, idx) => {
    if (c.nodeType === TEXT) {
      out += (c.nodeValue ?? '').replace(/[​﻿]/g, '').replace(/ /g, ' ').replace(/\n/g, ' ')
      return
    }
    if (c.nodeType !== ELEMENT) return
    const name = c.nodeName.toUpperCase()
    if (name === 'BR') {
      // The browser's trailing placeholder <br> is not a line break.
      if (idx === list.length - 1 && idx > 0) return
      out += '\n'
    } else if (name === 'B' || name === 'STRONG') out += wrapMark('**', inlineMd(c))
    else if (name === 'I' || name === 'EM') out += wrapMark('*', inlineMd(c))
    else if (name === 'CODE') out += `\`${kids(c).map((x) => x.nodeValue ?? '').join('')}\``
    else if (name === 'A') {
      const href = c.getAttribute?.('href') ?? ''
      const label = inlineMd(c)
      out += href && SAFE_HREF.test(href) ? `[${label}](${href})` : label
    } else if (BLOCK.has(name) && name !== 'LI') {
      const inner = inlineMd(c)
      if (inner.trim()) out += `${out && !out.endsWith('\n') ? '\n' : ''}${inner}`
    } else out += inlineMd(c)
  })
  return out
}

const oneLine = (s: string) => s.replace(/\s*\n\s*/g, ' ').trim()

function listMd(el: RichNode, depth: number): string[] {
  const out: string[] = []
  const pad = '  '.repeat(depth)
  let n = 0
  for (const li of kids(el)) {
    if (li.nodeType !== ELEMENT) continue
    const own: RichNode[] = []
    const subs: RichNode[] = []
    for (const c of kids(li)) (c.nodeType === ELEMENT && /^(UL|OL)$/i.test(c.nodeName) ? subs : own).push(c)
    const text = inlineMd({ nodeType: ELEMENT, nodeName: 'LI', nodeValue: null, childNodes: own }).trim()
    if (!text && !subs.length) continue
    n++
    const marker = el.nodeName.toUpperCase() === 'OL' ? `${n}.` : '-'
    out.push(`${pad}${marker} ${text.replace(/\n/g, `\n${pad}  `)}`)
    for (const s of subs) out.push(...listMd(s, depth + 1))
  }
  return out
}

function tableMd(el: RichNode): string {
  const rows: string[][] = []
  const walk = (n: RichNode) => {
    for (const c of kids(n)) {
      if (c.nodeType !== ELEMENT) continue
      if (/^TR$/i.test(c.nodeName))
        rows.push(kids(c).filter((x) => x.nodeType === ELEMENT && /^(TH|TD)$/i.test(x.nodeName)).map((x) => oneLine(inlineMd(x)).replace(/\|/g, '\\|')))
      else walk(c)
    }
  }
  walk(el)
  if (!rows.length) return ''
  const cols = Math.max(...rows.map((r) => r.length))
  const fmt = (r: string[]) => `| ${Array.from({ length: cols }, (_, i) => r[i] ?? '').join(' | ')} |`
  return [fmt(rows[0]!), `|${Array.from({ length: cols }, () => '---').join('|')}|`, ...rows.slice(1).map(fmt)].join('\n')
}

type Out = { md: string; gap: string | null }
export type KeepFn = (el: RichNode) => { src: string; gap: string } | null

function blocksOf(nodes: RichNode[], keep: KeepFn | undefined): Out[] {
  const out: Out[] = []
  let loose: RichNode[] = []
  const flush = () => {
    if (!loose.length) return
    const md = inlineMd({ nodeType: ELEMENT, nodeName: 'P', nodeValue: null, childNodes: loose }).trim()
    if (md) out.push({ md, gap: null })
    loose = []
  }
  for (const n of nodes) {
    if (!isBlockEl(n)) {
      if (n.nodeType === TEXT || n.nodeType === ELEMENT) loose.push(n)
      continue
    }
    flush()
    const kept = keep?.(n)
    if (kept) {
      out.push({ md: kept.src, gap: kept.gap })
      continue
    }
    const name = n.nodeName.toUpperCase()
    let md = ''
    if (/^H[1-6]$/.test(name)) {
      const text = oneLine(inlineMd(n))
      md = text ? `${'#'.repeat(Number(name[1]))} ${text}` : ''
    } else if (name === 'P') md = inlineMd(n).trim()
    else if (name === 'DIV') {
      if (kids(n).some(isBlockEl)) out.push(...blocksOf(kids(n), keep))
      else md = inlineMd(n).trim()
    } else if (name === 'UL' || name === 'OL') md = listMd(n, 0).join('\n')
    else if (name === 'LI') md = inlineMd(n).trim()
    else if (name === 'BLOCKQUOTE') {
      const inner = kids(n).some(isBlockEl) ? blocksOf(kids(n), undefined).map((b) => b.md).join('\n') : inlineMd(n).trim()
      md = inner ? inner.split('\n').map((l) => `> ${l}`.trimEnd()).join('\n') : ''
    } else if (name === 'TABLE') md = tableMd(n)
    else if (name === 'HR') md = '---'
    else if (name === 'PRE') md = `\`\`\`\n${kids(n).map((x) => x.nodeValue ?? '').join('')}\n\`\`\``
    if (md) out.push({ md, gap: null })
  }
  flush()
  return out
}

// The markdown of the rendered tree. `keep` returns the original source and gap of a block that is unchanged.
export function docFromDom(root: RichNode, opts: { keep?: KeepFn; tail?: string } = {}): string {
  const blocks = blocksOf(kids(root), opts.keep)
  if (!blocks.length) return ''
  return blocks.map((b, i) => (b.gap ?? (i ? '\n\n' : '')) + b.md).join('') + (opts.tail ?? '')
}

// A caret inside a placeholder still counts only while the text keeps the shape HQ checks.
export const isPlaceholderText = (s: string): boolean => /^\[[^\]\n]{2,60}\]$/.test(s)
