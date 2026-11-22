'use client'

import { PaperPlaneRight } from '@phosphor-icons/react'
import { useEffect, useId, useRef, useState } from 'react'
import { useCabinetUser } from '@/components/cabinet/use-cabinet-user'
import { DemoGateBar, DemoLeft, DemoLimitPlate } from '@/components/demo/demo-gate-ui'
import { callPersona, START } from '@/components/demo/persona-call'
import { TabList, tabId, tabPanelId } from '@/components/ui'
import type { Dict } from '@/content'
import type { ProductBlocks } from '@/content/product-pages'
import { MESSAGE_MAX } from '@/lib/chat'
import { cn } from '@/lib/cn'
import { demoLoginHref } from '@/lib/demo-gate'
import { errorLine } from '@/lib/errors'
import type { PersonaKind } from '@/lib/personal-page'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { skillIcons } from './skill-grid'

type Copy = NonNullable<ProductBlocks['myday']>
type Msg = { from: 'me' | 'agent' | 'sys'; text: string }

function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

// «Кто вы»: eight kinds of people, one choice drives two things. The compact day (four moments, one line each) and
// the demo. Signed in: the real agent behind POST /api/chat with `persona: personal` and the chosen kind in
// `personaKind`. Signed out: a still example (labelled «Пример», never a working chat) and the lock plate with the
// sign-in buttons (owner 2026-11-22: the demo is for signed-in clients and must look so).
export function PersonalLive({
  copy,
  people,
  skillNames,
  gate,
  badge,
  locale,
}: {
  copy: Copy
  people: { id: string; name: string }[]
  skillNames: Record<string, string>
  gate: Dict['demoGate']
  badge: string
  locale: 'ru' | 'en'
}) {
  const base = useId()
  const reduce = useReducedMotion()
  const { state: me, refresh } = useCabinetUser()
  const locked = me.status === 'out' || me.status === 'loading'
  const [who, setWho] = useState<string>(copy.personas[0]!.id)
  const persona = copy.personas.find((p) => p.id === who) ?? copy.personas[0]!
  const name = people.find((p) => p.id === persona.id)?.name ?? persona.id

  const [live, setLive] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [left, setLeft] = useState<number | null>(null)
  const [limitHit, setLimitHit] = useState(false)
  const session = useRef<{ id: string; started: boolean } | null>(null)
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: reduce ? 'auto' : 'smooth' })
  }, [live.length, pending, reduce])

  function pick(id: string) {
    if (id === who) return
    setWho(id)
    // A new kind of person is a new conversation.
    setLive([])
    session.current = null
  }

  async function send(message: string) {
    const value = message.trim()
    if (!value || pending || limitHit) return
    setPending(true)
    setText('')
    setLive((l) => [...l, { from: 'me', text: value }])
    const s = (session.current ??= { id: uuid(), started: false })
    const kind = persona.id as PersonaKind
    if (!s.started) {
      s.started = true
      await callPersona('personal', locale, s.id, START, kind)
    }
    const answer = await callPersona('personal', locale, s.id, value, kind)
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

  const bubble = 'chat-in max-w-[88%] rounded-[18px] px-4 py-2.5 text-[15px] leading-snug'
  const first = persona.steps[0]!
  return (
    <div data-myday>
      <TabList
        base={base}
        label={copy.pick}
        items={copy.personas.map((p) => ({ id: p.id, label: people.find((x) => x.id === p.id)?.name ?? p.id }))}
        value={who}
        onChange={pick}
        itemProps={(id) => ({ 'data-myday-persona': id })}
      />
      <div
        role="tabpanel"
        id={tabPanelId(base, who)}
        aria-labelledby={tabId(base, who)}
        className="mt-8 grid gap-8 lg:grid-cols-12 lg:gap-12"
      >
        <div className="lg:col-span-5">
          <h3 className="text-title-3 font-semibold">{copy.dayTitle}</h3>
          <ol key={who} className="relative mt-6 grid gap-5 border-l border-l-hairline border-line pl-6" data-myday-day>
            {persona.steps.map((step) => {
              const Glyph = skillIcons[step.hand]!
              return (
                <li key={step.time} className="chat-in relative" data-myday-hour={step.time}>
                  <span
                    aria-hidden="true"
                    className="absolute top-0 -left-[2.4rem] grid size-8 place-items-center rounded-full border border-hairline border-line bg-elevated text-accent-text"
                  >
                    <Glyph size={16} weight="duotone" aria-hidden="true" />
                  </span>
                  <p className="text-footnote text-muted">
                    <span className="font-mono text-fg">{step.time}</span> {skillNames[step.hand]}
                  </p>
                  <p className="mt-1 text-body">{step.text}</p>
                </li>
              )
            })}
          </ol>
        </div>

        <div className="lg:col-span-7">
          <h3 className="text-title-3 font-semibold">{copy.demoTitle}</h3>
          <div
            className={cn('material-thick mt-6 flex flex-col overflow-hidden rounded-panel', locked ? '' : 'h-[26rem]')}
            data-personal-demo={locked ? 'locked' : 'live'}
          >
            <div className="flex items-center gap-3 border-b border-b-hairline border-glass-line px-4 py-3">
              <span className="grid size-9 place-items-center rounded-full bg-pine font-brand text-xs text-accent-text">ft</span>
              <p className="min-w-0 flex-1 truncate text-callout font-medium">{name}</p>
              {locked && <span className="rounded-full bg-accent/15 px-3 py-1 text-caption text-accent-text" data-personal-example>{badge}</span>}
            </div>
            {locked ? (
              <div className="grid gap-4 p-4">
                <ol className="grid gap-2.5" data-example-log>
                  <li className="ml-auto max-w-[88%] rounded-[18px] rounded-br-md bg-accent px-4 py-2.5 text-[15px] leading-snug text-accent-ink">{persona.asks[0]}</li>
                  <li className="max-w-[88%] rounded-[18px] rounded-bl-md bg-surface-2 px-4 py-2.5 text-[15px] leading-snug">{first.text}</li>
                </ol>
                <DemoGateBar
                  variant="plate"
                  gate={gate}
                  href={demoLoginHref(locale, `/${locale}/products/personal#myday`)}
                  locked={me.status === 'loading'}
                />
              </div>
            ) : (
              <>
                <ol ref={listRef} aria-live="polite" className="grid flex-1 content-start gap-2.5 overflow-y-auto p-4">
                  <li className={cn(bubble, 'rounded-bl-md bg-surface-2')}>{copy.hello}</li>
                  {live.map((m, i) => (
                    <li
                      key={`${i}-${m.text}`}
                      className={cn(
                        bubble,
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
                  {limitHit ? (
                    <DemoLimitPlate gate={gate} locale={locale} />
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {persona.asks.map((q) => (
                          <button
                            key={q}
                            type="button"
                            disabled={pending}
                            onClick={() => void send(q)}
                            className="pressable rounded-full border border-accent-text/40 px-3 py-1.5 text-[13px] transition-[background-color,border-color] duration-200 hover:border-accent-text hover:bg-accent/10 disabled:opacity-40"
                          >
                            {q}
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
