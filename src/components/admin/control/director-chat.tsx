'use client'

import { PaperPlaneRight, Robot, Trash } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { keepLast, parseCommand, plainBotText, readChat, type ChatMessage, type Id } from '@/lib/hq-admin-view'
import { errText, fill, hq, storedValue } from './api'
import { CcPanel } from './cc-panel'

const t = admin.cc.director
const QUICK = ['status', 'tasks', 'approve', 'costs', 'builders'] as const

// The last 50 messages of this tab (sessionStorage), shared through useSyncExternalStore so the
// server render and the first client render agree (both empty) and the kept chat appears after.
const chat = storedValue<ChatMessage[]>('firtech-cc-chat', 'session', readChat, [])
let seq = 0
const newId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`
const push = (...messages: Omit<ChatMessage, 'id' | 'at'>[]) =>
  chat.set(keepLast([...chat.get(), ...messages.map((m) => ({ ...m, id: newId(), at: new Date().toISOString() }))]))

export function DirectorChat({
  className,
  onOpenTask,
  onSent,
}: {
  className?: string
  onOpenTask: (id: Id) => void
  // Something changed in HQ (a task was given, a command ran): the page refreshes its panels.
  onSent: () => void
}) {
  const messages = useSyncExternalStore(chat.subscribe, chat.get, chat.server)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, busy])

  async function send(raw: string) {
    const value = raw.trim()
    if (!value || busy) return
    setText('')
    setBusy(true)
    push({ role: 'me', text: value })
    const cmd = parseCommand(value)
    const res = cmd
      ? await hq<{ replies: string[] }>('command', { name: cmd.name, arg: cmd.arg || undefined })
      : await hq<{ replies: string[]; taskId?: Id }>('say', { text: value })
    setBusy(false)
    if (!res.ok) {
      push({ role: 'error', text: errText(res.error) })
    } else {
      const replies = Array.isArray(res.replies) ? res.replies.map(String) : []
      const taskId = 'taskId' in res && res.taskId !== undefined && res.taskId !== null ? (res.taskId as Id) : null
      if (!replies.length && taskId === null) push({ role: 'director', text: '…' })
      replies.forEach((r, i) =>
        push({ role: 'director', text: plainBotText(r), taskId: i === replies.length - 1 ? taskId : null }),
      )
      if (!replies.length && taskId !== null) push({ role: 'director', text: '', taskId })
      onSent()
    }
    input.current?.focus()
  }

  return (
    <CcPanel
      id="director"
      title={t.title}
      icon={<Robot size={18} aria-hidden="true" />}
      className={className}
      aside={
        messages.length ? (
          <button
            type="button"
            onClick={() => chat.set([])}
            aria-label={t.clear}
            title={t.clear}
            className="grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <Trash size={16} aria-hidden="true" />
          </button>
        ) : null
      }
    >
      <div className="flex h-[min(70dvh,32rem)] min-h-0 flex-col lg:h-[30rem]">
        <div
          ref={scroller}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3"
        >
          {!messages.length ? <p className="py-6 text-center text-sm text-muted">{t.empty}</p> : null}
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.li
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className={cn('flex flex-col', m.role === 'me' ? 'items-end' : 'items-start')}
                >
                  <span className="sr-only">{m.role === 'me' ? t.you : t.me}: </span>
                  {m.text ? (
                    <p
                      className={cn(
                        'max-w-[88%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words',
                        m.role === 'me' && 'rounded-br-md bg-fg text-bg',
                        m.role === 'director' && 'rounded-bl-md bg-surface-2',
                        m.role === 'error' && 'rounded-bl-md border border-danger/40 text-danger',
                      )}
                    >
                      {m.text}
                    </p>
                  ) : null}
                  {m.taskId !== null && m.taskId !== undefined ? (
                    <button
                      type="button"
                      onClick={() => onOpenTask(m.taskId as Id)}
                      className="mt-1.5 inline-flex min-h-8 items-center gap-1.5 rounded-full border border-accent/60 px-3 text-xs text-accent-text transition-colors hover:bg-surface-2"
                    >
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
                      {fill(t.task, { id: m.taskId })}
                    </button>
                  ) : null}
                </motion.li>
              ))}
            </AnimatePresence>
            {busy ? (
              <li className="flex items-center gap-2 text-xs text-muted" role="status">
                <span className="flex gap-1" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="office-breathe size-1.5 rounded-full bg-muted" style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </span>
                {t.thinking}
              </li>
            ) : null}
          </ul>
        </div>

        <div className="border-t border-line p-3">
          <div role="group" aria-label={t.commands} className="mb-2 flex gap-1.5 overflow-x-auto">
            {QUICK.map((name) => (
              <button
                key={name}
                type="button"
                disabled={busy}
                onClick={() => send(`/${name}`)}
                className="inline-flex min-h-8 shrink-0 items-center rounded-full border border-line px-3 font-mono text-xs text-muted transition-colors hover:border-line-strong hover:text-fg disabled:opacity-50"
              >
                /{name}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void send(text)
            }}
            className="flex items-end gap-2"
          >
            <label htmlFor="cc-director-input" className="sr-only">
              {t.placeholder}
            </label>
            <textarea
              id="cc-director-input"
              ref={input}
              value={text}
              rows={1}
              maxLength={4000}
              placeholder={t.placeholder}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  void send(text)
                }
              }}
              className="ym-disable-keys max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line-strong bg-bg px-3.5 py-2.5 text-sm outline-none [field-sizing:content] focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy || !text.trim()}
              aria-label={t.send}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition-opacity disabled:opacity-40"
            >
              <PaperPlaneRight size={18} weight="fill" aria-hidden="true" />
            </button>
          </form>
          <p className="mt-1.5 hidden text-[11px] text-faint sm:block">{t.hint}</p>
        </div>
      </div>
    </CcPanel>
  )
}
