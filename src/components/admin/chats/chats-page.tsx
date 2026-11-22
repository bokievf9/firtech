'use client'

import { ArrowBendUpLeft, ArrowLeft, ChatCircleText, EnvelopeSimple, MagnifyingGlass, PaperPlaneTilt, Paperclip, X } from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { errText, hq } from '@/components/admin/control/api'
import { Toast, type ToastMessage } from '@/components/admin/control/toast'
import { btnPrimary, inputClass, modalOpen, Offline, typingIn, useHqView } from '@/components/admin/hub/ui'
import { Chip } from '@/components/admin/shell-crm/bits'
import { normalizeSettings } from '@/lib/settings-hq'
import { cn } from '@/lib/cn'
import {
  autopilotChip,
  canReplyTo,
  chatAutopilotKind,
  CHANNEL_LABELS,
  choiceLabel,
  choicesFrom,
  defaultChoice,
  fallbackChoices,
  lastClientThread,
  markedUnread,
  messageThreads,
  mergeMessages,
  normalizeChats,
  normalizeReply,
  normalizeThread,
  normalizeThreadChoices,
  normalizeThreadView,
  replyBody,
  replyNote,
  searchThreads,
  sendsOnEnter,
  sortThreads,
  threadLinks,
  type Channel,
  type ChatMessage,
  type ChatThread,
  type ChatThreadView,
  type ThreadChoice,
} from '@/lib/chats'
import { RateButtons, RatingsProvider } from '@/components/admin/hq/rate-buttons'

const desktopQuery = '(min-width: 1024px)'
const subscribeDesktop = (cb: () => void) => {
  const m = window.matchMedia(desktopQuery)
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}
const useDesktop = () => useSyncExternalStore(subscribeDesktop, () => window.matchMedia(desktopQuery).matches, () => false)

const time = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const same = d.toDateString() === new Date().toDateString()
  return same ? d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
const t422 = 'У клиента несколько тредов: выберите, куда отправить ответ.'
const NO_TEXTS =
  'Тексты анонимных диалогов сайта и бота не хранятся: у такого чата есть только короткая обезличенная сводка. Сообщения появятся, когда человек станет лидом, тикетом или клиентом кабинета.'

