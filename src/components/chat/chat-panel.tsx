'use client'

import { ArrowClockwise, ArrowRight, ArrowsIn, ArrowsOut, CalendarBlank, Hammer, PaperPlaneRight, X } from '@phosphor-icons/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  type Persona,
} from '@/lib/chat'
import type { Dict } from '@/content'
import type { Locale } from '@/lib/i18n'
import { ctaActions, slotMessage, type ChatAction } from '@/lib/chat-cta'
import { telegramUrl } from '@/lib/site'
import { codeFromBody, describeError, errorLine, FETCH_TIMEOUT_MS, type ErrorInfo } from '@/lib/errors'
import { draftReturnPath } from '@/lib/lead-draft'
import { AuthForms } from '../cabinet/auth-forms'
import { fill } from '../cabinet/ui'
import { useCabinetUser } from '../cabinet/use-cabinet-user'
import { FiraStage } from '../fira/fira-stage'
import { useFiraLive, useFiraStore } from '../fira/fira-live-store'
import { cardsFor, pageSlug, parseSse, suggestGroupFor, type FiraCard } from '@/lib/fira/live'
import { splitWords, wordsShown } from '@/lib/fira/guide'
import { ChatSlots } from './chat-slots'
import { storedRef } from '@/lib/referral'
import { fade, spring } from '@/lib/motion'
import { useReducedMotion } from '@/lib/use-reduced-motion'

