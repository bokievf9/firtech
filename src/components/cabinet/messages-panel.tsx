'use client'

import { Briefcase, ClipboardText, Lifebuoy, Robot } from '@phosphor-icons/react'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { Dict } from '@/content'
import { formatDate, type CabinetTicket } from '@/lib/cabinet-data'
import { parseThreads, sortThreads, threadFor, unreadTotal, type ChatThread, type ThreadKind } from '@/lib/cabinet-chat'
import { buttonStyles, cn } from '@/lib/cn'
import { COUNTS_EVENT } from './cabinet-tabs'
import { TicketsPanel } from './cabinet-forms'
import { ThreadPane } from './thread-pane'
import { useWide } from './use-wide'
import { Empty, fill } from './ui'

// «Сообщения» (cabinet v3, owner 2026-11-22: «чат очень неудобный: темы по каждому проекту и заявке»):
// a messenger. The thread list (one per request, project, support and the client's own agent) with
// unread badges, the conversation next to it (on phones it replaces the list), the composer. The open
// thread refreshes every 15 s while the page is visible (thread-pane.tsx); the list does the same.
// `?ref=lead-12` opens that request's thread (links from the cards).
const POLL_MS = 15_000
const icons: Record<ThreadKind, typeof Briefcase> = { lead: ClipboardText, project: Briefcase, agent: Robot, support: Lifebuoy }
const TICKET = 'ticket'

export function MessagesPanel({
  dict,
  locale,
  initial,
  tickets,
}: {
  dict: Dict
  locale: string
  initial: ChatThread[]
  tickets: CabinetTicket[]
}) {
  const t = dict.cabinet.v3.messages
  const search = useSearchParams()
  const [threads, setThreads] = useState(() => sortThreads(initial))
  const [selected, setSelected] = useState<string | null>(null)
  const ref = search.get('ref')

  const publish = useCallback((list: ChatThread[]) => {
    window.dispatchEvent(new CustomEvent(COUNTS_EVENT, { detail: { messages: unreadTotal(list) } }))
  }, [])

  // A link with `?ref=` picks its thread (only a NEW value decides, list updates never move the selection);
  // on wide screens the first thread is shown when none is chosen.
  const wide = useWide()
  const [seen, setSeen] = useState<string | null>(null)
  if (ref !== seen) {
    setSeen(ref)
    const wanted = threadFor(threads, ref)
    if (wanted) setSelected(wanted.id)
  }

  useEffect(() => {
    let alive = true
    async function load() {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/api/cabinet/threads', { cache: 'no-store' })
        const body = (await res.json().catch(() => null)) as { ok?: boolean; threads?: unknown } | null
        if (alive && res.ok && body?.ok) {
          const next = sortThreads(parseThreads(body.threads))
          setThreads(next)
          publish(next)
        }
      } catch {
        // Offline for a moment: the next tick tries again.
      }
    }
    const timer = window.setInterval(load, POLL_MS)
    const onVisible = () => void load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [publish])

  const onRead = useCallback(
    (id: string) => {
      setThreads((list) => {
        const next = list.map((x) => (x.id === id ? { ...x, unread: 0 } : x))
        publish(next)
        return next
      })
    },
    [publish],
  )

  const active = threads.find((x) => x.id === selected) ?? (selected === null && wide ? (threads[0] ?? null) : null)
  const showTicket = selected === TICKET
  const hasSupport = threads.some((x) => x.kind === 'support')
  const paneOpen = selected !== null

  return (
    <section aria-labelledby="cabinet-messages-title" data-cabinet-messages>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="cabinet-messages-title" className="font-display text-2xl font-semibold tracking-tight">
          {t.title}
        </h2>
        <p className="text-[13px] text-faint">{t.live}</p>
      </div>

      {threads.length === 0 && !showTicket ? (
        <div className="mt-5 grid justify-items-start gap-4 rounded-card border border-line bg-surface p-6 md:p-8">
          <Empty>{t.noThreads}</Empty>
          <button type="button" onClick={() => setSelected(TICKET)} className={buttonStyles.secondary}>
            {t.supportCta}
          </button>
        </div>
      ) : (
        <div className="mt-5 grid h-[min(78dvh,720px)] min-h-[520px] overflow-hidden rounded-card border border-line bg-surface lg:grid-cols-[19rem_minmax(0,1fr)]">
          <nav aria-label={t.listLabel} className={cn('flex min-h-0 flex-col border-line lg:border-r', paneOpen && 'hidden lg:flex')}>
            <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
              {threads.map((x) => {
                const Icon = icons[x.kind]
                return (
                  <li key={x.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(x.id)}
                      aria-current={x.id === active?.id ? 'true' : undefined}
                      data-thread-item={x.id}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors',
                        x.id === active?.id ? 'bg-accent/[0.07]' : 'hover:bg-fg/[0.03]',
                      )}
                    >
                      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={cn('truncate text-[15px]', x.unread > 0 ? 'font-semibold text-fg' : 'font-medium')}>
                            {x.title || t.kind[x.kind]}
                          </span>
                          {x.unread > 0 && (
                            <span
                              aria-label={fill(t.unread, { n: String(x.unread) })}
                              className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 font-mono text-[11px] leading-5 text-accent-ink"
                            >
                              {x.unread}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2 font-mono text-[11px] text-faint">
                          <span className="tracking-[0.08em] uppercase">{t.kind[x.kind]}</span>
                          {x.lastAt && <span>{formatDate(x.lastAt, locale)}</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {!hasSupport && (
              <div className="border-t border-line p-3">
                <button
                  type="button"
                  onClick={() => setSelected(TICKET)}
                  className={cn(buttonStyles.secondary, 'w-full !py-2.5 text-sm')}
                  data-support-cta
                >
                  <Lifebuoy size={18} aria-hidden="true" />
                  {t.supportCta}
                </button>
              </div>
            )}
          </nav>

          <div className={cn('flex min-h-0 flex-col', !paneOpen && 'hidden lg:flex')}>
            {active ? (
              <ThreadPane
                key={active.id}
                thread={active}
                dict={dict}
                locale={locale}
                onRead={onRead}
                onBack={() => setSelected(null)}
                agentReply={active.kind === 'agent'}
                className="h-full"
              />
            ) : showTicket ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
                <button type="button" onClick={() => setSelected(null)} className="mb-3 text-sm text-muted hover:text-fg lg:hidden">
                  {t.back}
                </button>
                <h3 className="font-display text-lg font-semibold tracking-tight">{t.supportTitle}</h3>
                <div className="mt-4">
                  <TicketsPanel dict={dict} locale={locale as 'ru' | 'en'} initial={tickets} />
                </div>
              </div>
            ) : (
              <div className="grid flex-1 place-items-center p-10 text-center text-sm text-muted">{t.pick}</div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
