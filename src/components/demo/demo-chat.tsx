'use client'

import { PaperPlaneRight } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dict } from '@/content'
import { useCabinetUser } from '@/components/cabinet/use-cabinet-user'
import { scripted } from '@/content/builder-v2'
import { btnMessage, MESSAGE_MAX, START, type ChatButton, type NichePersona } from '@/lib/chat'
import { demoLoginHref, demoTabNext } from '@/lib/demo-gate'
import { cn } from '@/lib/cn'
import { errorLine } from '@/lib/errors'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { DemoGateBar, DemoLeft, DemoLimitPlate } from './demo-gate-ui'
import { callPersona, type PersonaAnswer } from './persona-call'

// `retry`: a failure line with a «Повторить» button that sends the same message again.
type Msg = { id: number; from: 'me' | 'agent' | 'sys'; text: string; retry?: { message: string; shown: string } }
type Answer = PersonaAnswer
type Copy = Dict['demoSection']['receptionist']

const NICHES: readonly NichePersona[] = ['salon', 'clinic', 'shop', 'cafe', 'service', 'courses']
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
export function DemoChat({ copy, gate, badge, locale }: { copy: Copy; gate: Dict['demoGate']; badge: string; locale: 'ru' | 'en' }) {
  const reduce = useReducedMotion()
  // Only a signed-in client writes (owner 2026-11-23, item 15); a visitor gets the scripted example and «Войти».
  const { state: me, refresh } = useCabinetUser()
  const scriptMode = me.status === 'out' || me.status === 'loading'
  const [left, setLeft] = useState<number | null>(null)
  const [limitHit, setLimitHit] = useState(false)
  const [niche, setNiche] = useState<NichePersona>('salon')
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

  const push = useCallback((forNiche: NichePersona, ...items: Omit<Msg, 'id'>[]) => {
    setThreads((all) => ({
      ...all,
      [forNiche]: [...(all[forNiche] ?? []), ...items.map((m) => ({ ...m, id: ++counter.current }))],
    }))
  }, [])

  const call = useCallback(
    async (forNiche: NichePersona, message: string): Promise<Answer> => {
      const session = (sessions.current[forNiche] ??= { id: uuid(), started: false })
      return callPersona(forNiche, locale, session.id, message)
    },
    [locale],
  )

  // Signed out: the scripted lines of the niche, a question from the chips only; nothing is sent.
  const script = scripted[niche as keyof typeof scripted]?.[locale]
  const answerScripted = useCallback(
    (forNiche: NichePersona, shown: string) => {
      const sc = scripted[forNiche as keyof typeof scripted]?.[locale]
      if (!sc) return
      const i = sc.chips.indexOf(shown)
      push(forNiche, { from: 'me', text: shown }, { from: 'agent', text: i >= 0 ? (sc.answers[i] ?? sc.fallback) : sc.fallback })
    },
    [locale, push],
  )

  const send = useCallback(
    async (message: string, shown: string) => {
      if (scriptMode) {
        answerScripted(niche, shown)
        return
      }
      const now = Date.now()
      if (pending || limitHit || now - last.current < MIN_GAP_MS) return
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
        if (answer.usage) setLeft(answer.usage.left)
        push(forNiche, { from: 'agent', text: answer.reply })
        if (answer.state === 'contact') push(forNiche, { from: 'sys', text: copy.noContacts })
        setButtons(answer.buttons ?? [])
      } else if (answer.error === 'demo_limit') {
        // The daily limit of the demo: a friendly plate instead of an error line.
        setLimitHit(true)
        setLeft(0)
      } else if (answer.error === 'auth_required') {
        // The session is gone: the sign-in bar takes the input's place.
        void refresh()
      } else {
        const info = 'info' in answer ? answer.info : undefined
        push(forNiche, {
          from: 'sys',
          text: info ? errorLine(info) : answer.error === 'rate_limited' ? copy.rateLimited : copy.error,
          ...(info?.retryable !== false ? { retry: { message, shown } } : {}),
        })
      }
    },
    [answerScripted, call, copy, limitHit, niche, pending, push, refresh, scriptMode],
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
        <div className={cn('material-thick flex flex-col overflow-hidden rounded-panel', scriptMode ? 'h-[36rem] lg:h-[31rem]' : 'h-[26rem]')} data-demo-chat>
          <div className="flex items-center justify-between gap-2 border-b border-b-hairline border-glass-line px-4 py-2.5">
            <span
              data-chat-demo
              className="inline-flex items-center rounded-full border border-accent-text/40 bg-accent/10 px-3 py-1 text-xs text-fg"
            >
              {copy.chips[niche]}
            </span>
            {scriptMode && (
              <span data-demo-example className="rounded-full bg-accent/15 px-3 py-1 text-xs text-accent-text">
                {badge}
              </span>
            )}
            <button
              type="button"
              onClick={reset}
              disabled={pending || messages.length === 0}
              className="text-xs text-muted underline-offset-4 transition-colors hover:text-fg hover:underline disabled:opacity-40"
            >
              {copy.reset}
            </button>
          </div>
          {scriptMode && <p className="px-4 pt-3 text-caption text-faint">{gate.scripted}</p>}
          <ol ref={listRef} aria-live="polite" className={cn('grid flex-1 content-start gap-2.5 overflow-y-auto p-4', scriptMode && 'opacity-80')}>
            {messages.length === 0 && scriptMode && script && (
              <li className="chat-in max-w-[88%] rounded-[18px] rounded-bl-md bg-surface-2 px-4 py-2.5 text-[15px] leading-snug">
                {script.greeting.replace('{company}', copy.niches[niche])}
              </li>
            )}
            {messages.length === 0 && !scriptMode && (
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
                {m.retry ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const r = m.retry!
                      last.current = 0
                      setThreads((all) => ({ ...all, [niche]: (all[niche] ?? []).filter((x) => x.id !== m.id) }))
                      void send(r.message, r.shown)
                    }}
                    className="mt-2 block rounded-full border border-line-strong px-3 py-1 text-[13px] text-fg transition-[background-color,transform] hover:bg-fg/5 active:scale-[0.97] disabled:opacity-40"
                  >
                    {copy.retry}
                  </button>
                ) : null}
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
            {(!scriptMode && buttons.length ? buttons.map((b) => ({ key: b.id, label: b.label, message: btnMessage(b.id) })) : (scriptMode && script ? script.chips : copy.hints[niche]).map((h) => ({ key: h, label: h, message: h }))).map((chip) => (
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
          <div className="border-t border-t-hairline border-glass-line p-3">
            {scriptMode ? (
              <DemoGateBar variant="plate" gate={gate} href={demoLoginHref(locale, demoTabNext(locale, 'receptionist'))} locked={me.status === 'loading'} />
            ) : limitHit ? (
              <DemoLimitPlate gate={gate} locale={locale} />
            ) : (
            <form onSubmit={submit}>
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

            )}
            {!scriptMode && !limitHit && <div className="mt-2 px-2"><DemoLeft gate={gate} left={left} /></div>}
          </div>
        </div>
      </div>
    </div>
  )
}
