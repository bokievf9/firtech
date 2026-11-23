'use client'

import { ArrowRight, PaperPlaneRight } from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { hq } from '@/components/admin/control/api'
import { btn, btnPrimary, inputClass, Loading, useHqView, useHub } from '@/components/admin/hub/ui'
import { FiraTyped } from '@/components/fira/fira-typed'
import { Pending } from '@/components/ui/pending'
import { cn } from '@/lib/cn'
import { requestError } from '@/lib/content-studio'
import {
  activeMention,
  applyMention,
  cardHref,
  chipsFor,
  MAX_CHAT_TEXT,
  normalizeChat,
  normalizeMembers,
  normalizeReply,
  pendingDone,
  POLL_PENDING_MS,
  routeMessage,
  suggestMembers,
  teamChatPath,
  type Card,
  type ChatItem,
  type Chip,
  type Member,
} from '@/lib/team'

const stamp = (iso: string) => (iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '')
const SEND_TIMEOUT_MS = 30_000
const CARD_LABEL: Record<Card['kind'], string> = {
  task: 'Task', lead: 'Lead', client: 'Client', project: 'Project', invoice: 'Invoice', document: 'Document',
  order: 'Order', plan: 'Plan', rule: 'Rule', metric: 'Metric', item: 'Material',
}

type Props = { member: Pick<Member, 'id' | 'title' | 'dept'> }

