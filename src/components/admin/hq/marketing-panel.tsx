'use client'

import { ArrowRight, PaperPlaneRight, X } from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { errText, fill, hq } from '@/components/admin/control/api'
import { btn, btnPrimary, inputClass, Loading, useHub } from '@/components/admin/hub/ui'
import { FiraTyped } from '@/components/fira/fira-typed'
import { Pending } from '@/components/ui/pending'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { requestError } from '@/lib/content-studio'
import {
  cardHref,
  CHIPS,
  chatPath,
  MAX_CHAT_TEXT,
  normalizeChat,
  normalizeReply,
  pendingDone,
  POLL_PENDING_MS,
  topicText,
  type Card,
  type ChatItem,
} from '@/lib/marketing-chat'

const m = admin.pult.content.marketing
const stamp = (iso: string) => (iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '')
// The chat answers for up to 25 s on the server; the browser waits a little longer.
const SEND_TIMEOUT_MS = 30_000

// The «Marketing» panel of Content Studio: the owner talks to the marketing agent (Fira), her replies type in word by word
// and carry cards that lead into the right Shell section. A 202 answer is polled every 3 s until the reply shows up in the log.
export function MarketingPanel({ onHide }: { onHide?: () => void }) {
  const { notify } = useHub()
  const [items, setItems] = useState<ChatItem[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [topic, setTopic] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [typing, setTyping] = useState<string | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const seq = useRef(0)

  const load = useCallback(async () => {
    const res = await hq<Record<string, unknown>>(chatPath())
    if (!res.ok) return setLoadError(requestError('Load marketing chat', res))
    const chat = normalizeChat(res)
    if (!chat) return setLoadError(requestError('Load marketing chat', { error: 'hq_bad_response' }))
    setLoadError(null)
    setItems(chat.items)
    return chat
  }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first fetch of the log
    void load()
  }, [load])

  // 202: poll the log until the pending reply is in it.
  useEffect(() => {
    if (!pending) return
    const id = window.setInterval(async () => {
      const res = await hq<Record<string, unknown>>(chatPath())
      const chat = res.ok ? normalizeChat(res) : null
      if (chat && pendingDone(chat, pending)) {
        setItems(chat.items)
        setTyping(pending)
        setPending(null)
      }
    }, POLL_PENDING_MS)
    return () => window.clearInterval(id)
  }, [pending])

  useEffect(() => {
    const el = list.current
    if (el) el.scrollTop = el.scrollHeight
  }, [items, pending, typing])

  async function send(raw: string) {
    const value = raw.trim()
    if (!value || busy) return false
    setBusy(true)
    setError(null)
    const local: ChatItem = { id: `local-${++seq.current}`, role: 'owner', text: value, at: new Date().toISOString(), cards: [] }
    setItems((x) => [...(x ?? []), local])
    const res = await hq<Record<string, unknown>>('marketing/chat', { text: value }, 'POST', SEND_TIMEOUT_MS)
    setBusy(false)
    const reply = res.ok ? normalizeReply(res) : null
    if (!res.ok || !reply) {
      setItems((x) => (x ?? []).filter((i) => i.id !== local.id))
      const msg = fill(m.failed, { e: requestError('Send to Marketing', res.ok ? { error: 'hq_bad_response' } : res) })
      setError(msg)
      notify(msg, 'error')
      return false
    }
    if ('pending' in reply) setPending(reply.pending)
    else {
      setItems((x) => [...(x ?? []), reply.reply])
      setTyping(reply.reply.id)
    }
    return true
  }

  async function submit() {
    const value = text
    if (await send(value)) setText('')
  }
  async function submitTopic() {
    if (!topic?.trim()) return
    if (await send(topicText(topic))) setTopic(null)
  }

  return (
    <section aria-label={m.panelLabel} className="flex h-full min-h-0 flex-col" data-marketing-panel>
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h2 className="text-sm font-medium">{m.title}</h2>
        {onHide ? (
          <button type="button" onClick={onHide} className="pressable inline-flex size-8 items-center justify-center rounded-full text-muted hover:bg-fill-strong hover:text-fg" aria-label={m.hide} data-marketing-hide>
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div ref={list} role="log" aria-live="polite" aria-label={m.panelLabel} className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto px-3 py-3" data-marketing-log>
        {items === null ? (
          loadError ? (
            <div role="alert" className="grid gap-2 text-sm text-danger" data-marketing-error>
              <p>{fill(m.loadFailed, { e: loadError })}</p>
              <button type="button" className={cn(btn, 'justify-self-start')} onClick={() => void load()}>
                {m.retry}
              </button>
            </div>
          ) : (
            <Loading rows={2} />
          )
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">{m.empty}</p>
        ) : (
          items.map((item) => (
            <Message key={item.id} item={item} typing={typing === item.id} onTyped={() => setTyping((t) => (t === item.id ? null : t))} />
          ))
        )}
        {pending ? (
          <p className="text-sm text-muted" data-marketing-pending>
            {m.pending}
          </p>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="px-3 pb-2 text-xs text-danger" data-marketing-error>
          {error}
        </p>
      ) : null}
      <div className="grid gap-2 border-t border-line p-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={m.chipsLabel}>
          {CHIPS.map((c) => (
            <button key={c.id} type="button" disabled={busy} onClick={() => void send(c.text)} className={cn(btn, '!min-h-8 !px-3 !text-xs')} data-chip={c.id}>
              {m.chips[c.id]}
            </button>
          ))}
          <button type="button" onClick={() => setTopic((t) => (t === null ? '' : null))} aria-expanded={topic !== null} className={cn(btn, '!min-h-8 !px-3 !text-xs')} data-chip="topic">
            {m.chips.topic}
          </button>
        </div>
        {topic !== null ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void submitTopic()
            }}
            data-marketing-topic
          >
            <input autoFocus value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={400} aria-label={m.topicLabel} placeholder={m.topicPlaceholder} className={cn(inputClass, 'min-w-0 flex-1')} />
            <Pending type="submit" pending={busy} pendingLabel={m.sending} disabled={!topic.trim()} className={btnPrimary}>
              {m.topicSend}
            </Pending>
          </form>
        ) : null}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void submit()
              }
            }}
            rows={2}
            maxLength={MAX_CHAT_TEXT}
            aria-label={m.inputLabel}
            placeholder={m.inputPlaceholder}
            className={cn(inputClass, 'min-w-0 flex-1 resize-none')}
            data-marketing-input
          />
          <Pending type="submit" pending={busy} pendingLabel={m.sending} disabled={!text.trim()} className={btnPrimary} aria-label={m.send} data-marketing-send>
            <PaperPlaneRight size={16} weight="fill" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{m.send}</span>
          </Pending>
        </form>
      </div>
    </section>
  )
}

