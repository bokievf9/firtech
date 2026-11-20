'use client'

import { PaperPlaneRight, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { track } from '@/lib/analytics'
import {
  btnMessage,
  MESSAGE_MAX,
  START,
  type ChatButton,
  type ChatResponse,
  type ChatState,
} from '@/lib/chat'
import type { Dict } from '@/content'
import { demoChatMessage, demoPlace } from '@/lib/demo'
import type { Locale } from '@/lib/i18n'
import { draftReturnPath } from '@/lib/lead-draft'
import { AuthForms } from '../cabinet/auth-forms'
import { fill } from '../cabinet/ui'
import { useCabinetUser } from '../cabinet/use-cabinet-user'
import { storedRef } from '@/lib/referral'
import { useReducedMotion } from '@/lib/use-reduced-motion'

type Message = {
  id: string
  from: 'bot' | 'me' | 'sys' | 'owner'
  text: string
  buttons?: ChatButton[]
  link?: boolean
  // «Открыть кабинет» under the message (a lead was created).
  cabinet?: boolean
}
// `needAuth`: the site refused to pass a contact on while signed out (owner 2026-11-20).
type Saved = { sessionId: string; messages: Message[]; state: ChatState; mock: boolean; needAuth?: boolean }

const STORE_KEY = 'firtech-chat-v1'
// Client-side pace: one message per 2 s (the route also limits each IP to 30 an hour).
const MIN_GAP_MS = 2000

function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // Older Safari on plain http (dev over LAN): build a v4 uuid by hand.
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function load(): Saved | null {
  try {
    const raw = sessionStorage.getItem(STORE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Saved
    return typeof v.sessionId === 'string' && Array.isArray(v.messages) ? v : null
  } catch {
    return null
  }
}

function save(v: Saved) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify({ ...v, messages: v.messages.slice(-60) }))
  } catch {
    // Private mode or full storage: the chat still works for this page view.
  }
}

