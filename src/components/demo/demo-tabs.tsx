'use client'

import { ArrowRight, ArrowUpRight } from '@phosphor-icons/react'
import Link from 'next/link'
import { useId, useRef, useState } from 'react'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import { ChatOpenButton } from '../chat/chat-open-button'
import { DemoAssistant } from './demo-assistant'
import { DemoBooking } from './demo-booking'
import { DemoBuilt } from './demo-built'
import { DemoChat } from './demo-chat'
import { DemoOffice } from './demo-office'

export type DemoArticle = { slug: string; title: string; description: string; date: string; dateLabel: string }

export const demoTabIds = ['receptionist', 'admin', 'automation', 'content', 'miniapp', 'agent', 'implementation'] as const
export type DemoTabId = (typeof demoTabIds)[number]

// The tabs of #demo (owner 2026-11-22), one per product, all seven: the receptionist chat with a niche
// selector (live), the latest blog articles and the live office counts, and labelled «Пример» the
// booking dialogue, the process chain, the Mini App phone and the assistant's scripted chat. Arrow keys move between the tabs; the chat stays mounted so a
// conversation survives a switch.
export function DemoTabs({
  dict,
  locale,
  articles,
  names,
  buildHrefs,
}: {
  dict: Dict
  locale: 'ru' | 'en'
  articles: DemoArticle[]
  names: Record<DemoTabId, string>
  buildHrefs: Record<DemoTabId, string>
}) {
  const t = dict.demoSection
  const base = useId()
  const [active, setActive] = useState<DemoTabId>('receptionist')
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({})

  function onKey(e: React.KeyboardEvent, index: number) {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!dir && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? demoTabIds.length - 1 : (index + dir + demoTabIds.length) % demoTabIds.length
    const id = demoTabIds[next]!
    setActive(id)
    tabs.current[id]?.focus()
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={t.tabsLabel}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
      >
        {demoTabIds.map((id, i) => (
          <button
            key={id}
            ref={(el) => {
              tabs.current[id] = el
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${id}`}
            aria-selected={active === id}
            aria-controls={`${base}-panel-${id}`}
            tabIndex={active === id ? 0 : -1}
            data-demo-tab={id}
            onClick={() => setActive(id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'shrink-0 rounded-full border px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-[border-color,background-color] duration-200',
              active === id ? 'border-accent-text bg-accent/10 text-fg' : 'border-line-strong text-muted hover:border-fg/40 hover:text-fg',
            )}
          >
            {names[id]}
          </button>
        ))}
      </div>

      <div className="mt-8">
        <div role="tabpanel" id={`${base}-panel-receptionist`} aria-labelledby={`${base}-tab-receptionist`} hidden={active !== 'receptionist'}>
          <DemoChat copy={t.receptionist} locale={locale} />
        </div>
        <div role="tabpanel" id={`${base}-panel-admin`} aria-labelledby={`${base}-tab-admin`} hidden={active !== 'admin'}>
          {active === 'admin' && <DemoBooking copy={t.admin} badge={t.exampleBadge} />}
        </div>
        <div role="tabpanel" id={`${base}-panel-automation`} aria-labelledby={`${base}-tab-automation`} hidden={active !== 'automation'}>
          {active === 'automation' && <DemoBuilt dict={dict} locale={locale} product="automation" intro={t.automation.intro} badge={t.exampleBadge} />}
        </div>
        <div role="tabpanel" id={`${base}-panel-miniapp`} aria-labelledby={`${base}-tab-miniapp`} hidden={active !== 'miniapp'}>
          {active === 'miniapp' && <DemoBuilt dict={dict} locale={locale} product="miniapp" intro={t.miniapp.intro} badge={t.exampleBadge} />}
        </div>
        <div role="tabpanel" id={`${base}-panel-agent`} aria-labelledby={`${base}-tab-agent`} hidden={active !== 'agent'}>
          {active === 'agent' && <DemoAssistant copy={t.agent} badge={t.exampleBadge} />}
        </div>
        <div role="tabpanel" id={`${base}-panel-content`} aria-labelledby={`${base}-tab-content`} hidden={active !== 'content'}>
          {active === 'content' && (
            <div>
              <p className="max-w-[56ch] text-muted">{t.content.intro}</p>
              {articles.length === 0 ? (
                <p className="mt-6 text-sm text-faint">{t.content.empty}</p>
              ) : (
                <ul className="mt-6 grid gap-gutter md:grid-cols-3" data-demo-articles>
                  {articles.map((a) => (
                    <li key={a.slug}>
                      <Link
                        href={`/${locale}/blog/${a.slug}`}
                        className="group flex h-full flex-col rounded-card border border-line bg-surface p-5 transition-colors hover:border-line-strong md:p-6"
                      >
                        <time dateTime={a.date} className="font-mono text-xs text-faint">
                          {a.dateLabel}
                        </time>
                        <span className="mt-3 text-lg leading-snug font-semibold">{a.title}</span>
                        <span className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{a.description}</span>
                        <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-medium text-accent-text">
                          {t.content.read}
                          <ArrowUpRight size={14} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={`/${locale}/blog`} className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted underline decoration-line-strong underline-offset-4 hover:text-accent-text">
                {t.content.all}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
        <div role="tabpanel" id={`${base}-panel-implementation`} aria-labelledby={`${base}-tab-implementation`} hidden={active !== 'implementation'}>
          {active === 'implementation' && (
            <div>
              <DemoOffice copy={t.implementation} live={dict.proof.live} />
              <Link href={`/${locale}/ai-team`} className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-fg underline decoration-line-strong underline-offset-4 hover:text-accent-text">
                {t.implementation.cta}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link href={buildHrefs[active]} data-cta={`demo_build_${active}`} className={cn(buttonStyles.primary, 'group')}>
          {t.cta}
          <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
        <ChatOpenButton source="demo" fallbackHref="#demo" className={buttonStyles.secondary}>
          {t.ask}
        </ChatOpenButton>
      </div>
    </div>
  )
}