function Message({ item, typing, onTyped }: { item: ChatItem; typing: boolean; onTyped: () => void }) {
  const mine = item.role === 'owner'
  return (
    <div className={cn('grid max-w-full gap-1.5', mine ? 'justify-items-end' : 'justify-items-start')} data-msg={item.role}>
      <div className={cn('max-w-[92%] rounded-2xl px-3 py-2 text-sm wrap-anywhere', mine ? 'bg-accent text-accent-ink' : 'border border-line bg-inset')}>
        <p className={cn('mb-0.5 text-[11px]', mine ? 'text-accent-ink/70' : 'text-faint')}>
          {mine ? m.you : m.fira} {stamp(item.at)}
        </p>
        {typing ? <FiraTyped text={item.text} onDone={onTyped} /> : <span className="whitespace-pre-wrap">{item.text}</span>}
      </div>
      {!typing && item.cards.length ? (
        <ul className="grid w-full gap-1.5" data-cards>
          {item.cards.map((c) => (
            <li key={`${c.kind}:${c.id}`}>
              <CardView card={c} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function CardView({ card }: { card: Card }) {
  const { notify } = useHub()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  async function accept() {
    setBusy(true)
    const res = await hq<{ slots?: number; orders?: number }>('marketing/plan/accept', { planId: card.id })
    setBusy(false)
    if (res.ok) {
      setDone(true)
      notify(fill(m.planAccepted, { slots: res.slots ?? 0, orders: res.orders ?? 0 }))
    } else notify(fill(m.planFailed, { e: errText(res.error) }), 'error')
  }
  return (
    <div className="grid gap-1.5 rounded-xl border border-line bg-surface p-2.5" data-card={card.kind} data-card-id={card.id}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-faint">{m.cards[card.kind]}</div>
      <p className="text-sm font-medium wrap-anywhere">{card.title}</p>
      {card.meta.length ? (
        <p className="flex flex-wrap gap-x-3 text-xs text-muted">
          {card.meta.map(([k, v]) => (
            <span key={k}>
              {k}: <span className="font-mono">{v}</span>
            </span>
          ))}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={cardHref(card)} className="inline-flex items-center gap-1 text-accent-text underline-offset-4 hover:underline" data-card-link>
          {m.open} <ArrowRight size={14} aria-hidden="true" />
        </Link>
        {card.kind === 'plan' ? (
          <Pending pending={busy} pendingLabel={admin.hq.loading} disabled={done} onClick={() => void accept()} className={cn(btn, '!min-h-8 !px-3 !text-xs')} data-card-accept>
            {m.acceptPlan}
          </Pending>
        ) : null}
      </div>
    </div>
  )
}
