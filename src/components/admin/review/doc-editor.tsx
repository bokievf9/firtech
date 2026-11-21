'use client'

import {
  ArrowLeft,
  CaretDown,
  CaretUp,
  Columns,
  Eye,
  LinkSimple,
  ListBullets,
  MagnifyingGlass,
  PencilSimple,
  Table,
  TextB,
  TextH,
  TextItalic,
  X,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { btn, btnPrimary, useConfirm } from '@/components/admin/hub/ui'
import { Markdown } from '@/components/admin/pult/markdown'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { diffStats, sideBySide, wordDiff, type DiffOp } from '@/lib/diff'
import {
  applyFormat,
  AUTOSAVE_MS,
  DOC_MAX,
  draftKey,
  draftRestorable,
  editorCommand,
  findMatches,
  parseDraft,
  readMinutes,
  replaceAll,
  replaceAt,
  serializeDraft,
  stepMatch,
  wordCount,
  type Edit,
  type FormatKind,
} from '@/lib/doc-editor'

const t = admin.editor
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''))
const clock = (at: number) => new Date(at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export type DocEditorProps = {
  // Dialog title and the line under it (what the document is about).
  title: string
  subtitle?: string
  // The text as saved in HQ, and the text of v1 for «Сравнить с v1».
  initial: string
  baseText: string
  // Storage key of the local draft (draftKey(itemId)).
  storageId: string
  // Save the text as a new version; true when HQ took it. The editor stays open unless `close` is set.
  onSave: (text: string) => Promise<boolean>
  onClose: () => void
  maxLength?: number
}

// The page's type: Onest, 17 px, a comfortable line. The textarea and the search mirror share it exactly.
const pageText: CSSProperties = { fontFamily: 'var(--font-sans)', fontSize: 17, lineHeight: 1.75, padding: 0, margin: 0, border: 0, letterSpacing: 'normal' }

const toolbarButton =
  'grid size-10 shrink-0 place-items-center rounded-xl text-muted transition-[background-color,color,transform] duration-150 hover:bg-surface-3 hover:text-fg active:scale-[0.96] aria-pressed:bg-surface-3 aria-pressed:text-fg disabled:opacity-40'

// Words of the diff, the removed ones struck through on the left, the added ones tinted on the right.
function DiffText({ ops, side }: { ops: DiffOp[]; side: 'left' | 'right' }) {
  return (
    <p className="whitespace-pre-wrap break-words font-sans text-[16px] leading-[1.75]">
      {ops.map((o, i) =>
        o.type === 'eq' ? (
          <span key={i}>{o.text}</span>
        ) : (
          <mark
            key={i}
            className={cn('rounded-sm px-0.5', side === 'left' ? 'bg-danger/15 text-fg line-through decoration-danger/70' : 'bg-accent/25 text-fg')}
          >
            {o.text}
          </mark>
        ),
      )}
    </p>
  )
}

// The text of the page with every match of the search marked, drawn under the transparent textarea.
function Mirror({ text, matches, length, current }: { text: string; matches: number[]; length: number; current: number | null }) {
  const parts: React.ReactNode[] = []
  let at = 0
  matches.forEach((m) => {
    parts.push(text.slice(at, m))
    parts.push(
      <mark key={m} data-current={current === m ? '' : undefined} className={cn('rounded-sm text-transparent', current === m ? 'bg-accent/60' : 'bg-accent/25')}>
        {text.slice(m, m + length)}
      </mark>,
    )
    at = m + length
  })
  parts.push(text.slice(at))
  return (
    <div aria-hidden="true" style={pageText} className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-transparent">
      {parts}
      {'\n'}
    </div>
  )
}

// A Word-like full-screen editor over markdown text: a page column, a formatting toolbar (at the
// bottom on phones), find and replace, a word-level comparison with v1 and a local draft kept every 5 s.
export function DocEditor({ title, subtitle, initial, baseText, storageId, onSave, onClose, maxLength = DOC_MAX }: DocEditorProps) {
  const [value, setValue] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'edit' | 'preview' | 'compare'>('edit')
  const [find, setFind] = useState<{ q: string; r: string; cs: boolean } | null>(null)
  const [cursor, setCursor] = useState<number | null>(null)
  const [findNote, setFindNote] = useState('')
  const [draftAt, setDraftAt] = useState<number | null>(null)
  const [offer, setOffer] = useState<ReturnType<typeof parseDraft>>(null)
  const [error, setError] = useState<string | null>(null)
  const ta = useRef<HTMLTextAreaElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const findInput = useRef<HTMLInputElement>(null)
  const { ask, dialog } = useConfirm()
  const key = draftKey(storageId)
  const dirty = value !== saved
  const tooLong = value.length > maxLength

  // A stored draft that was started from the text saved now is offered back once.
  useEffect(() => {
    try {
      const d = parseDraft(localStorage.getItem(key))
      if (draftRestorable(d, initial)) setOffer(d)
    } catch {}
  }, [key, initial])

  // Autosave: the draft goes to this device every 5 s while the text differs from the saved one.
  const latest = useRef({ value, saved })
  useEffect(() => {
    latest.current = { value, saved }
  })
  useEffect(() => {
    const id = window.setInterval(() => {
      const { value: v, saved: s } = latest.current
      try {
        if (v === s) localStorage.removeItem(key)
        else {
          const at = Date.now()
          localStorage.setItem(key, serializeDraft({ base: s, value: v, at }))
          setDraftAt(at)
        }
      } catch {}
    }, AUTOSAVE_MS)
    return () => window.clearInterval(id)
  }, [key])

  // The page grows with the text: the textarea never scrolls inside, the page column does.
  useLayoutEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value, mode])

  const matches = useMemo(() => (find ? findMatches(value, find.q, find.cs) : []), [find, value])
  const current = cursor !== null && matches.includes(cursor) ? cursor : null
  const position = current !== null ? matches.indexOf(current) + 1 : 0

  const scrollToMatch = useCallback(() => {
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-current]')?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior }))
  }, [])

  // Edits go through the browser's own text insertion where it can, so undo (⌘Z) keeps working.
  const commit = useCallback(
    (next: Edit) => {
      const el = ta.current
      if (!el) return setValue(next.text)
      const old = el.value
      let a = 0
      while (a < old.length && a < next.text.length && old[a] === next.text[a]) a++
      let b = 0
      while (b < old.length - a && b < next.text.length - a && old[old.length - 1 - b] === next.text[next.text.length - 1 - b]) b++
      el.focus()
      el.setSelectionRange(a, old.length - b)
      const ok = typeof document.execCommand === 'function' && document.execCommand('insertText', false, next.text.slice(a, next.text.length - b))
      if (!ok || el.value !== next.text) setValue(next.text)
      requestAnimationFrame(() => ta.current?.setSelectionRange(next.start, next.end))
    },
    [],
  )

  const format = (kind: FormatKind) => {
    const el = ta.current
    if (!el || mode !== 'edit') return
    commit(applyFormat(el.value, el.selectionStart, el.selectionEnd, kind))
  }

  const openFind = useCallback(() => {
    const sel = mode === 'edit' && ta.current ? ta.current.value.slice(ta.current.selectionStart, ta.current.selectionEnd) : ''
    setMode((m) => (m === 'edit' ? m : 'edit'))
    setFind((f) => ({ q: sel && !sel.includes('\n') ? sel : (f?.q ?? ''), r: f?.r ?? '', cs: f?.cs ?? false }))
    setFindNote('')
    requestAnimationFrame(() => {
      findInput.current?.focus()
      findInput.current?.select()
    })
  }, [mode])

  const jump = useCallback(
    (dir: 1 | -1) => {
      if (!find) return
      const list = findMatches(ta.current?.value ?? '', find.q, find.cs)
      const from = current !== null ? current + (dir === 1 ? 1 : 0) : (ta.current?.selectionStart ?? 0)
      const next = stepMatch(list, from, dir)
      setCursor(next)
      setFindNote('')
      if (next !== null) scrollToMatch()
    },
    [find, current, scrollToMatch],
  )

  const replaceOne = () => {
    if (!find || current === null) return jump(1)
    const next = replaceAt(value, current, find.q.length, find.r)
    commit({ text: next, start: current, end: current + find.r.length })
    const rest = findMatches(next, find.q, find.cs)
    setCursor(stepMatch(rest, current + find.r.length, 1))
    setFindNote(fill(t.replaced, { n: 1 }))
    scrollToMatch()
  }
  const replaceEvery = () => {
    if (!find || !matches.length) return
    const r = replaceAll(value, find.q, find.r, find.cs)
    commit({ text: r.text, start: 0, end: 0 })
    setCursor(null)
    setFindNote(fill(t.replaced, { n: r.count }))
  }

  const save = useCallback(
    async (andClose: boolean) => {
      if (busy) return false
      if (value === saved) {
        if (andClose) onClose()
        return true
      }
      if (value.length > maxLength) {
        setError(fill(t.tooLong, { max: maxLength }))
        return false
      }
      setBusy(true)
      setError(null)
      const ok = await onSave(value)
      setBusy(false)
      if (!ok) {
        setError(t.saveFailed)
        return false
      }
      setSaved(value)
      try {
        localStorage.removeItem(key)
      } catch {}
      setDraftAt(null)
      if (andClose) onClose()
      return true
    },
    [busy, value, saved, maxLength, onSave, onClose, key],
  )

  const requestClose = useCallback(async () => {
    if (!dirty) return onClose()
    if (await ask(t.leave, { yes: t.leaveYes, danger: true })) onClose()
  }, [dirty, ask, onClose])

  // Keyboard: captured at the window so the review page and the hub never see these keys while the editor is open.
  const handlers = useRef({ save, requestClose, openFind, jump, format, mode, find })
  useEffect(() => {
    handlers.current = { save, requestClose, openFind, jump, format, mode, find }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmd = editorCommand(e)
      if (!cmd) return
      const h = handlers.current
      // A confirm dialog on top handles its own Escape.
      if (cmd === 'close' && document.querySelector('[role="alertdialog"]')) return
      e.preventDefault()
      e.stopImmediatePropagation()
      switch (cmd) {
        case 'save':
          return void h.save(false)
        case 'saveClose':
          return void h.save(true)
        case 'find':
          return h.openFind()
        case 'findNext':
          return h.jump(1)
        case 'findPrev':
          return h.jump(-1)
        case 'bold':
        case 'italic':
        case 'link':
          return h.format(cmd)
        case 'close':
          if (h.find) {
            setFind(null)
            setCursor(null)
            ta.current?.focus()
          } else if (h.mode !== 'edit') setMode('edit')
          else void h.requestClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // Focus the page on open, and keep the page behind from scrolling.
  useEffect(() => {
    ta.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const ops = useMemo(() => (mode === 'compare' ? wordDiff(baseText, value) : []), [mode, baseText, value])
  const sides = useMemo(() => sideBySide(ops), [ops])
  const stats = useMemo(() => diffStats(ops), [ops])
  const words = wordCount(value)

  const stateText = busy ? t.saving : dirty ? (draftAt ? fill(t.state.draft, { t: clock(draftAt) }) : t.state.dirty) : t.state.clean

  const toolbar = (
    <div role="toolbar" aria-label={t.toolbar} className="flex items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
      <button type="button" className={toolbarButton} aria-label={t.bold} title={t.bold} onMouseDown={(e) => e.preventDefault()} onClick={() => format('bold')} disabled={mode !== 'edit'}>
        <TextB size={18} weight="bold" aria-hidden="true" />
      </button>
      <button type="button" className={toolbarButton} aria-label={t.italic} title={t.italic} onMouseDown={(e) => e.preventDefault()} onClick={() => format('italic')} disabled={mode !== 'edit'}>
        <TextItalic size={18} aria-hidden="true" />
      </button>
      <button type="button" className={toolbarButton} aria-label={t.heading} title={t.heading} onMouseDown={(e) => e.preventDefault()} onClick={() => format('heading')} disabled={mode !== 'edit'}>
        <TextH size={18} aria-hidden="true" />
      </button>
      <button type="button" className={toolbarButton} aria-label={t.list} title={t.list} onMouseDown={(e) => e.preventDefault()} onClick={() => format('list')} disabled={mode !== 'edit'}>
        <ListBullets size={18} aria-hidden="true" />
      </button>
      <button type="button" className={toolbarButton} aria-label={t.link} title={t.link} onMouseDown={(e) => e.preventDefault()} onClick={() => format('link')} disabled={mode !== 'edit'}>
        <LinkSimple size={18} aria-hidden="true" />
      </button>
      <button type="button" className={toolbarButton} aria-label={t.table} title={t.table} onMouseDown={(e) => e.preventDefault()} onClick={() => format('table')} disabled={mode !== 'edit'}>
        <Table size={18} aria-hidden="true" />
      </button>
      <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-line-strong" />
      <button type="button" className={toolbarButton} aria-label={t.find} title={t.find} aria-pressed={!!find} onClick={() => (find ? (setFind(null), setCursor(null)) : openFind())}>
        <MagnifyingGlass size={18} aria-hidden="true" />
      </button>
      <button type="button" className={toolbarButton} aria-label={mode === 'preview' ? t.edit : t.preview} title={mode === 'preview' ? t.edit : t.preview} aria-pressed={mode === 'preview'} onClick={() => setMode(mode === 'preview' ? 'edit' : 'preview')}>
        {mode === 'preview' ? <PencilSimple size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
      <button type="button" className={toolbarButton} aria-label={mode === 'compare' ? t.compareOff : t.compare} title={mode === 'compare' ? t.compareOff : t.compare} aria-pressed={mode === 'compare'} onClick={() => setMode(mode === 'compare' ? 'edit' : 'compare')}>
        <Columns size={18} aria-hidden="true" />
      </button>
    </div>
  )

  return (
    <div role="dialog" aria-modal="true" aria-label={t.dialog} className="fixed inset-0 z-[70] flex flex-col bg-surface-2 text-fg">
      <header className="flex min-h-14 items-center gap-2 border-b border-line bg-bg px-2 sm:gap-3 sm:px-4">
        <button type="button" onClick={() => void requestClose()} aria-label={t.close} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-3 hover:text-fg sm:hidden">
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold sm:text-base">{title}</h2>
          <p className="truncate text-xs text-faint" aria-live="polite">
            {[subtitle, stateText].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className="hidden font-mono text-xs tabular-nums text-faint md:inline" aria-label="Объём">
          {fill(t.words, { n: words })} · {fill(t.chars, { n: value.length })} · {fill(t.minutes, { n: readMinutes(value) })}
        </span>
        <button
          type="button"
          onClick={() => setMode(mode === 'compare' ? 'edit' : 'compare')}
          aria-pressed={mode === 'compare'}
          className={cn(btn, 'hidden sm:inline-flex', mode === 'compare' && 'border-accent text-accent-text')}
        >
          <Columns size={16} aria-hidden="true" />
          {mode === 'compare' ? t.compareOff : t.compare}
        </button>
        <button type="button" onClick={() => void requestClose()} className={cn(btn, 'hidden sm:inline-flex')}>
          <X size={16} aria-hidden="true" />
          {t.close}
        </button>
        <button type="button" data-save-version onClick={() => void save(false)} disabled={busy || !dirty || tooLong} className={btnPrimary}>
          <span className="sm:hidden">Сохранить</span>
          <span className="hidden sm:inline">{t.save}</span>
        </button>
      </header>

      <div className="hidden border-b border-line bg-bg px-2 py-1 sm:block sm:px-4">{toolbar}</div>

      {find ? (
        <div role="search" aria-label={t.find} className="border-b border-line bg-bg px-2 py-2 sm:px-4">
          <div className="mx-auto flex max-w-[760px] flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="doc-find">{t.findLabel}</label>
            <input
              id="doc-find"
              ref={findInput}
              value={find.q}
              placeholder={t.findLabel}
              onChange={(e) => {
                setFind({ ...find, q: e.target.value })
                setCursor(null)
                setFindNote('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  jump(e.shiftKey ? -1 : 1)
                }
              }}
              className="ym-disable-keys min-h-10 min-w-0 flex-1 basis-40 rounded-xl border border-line-strong bg-field px-3 text-base outline-none focus:border-accent md:text-sm"
            />
            <label className="sr-only" htmlFor="doc-replace">{t.replaceLabel}</label>
            <input
              id="doc-replace"
              value={find.r}
              placeholder={t.replaceLabel}
              onChange={(e) => setFind({ ...find, r: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  replaceOne()
                }
              }}
              className="ym-disable-keys min-h-10 min-w-0 flex-1 basis-40 rounded-xl border border-line-strong bg-field px-3 text-base outline-none focus:border-accent md:text-sm"
            />
            <span className="min-w-16 font-mono text-xs tabular-nums text-faint" role="status">
              {findNote || (find.q ? (matches.length ? (position ? fill(t.matches, { i: position, n: matches.length }) : `${matches.length}`) : t.noMatches) : '')}
            </span>
            <button type="button" className={toolbarButton} aria-label={t.prev} title={t.prev} onClick={() => jump(-1)} disabled={!matches.length}>
              <CaretUp size={16} aria-hidden="true" />
            </button>
            <button type="button" className={toolbarButton} aria-label={t.next} title={t.next} onClick={() => jump(1)} disabled={!matches.length}>
              <CaretDown size={16} aria-hidden="true" />
            </button>
            <button type="button" aria-pressed={find.cs} title={t.case} aria-label={t.case} onClick={() => setFind({ ...find, cs: !find.cs })} className={cn(toolbarButton, 'font-mono text-xs')}>
              Aa
            </button>
            <button type="button" className={btn} onClick={replaceOne} disabled={!matches.length}>{t.replaceOne}</button>
            <button type="button" className={btn} onClick={replaceEvery} disabled={!matches.length}>{t.replaceAll}</button>
            <button type="button" className={toolbarButton} aria-label={t.closeFind} title={t.closeFind} onClick={() => { setFind(null); setCursor(null); ta.current?.focus() }}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      {offer ? (
        <div role="status" className="flex flex-wrap items-center justify-center gap-2 border-b border-line bg-accent/15 px-3 py-2 text-sm">
          <span>{fill(t.draftFound, { t: clock(offer.at) })}</span>
          <button
            type="button"
            className="min-h-9 rounded-full bg-fg px-3 text-xs font-medium text-bg"
            onClick={() => {
              setValue(offer.value)
              setOffer(null)
            }}
          >
            {t.draftRestore}
          </button>
          <button
            type="button"
            className="min-h-9 rounded-full border border-line-strong px-3 text-xs"
            onClick={() => {
              try {
                localStorage.removeItem(key)
              } catch {}
              setOffer(null)
            }}
          >
            {t.draftDrop}
          </button>
        </div>
      ) : null}

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-4 sm:px-6 sm:py-8">
        {mode === 'compare' ? (
          <div className="mx-auto grid max-w-[1180px] gap-4 md:grid-cols-2">
            <p className="md:col-span-2 text-center text-xs text-muted" role="status">
              {stats.changed ? fill(t.compareStats, { a: stats.added, r: stats.removed }) : t.compareNone}
            </p>
            <section aria-label={t.compareBefore} className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-8">
              <h3 className="mb-3 text-xs text-faint">{t.compareBefore}</h3>
              <DiffText ops={sides.left} side="left" />
            </section>
            <section aria-label={t.compareAfter} className="rounded-2xl border border-accent/40 bg-surface p-5 shadow-card sm:p-8">
              <h3 className="mb-3 text-xs text-accent-text">{t.compareAfter}</h3>
              <DiffText ops={sides.right} side="right" />
            </section>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[760px] rounded-2xl border border-line bg-surface shadow-card">
            {mode === 'preview' ? (
              <div className="px-5 py-8 sm:px-14 sm:py-12 [&_li]:text-[17px] [&_li]:leading-[1.75] [&_ol]:text-[17px] [&_p]:text-[17px] [&_p]:leading-[1.75] [&_td]:text-[16px] [&_ul]:text-[17px]">
                <Markdown text={value} />
              </div>
            ) : (
              <div className="relative px-5 py-8 sm:px-14 sm:py-12" style={{ minHeight: 'min(60dvh, 32rem)' }}>
                <div className="relative">
                  {find ? <Mirror text={value} matches={matches} length={find.q.length} current={current} /> : null}
                  <textarea
                    ref={ta}
                    value={value}
                    aria-label={t.page}
                    spellCheck
                    lang="ru"
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                      // Tab inserts spaces instead of leaving the page.
                      if (e.key === 'Tab' && !e.shiftKey && !(e.metaKey || e.ctrlKey)) {
                        e.preventDefault()
                        document.execCommand('insertText', false, '  ')
                      }
                    }}
                    className="ym-disable-keys relative block w-full resize-none overflow-hidden whitespace-pre-wrap break-words bg-transparent text-fg outline-none placeholder:text-faint"
                    style={{ ...pageText, minHeight: '24rem' }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        {error ? (
          <p role="alert" className="mx-auto mt-3 max-w-[760px] rounded-xl border border-danger/50 p-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <p className="mx-auto mt-4 hidden max-w-[760px] text-center text-xs text-faint sm:block">{t.hint}</p>
        <div className="h-16 sm:hidden" aria-hidden="true" />
      </div>

      <div className="border-t border-line bg-bg px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] sm:hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 pl-1 font-mono text-[11px] tabular-nums text-faint">{fill(t.words, { n: words })}</span>
          <button type="button" onClick={() => void requestClose()} className="min-h-10 shrink-0 px-2 text-xs text-muted">{t.close}</button>
        </div>
        {toolbar}
      </div>
      {dialog}
    </div>
  )
}