function ChannelChips({ channels }: { channels: Channel[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {channels.map((c) => (
        <Chip key={c}>{CHANNEL_LABELS[c]}</Chip>
      ))}
    </span>
  )
}

// `plain` = no link (the list row is itself a button).
function AutopilotChip({ settings, thread, lastThread = null, plain = false }: { settings: Parameters<typeof autopilotChip>[0]; thread: ChatThread; lastThread?: string | null; plain?: boolean }) {
  const chip = autopilotChip(settings, chatAutopilotKind(thread, lastThread))
  if (!chip) return null
  const cls = 'inline-flex shrink-0 items-center rounded-full border border-line px-2 py-0.5 text-xs text-muted'
  if (plain) return <span title={chip.title} data-autopilot-chip={chip.mode} className={cls}>{chip.text}</span>
  return (
    <Link href="/admin/settings" title={chip.title} data-autopilot-chip={chip.mode} className={cn(cls, 'hover:border-line-strong hover:text-fg')}>
      {chip.text}
    </Link>
  )
}

function ChatsPageInner() {
  const desktop = useDesktop()
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const notify = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => setToast({ id: Date.now() + Math.random(), text, tone }), [])
  const closeToast = useCallback(() => setToast(null), [])
  const [scope, setScope] = useState<'open' | 'all'>('open')
  const [channel, setChannel] = useState<Channel | 'all'>('all')
  const [sel, setSel] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [query, setQuery] = useState('')
  // Reply target: the thread picked in the composer (per chat) and the message answered.
  const [pickedThread, setPickedThread] = useState<Record<string, string>>({})
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [pickerHot, setPickerHot] = useState(false)
  const [hqChoices, setHqChoices] = useState<{ for: string; list: ThreadChoice[] } | null>(null)
  const picker = useRef<HTMLSelectElement>(null)

  // The Autopilot modes are read once for the page; a failed call simply hides the chips.
  const settingsRes = useHqView('settings', normalizeSettings, { visible: 86_400_000, hidden: 86_400_000 })
  const autopilot = settingsRes.view?.settings ?? null
  const list = useHqView(`chats?status=${scope}&limit=100`, normalizeChats, { visible: 30_000, hidden: 120_000 })
  const threads = useMemo(
    () => searchThreads(sortThreads(list.view?.items ?? []), query).filter((t) => channel === 'all' || t.channels.includes(channel)),
    [list.view, channel, query],
  )
  const activeId = sel ?? (desktop ? (threads[0]?.id ?? null) : null)
  // Only the open thread refreshes (30 s), and not at all while the tab is hidden.
  const open = useHqView(activeId ? `chats/${encodeURIComponent(activeId)}` : null, normalizeThreadView, { visible: 30_000, hidden: 86_400_000 })
  const thread: ChatThread | null = open.view && !open.stale ? open.view.thread : (threads.find((t) => t.id === activeId) ?? null)
  const messages = useMemo(() => (open.view && !open.stale ? open.view.messages : []), [open.view, open.stale])
  const unread = list.view?.unread ?? 0
  // The client's threads (lead, support, project-N) for the reply picker; a client without a cabinet falls back to what the row shows.
  const clientId = thread?.client.id ?? null
  const threadsRes = useHqView(clientId !== null ? `clients/${clientId}/threads` : null, normalizeThreadChoices, { visible: 120_000, hidden: 86_400_000 })
  const choices: ThreadChoice[] = useMemo(() => {
    const fromHq = clientId !== null && threadsRes.view && !threadsRes.stale ? threadsRes.view : null
    const known = hqChoices && thread && hqChoices.for === thread.id ? hqChoices.list : fromHq
    return known && known.length ? known : thread ? fallbackChoices(thread) : []
  }, [hqChoices, threadsRes.view, threadsRes.stale, thread, clientId])
  // The reply goes to the thread picked by the owner, else the thread of the client's LAST message (HQ's own default).
  const lastThread = useMemo(() => lastClientThread(messages), [messages])
  const showThreadChip = useMemo(() => messageThreads(messages).length > 1, [messages])
  const chosen = thread ? (pickedThread[thread.id] ?? defaultChoice(choices, lastThread)) : null

  const end = useRef<HTMLDivElement>(null)
  const last = messages.at(-1)?.id
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [last, activeId])

  // Opening an unread thread clears its badge in the list at once (HQ counts it read when the owner answers).
  const { mutate: mutateList } = list
  const { mutate: mutateOpen } = open

  // «Отметить непрочитанным»: optimistic (the counter in the list at once), rolled back when HQ refuses.
  const markUnread = async (t: ChatThread) => {
    const before = list.view?.items.find((x) => x.id === t.id) ?? null
    mutateList((v) => ({ ...v, items: v.items.map((x) => (x.id === t.id ? markedUnread(x) : x)), unread: v.items.filter((x) => (x.id === t.id ? markedUnread(x) : x).unread > 0).length }))
    if (!desktop) setSel(null)
    const res = await hq<Record<string, unknown>>(`chats/${encodeURIComponent(t.id)}/unread`, {})
    const row = res.ok ? normalizeThread((res as { thread?: unknown }).thread) : null
    if (!row) {
      mutateList((v) => {
        const items = v.items.map((x) => (x.id === t.id && before ? before : x))
        return { ...v, items, unread: items.filter((x) => x.unread > 0).length }
      })
      notify(res.ok ? errText('hq_bad_response') : errText(res.error), 'error')
      return
    }
    mutateList((v) => {
      const items = v.items.map((x) => (x.id === t.id || x.id === row.id ? row : x))
      return { ...v, items, unread: items.filter((x) => x.unread > 0).length }
    })
    notify('Отмечено непрочитанным', 'info')
  }

  const send = async () => {
    const text = draft.trim()
    if (!text || sending || !thread) return
    setSending(true)
    const id = `local_${Date.now()}`
    // `thread` goes along when the client has several threads (the picked one) or the owner chose; `replyTo` when a message is being answered.
    const target = choices.length > 1 || pickedThread[thread.id] ? chosen : null
    const local: ChatMessage = { id, at: new Date().toISOString(), from: 'owner', channel: thread.channels.includes('cabinet') ? 'cabinet' : (thread.channels[0] ?? 'web'), thread: target, text, attachments: [] }
    setDraft('')
    mutateOpen((v) => ({ ...v, messages: [...v.messages, local] }))
    const res = await hq<Record<string, unknown>>(`chats/${encodeURIComponent(thread.id)}/reply`, replyBody(text, { thread: target, replyTo: replyTo?.id }))
    setSending(false)
    const out = res.ok ? normalizeReply(res) : null
    if (!out) {
      mutateOpen((v) => ({ ...v, messages: v.messages.filter((m) => m.id !== id) }))
      setDraft(text)
      if (!res.ok && res.error === 'thread_required') {
        // HQ cannot tell which thread the client wrote in last: open the picker with the names it sent, nothing was saved.
        const named = choicesFrom((res as { threads?: unknown }).threads, choices)
        if (named.length) setHqChoices({ for: thread.id, list: named })
        setPickerHot(true)
        notify(t422, 'error')
        setTimeout(() => picker.current?.focus(), 0)
        return
      }
      notify(res.ok ? errText('hq_bad_response') : errText(res.error), 'error')
      return
    }
    setReplyTo(null)
    setPickerHot(false)
    mutateOpen((v: ChatThreadView) => ({
      thread: out.thread ?? v.thread,
      messages: mergeMessages(
        v.messages.filter((m) => m.id !== id),
        [],
      ).concat(out.message ? [out.message] : [{ ...local, id: `ow_${Date.now()}` }]),
    }))
    if (out.thread) {
      const t = out.thread
      mutateList((v) => ({ ...v, items: v.items.map((x) => (x.id === t.id || x.id === thread.id ? t : x)) }))
    }
    notify(replyNote(out), out.sent ? 'info' : 'error')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || modalOpen() || e.defaultPrevented) return
      if (typingIn(e.target)) {
        ;(e.target as HTMLElement).blur()
        return
      }
      if (!desktop && sel) setSel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [desktop, sel])

  const showList = desktop || !sel
  const showThread = desktop || !!sel

  return (
    <div className="absolute inset-0 flex flex-col bg-bg text-fg">
      <header className="flex min-h-12 items-center gap-2 border-b border-line px-2 sm:gap-3 sm:px-4">
        {!desktop && sel ? (
          <button type="button" onClick={() => setSel(null)} aria-label="К списку чатов" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm">
            <ArrowLeft size={16} aria-hidden="true" />
            Чаты
          </button>
        ) : null}
        <h1 className={cn('font-brand text-sm tracking-wide sm:text-base', !desktop && sel && 'sr-only')}>Чаты</h1>
        {unread ? <span className="rounded-full bg-accent px-2.5 py-1 font-mono text-xs tabular-nums text-accent-ink" aria-label={`Непрочитанных: ${unread}`}>{unread}</span> : null}
      </header>

      <div className="min-h-0 flex-1 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)]">
        {showList ? (
          <aside aria-label="Чаты" className="flex h-full min-h-0 flex-col border-r border-line">
            <div className="flex flex-wrap gap-1.5 border-b border-line p-2" role="group" aria-label="Фильтры">
              {(['open', 'all'] as const).map((s) => (
                <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)} className={cn('min-h-9 rounded-full border px-3 text-sm', scope === s ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-muted')}>
                  {s === 'open' ? 'Активные' : 'Все'}
                </button>
              ))}
              {(['all', 'web', 'telegram', 'cabinet'] as const).map((c) => (
                <button key={c} type="button" aria-pressed={channel === c} onClick={() => setChannel(c)} className={cn('min-h-9 rounded-full border px-3 text-sm', channel === c ? 'border-accent text-accent-text' : 'border-line text-muted')}>
                  {c === 'all' ? 'Любой канал' : CHANNEL_LABELS[c]}
                </button>
              ))}
            </div>
            <div className="border-b border-line p-2">
              <label className="relative block">
                <span className="sr-only">Поиск по клиентам</span>
                <MagnifyingGlass size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={80} placeholder="Поиск: имя, контакт, почта, текст" className={cn(inputClass, 'pl-9')} />
              </label>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {list.error && !list.view ? <li><Offline error={list.error} onRetry={() => list.reload()} /></li> : null}
              {!list.view && !list.error ? <li role="status" className="p-4 text-sm text-muted">Загружаю чаты</li> : null}
              {list.view && !threads.length ? <li className="p-4 text-sm text-muted">{query.trim() ? 'По запросу никого нет.' : 'Чатов нет.'}</li> : null}
              {threads.map((t) => {
                const active = t.id === activeId
                return (
                  <li key={t.id} className="border-b border-line">
                    <button
                      type="button"
                      onClick={() => {
                        setSel(t.id)
                        setReplyTo(null)
                        setPickerHot(false)
                      }}
                      aria-current={active} className={cn('grid w-full gap-1 p-3 text-left transition-colors', active ? 'bg-surface-2' : 'hover:bg-surface-2/60')}>
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn('truncate text-sm', t.unread ? 'font-semibold' : 'font-medium')}>{t.client.name}</span>
                        <span className="shrink-0 font-mono text-xs text-faint">{time(t.lastAt)}</span>
                      </span>
                      <span className={cn('line-clamp-2 text-sm', t.unread ? 'text-fg' : 'text-muted')}>{t.preview || 'Без текста'}</span>
                      <span className="flex flex-wrap items-center gap-1">
                        <ChannelChips channels={t.channels} />
                        {t.leadId !== null ? <Chip tone="accent">лид #{t.leadId}</Chip> : null}
                        {t.ticketId !== null ? <Chip tone={t.openTicket ? 'warn' : 'plain'}>тикет #{t.ticketId}</Chip> : null}
                        <AutopilotChip settings={autopilot} thread={t} plain />
                        {t.unread ? <span className="ml-auto rounded-full bg-accent px-2 py-0.5 font-mono text-xs text-accent-ink" aria-label="Есть непрочитанное">{t.unread}</span> : null}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>
        ) : null}

        {showThread ? (
          <section aria-label="Переписка" className="flex h-full min-h-0 flex-col">
            {!thread ? (
              <div className="grid flex-1 place-items-center p-6 text-center">
                <div className="grid justify-items-center gap-2">
                  <ChatCircleText size={40} weight="duotone" aria-hidden="true" className="text-faint" />
                  <p className="text-sm text-muted">Выберите чат слева.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold">{thread.client.name}</h2>
                    <p className="truncate text-xs text-muted">{[thread.client.contact, thread.client.email].filter(Boolean).join(' · ') || 'Контактов нет'}</p>
                  </div>
                  <ChannelChips channels={thread.channels} />
                  <AutopilotChip settings={autopilot} thread={thread} lastThread={lastThread} />
                  <div className="ml-auto flex flex-wrap items-center gap-x-3">
                    <button
                      type="button"
                      onClick={() => void markUnread(thread)}
                      className="inline-flex min-h-9 items-center gap-1 text-sm text-muted hover:text-fg"
                    >
                      <EnvelopeSimple size={14} aria-hidden="true" /> Отметить непрочитанным
                    </button>
                    {threadLinks(thread).map((l) => (
                      <Link key={l.href} href={l.href} className="inline-flex min-h-9 items-center text-sm text-accent-text underline">{l.label}</Link>
                    ))}
                  </div>
                </div>

                <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4', open.stale && 'opacity-60')} aria-live="polite">
                  {open.error && !open.view ? <Offline error={open.error} onRetry={() => open.reload()} /> : null}
                  {!thread.textsStored ? (
                    <div className="mx-auto grid max-w-md gap-2 rounded-2xl border border-dashed border-line-strong p-4 text-sm">
                      <p>{NO_TEXTS}</p>
                      {thread.preview ? <p className="text-muted">Сводка: {thread.preview}</p> : null}
                    </div>
                  ) : (
                    <ol className="mx-auto grid max-w-2xl gap-3">
                      {messages.map((m) => {
                        const mine = m.from !== 'client'
                        return (
                          <li key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                            <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap', mine ? 'rounded-br-md bg-accent/20 ring-1 ring-accent/40' : 'rounded-bl-md bg-surface-2')}>
                              {m.text}
                              {m.attachments.map((a) => (
                                <span key={a.name} className="mt-1 flex items-center gap-1 text-xs text-muted">
                                  <Paperclip size={12} aria-hidden="true" />
                                  {a.url ? <a href={a.url} target="_blank" rel="noreferrer noopener" className="underline">{a.name}</a> : a.name}
                                </span>
                              ))}
                            </div>
                            <span className="mt-0.5 flex items-center gap-2 px-1 font-mono text-xs text-faint">
                              {m.from === 'hq' ? 'Fir Tech' : m.from === 'owner' ? 'Вы' : 'Клиент'}, {CHANNEL_LABELS[m.channel]}, {time(m.at)}
                              {showThreadChip && m.thread ? <Chip>{choiceLabel(m.thread)}</Chip> : null}
                              {canReplyTo(m) ? (
                                <button type="button" onClick={() => setReplyTo(m)} aria-label="Ответить на это сообщение" className="inline-flex min-h-6 items-center gap-1 font-sans text-accent-text underline">
                                  <ArrowBendUpLeft size={12} aria-hidden="true" /> Ответить
                                </button>
                              ) : null}
                            </span>
                            {m.from === 'hq' ? <RateButtons messageId={m.id} thread={m.thread ?? thread.id} className="mt-1 max-w-[85%]" /> : null}
                          </li>
                        )
                      })}
                    </ol>
                  )}
                  <div ref={end} />
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void send()
                  }}
                  className="border-t border-line bg-bg p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
                >
                  {choices.length > 1 || replyTo ? (
                    <div className="mx-auto mb-2 flex max-w-2xl flex-wrap items-center gap-2 text-sm">
                      {choices.length > 1 ? (
                        <label className="flex min-w-0 max-w-full items-center gap-2">
                          <span className={cn('shrink-0 text-xs', pickerHot ? 'text-warn' : 'text-faint')}>Ответить в тред</span>
                          <select
                            ref={picker}
                            value={chosen ?? ''}
                            onChange={(e) => {
                              setPickedThread((p) => ({ ...p, [thread.id]: e.target.value }))
                              setPickerHot(false)
                            }}
                            className={cn(inputClass, 'min-h-9 w-auto min-w-0 max-w-full py-1', pickerHot && 'border-warn ring-1 ring-warn')}
                          >
                            {choices.map((c) => (
                              <option key={c.id} value={c.id}>{c.label || choiceLabel(c.id)}</option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      {replyTo ? (
                        <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full bg-surface-2 py-1 pr-1 pl-3 text-xs text-muted">
                          <ArrowBendUpLeft size={12} aria-hidden="true" />
                          <span className="truncate">Ответ на: {replyTo.text.slice(0, 60)}</span>
                          <button type="button" onClick={() => setReplyTo(null)} aria-label="Не отвечать на сообщение" className="grid size-6 place-items-center rounded-full hover:bg-surface-3">
                            <X size={12} aria-hidden="true" />
                          </button>
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mx-auto flex max-w-2xl items-end gap-2">
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">Ответ клиенту</span>
                      <textarea
                        value={draft}
                        rows={2}
                        maxLength={2000}
                        placeholder="Ответ клиенту. Enter отправляет, Shift+Enter новая строка"
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (sendsOnEnter({ key: e.key, shiftKey: e.shiftKey, isComposing: e.nativeEvent.isComposing })) {
                            e.preventDefault()
                            void send()
                          }
                        }}
                        className={cn(inputClass, 'max-h-40 resize-y')}
                      />
                    </label>
                    <button type="submit" disabled={!draft.trim() || sending} className={cn(btnPrimary, 'shrink-0')}>
                      <PaperPlaneTilt size={16} weight="fill" aria-hidden="true" />
                      Отправить
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        ) : null}
      </div>
      <Toast message={toast} onClose={closeToast} />
    </div>
  )
}


export function ChatsPage() {
  return (
    <RatingsProvider>
      <ChatsPageInner />
    </RatingsProvider>
  )
}
