'use client'

import { useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react'
import { TABLE_HEAD, type FormatKind } from '@/lib/doc-editor'
import { docFromDom, docHtml, isPlaceholderText, parseDoc, type RichNode } from '@/lib/doc-rich'

// The rendered view of a document: a contenteditable page over `lib/doc-rich.ts`. The markdown `value` stays the
// source of truth; the tree is drawn from it only when it changed from outside (source view, find and replace,
// a restored draft), never while the owner types here, so the caret never jumps.

export type RichHandle = {
  focus: () => void
  format: (kind: FormatKind) => void
  // Remember the selection (the link address field takes focus), then wrap it in a link.
  saveSelection: () => string
  applyLink: (url: string) => void
  jumpToPlaceholder: (index: number) => void
}

type Rec = { src: string; gap: string; html: string }

// Typography of the page, in the shell's tokens: Onest 17 px on a 1.75 line, headings in Geologica-free sans weight.
export const richPage = [
  'min-h-[24rem] break-words text-[17px] leading-[1.75] text-fg outline-none',
  '[&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-[28px] [&_h1]:font-semibold [&_h1]:leading-[1.2] [&_h1]:tracking-[-0.02em] first:[&_h1]:mt-0',
  '[&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-[22px] [&_h2]:font-semibold [&_h2]:leading-[1.25] [&_h2]:tracking-[-0.015em] first:[&_h2]:mt-0',
  '[&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-[18px] [&_h3]:font-semibold [&_h3]:leading-[1.3] first:[&_h3]:mt-0',
  '[&_h4]:mb-1 [&_h4]:mt-4 [&_h4]:font-semibold [&_h5]:mt-4 [&_h5]:font-semibold [&_h6]:mt-4 [&_h6]:font-semibold',
  '[&_p]:my-3 first:[&_p]:mt-0',
  '[&_strong]:font-semibold [&_em]:italic',
  '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_li>ul]:my-1 [&_li>ol]:my-1',
  '[&_a]:text-accent-text [&_a]:underline [&_a]:decoration-accent-text/50 [&_a]:underline-offset-2',
  '[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-line-strong [&_blockquote]:pl-4 [&_blockquote]:text-muted',
  '[&_hr]:my-6 [&_hr]:border-line-strong',
  '[&_code]:rounded [&_code]:bg-surface-3 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]',
  '[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-line [&_pre]:bg-inset [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-[13px] [&_pre]:leading-[1.5]',
  '[&_table]:my-4 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-[15px]',
  '[&_th]:border [&_th]:border-line-strong [&_th]:bg-surface-2 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:align-top',
  '[&_td]:min-w-16 [&_td]:border [&_td]:border-line-strong [&_td]:px-3 [&_td]:py-1.5 [&_td]:align-top',
  '[&_mark[data-ph]]:rounded-sm [&_mark[data-ph]]:bg-warn/30 [&_mark[data-ph]]:text-fg [&_mark[data-ph]]:underline [&_mark[data-ph]]:decoration-warn [&_mark[data-ph]]:decoration-wavy [&_mark[data-ph]]:underline-offset-4',
].join(' ')

const placeholders = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>('mark[data-ph]'))