// The chat with one employee: replies type in word by word and carry cards into the right Shell section; a 202 is polled every
// 3 s; `@agent text` at the start of a message assigns a task to that agent (POST /assign) with the field's autocomplete.
export function TeamChat({ member }: Props) {
  const { notify } = useHub()
  const people = useHqView('team', normalizeMembers, { visible: 60_000, hidden: 300_000 })
  const [items, setItems] = useState<ChatItem[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [caret, setCaret] = useState(0)
  const [pick, setPick] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [typing, setTyping] = useState<string | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const seq = useRef(0)
  const id = member.id

  const load = useCallback(async () => {
    const res = await hq<Record<string, unknown>>(teamChatPath(id))
    if (!res.ok) return setLoadError(requestError('Load chat', res))
    const chat = normalizeChat(res)
    if (!chat) return setLoadError(requestError('Load chat', { error: 'hq_bad_response' }))
    setLoadError(null)
    setItems(chat.items)
    if (chat.pending[0]) setPending(chat.pending[0])
  }, [id])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first fetch of the log
    void load()
  }, [load])

  useEffect(() => {
    if (!pending) return
    const timer = window.setInterval(async () => {
      const res = await hq<Record<string, unknown>>(teamChatPath(id))
      const chat = res.ok ? normalizeChat(res) : null
      if (chat && pendingDone(chat, pending)) {
        setItems(chat.items)
        setTyping(pending)
        setPending(null)
      }
    }, POLL_PENDING_MS)
    return () => window.clearInterval(timer)
  }, [pending, id])

  useEffect(() => {
    const el = list.current
    if (el) el.scrollTop = el.scrollHeight
  }, [items, pending, typing])

  const others = useMemo(() => (people.view ?? []).filter((m) => m.id !== id), [people.view, id])
  const mention = activeMention(text, caret)
  const options = mention ? suggestMembers(others, mention.query) : []
  const menuOpen = options.length > 0

  const fail = (what: string, res: { error: string }) => {
    const msg = requestError(what, res)
    setError(msg)
    notify(msg, 'error')
  }

  async function assign(agent: string, body: string) {
    const local: ChatItem = { id: `local-${++seq.current}`, role: 'owner', text: `@${agent} ${body}`, at: new Date().toISOString(), cards: [] }
    setItems((x) => [...(x ?? []), local])
    const res = await hq<{ task?: { id?: unknown } }>(`team/${agent}/assign`, { text: body })
    const taskId = res.ok && res.task && (typeof res.task.id === 'number' || typeof res.task.id === 'string') ? String(res.task.id) : null
    if (!res.ok || !taskId) {
      setItems((x) => (x ?? []).filter((i) => i.id !== local.id))
      fail('Assign', res.ok ? { error: 'hq_bad_response' } : res)
      return false
    }
    const who = (people.view ?? []).find((m) => m.id === agent)?.title ?? agent
    setItems((x) => [...(x ?? []), { id: `local-${++seq.current}`, role: 'agent', text: `Task for ${who} created.`, at: new Date().toISOString(), cards: [{ kind: 'task', id: taskId, title: `Task #${taskId}`, meta: [['assignee', who]] }] }])
    notify(`Task #${taskId} assigned to ${who}`)
    return true
  }

  async function send(raw: string) {
    const route = routeMessage(raw, id)
    if (!route.text || busy) return false
    setBusy(true)
    setError(null)
    let ok: boolean
    if (route.kind === 'assign') ok = await assign(route.agent, route.text)
    else {
      const local: ChatItem = { id: `local-${++seq.current}`, role: 'owner', text: route.text, at: new Date().toISOString(), cards: [] }
      setItems((x) => [...(x ?? []), local])
      const res = await hq<Record<string, unknown>>(`team/${id}/chat`, { text: route.text }, 'POST', SEND_TIMEOUT_MS)
      const reply = res.ok ? normalizeReply(res) : null
      if (!res.ok || !reply) {
        setItems((x) => (x ?? []).filter((i) => i.id !== local.id))
        fail('Send', res.ok ? { error: 'hq_bad_response' } : res)
        ok = false
      } else {
        if ('pending' in reply) setPending(reply.pending)
        else {
          setItems((x) => [...(x ?? []), reply.reply])
          setTyping(reply.reply.id)
        }
        ok = true
      }
    }
    setBusy(false)
    return ok
  }

  async function submit() {
    if (await send(text)) {
      setText('')
      setCaret(0)
    }
  }

  function chip(c: Chip) {
    if (c.fill) {
      setText(c.text)
      setCaret(c.text.length)
      field.current?.focus()
      return
    }
    void send(c.text)
  }

  function choose(agent: string) {
    if (!mention) return
    const next = applyMention(text, caret, mention.start, agent)
    setText(next.text)
    setCaret(next.caret)
    setPick(0)
    requestAnimationFrame(() => {
      const el = field.current
      if (el) {
        el.focus()
        el.setSelectionRange(next.caret, next.caret)
      }
    })
  }

  return (
    <section aria-label={`Chat with ${member.title}`} className="flex h-full min-h-0 flex-col" data-team-chat={id}>
      <div ref={list} role="log" aria-live="polite" aria-label={`Chat with ${member.title}`} className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto px-3 py-3" data-team-log>
        {items === null ? (
          loadError ? (
            <div role="alert" className="grid gap-2 text-sm text-danger" data-team-error>
              <p>{loadError}</p>
              <button type="button" className={cn(btn, 'justify-self-start')} onClick={() => void load()}>
                Retry
              </button>
            </div>
          ) : (
            <Loading rows={2} />
          )
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">No messages yet. Ask something or use a quick chip.</p>
        ) : (
          items.map((item) => <Message key={item.id} item={item} who={member.title} typing={typing === item.id} onTyped={() => setTyping((t) => (t === item.id ? null : t))} />)
        )}
        {pending ? (
          <p className="text-sm text-muted" data-team-pending>
            {member.title} is answering…
          </p>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="px-3 pb-2 text-xs text-danger" data-team-error>
          {error}
        </p>
      ) : null}
      <div className="relative grid gap-2 border-t border-line p-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick questions">
          {chipsFor(member).map((c) => (
            <button key={c.id} type="button" disabled={busy} onClick={() => chip(c)} className={cn(btn, '!min-h-8 !px-3 !text-xs')} data-chip={c.id}>
              {c.label}
            </button>
          ))}
        </div>
        {menuOpen ? (
          <ul role="listbox" aria-label="Employees" className="absolute inset-x-3 bottom-[calc(100%-0.25rem)] z-20 grid max-h-56 overflow-auto rounded-xl border border-line-strong bg-elevated p-1 shadow-card" data-mention-menu>
            {options.map((o, i) => (
              <li key={o.id} role="option" aria-selected={i === pick}>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    choose(o.id)
                  }}
                  className={cn('flex w-full items-baseline gap-2 rounded-lg px-3 py-2 text-left text-sm', i === pick ? 'bg-fill-strong' : 'hover:bg-fill')}
                  data-mention-option={o.id}
                >
                  <span className="font-mono text-xs text-muted">@{o.id}</span>
                  <span className="truncate">{o.title}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <textarea
            ref={field}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setCaret(e.target.selectionStart)
              setPick(0)
            }}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
            onKeyDown={(e) => {
              if (menuOpen) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault()
                  setPick((p) => (p + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
                  return
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault()
                  choose(options[pick]!.id)
                  return
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setCaret(0)
                  return
                }
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void submit()
              }
            }}
            rows={2}
            maxLength={MAX_CHAT_TEXT}
            aria-label={`Message to ${member.title}`}
            aria-autocomplete="list"
            placeholder="Write a message, or @name to give another employee a task"
            className={cn(inputClass, 'min-w-0 flex-1 resize-none')}
            data-team-input
          />
          <Pending type="submit" pending={busy} pendingLabel="Sending" disabled={!text.trim()} className={btnPrimary} aria-label="Send" data-team-send>
            <PaperPlaneRight size={16} weight="fill" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Send</span>
          </Pending>
        </form>
      </div>
    </section>
  )
}

function Message({ item, who, typing, onTyped }: { item: ChatItem; who: string; typing: boolean; onTyped: () => void }) {
  const mine = item.role === 'owner'
  return (
    <div className={cn('grid max-w-full gap-1.5', mine ? 'justify-items-end' : 'justify-items-start')} data-msg={item.role}>
      <div className={cn('max-w-[92%] rounded-2xl px-3 py-2 text-sm wrap-anywhere', mine ? 'bg-accent text-accent-ink' : 'border border-line bg-inset')}>
        <p className={cn('mb-0.5 text-[11px]', mine ? 'text-accent-ink/70' : 'text-faint')}>
          {mine ? 'You' : who} {stamp(item.at)}
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

export function CardView({ card }: { card: Card }) {
  return (
    <div className="grid gap-1.5 rounded-xl border border-line bg-surface p-2.5" data-card={card.kind} data-card-id={card.id}>
      <div className="text-[11px] uppercase tracking-wide text-faint">{CARD_LABEL[card.kind]}</div>
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
      <Link href={cardHref(card)} className="inline-flex w-fit items-center gap-1 text-sm text-accent-text underline-offset-4 hover:underline" data-card-link>
        Open <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </div>
  )
}
