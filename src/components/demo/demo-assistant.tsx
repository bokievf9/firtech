'use client'

import { PaperPlaneRight } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { useCabinetUser } from '@/components/cabinet/use-cabinet-user'
import type { Dict } from '@/content'
import { MESSAGE_MAX, START } from '@/lib/chat'
import { cn } from '@/lib/cn'
import { demoLoginHref, demoTabNext } from '@/lib/demo-gate'
import { errorLine } from '@/lib/errors'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { DemoGateBar, DemoLeft, DemoLimitPlate } from './demo-gate-ui'
import { callPersona } from './persona-call'

type Msg = { from: 'me' | 'agent' | 'sys'; text: string }

function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

// The «Персональный ИИ» demo tab. Signed out: a scripted conversation, five questions the visitor taps (brief, mail,
// promises from memory, time for a task, a language lesson), labelled «Пример», with the sign-in prompt where the
// input would be. Signed in (owner 2026-11-23, item 15): the real agent behind POST /api/chat with `persona=personal`,
// free text, and «Осталось N сообщений сегодня» from HQ's usage.
export function DemoAssistant({
  copy,
  gate,
  locale,
  badge,
  compact = false,
}: {
  copy: Dict['demoSection']['personal']
  gate: Dict['demoGate']
  locale: 'ru' | 'en'
  badge: string
  compact?: boolean
}) {
  const reduce = useReducedMotion()
  const { state: me, refresh } = useCabinetUser()
  const scriptMode = me.status === 'out' || me.status === 'loading'
  const [asked, setAsked] = useState<number[]>([])
  const [live, setLive] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [left, setLeft] = useState<number | null>(null)
  const [limitHit, setLimitHit] = useState(false)
  const session = useRef<{ id: string; started: boolean } | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const log: Msg[] = [
    { from: 'agent', text: copy.greet },
    ...(scriptMode
      ? asked.flatMap((i): Msg[] => [
          { from: 'me', text: copy.prompts[i]!.q },
          { from: 'agent', text: copy.prompts[i]!.a },
        ])
      : live),
  ]
  const left_ = copy.prompts.map((p, i) => ({ q: p.q, i })).filter((p) => !asked.includes(p.i))

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: reduce ? 'auto' : 'smooth' })
  }, [asked.length, live.length, pending, reduce])

  async function send(message: string) {
    const value = message.trim()
    if (!value || pending || limitHit) return
    setPending(true)
    setText('')
    setLive((l) => [...l, { from: 'me', text: value }])
    const s = (session.current ??= { id: uuid(), started: false })
    // HQ's conversation starts with the greeting request; its answer is not shown here.
    if (!s.started) {
      s.started = true
      await callPersona('personal', locale, s.id, START)
    }
    const answer = await callPersona('personal', locale, s.id, value)
    setPending(false)
    if (answer.ok) {
      if (answer.usage) setLeft(answer.usage.left)
      setLive((l) => [...l, { from: 'agent', text: answer.reply }])
    } else if (answer.error === 'demo_limit') {
      setLimitHit(true)
      setLeft(0)
    } else if (answer.error === 'auth_required') {
      void refresh()
    } else {
      setLive((l) => [...l, { from: 'sys', text: 'info' in answer ? errorLine(answer.info) : answer.error }])
    }
  }

  return (
    <div className={cn('grid gap-5', !compact && 'lg:grid-cols-12 lg:gap-8')}>
      <div className={cn(!compact && 'lg:col-span-5')}>
        {!compact && <p className="max-w-[44ch] text-muted">{copy.intro}</p>}
        {scriptMode && <p className={cn('inline-flex rounded-full bg-accent/15 px-3 py-1 text-xs text-accent-text', !compact && 'mt-6')}>{badge}</p>}
      </div>
      <div className={cn(!compact && 'lg:col-span-7')}>
        <div className={cn('material-thick flex flex-col overflow-hidden rounded-panel', scriptMode ? 'h-[38rem] lg:h-[32rem]' : 'h-[26rem]')} data-demo-assistant>
          <div className="flex items-center gap-3 border-b border-b-hairline border-glass-line px-4 py-3">
            <span className="grid size-9 place-items-center rounded-full bg-pine font-brand text-xs text-accent-text">ft</span>
            <div>
              <p className="text-sm font-medium">{copy.name}</p>
              <p className="text-xs text-muted">{copy.sub}</p>
            </div>
          </div>
          <ol ref={listRef} aria-live="polite" className="grid flex-1 content-start gap-2.5 overflow-y-auto p-4">
            {log.map((m, i) => (
              <li
                key={`${i}-${m.text}`}
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
              <li className="flex">
                <span className="inline-flex items-center gap-1 rounded-[18px] rounded-bl-md bg-surface-2 px-4 py-3.5">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </span>
              </li>
            )}
          </ol>
          <div className="grid gap-3 border-t border-t-hairline border-glass-line p-4">
            {scriptMode ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {left_.length > 0 ? (
                    left_.map((p) => (
                      <button
                        key={p.i}
                        type="button"
                        data-assistant-option={p.i}
                        onClick={() => setAsked((a) => [...a, p.i])}
                        className="rounded-full border border-accent-text/40 px-4 py-2 text-sm transition-[background-color,border-color] duration-200 hover:border-accent-text hover:bg-accent/10"
                      >
                        {p.q}
                      </button>
                    ))
                  ) : (
                    <>
                      <p className="text-sm text-muted">{copy.end}</p>
                      <button
                        type="button"
                        onClick={() => setAsked([])}
                        className="rounded-full border border-line-strong px-4 py-2 text-sm text-muted transition-colors hover:text-fg"
                      >
                        {copy.restart}
                      </button>
                    </>
                  )}
                </div>
                <DemoGateBar variant="plate" gate={gate} href={demoLoginHref(locale, demoTabNext(locale, 'personal'))} locked={me.status === 'loading'} />
              </>
            ) : limitHit ? (
              <DemoLimitPlate gate={gate} locale={locale} />
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {copy.prompts.map((p) => (
                    <button
                      key={p.q}
                      type="button"
                      disabled={pending}
                      onClick={() => void send(p.q)}
                      className="rounded-full border border-accent-text/40 px-3 py-1.5 text-[13px] transition-[background-color,border-color] duration-200 hover:border-accent-text hover:bg-accent/10 disabled:opacity-40"
                    >
                      {p.q}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void send(text)
                  }}
                  className="flex items-end gap-2 rounded-[22px] border border-line-strong bg-bg/60 p-1.5 pl-4 focus-within:border-accent-text/60"
                >
                  <input
                    value={text}
                    maxLength={MESSAGE_MAX}
                    aria-label={gate.write}
                    placeholder={gate.write}
                    onChange={(e) => setText(e.target.value)}
                    className="ym-disable-keys min-h-10 flex-1 bg-transparent text-[15px] text-fg placeholder:text-faint focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={pending || !text.trim()}
                    aria-label={gate.send}
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition-opacity disabled:opacity-40"
                  >
                    <PaperPlaneRight size={18} weight="fill" aria-hidden="true" />
                  </button>
                </form>
                <DemoLeft gate={gate} left={left} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
