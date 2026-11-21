'use client'

import { PaperPlaneRight } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dict } from '@/content'
import { btnMessage, MESSAGE_MAX, START, type ChatButton, type ChatResponse, type Persona } from '@/lib/chat'
import { cn } from '@/lib/cn'
import { useReducedMotion } from '@/lib/use-reduced-motion'

type Msg = { id: number; from: 'me' | 'agent' | 'sys'; text: string }
type Copy = Dict['demoSection']['receptionist']

const NICHES: readonly Persona[] = ['salon', 'clinic', 'shop']
const MIN_GAP_MS = 1500

function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

// The «ИИ-менеджер заявок» demo tab: the real receptionist behind POST /api/chat, with a niche
// selector. The niche goes along as `persona` (HQ reads it later, see chat.ts); a message that looks
// like a contact is answered by the route and never reaches HQ, so the demo creates no lead. Each
// niche has its own session and its own conversation.
export function DemoChat({ copy, locale }: { copy: Copy; locale: 'ru' | 'en' }) {
  const reduce = useReducedMotion()
  const [niche, setNiche] = useState<Persona>('salon')
  const [threads, setThreads] = useState<Record<string, Msg[]>>({})
  const [buttons, setButtons] = useState<ChatButton[]>([])
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const sessions = useRef<Record<string, { id: string; started: boolean }>>({})
  const last = useRef(0)
  const counter = useRef(0)
  const listRef = useRef<HTMLOListElement>(null)
  const messages = threads[niche] ?? []

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: reduce ? 'auto' : 'smooth' })
  }, [messages.length, pending, reduce])

  const push = useCallback((forNiche: Persona, ...items: Omit<Msg, 'id'>[]) => {
    setThreads((all) => ({
      ...all,
      [forNiche]: [...(all[forNiche] ?? []), ...items.map((m) => ({ ...m, id: ++counter.current }))],
    }))
  }, [])

  const call = useCallback(
    async (forNiche: Persona, message: string): Promise<ChatResponse> => {
      const session = (sessions.current[forNiche] ??= { id: uuid(), started: false })
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sessionId: session.id,
            locale,
            message,
            page: window.location.pathname,
            persona: forNiche,
          }),
        })
        const body = (await res.json()) as ChatResponse
        if (res.status === 429) return { ok: false, error: 'rate_limited' }
        return body
      } catch {
        return { ok: false, error: 'network' }
      }
    },
    [locale],
  )

  const send = useCallback(
    async (message: string, shown: string) => {
      const now = Date.now()
      if (pending || now - last.current < MIN_GAP_MS) return
      last.current = now
      const forNiche = niche
      setButtons([])
      setPending(true)
      push(forNiche, { from: 'me', text: shown })
      const session = (sessions.current[forNiche] ??= { id: uuid(), started: false })
      // HQ's conversation starts with the greeting request; its answer is not shown here.
      if (!session.started) {
        session.started = true
        await call(forNiche, START)
      }
      const answer = await call(forNiche, message)
      setPending(false)
      if (answer.ok) {
        push(forNiche, { from: 'agent', text: answer.reply })
        if (answer.state === 'contact') push(forNiche, { from: 'sys', text: copy.noContacts })
        setButtons(answer.buttons ?? [])
      } else {
        push(forNiche, { from: 'sys', text: answer.error === 'rate_limited' ? copy.rateLimited : copy.error })
      }
    },
    [call, copy, niche, pending, push],
  )

  // «Сбросить демо»: this niche starts over with a new session.
  function reset() {
    if (pending) return
    delete sessions.current[niche]
    setThreads((all) => ({ ...all, [niche]: [] }))
    setButtons([])
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    setText('')
    void send(value, value)
  }

  return (
    <div className="grid gap-5 lg:grid-cols-12 lg:gap-8">
      <div className="lg:col-span-5">
        <p className="max-w-[44ch] text-muted">{copy.intro}</p>
        <fieldset className="mt-6">
          <legend className="text-sm text-faint">{copy.nicheLabel}</legend>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={copy.nicheLabel}>
            {NICHES.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={niche === id}
                onClick={() => {
                  setNiche(id)
                  setButtons([])
                }}
                data-niche={id}
                className={cn(
                  'rounded-full border px-4 py-2 text-sm transition-[border-color,background-color] duration-200',
                  niche === id ? 'border-accent-text bg-accent/10 text-fg' : 'border-line-strong text-muted hover:border-fg/40',
                )}
              >
                {copy.niches[id]}
              </button>
            ))}
          </div>
        </fieldset>
        <p className="mt-6 text-[13px] leading-relaxed text-faint">{copy.note}</p>
      </div>

      <div className="lg:col-span-7">
        <div className="glass flex h-[26rem] flex-col overflow-hidden rounded-panel" data-demo-chat>
          <div className="flex items-center justify-between gap-2 border-b border-glass-line px-4 py-2.5">
            <span
              data-chat-demo
              className="inline-flex items-center rounded-full border border-accent-text/40 bg-accent/10 px-3 py-1 text-xs text-fg"
            >
              {copy.chips[niche]}
            </span>
            <button
              type="button"
              onClick={reset}
              disabled={pending || messages.length === 0}
              className="text-xs text-muted underline-offset-4 transition-colors hover:text-fg hover:underline disabled:opacity-40"
            >
              {copy.reset}
            </button>
          </div>
          <ol ref={listRef} aria-live="polite" className="grid flex-1 content-start gap-2.5 overflow-y-auto p-4">
            {messages.length === 0 && (
              <li className="text-sm text-faint">{copy.empty}</li>
            )}
            {messages.map((m) => (
              <li
                key={m.id}
                className={cn(
                  'chat-in max-w-[88%] rounded-[18px] px-4 py-2.5 text-[15px] leading-snug',
                  m.from === 'me' && 'ml-auto rounded-br-md bg-accent text-accent-ink',
                  m.from === 'agent' && 'rounded-bl-md bg-surface-2',
                  m.from === 'sys' && 'max-w-full border border-line text-sm text-muted',
                )}
              >
                {m.text}
              </li>
            ))}
            {pending && (
              <li className="flex" aria-label={copy.typing}>
                <span className="inline-flex items-center gap-1 rounded-[18px] rounded-bl-md bg-surface-2 px-4 py-3.5">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </span>
              </li>
            )}
          </ol>
          <div className="flex flex-wrap gap-2 px-4 pb-2">
            {(buttons.length ? buttons.map((b) => ({ key: b.id, label: b.label, message: btnMessage(b.id) })) : copy.hints[niche].map((h) => ({ key: h, label: h, message: h }))).map((chip) => (
              <button
                key={chip.key}
                type="button"
                disabled={pending}
                onClick={() => void send(chip.message, chip.label)}
                className="rounded-full border border-accent-text/40 px-3 py-1.5 text-[13px] transition-[background-color,border-color] duration-200 hover:border-accent-text hover:bg-accent/10 disabled:opacity-40"
              >
                {chip.label}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="border-t border-glass-line p-3">
            <div className="flex items-end gap-2 rounded-[22px] border border-line-strong bg-bg/60 p-1.5 pl-4 focus-within:border-accent-text/60">
              <label htmlFor="demo-chat-input" className="sr-only">
                {copy.placeholder}
              </label>
              <input
                id="demo-chat-input"
                value={text}
                maxLength={MESSAGE_MAX}
                placeholder={copy.placeholder}
                onChange={(e) => setText(e.target.value)}
                className="ym-disable-keys min-h-10 flex-1 bg-transparent text-[15px] text-fg placeholder:text-faint focus:outline-none"
              />
              <button
                type="submit"
                disabled={pending || !text.trim()}
                aria-label={copy.send}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition-opacity disabled:opacity-40"
              >
                <PaperPlaneRight size={18} weight="fill" aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