export function RichEditor({
  value,
  onChange,
  label,
  ref,
}: {
  value: string
  onChange: (md: string) => void
  label: string
  ref?: Ref<RichHandle>
}) {
  const root = useRef<HTMLDivElement>(null)
  // `emitted` = the markdown the tree stands for; `tail` = what followed the last block; `recs` = untouched blocks.
  const s = useRef<{ emitted: string | null; tail: string; recs: WeakMap<Element, Rec>; range: Range | null }>({
    emitted: null,
    tail: '',
    recs: new WeakMap(),
    range: null,
  })

  const draw = (md: string) => {
    const el = root.current
    if (!el) return
    const doc = parseDoc(md)
    el.innerHTML = docHtml(doc)
    const recs = new WeakMap<Element, Rec>()
    doc.blocks.forEach((b, i) => {
      const child = el.children[i]
      if (child) recs.set(child, { src: b.src, gap: b.gap, html: child.innerHTML })
    })
    s.current = { emitted: md, tail: doc.tail, recs, range: null }
  }

  useLayoutEffect(() => {
    if (value !== s.current.emitted) draw(value)
  })

  // Enter makes a <p>, not a <div>; and the page is plain text only, never pasted HTML.
  useLayoutEffect(() => {
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p')
    } catch {
      // Older engines: the serializer reads a <div> as a paragraph too.
    }
  }, [])

  const emit = () => {
    const el = root.current
    if (!el) return
    // A placeholder whose text no longer has the bracket shape stops being one.
    for (const m of placeholders(el)) if (!isPlaceholderText(m.textContent ?? '')) m.removeAttribute('data-ph')
    const { recs, tail } = s.current
    const md = docFromDom(el as unknown as RichNode, {
      tail,
      keep: (n) => {
        const rec = recs.get(n as unknown as Element)
        return rec && (n as unknown as Element).innerHTML === rec.html ? rec : null
      },
    })
    s.current.emitted = md
    onChange(md)
  }

  const closest = (sel: string): HTMLElement | null => {
    const node = window.getSelection()?.anchorNode
    const el = node && node.nodeType === 3 ? node.parentElement : (node as HTMLElement | null)
    const hit = el?.closest<HTMLElement>(sel) ?? null
    return hit && root.current?.contains(hit) ? hit : null
  }
  const inside = () => !!root.current && !!window.getSelection()?.anchorNode && root.current.contains(window.getSelection()!.anchorNode)

  useImperativeHandle(ref, () => ({
    focus: () => root.current?.focus(),
    format: (kind) => {
      const el = root.current
      if (!el) return
      if (!inside()) el.focus()
      if (kind === 'bold') document.execCommand('bold')
      else if (kind === 'italic') document.execCommand('italic')
      else if (kind === 'heading') document.execCommand('formatBlock', false, closest('h2') ? 'p' : 'h2')
      else if (kind === 'list') document.execCommand('insertUnorderedList')
      else if (kind === 'table') {
        const row = closest('tr')
        if (row) {
          const copy = row.cloneNode(true) as HTMLTableRowElement
          for (const c of Array.from(copy.cells)) c.innerHTML = '<br>'
          if (copy.parentElement?.tagName === 'THEAD') (row.closest('table')!.tBodies[0] ?? row.parentElement!).prepend(copy.cloneNode(true))
          else row.after(copy)
          const cell = copy.cells[0]
          if (cell) window.getSelection()?.collapse(cell, 0)
        } else {
          const table = document.createElement('table')
          table.innerHTML = `<thead><tr>${TABLE_HEAD.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody><tr>${TABLE_HEAD.map(() => '<td><br></td>').join('')}</tr></tbody>`
          const at = closest('p,h1,h2,h3,h4,h5,h6,ul,ol,blockquote,div') ?? el.lastElementChild
          const top = at && at.parentElement !== el ? (at.closest('ul,ol,blockquote') ?? at) : at
          if (top && top.parentElement === el) top.after(table)
          else el.append(table)
          window.getSelection()?.collapse(table.querySelector('tbody td'), 0)
        }
      }
      emit()
    },
    saveSelection: () => {
      const sel = window.getSelection()
      s.current.range = sel && sel.rangeCount && inside() ? sel.getRangeAt(0).cloneRange() : null
      return s.current.range?.toString() ?? ''
    },
    applyLink: (url) => {
      const el = root.current
      if (!el) return
      el.focus()
      const sel = window.getSelection()
      if (s.current.range) {
        sel?.removeAllRanges()
        sel?.addRange(s.current.range)
      }
      if (sel && sel.isCollapsed) document.execCommand('insertHTML', false, `<a href="${url.replace(/"/g, '&quot;')}">${url.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</a>`)
      else document.execCommand('createLink', false, url)
      emit()
    },
    jumpToPlaceholder: (index) => {
      const el = root.current
      const mark = el ? placeholders(el)[index] : undefined
      if (!el || !mark) return
      el.focus()
      const r = document.createRange()
      r.selectNodeContents(mark)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(r)
      mark.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
    },
  }))

  return (
    <div
      ref={root}
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      lang="ru"
      data-rich
      onInput={emit}
      onPaste={(e) => {
        e.preventDefault()
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
      }}
      className={`ym-disable-keys ${richPage}`}
    />
  )
}