// The demo link HQ puts into its answer to «demo» becomes a real link (only @firtech_bot links).
const BOT_LINK = /(https:\/\/t\.me\/firtech_bot[^\s]*)/g
function withLinks(text: string): React.ReactNode {
  const parts = text.split(BOT_LINK)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={part.replace(/[.,)]+$/, '')}
        data-place={`chat_${demoPlace}`}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-accent-text underline underline-offset-2"
      >
        {part}
      </a>
    ) : (
      part
    ),
  )
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function ChatPanel({
  open,
  onClose,
  locale,
  dict,
  contactHref,
}: {
  open: boolean
  onClose: () => void
  locale: Locale
  dict: Dict
  contactHref: string
}) {
  const copy = dict.chat
  const { state: me, refresh } = useCabinetUser()
  const reduce = useReducedMotion()
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const lastSent = useRef(0)
  const busy = useRef(false)
  const [chat, setChat] = useState<Saved>(
    () => load() ?? { sessionId: uuid(), messages: [], state: 'chat', mock: false },
  )
  const [pending, setPending] = useState(false)
  const [text, setText] = useState('')
  const [hint, setHint] = useState('')
  const chatRef = useRef(chat)

  useEffect(() => {
    chatRef.current = chat
    save(chat)
  }, [chat])

  const send = useCallback(
    async (message: string, shown: string | null) => {
      // The pace applies to the visitor's own messages; the greeting request does not count.
      if (shown !== null) {
        const now = Date.now()
        if (busy.current || now - lastSent.current < MIN_GAP_MS) {
          setHint(copy.tooFast)
          return false
        }
        lastSent.current = now
      }
      busy.current = true
      setHint('')
      setPending(true)
      if (shown) {
        setChat((c) => ({
          ...c,
          messages: [...c.messages, { id: uuid(), from: 'me', text: shown }],
        }))
      }
      let mock = chatRef.current.mock
      let answer: ChatResponse
      let status = 0
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sessionId: chatRef.current.sessionId,
            locale,
            message,
            page: window.location.pathname,
            ...(storedRef() ? { ref: storedRef() } : {}),
          }),
        })
        status = res.status
        mock = res.headers.get('x-chat-mode') === 'mock'
        answer = (await res.json()) as ChatResponse
      } catch {
        answer = { ok: false, error: 'network' }
      }
      busy.current = false
      setPending(false)
      setChat((c) => {
        if (answer.ok) {
          return {
            ...c,
            mock,
            state: answer.state,
            needAuth: answer.authRequired === true,
            messages: [
              ...c.messages,
              ...(answer.ownerReplies ?? []).map((text): Message => ({ id: uuid(), from: 'owner', text })),
              { id: uuid(), from: 'bot', text: answer.reply, buttons: answer.buttons },
              ...(answer.leadCreated ? [{ id: uuid(), from: 'sys' as const, text: copy.leadInCabinet, cabinet: true }] : []),
            ],
          }
        }
        const limited = status === 429 || answer.error === 'rate_limited'
        return {
          ...c,
          messages: [
            ...c.messages,
            { id: uuid(), from: 'sys', text: limited ? copy.rateLimited : copy.error, link: true },
          ],
        }
      })
      if (answer.ok && answer.state !== chatRef.current.state)
        track('chat_state', { state: answer.state })
      return true
    },
    [copy.error, copy.leadInCabinet, copy.rateLimited, copy.tooFast, locale],
  )

  // The greeting: the first open of a session asks HQ (or the mock) to start.
  const started = useRef(false)
  useEffect(() => {
    if (!open || started.current || chatRef.current.messages.length) return
    started.current = true
    void send(START, null)
  }, [open, send])

  // Focus the input on open; Esc closes; Tab stays inside the dialog.
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 60)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const items = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      )
      if (!items.length) return
      const first = items[0]!
      const last = items[items.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: reduce ? 'auto' : 'smooth' })
  }, [chat.messages.length, pending, reduce])

  // Enter (or the button) while the greeting or a reply is still coming used to do nothing and keep
  // the text; now the message waits and goes out as soon as the chat is free.
  const [queued, setQueued] = useState(false)
  const sendTyped = async () => {
    const value = text.trim().slice(0, MESSAGE_MAX)
    if (!value) return
    if (await send(value, value)) setText('')
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    if (pending) {
      setQueued(true)
      return
    }
    await sendTyped()
  }
  useEffect(() => {
    if (!queued || pending) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot release of the queued message
    setQueued(false)
    void sendTyped()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queued, pending])

  const lastBot = [...chat.messages].reverse().find((m) => m.from !== 'me')
  const chips = !pending && lastBot?.from === 'bot' ? (lastBot.buttons ?? []) : []
  // HQ asks for a contact (or the site refused one): a signed-out visitor signs in right here, a
  // signed-in one sends the request with the account email in one tap.
  const wantsContact = !pending && (chat.state === 'contact' || chat.needAuth === true)
  const askSignIn = wantsContact && me.status === 'out'
  const sendAs = wantsContact && me.status === 'in' ? me.user.email : null

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="chat"
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34, mass: 0.8 }}
          style={{ transformOrigin: '100% 100%' }}
          className="print-hidden glass bg-glass-strong fixed inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] bottom-2 z-50 flex flex-col overflow-hidden rounded-panel sm:inset-x-auto sm:top-auto sm:right-6 sm:bottom-6 sm:h-[min(600px,calc(100dvh-3rem))] sm:w-[400px]"
        >
          <header className="flex items-center gap-3 px-5 pt-4 pb-3">
            <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-pine font-display text-sm font-bold text-accent-text">
              AI
              <span
                className="live-dot absolute -right-0.5 -bottom-0.5 border-2 border-bg"
                aria-hidden="true"
              />
            </span>
            <div className="min-w-0 flex-1">
              <h2
                id={titleId}
                className="truncate font-display text-base font-semibold tracking-tight"
              >
                {copy.title}
              </h2>
              <p className="truncate text-xs text-muted">
                {chat.mock ? copy.mockNote : copy.subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={copy.close}
              className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-fg/5 hover:text-fg"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <div className="hairline" />

          <ol
            ref={listRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
          >
            {chat.messages.map((m) => (
              <li
                key={m.id}
                className={`chat-in flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}
                style={
                  {
                    '--chat-origin': m.from === 'me' ? '100% 100%' : '0 100%',
                  } as React.CSSProperties
                }
              >
                <div
                  className={
                    m.from === 'me'
                      ? 'max-w-[85%] rounded-[18px] rounded-br-md bg-accent px-3.5 py-2.5 text-[15px] leading-snug text-accent-ink'
                      : m.cabinet
                        ? 'max-w-[90%] rounded-[18px] border border-accent-text/40 bg-accent/[0.06] px-3.5 py-2.5 text-sm leading-snug text-fg'
                      : m.from === 'sys'
                        ? 'max-w-[90%] rounded-[18px] border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm leading-snug text-fg'
                        : m.from === 'owner'
                          ? 'max-w-[85%] rounded-[18px] rounded-bl-md border border-accent-text/40 bg-surface-2 px-3.5 py-2.5 text-[15px] leading-snug whitespace-pre-line text-fg'
                        : 'max-w-[85%] rounded-[18px] rounded-bl-md bg-surface-2 px-3.5 py-2.5 text-[15px] leading-snug whitespace-pre-line text-fg'
                  }
                >
                  {m.from === 'owner' ? (
                    <span className="mb-1 block text-xs font-medium text-accent-text">{copy.owner}</span>
                  ) : (
                    <span className="sr-only">{m.from === 'me' ? copy.you : copy.bot}: </span>
                  )}
                  {m.from === 'bot' || m.from === 'owner' ? withLinks(m.text) : m.text}
                  {m.cabinet ? (
                    <a
                      href={`/${locale}/cabinet?lead=new`}
                      className="mt-2 block font-medium text-accent-text underline-offset-4 hover:underline"
                    >
                      {copy.toCabinet}
                    </a>
                  ) : null}
                  {m.link ? (
                    <a
                      href={contactHref}
                      onClick={onClose}
                      className="mt-2 block font-medium text-accent-text underline-offset-4 hover:underline"
                    >
                      {copy.contact}
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
            {pending ? (
              <li className="chat-in flex justify-start" aria-label={copy.typing}>
                <span className="inline-flex items-center gap-1 rounded-[18px] rounded-bl-md bg-surface-2 px-4 py-3.5">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </span>
              </li>
            ) : null}
            {sendAs ? (
              <li className="chat-in flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void send(sendAs, sendAs)}
                  className="rounded-full border border-accent-text bg-accent/10 px-3.5 py-2 text-sm text-fg transition-[background-color,transform] duration-200 hover:bg-accent/20 active:scale-[0.97]"
                >
                  {fill(copy.sendAs, { email: sendAs })}
                </button>
              </li>
            ) : null}
            {askSignIn ? (
              <li className="chat-in" data-chat-auth>
                <AuthForms
                  compact
                  dict={dict}
                  locale={locale}
                  startMode="up"
                  callbackError={null}
                  next={draftReturnPath(window.location.pathname, window.location.search, '#chat')}
                  onSignedIn={() => void refresh()}
                />
              </li>
            ) : null}
            {chips.length ? (
              <li className="chat-in flex flex-wrap gap-2 pt-1">
                {chips.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => void send(btnMessage(b.id), b.label)}
                    className="rounded-full border border-accent-text/40 px-3.5 py-2 text-sm text-fg transition-[background-color,border-color,transform] duration-200 hover:border-accent-text hover:bg-accent/10 active:scale-[0.97]"
                  >
                    {b.label}
                  </button>
                ))}
              </li>
            ) : null}
          </ol>

          <form onSubmit={submit} className="border-t border-glass-line p-3">
            {hint ? (
              <p role="status" className="px-2 pb-2 text-xs text-faint">
                {hint}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 px-1 pb-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => void send(demoChatMessage, copy.demoChip)}
                className="rounded-full border border-accent-text/40 px-3 py-1 text-[13px] text-fg transition-[background-color,border-color,transform] duration-200 hover:border-accent-text hover:bg-accent/10 active:scale-[0.97] disabled:opacity-40"
              >
                {copy.demoChip}
              </button>
            </div>
            <div className="flex items-end gap-2 rounded-[22px] border border-line-strong bg-bg/60 p-1.5 pl-4 focus-within:border-accent-text/60">
              <label htmlFor={`${titleId}-input`} className="sr-only">
                {copy.input}
              </label>
              <textarea
                id={`${titleId}-input`}
                ref={inputRef}
                rows={1}
                value={text}
                maxLength={MESSAGE_MAX}
                placeholder={copy.placeholder}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    e.currentTarget.form?.requestSubmit()
                  }
                }}
                className="ym-disable-keys max-h-28 min-h-10 flex-1 resize-none bg-transparent py-2 text-[15px] text-fg placeholder:text-faint focus:outline-none"
              />
              <button
                type="submit"
                disabled={!text.trim() || queued}
                aria-label={copy.send}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition-[background-color,transform,opacity] duration-200 hover:bg-accent-strong active:scale-[0.94] disabled:opacity-40"
              >
                <PaperPlaneRight size={18} weight="fill" aria-hidden="true" />
              </button>
            </div>
          </form>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
