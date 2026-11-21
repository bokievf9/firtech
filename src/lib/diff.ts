// Word-level diff for the document editor («Сравнить с v1»). Pure: no I/O, no React.
// A text is split into words and the whitespace between them; the longest common subsequence of
// the two token lists gives the shared words, everything else is a deletion (left) or an addition
// (right). Very long texts fall back to a coarse diff so the page never freezes.

export type DiffOp = { type: 'eq' | 'add' | 'del'; text: string }

// Words and the runs of spaces / line breaks between them, so joining the tokens gives the text back.
export const tokenize = (s: string): string[] => s.match(/\s+|[^\s]+/g) ?? []

// Above this many cells of the LCS table the exact diff is skipped (about 4 000 x 4 000 tokens).
const MAX_CELLS = 16_000_000

function merge(ops: DiffOp[]): DiffOp[] {
  const out: DiffOp[] = []
  for (const op of ops) {
    if (!op.text) continue
    const last = out.at(-1)
    if (last && last.type === op.type) last.text += op.text
    else out.push({ ...op })
  }
  return out
}

export function wordDiff(before: string, after: string): DiffOp[] {
  if (before === after) return before ? [{ type: 'eq', text: before }] : []
  const a = tokenize(before)
  const b = tokenize(after)
  // Trim the common head and tail first: most edits touch a small middle part.
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  let tail = 0
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++
  const am = a.slice(head, a.length - tail)
  const bm = b.slice(head, b.length - tail)
  const ops: DiffOp[] = []
  if (head) ops.push({ type: 'eq', text: a.slice(0, head).join('') })

  if (!am.length || !bm.length) {
    if (am.length) ops.push({ type: 'del', text: am.join('') })
    if (bm.length) ops.push({ type: 'add', text: bm.join('') })
  } else if (am.length * bm.length > MAX_CELLS) {
    ops.push({ type: 'del', text: am.join('') }, { type: 'add', text: bm.join('') })
  } else {
    const w = bm.length + 1
    const table = new Uint32Array((am.length + 1) * w)
    for (let i = am.length - 1; i >= 0; i--)
      for (let j = bm.length - 1; j >= 0; j--)
        table[i * w + j] = am[i] === bm[j] ? table[(i + 1) * w + j + 1]! + 1 : Math.max(table[(i + 1) * w + j]!, table[i * w + j + 1]!)
    let i = 0
    let j = 0
    while (i < am.length && j < bm.length) {
      if (am[i] === bm[j]) {
        ops.push({ type: 'eq', text: am[i]! })
        i++
        j++
      } else if (table[(i + 1) * w + j]! >= table[i * w + j + 1]!) ops.push({ type: 'del', text: am[i++]! })
      else ops.push({ type: 'add', text: bm[j++]! })
    }
    while (i < am.length) ops.push({ type: 'del', text: am[i++]! })
    while (j < bm.length) ops.push({ type: 'add', text: bm[j++]! })
  }
  if (tail) ops.push({ type: 'eq', text: a.slice(a.length - tail).join('') })
  return merge(ops)
}

// Left column = what was there (shared and removed), right column = what is there now (shared and added).
export function sideBySide(ops: DiffOp[]): { left: DiffOp[]; right: DiffOp[] } {
  return { left: ops.filter((o) => o.type !== 'add'), right: ops.filter((o) => o.type !== 'del') }
}

const words = (s: string) => s.match(/[^\s]+/g)?.length ?? 0
export type DiffStats = { added: number; removed: number; changed: boolean }
// Words added and removed, counted by word (whitespace-only changes are not counted).
export function diffStats(ops: DiffOp[]): DiffStats {
  let added = 0
  let removed = 0
  for (const o of ops) {
    if (o.type === 'add') added += words(o.text)
    else if (o.type === 'del') removed += words(o.text)
  }
  return { added, removed, changed: ops.some((o) => o.type !== 'eq') }
}
