'use client'

import { ArrowLeft, ChatCircleText, PaperPlaneTilt, Paperclip } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { errText, hq } from '@/components/admin/control/api'
import { Toast, type ToastMessage } from '@/components/admin/control/toast'
import { btnPrimary, inputClass, modalOpen, Offline, typingIn, useHqView } from '@/components/admin/hub/ui'
import { Chip } from '@/components/admin/pult/bits'
import { ThemeToggle } from '@/components/admin/theme-toggle'
import { cn } from '@/lib/cn'
import {
  CHANNEL_LABELS,
  mergeMessages,
  normalizeChats,
  normalizeReply,
  normalizeThreadView,
  replyNote,
  sendsOnEnter,
  threadLinks,
  type Channel,
  type ChatMessage,
  type ChatThread,
  type ChatThreadView,
} from '@/lib/chats'

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

export function ChatsPage() {
  const router = useRouter()
  const desktop = useDesktop()
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const notify = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => setToast({ id: Date.now() + Math.random(), text, tone }), [])
  const closeToast = useCallback(() => setToast(null), [])
  const [scope, setScope] = useState<'open' | 'all'>('open')
  const [channel, setChannel] = useState<Channel | 'all'>('all')
  const [sel, setSel] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const list = useHqView(`chats?status=${scope}&limit=100`, normalizeChats, { visible: 30_000, hidden: 120_000 })
  const threads = useMemo(() => (list.view?.items ?? []).filter((t) => channel === 'all' || t.channels.includes(channel)), [list.view, channel])
  const activeId = sel ?? (desktop ? (threads[0]?.id ?? null) : null)
  // Only the open thread refreshes (30 s), and not at all while the tab is hidden.
  const open = useHqView(activeId ? `chats/${encodeURIComponent(activeId)}` : null, normalizeThreadView, { visible: 30_000, hidden: 86_400_000 })
  const thread: ChatThread | null = open.view && !open.stale ? open.view.thread : (threads.find((t) => t.id === activeId) ?? null)
  const messages = open.view && !open.stale ? open.view.messages : []
  const unread = list.view?.unread ?? 0

  const end = useRef<HTMLDivElement>(null)
  const last = messages.at(-1)?.id
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [last, activeId])

  // Opening an unread thread clears its badge in the list at once (HQ counts it read when the owner answers).
  const { mutate: mutateList } = list
  const { mutate: mutateOpen } = open

  const send = async () => {
    const text = draft.trim()
    if (!text || sending || !thread) return
    setSending(true)
    const id = `local_${Date.now()}`
    const local: ChatMessage = { id, at: new Date().toISOString(), from: 'owner', channel: thread.channels.includes('cabinet') ? 'cabinet' : (thread.channels[0] ?? 'web'), text, attachments: [] }
    setDraft('')
    mutateOpen((v) => ({ ...v, messages: [...v.messages, local] }))
    const res = await hq<Record<string, unknown>>(`chats/${encodeURIComponent(thread.id)}/reply`, { text })
    setSending(false)
    const out = res.ok ? normalizeReply(res) : null
    if (!out) {
      mutateOpen((v) => ({ ...v, messages: v.messages.filter((m) => m.id !== id) }))
      setDraft(text)
      notify(res.ok ? errText('hq_bad_response') : errText(res.error), 'error')
      return
    }
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
      else router.push('/admin/office')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [desktop, sel, router])

  const showList = desktop || !sel
  const showThread = desktop || !!sel

  return (
    <div className="fixed inset-0 flex flex-col bg-bg text-fg">
      <header className="flex min-h-14 items-center gap-2 border-b border-line px-2 sm:gap-3 sm:px-4">
        {!desktop && sel ? (
          <button type="button" onClick={() => setSel(null)} aria-label="К списку чатов" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm">
            <ArrowLeft size={16} aria-hidden="true" />
            Чаты
          </button>
        ) : (
          <Link href="/admin/office" aria-label="Назад в офис" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm hover:border-accent hover:text-accent-text">
            <ArrowLeft size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Офис</span>
          </Link>
        )}
        <h1 className="font-brand text-sm tracking-wide sm:text-base">Чаты</h1>
        {unread ? <span className="rounded-full bg-accent px-2.5 py-1 font-mono text-xs tabular-nums text-accent-ink" aria-label={`Непрочитанных: ${unread}`}>{unread}</span> : null}
        <div className="ml-auto flex items-center gap-2">
          <Link href="/admin/review" className="hidden h-10 items-center rounded-full border border-line-strong px-3 text-sm hover:border-accent hover:text-accent-text sm:inline-flex">Ревью</Link>
          <ThemeToggle />
        </div>
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
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {list.error && !list.view ? <li><Offline error={list.error} onRetry={() => void list.reload()} /></li> : null}
              {!list.view && !list.error ? <li role="status" className="p-4 text-sm text-muted">Загружаю чаты</li> : null}
              {list.view && !threads.length ? <li className="p-4 text-sm text-muted">Чатов нет.</li> : null}
              {threads.map((t) => {
                const active = t.id === activeId
                return (
                  <li key={t.id} className="border-b border-line">
                    <button type="button" onClick={() => setSel(t.id)} aria-current={active} className={cn('grid w-full gap-1 p-3 text-left transition-colors', active ? 'bg-surface-2' : 'hover:bg-surface-2/60')}>
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn('truncate text-sm', t.unread ? 'font-semibold' : 'font-medium')}>{t.client.name}</span>
                        <span className="shrink-0 font-mono text-xs text-faint">{time(t.lastAt)}</span>
                      </span>
                      <span className={cn('line-clamp-2 text-sm', t.unread ? 'text-fg' : 'text-muted')}>{t.preview || 'Без текста'}</span>
                      <span className="flex flex-wrap items-center gap-1">
                        <ChannelChips channels={t.channels} />
                        {t.leadId !== null ? <Chip tone="accent">лид #{t.leadId}</Chip> : null}
                        {t.ticketId !== null ? <Chip tone={t.openTicket ? 'warn' : 'plain'}>тикет #{t.ticketId}</Chip> : null}
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
                  <div className="ml-auto flex flex-wrap gap-x-3">
                    {threadLinks(thread).map((l) => (
                      <Link key={l.href} href={l.href} className="inline-flex min-h-9 items-center text-sm text-accent-text underline">{l.label}</Link>
                    ))}
                  </div>
                </div>

                <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4', open.stale && 'opacity-60')} aria-live="polite">
                  {open.error && !open.view ? <Offline error={open.error} onRetry={() => void open.reload()} /> : null}
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
                            <span className="mt-0.5 px-1 font-mono text-xs text-faint">
                              {m.from === 'hq' ? 'Fir Tech' : m.from === 'owner' ? 'Вы' : 'Клиент'}, {CHANNEL_LABELS[m.channel]}, {time(m.at)}
                            </span>
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
