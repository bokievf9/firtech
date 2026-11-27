'use client'

import { ArrowUpRight, ChatCircleDots, MagnifyingGlass } from '@phosphor-icons/react'
import Link from 'next/link'
import { useId, useState } from 'react'
import { notFoundLinks, notFoundText, searchPages } from '@/content/not-found'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { openChat } from '../chat/chat-events'
import { FiraFlat } from '../fira/fira-flat'

// The 404 page (404s.design patterns: a playful scene, a way out right there). A giant «404» whose
// zero is a turning ring, the receptionist «lost» in the chat, a search over the site's main pages
// and quick links back. `withChat`: the chat widget exists (inside the locale layout).
export function NotFoundView({ locale, withChat = true }: { locale: Locale; withChat?: boolean }) {
  const t = notFoundText[locale]
  const [query, setQuery] = useState('')
  const inputId = useId()
  const results = searchPages(t.pages, query).slice(0, 6)
  const links = notFoundLinks(locale)

  return (
    <section data-not-found className="relative isolate mx-auto flex min-h-[100dvh] site-container flex-col justify-center overflow-hidden pt-28 pb-20">
      <div
        aria-hidden="true"
        className="hero-aurora pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(70%_70%_at_60%_40%,black,transparent)]"
      />
      <div className="grid items-center gap-12 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
          <p
            aria-hidden="true"
            className="nf-float mt-4 flex items-center font-display text-[clamp(7rem,4rem+14vw,15rem)] leading-[0.85] font-semibold tracking-[-0.06em]"
          >
            4
            <span className="relative mx-[0.04em] inline-grid size-[0.78em] place-items-center">
              <span className="nf-spin absolute inset-0 rounded-full border-[0.09em] border-dashed border-accent-text/70" />
              <span className="size-[0.22em] rounded-full bg-accent" />
            </span>
            4
          </p>
          <h1 className="mt-6 font-display text-title font-semibold">{t.title}</h1>
          <p className="mt-4 max-w-[44ch] text-lead text-muted">{t.text}</p>
        </div>

        <div className="lg:col-span-6">
          <div className="glass grid gap-3 rounded-panel p-5 md:p-6">
            <FiraFlat emotion="sorry" className="block size-20" />
            <p className="max-w-[90%] rounded-[18px] rounded-bl-md bg-surface-2 px-4 py-3 text-[15px] leading-snug">
              {t.bot}
            </p>
            <p className="max-w-[90%] rounded-[18px] rounded-bl-md bg-surface-2 px-4 py-3 text-[15px] leading-snug">
              {t.bot2}
            </p>
            <label htmlFor={inputId} className="sr-only">
              {t.search}
            </label>
            <div className="relative mt-1">
              <MagnifyingGlass
                size={18}
                aria-hidden="true"
                className="absolute top-1/2 left-4 -translate-y-1/2 text-faint"
              />
              <input
                id={inputId}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.placeholder}
                autoComplete="off"
                className="ym-disable-keys w-full rounded-xl border border-line-strong bg-bg/70 py-3.5 pr-4 pl-11 text-[15px] placeholder:text-faint focus:border-accent-text/60 focus:outline-none"
              />
            </div>
            {query.trim() ? (
              results.length ? (
                <ul className="grid gap-1.5" aria-live="polite">
                  {results.map((r) => (
                    <li key={r.path}>
                      <Link
                        href={`/${locale}${r.path}`}
                        className="group flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5 text-sm transition-colors hover:border-accent-text/40"
                      >
                        {r.label}
                        <ArrowUpRight size={14} aria-hidden="true" className="shrink-0 text-faint group-hover:text-accent-text" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-1 text-sm text-muted" aria-live="polite">
                  {t.empty}
                </p>
              )
            ) : (
              <ul className="flex flex-wrap gap-2">
                {links.map((link) => (
                  <li key={link.id}>
                    <Link
                      href={link.href}
                      className={cn(
                        'inline-flex rounded-full border px-3.5 py-2 text-sm transition-colors',
                        link.id === 'home'
                          ? 'border-accent-text bg-accent/10 text-fg'
                          : 'border-accent-text/30 text-muted hover:border-accent-text/60 hover:text-fg',
                      )}
                    >
                      {t.links[link.id]}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/${locale}`} data-fira-target="home" className={buttonStyles.primary}>
              {t.home}
            </Link>
            {withChat && (
              <button type="button" onClick={() => openChat('404')} className={buttonStyles.secondary}>
                <ChatCircleDots size={18} weight="fill" aria-hidden="true" className="text-accent-text" />
                {t.chat}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
