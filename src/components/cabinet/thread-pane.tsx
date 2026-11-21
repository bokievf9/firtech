'use client'

import { ArrowLeft, Check, Checks, FileText, Paperclip, PaperPlaneRight, WarningCircle, X } from '@phosphor-icons/react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { Dict } from '@/content'
import {
  checkUpload,
  cleanMessage,
  composerKey,
  formatSize,
  groupByDay,
  lastServerId,
  mergeMessages,
  parseMessageItem,
  parseMessages,
  uploadAccept,
  MESSAGE_MAX,
  type ChatMessage,
  type ChatThread,
} from '@/lib/cabinet-chat'
import { buttonStyles, cn } from '@/lib/cn'
import { FormMessage } from './ui'

// One conversation of the messenger (cabinet v3): the messages (day separators, read marks, attachments),
// the composer (Enter sends, Shift+Enter breaks the line, a file through /api/cabinet/uploads) and the
// refresh of the open thread every 15 s while the page is visible. Used by «Сообщения» and, for the
// client's own agent, by «Ваш агент» (`agentReply`: after a send it asks again soon, because the agent
// answers within seconds).
const POLL_MS = 15_000
const BURST_MS = [1200, 3000, 6000]

const localDay = (iso: string | null) => {
  const d = iso ? new Date(iso) : null
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('sv-SE') : ''
}
const timeOf = (iso: string | null, locale: string) => {
  const d = iso ? new Date(iso) : null
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString(locale === 'en' ? 'en-US' : 'ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''
}

export function ThreadPane({
  thread,
  dict,
  locale,
  onRead,
  onBack,
  agentReply = false,
  chrome = true,
  className,
}: {
  thread: ChatThread
  dict: Dict
  locale: string
  // The thread was opened or read: the unread count of it is now zero.
  onRead?: (threadId: string) => void
  onBack?: () => void
  agentReply?: boolean
  // The header with the title (off where the surrounding card has its own).
  chrome?: boolean
  className?: string
}) {
  const t = dict.cabinet.v3.messages
  const errors = t.errors as Record<string, string>
  const uid = useId()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const pick = useRef<HTMLInputElement>(null)
  const current = useRef(messages)
  const stick = useRef(true)
  const unread = useRef(thread.unread)
  const seq = useRef(0)
  const threadId = thread.id
  useEffect(() => {
    current.current = messages
  })

  const markRead = useCallback(async () => {
    try {
      await fetch(`/api/cabinet/threads/${encodeURIComponent(threadId)}/read`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      unread.current = 0
      onRead?.(threadId)
    } catch {
      // The next poll tries again.
    }
  }, [threadId, onRead])

  // Newer messages than the last one we know (all of them on the first call).
  const load = useCallback(
    async (first = false) => {
      if (!first && document.visibilityState !== 'visible') return
      const after = first ? null : lastServerId(current.current)
      try {
        const res = await fetch(
          `/api/cabinet/threads/${encodeURIComponent(threadId)}/messages${after ? `?after=${encodeURIComponent(after)}` : ''}`,
          { cache: 'no-store' },
        )
        const body = (await res.json().catch(() => null)) as { ok?: boolean; messages?: unknown } | null
        if (!res.ok || !body?.ok) {
          if (first) setStatus('error')
          return
        }
        const rows = parseMessages(body.messages)
        setMessages((m) => (first ? mergeMessages(m.filter((x) => x.id.startsWith('local:')), rows) : mergeMessages(m, rows)))
        setStatus('ready')
        if (rows.some((r) => r.from !== 'client') || (first && unread.current > 0)) void markRead()
      } catch {
        if (first) setStatus('error')
      }
    },
    [threadId, markRead],
  )

  useEffect(() => {
    // A new thread arrives with a new `key`, so the state starts clean; only the loading begins here.
    stick.current = true
    unread.current = thread.unread
    const first = window.setTimeout(() => void load(true), 0)
    const timer = window.setInterval(() => void load(), POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // A new thread restarts everything; the unread count at that moment is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, load])

  // Follow the bottom while the reader is at the bottom or just wrote.
  useEffect(() => {
    const el = box.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [messages, status])

  function onScroll() {
    const el = box.current
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  function grow() {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  function burst() {
    for (const ms of BURST_MS) window.setTimeout(() => void load(), ms)
  }

  async function post(body: string, localId: string) {
    try {
      const res = await fetch(`/api/cabinet/threads/${encodeURIComponent(threadId)}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: body }),
      })
      const data = (await res.json().catch(() => null)) as { ok?: boolean; item?: unknown; reply?: unknown; error?: string } | null
      const item = res.ok && data?.ok ? parseMessageItem({ item: data.item }) : null
      if (item) {
        const reply = data?.reply ? parseMessageItem({ item: data.reply }) : null
        setMessages((m) => mergeMessages(m.filter((x) => x.id !== localId), reply ? [item, reply] : [item]))
        if (agentReply && !reply) burst()
        return true
      }
      setError(errors[data?.error ?? ''] ?? errors.hq ?? '')
    } catch {
      setError(errors.network ?? '')
    }
    setMessages((m) => m.map((x) => (x.id === localId ? { ...x, state: 'failed' as const } : x)))
    return false
  }

  async function upload(f: File) {
    const form = new FormData()
    form.set('file', f, f.name)
    form.set('threadId', threadId)
    try {
      const res = await fetch('/api/cabinet/uploads', { method: 'POST', body: form })
      const data = (await res.json().catch(() => null)) as { ok?: boolean; item?: unknown; error?: string } | null
      const item = res.ok && data?.ok ? parseMessageItem({ item: data.item }) : null
      if (item) {
        setMessages((m) => mergeMessages(m, [item]))
        return true
      }
      setError(errors[data?.error === 'too_large' ? 'size' : data?.error === 'invalid_type' || data?.error === 'unsupported_type' ? 'type' : (data?.error ?? '')] ?? errors.hq ?? '')
    } catch {
      setError(errors.network ?? '')
    }
    return false
  }

  async function submit() {
    const body = cleanMessage(text)
    if ((!body && !file) || sending) return
    setError('')
    setSending(true)
    stick.current = true
    const pending = file
    if (body) {
      const localId = `local:${Date.now()}-${++seq.current}`
      setMessages((m) => [...m, { id: localId, at: new Date().toISOString(), from: 'client', text: body, attachments: [], readAt: null, state: 'sending' }])
      setText('')
      requestAnimationFrame(grow)
      await post(body, localId)
    }
    if (pending) {
      const ok = await upload(pending)
      if (ok) setFile(null)
    }
    setSending(false)
    area.current?.focus()
  }

  async function retry(m: ChatMessage) {
    setError('')
    setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, state: 'sending' as const } : x)))
    await post(m.text, m.id)
  }

  function choose(f: File | undefined) {
    if (!f) return
    const checked = checkUpload(f)
    if (!checked.ok) {
      setError(errors[checked.error] ?? '')
      return
    }
    setError('')
    setFile(f)
  }

  const groups = groupByDay(messages, localDay)
  const today = localDay(new Date().toISOString())
  const before = new Date()
  before.setDate(before.getDate() - 1)
  const yesterday = localDay(before.toISOString())
  const lastOwn = [...messages].reverse().find((m) => m.from === 'client' && !m.state)
  const label = thread.title || t.kind[thread.kind]

  return (
    <div className={cn('flex min-h-0 flex-col', className)} data-thread={thread.id} data-thread-kind={thread.kind}>
      {chrome && (
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
          {onBack && (
            <button type="button" onClick={onBack} aria-label={t.back} className="-ml-1 rounded-full p-1.5 text-muted transition-colors hover:text-fg lg:hidden">
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
          )}
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium">{label}</p>
            <p className="font-mono text-[11px] tracking-[0.08em] text-faint uppercase">{t.kind[thread.kind]}</p>
          </div>
        </div>
      )}

      <div
        ref={box}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-label={t.paneLabel}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
        data-messages
      >
        {status === 'loading' && <p className="py-10 text-center text-sm text-faint">{t.loading}</p>}
        {status === 'error' && <p className="py-10 text-center text-sm text-danger">{errors.hq}</p>}
        {status === 'ready' && messages.length === 0 && <p className="py-10 text-center text-sm text-faint">{t.noMessages}</p>}
        {groups.map((g) => (
          <div key={g.day || 'x'}>
            <p className="my-3 text-center font-mono text-[11px] tracking-[0.08em] text-faint uppercase">
              {g.day === today ? t.today : g.day === yesterday ? t.yesterday : new Date(g.items[0]?.at ?? '').toLocaleDateString(locale === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'long' })}
            </p>
            <ul className="grid gap-2">
              {g.items.map((m) => (
                <Bubble key={m.id} m={m} own={m.from === 'client'} t={t} locale={locale} showRead={m === lastOwn} onRetry={() => void retry(m)} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-line p-3 md:p-4">
        {file && (
          <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-full border border-line-strong py-1 pr-1 pl-3 text-[13px]" data-pending-file>
            <FileText size={16} aria-hidden="true" className="shrink-0 text-faint" />
            <span className="truncate">{file.name}</span>
            <span className="shrink-0 font-mono text-[11px] text-faint">{formatSize(file.size)}</span>
            <button type="button" onClick={() => setFile(null)} aria-label={t.removeFile} className="rounded-full p-1 text-muted hover:text-fg">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={pick}
            type="file"
            accept={uploadAccept}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              choose(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => pick.current?.click()}
            aria-label={t.attach}
            title={t.attach}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-line-strong text-muted transition-colors hover:border-fg/40 hover:text-fg"
          >
            <Paperclip size={20} aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <label htmlFor={`${uid}-text`} className="sr-only">
              {t.composer}
            </label>
            <textarea
              id={`${uid}-text`}
              ref={area}
              rows={1}
              value={text}
              maxLength={MESSAGE_MAX}
              placeholder={t.placeholder}
              aria-describedby={`${uid}-hint`}
              onChange={(e) => {
                setText(e.target.value)
                grow()
              }}
              onKeyDown={(e) => {
                const action = composerKey({ key: e.key, shiftKey: e.shiftKey, isComposing: e.nativeEvent.isComposing, ctrlKey: e.ctrlKey, metaKey: e.metaKey })
                if (action === 'send') {
                  e.preventDefault()
                  void submit()
                }
              }}
              className="ym-disable-keys block max-h-40 min-h-11 w-full resize-none rounded-[22px] border border-line-strong bg-bg px-4 py-2.5 text-base text-fg transition-colors placeholder:text-faint focus:border-accent-text focus:outline-none md:text-[15px]"
              data-composer
            />
          </div>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={sending || (!cleanMessage(text) && !file)}
            aria-label={t.send}
            className={cn(buttonStyles.primary, 'size-11 shrink-0 !p-0')}
            data-send
          >
            <PaperPlaneRight size={20} weight="fill" aria-hidden="true" />
          </button>
        </div>
        <p id={`${uid}-hint`} className="mt-2 hidden px-1 text-[12px] text-faint md:block">
          {t.hint}
        </p>
        {error && (
          <div className="mt-2">
            <FormMessage kind="error">{error}</FormMessage>
          </div>
        )}
      </div>
    </div>
  )
}

function Bubble({
  m,
  own,
  t,
  locale,
  showRead,
  onRetry,
}: {
  m: ChatMessage
  own: boolean
  t: Dict['cabinet']['v3']['messages']
  locale: string
  showRead: boolean
  onRetry: () => void
}) {
  const who = m.from === 'client' ? t.you : m.from === 'agent' ? t.agent : t.firtech
  return (
    <li className={cn('flex flex-col', own ? 'items-end' : 'items-start')} data-message={m.id} data-from={m.from}>
      <div
        className={cn(
          'max-w-[88%] rounded-[18px] px-3.5 py-2.5 text-[15px] leading-snug whitespace-pre-line',
          own ? 'rounded-br-md bg-accent text-accent-ink' : 'rounded-bl-md border border-line bg-surface-2 text-fg',
          m.state === 'sending' && 'opacity-70',
          m.state === 'failed' && 'border border-danger',
        )}
      >
        {!own && <span className="mb-0.5 block text-xs font-medium text-accent-text">{who}</span>}
        {m.text}
        {m.attachments.length > 0 && (
          <ul className={cn('grid gap-1.5', m.text && 'mt-2')}>
            {m.attachments.map((a) => (
              <li key={`${a.href}-${a.name}`}>
                <a
                  {...(a.href ? { href: a.href, target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[13px] break-all',
                    own ? 'border-accent-ink/25 hover:bg-accent-ink/10' : 'border-line-strong hover:bg-fg/5',
                  )}
                >
                  <FileText size={16} aria-hidden="true" className="shrink-0" />
                  <span className="min-w-0">{a.name}</span>
                  {a.size > 0 && <span className="shrink-0 font-mono text-[11px] opacity-70">{formatSize(a.size)}</span>}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-1 flex items-center gap-2 px-1 font-mono text-[11px] text-faint">
        <span>{timeOf(m.at, locale)}</span>
        {m.state === 'failed' && (
          <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 text-danger underline underline-offset-2">
            <WarningCircle size={13} aria-hidden="true" />
            {t.failed}. {t.retry}
          </button>
        )}
        {own && showRead && !m.state && (
          <span className="inline-flex items-center gap-1" data-read-mark={m.readAt ? 'read' : 'delivered'}>
            {m.readAt ? <Checks size={14} aria-hidden="true" className="text-accent-text" /> : <Check size={14} aria-hidden="true" />}
            {m.readAt ? t.read : t.delivered}
          </span>
        )}
      </div>
    </li>
  )
}