type Message = {
  id: string
  from: 'bot' | 'me' | 'sys' | 'owner'
  text: string
  buttons?: ChatButton[]
  link?: boolean
  // «Открыть кабинет» under the message (a lead was created).
  cabinet?: boolean
  // «Собрать проект» / «Предложить время» / Telegram under a receptionist reply.
  actions?: ChatAction[]
  // Link cards under the reply (page, builder, agent, article).
  cards?: FiraCard[]
  // The founder took over: a calm line under the reply.
  handoff?: boolean
  // The visitor's message that did not reach the receptionist: «Повторить» sends it again.
  failed?: { payload: string }
}
// `needAuth`: the site refused to pass a contact on while signed out (owner 2026-11-20).
type Saved = {
  sessionId: string
  messages: Message[]
  state: ChatState
  mock: boolean
  needAuth?: boolean
  // HQ marked the session as a demo (a fictional business, no lead).
  demo?: boolean
}

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

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function ChatPanel({
  open,
  onClose,
  locale,
  dict,
  contactHref,
  persona,
}: {
  open: boolean
  onClose: () => void
  locale: Locale
  dict: Dict
  contactHref: string
  // Set when the chat is opened as a demo of a niche (salon, clinic, shop).
  persona?: Persona
}) {
  const copy = dict.chat
  const { state: me, refresh } = useCabinetUser()
  const reduce = useReducedMotion()
  const store = useFiraStore()
  const live = useFiraLive()
  const pathname = usePathname()
  const [wide, setWide] = useState(false)
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
  const [callFor, setCallFor] = useState<string | null>(null)
  const chatRef = useRef(chat)

  useEffect(() => {
    chatRef.current = chat
    save(chat)
  }, [chat])

  const send = useCallback(
    async (message: string, shown: string | null, retryId?: string) => {
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
      const myId = uuid()
      if (shown) {
        setChat((c) => ({
          ...c,
          messages: [
            ...c.messages.filter((m) => m.id !== retryId),
            { id: myId, from: 'me', text: shown },
          ],
        }))
      }
      let mock = chatRef.current.mock
      let answer: ChatResponse
      let cards: FiraCard[] = []
      let status = 0
      let failure: ErrorInfo | null = null
      // Fira: thinking (three dots) from the send until the first word; the greeting is committed at once.
      if (shown !== null) store.dots(true)
      try {
        const res = await fetch(shown !== null ? '/api/chat?stream=1' : '/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sessionId: chatRef.current.sessionId,
            locale,
            message,
            page: window.location.pathname,
            ...(storedRef() ? { ref: storedRef() } : {}),
            ...(persona ? { persona } : {}),
          }),
          // 20 s: a silent server becomes a clear «не ответил» line with a retry.
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        })
        status = res.status
        mock = res.headers.get('x-chat-mode') === 'mock'
        if (res.ok && res.body && (res.headers.get('content-type') ?? '').includes('text/event-stream')) {
          // The stream: words feed Fira's bubble as they arrive; the final event carries cards and the rest of the reply.
          let got = ''
          let finish: { cards: FiraCard[]; meta?: Record<string, unknown> } | null = null
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          async function* chunks(): AsyncGenerator<string> {
            let buf = ''
            for (;;) {
              const { done, value } = await reader.read()
              if (done) break
              buf += decoder.decode(value, { stream: true })
              const parsed = parseSse(buf)
              buf = parsed.rest
              for (const ev of parsed.events) {
                if ('t' in ev) {
                  got += ev.t
                  yield ev.t
                } else finish = { cards: ev.cards, meta: ev.meta }
              }
            }
          }
          await store.say('', { stream: chunks() })
          const end = finish as { cards: FiraCard[]; meta?: Record<string, unknown> } | null
          if (end && got) {
            answer = { ...(end.meta ?? {}), ok: true, reply: got } as ChatResponse
            cards = end.cards
          } else {
            answer = { ok: false, error: 'bad_response' }
            failure = describeError({ code: 'bad_response', status: res.status, locale })
          }
        } else {
          const body: unknown = await res.json().catch(() => null)
          answer = (body ?? { ok: false, error: 'bad_response' }) as ChatResponse
          if (!answer.ok || !res.ok) {
            answer = { ok: false, error: codeFromBody(body) ?? 'unknown' }
            failure = describeError({ code: codeFromBody(body), status: res.status, locale })
          } else if (shown !== null) {
            // An old or plain JSON answer: the same line, word by word (FiraTyped timing).
              await store.say(answer.reply)
            cards = cardsFor(answer, locale, window.location.pathname)
          }
        }
      } catch (thrown) {
        answer = { ok: false, error: 'network' }
        failure = describeError({ thrown, locale })
      }
      if (!answer.ok) {
        if (shown !== null) store.fail()
      } else if (cards.length) store.point('chat-card')
      busy.current = false
      setPending(false)
      setChat((c) => {
        if (answer.ok) {
          const actions = ctaActions(answer, telegramUrl)
          return {
            ...c,
            mock,
            state: answer.state,
            needAuth: answer.authRequired === true,
            demo: answer.demo === true || persona !== undefined,
            messages: [
              ...c.messages,
              ...(answer.ownerReplies ?? []).map((text): Message => ({ id: uuid(), from: 'owner', text })),
              {
                id: uuid(),
                from: 'bot',
                text: answer.reply,
                buttons: answer.buttons,
                ...(actions.length ? { actions } : {}),
                ...(cards.length ? { cards } : {}),
                ...(answer.handoff ? { handoff: true } : {}),
              },
              ...(answer.leadCreated ? [{ id: uuid(), from: 'sys' as const, text: copy.leadInCabinet, cabinet: true }] : []),
            ],
          }
        }
        const info = failure ?? describeError({ code: answer.ok ? undefined : answer.error, status, locale })
        // The greeting never reached the visitor: the dictionary line stands in for it.
        if (shown === null && c.messages.length === 0) {
          return { ...c, messages: [{ id: uuid(), from: 'bot', text: copy.greeting }] }
        }
        return {
          ...c,
          messages: [
            // The visitor's bubble stays and offers a retry instead of vanishing.
            ...c.messages.map((m) => (m.id === myId && shown ? { ...m, failed: { payload: message } } : m)),
            // The reason in plain words (no connection, no answer in 20 s, too many requests...);
            // the support code is in it for failures we have no text for.
            { id: uuid(), from: 'sys', text: errorLine(info), link: true },
          ],
        }
      })
      if (answer.ok && answer.state !== chatRef.current.state)
        track('chat_state', { state: answer.state })
      return true
    },
    [copy.greeting, copy.leadInCabinet, copy.tooFast, locale, persona, store],
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
  }, [chat.messages.length, pending, reduce, live.bubble?.wordsShown])

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

  const retry = (m: Message) => {
    if (!m.failed || busy.current) return
    lastSent.current = 0
    // The error line that followed the failed bubble goes away with it.
    setChat((c) => ({ ...c, messages: c.messages.filter((x) => !(x.from === 'sys' && x.link)) }))
    void send(m.failed.payload, m.text, m.id)
  }
  // «Сбросить демо»: a fresh session and a fresh greeting.
  const resetDemo = () => {
    if (busy.current) return
    const next: Saved = { sessionId: uuid(), messages: [], state: 'chat', mock: chatRef.current.mock, demo: true }
    chatRef.current = next
    setChat(next)
    setCallFor(null)
    void send(START, null)
  }
  const pickSlot = (label: string) => {
    setCallFor(null)
    lastSent.current = 0
    const message = slotMessage(copy.slots.message, label)
    void send(message, message)
  }

  const lastBot = [...chat.messages].reverse().find((m) => m.from !== 'me')
  const chips = !pending && lastBot?.from === 'bot' ? (lastBot.buttons ?? []) : []
  // HQ asks for a contact (or the site refused one): a signed-out visitor signs in right here, a
  // signed-in one sends the request with the account email in one tap.
  // A demo never shows the sign-in gate: it takes no contacts and creates no lead.
  const suggestions =
    !pending && !chat.demo && chat.state === 'chat' && chips.length === 0 && !chat.messages.some((m) => m.from === 'me')
      ? (copy.suggest[suggestGroupFor(pageSlug(pathname))] as readonly string[])
      : []
  const wantsContact = !pending && !chat.demo && (chat.state === 'contact' || chat.needAuth === true)
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
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96, filter: 'blur(6px)' }}
          transition={reduce ? fade : spring.sheet}
          style={{ transformOrigin: '100% 100%' }}
          className={`print-hidden material-chrome fixed inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] bottom-2 z-50 flex flex-col overflow-hidden rounded-panel sm:inset-x-auto sm:top-auto sm:right-6 sm:bottom-6 ${wide ? 'sm:h-[min(780px,calc(100dvh-3rem))] sm:w-[min(680px,calc(100vw-3rem))]' : 'sm:h-[min(600px,calc(100dvh-3rem))] sm:w-[400px]'}`}
          data-chat-size={wide ? 'wide' : 'normal'}
          data-fira-page={pageSlug(pathname)}
        >
          <header className="flex items-center gap-3 px-5 pt-4 pb-3">
            <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-pine" data-chat-stage>
              <FiraStage size={40} />
              <span
                className="live-dot absolute -right-0.5 -bottom-0.5 border-2 border-bg"
                aria-hidden="true"
              />
            </span>
            <div className="min-w-0 flex-1">
              <h2
                id={titleId}
                className="font-display text-[15px] leading-tight font-semibold tracking-tight sm:text-base"
              >
                {copy.title}
              </h2>
              <p className="truncate text-xs text-muted">
                {me.status === 'in'
                  ? fill(copy.signedInAs, { name: me.user.name || me.user.email })
                  : chat.mock
                    ? copy.mockNote
                    : copy.subtitle}
              </p>
            </div>
            <Link
              href={contactHref}
              onClick={onClose}
              data-chat-build
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 text-[13px] font-medium text-accent-ink transition-[background-color,transform] duration-200 hover:bg-accent-strong active:scale-[0.97]"
            >
              <Hammer size={14} weight="bold" aria-hidden="true" />
              <span className="max-sm:sr-only">{copy.buildProject}</span>
            </Link>
            <button
              type="button"
              onClick={() => setWide((w) => !w)}
              aria-label={wide ? copy.shrink : copy.expand}
              aria-pressed={wide}
              data-chat-expand
              className="hidden size-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-fg/5 hover:text-fg sm:grid"
            >
              {wide ? <ArrowsIn size={18} aria-hidden="true" /> : <ArrowsOut size={18} aria-hidden="true" />}
            </button>
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
          {chat.demo ? (
            <div className="flex items-center justify-between gap-2 px-5 pt-3">
              <span
                data-chat-demo
                className="inline-flex items-center rounded-full border border-accent-text/40 bg-accent/10 px-3 py-1 text-xs text-fg"
              >
                {copy.demoChip[persona && persona !== 'personal' ? persona : 'salon']}
              </span>
              <button
                type="button"
                onClick={resetDemo}
                className="inline-flex items-center gap-1 text-xs text-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
              >
                <ArrowClockwise size={12} aria-hidden="true" />
                {copy.demoReset}
              </button>
            </div>
          ) : null}

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
                      ? 'max-w-[85%] rounded-[18px] rounded-br-md bg-accent px-3.5 py-2.5 text-[15px] leading-snug [overflow-wrap:anywhere] text-accent-ink'
                      : m.cabinet
                        ? 'max-w-[90%] rounded-[18px] border border-accent-text/40 bg-accent/[0.06] px-3.5 py-2.5 text-sm leading-snug text-fg'
                      : m.from === 'sys'
                        ? 'max-w-[90%] rounded-[18px] border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm leading-snug text-fg'
                        : m.from === 'owner'
                          ? 'max-w-[85%] rounded-[18px] rounded-bl-md border border-accent-text/40 bg-surface-2 px-3.5 py-2.5 text-[15px] leading-snug [overflow-wrap:anywhere] whitespace-pre-line text-fg'
                        : 'max-w-[85%] rounded-[18px] rounded-bl-md bg-surface-2 px-3.5 py-2.5 text-[15px] leading-snug [overflow-wrap:anywhere] whitespace-pre-line text-fg'
                  }
                >
                  {m.from === 'owner' ? (
                    <span className="mb-1 block text-xs font-medium text-accent-text">{copy.owner}</span>
                  ) : (
                    <span className="sr-only">{m.from === 'me' ? copy.you : copy.bot}: </span>
                  )}
                  {m.text}
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
                  {m.handoff ? (
                    <span data-chat-handoff className="mt-2 block text-[13px] text-muted">
                      {copy.handoff}
                    </span>
                  ) : null}
                  {m.actions?.length ? (
                    <span className="mt-3 flex flex-wrap items-center gap-2">
                      {m.actions.map((a) =>
                        a.kind === 'builder' ? (
                          <a
                            key="builder"
                            href={a.href}
                            data-chat-cta="builder"
                            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-[background-color,transform] duration-200 hover:bg-accent-strong active:scale-[0.97]"
                          >
                            {copy.buildProject}
                            <ArrowRight size={14} weight="bold" aria-hidden="true" />
                          </a>
                        ) : a.kind === 'call' ? (
                          <button
                            key="call"
                            type="button"
                            data-chat-cta="call"
                            aria-expanded={callFor === m.id}
                            onClick={() => setCallFor((v) => (v === m.id ? null : m.id))}
                            className="inline-flex items-center gap-1.5 rounded-full border border-accent-text/50 px-3.5 py-2 text-sm text-fg transition-[background-color,border-color,transform] duration-200 hover:border-accent-text hover:bg-accent/10 active:scale-[0.97]"
                          >
                            <CalendarBlank size={15} aria-hidden="true" />
                            {copy.offerCall}
                          </button>
                        ) : (
                          <a
                            key="telegram"
                            href={a.href}
                            data-chat-cta="telegram"
                            className="text-[13px] text-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
                          >
                            {copy.telegramLast}
                          </a>
                        ),
                      )}
                    </span>
                  ) : null}
                  {m.cards?.length ? (
                    <span className="mt-3 grid gap-2" data-chat-cards>
                      {m.cards.map((c) => (
                        <Link
                          key={c.href}
                          href={c.href}
                          onClick={onClose}
                          data-chat-card={c.kind}
                          className="group flex items-center gap-2 rounded-2xl border border-accent-text/40 bg-bg/50 px-3 py-2 text-sm text-fg transition-[background-color,border-color,transform] duration-200 hover:border-accent-text hover:bg-accent/10 active:scale-[0.98]"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-caption font-semibold text-accent-text">{copy.cardKinds[c.kind]}</span>
                            <span className="block [overflow-wrap:anywhere]">{c.title}</span>
                          </span>
                          <ArrowRight size={14} weight="bold" aria-hidden="true" className="shrink-0 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      ))}
                    </span>
                  ) : null}
                  {callFor === m.id ? (
                    <ChatSlots
                      copy={copy.slots}
                      locale={locale}
                      onPick={pickSlot}
                      onCancel={() => setCallFor(null)}
                    />
                  ) : null}
                  {m.failed ? (
                    <button
                      type="button"
                      onClick={() => retry(m)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-bg/25 px-2.5 py-1 text-xs font-medium text-accent-ink transition-transform active:scale-[0.97]"
                    >
                      <ArrowClockwise size={12} aria-hidden="true" />
                      {copy.notSent}. {copy.retry}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
            {pending && live.bubble ? (
              <li className="chat-in flex justify-start" data-chat-live={live.bubble.dots ? 'dots' : 'words'} aria-hidden="true">
                {live.bubble.dots ? (
                  <span className="inline-flex items-center gap-1 rounded-[18px] rounded-bl-md bg-surface-2 px-4 py-3.5">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </span>
                ) : (
                  <div className="max-w-[85%] rounded-[18px] rounded-bl-md bg-surface-2 px-3.5 py-2.5 text-[15px] leading-snug [overflow-wrap:anywhere] whitespace-pre-line text-fg">
                    <span data-chat-live-text>{wordsShown(splitWords(live.bubble.text), live.bubble.wordsShown)}</span>
                  </div>
                )}
              </li>
            ) : null}
            {pending ? <li className="sr-only" role="status" aria-label={copy.typing}>{copy.typing}</li> : null}
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
            {suggestions.length ? (
              <li className="chat-in flex flex-wrap gap-2 pt-1" data-chat-suggest>
                <span className="sr-only">{copy.suggestLabel}: </span>
                {suggestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void send(q, q)}
                    className="rounded-full border border-accent-text/40 px-3.5 py-2 text-sm text-fg transition-[background-color,border-color,transform] duration-200 hover:border-accent-text hover:bg-accent/10 active:scale-[0.97]"
                  >
                    {q}
                  </button>
                ))}
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

          <form onSubmit={submit} className="border-t border-t-hairline border-glass-line p-3">
            {hint ? (
              <p role="status" className="px-2 pb-2 text-xs text-faint">
                {hint}
              </p>
            ) : null}
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
                onFocus={() => {
                  const st = store.getSnapshot().state
                  if (st === 'idle' || st === 'sleep') store.set('listening')
                }}
                onBlur={() => store.release('listening')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    e.currentTarget.form?.requestSubmit()
                  }
                }}
                className="ym-disable-keys max-h-28 min-h-10 min-w-0 flex-1 resize-none bg-transparent py-2 text-[15px] text-fg placeholder:text-faint focus:outline-none"
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
