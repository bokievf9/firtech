'use client'

import { ArrowUpRight, ChatCircleDots, List, UserCircle, X } from '@phosphor-icons/react'
import { motion, useMotionValueEvent, useScroll } from 'motion/react'
import Link from 'next/link'
import { CabinetNavLabel } from './cabinet/cabinet-nav-label'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { Dict } from '@/content'
import { buttonStyles, cn, homeAnchor } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { spring, staggerStep } from '@/lib/motion'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { IconButton } from './ui/button'
import { Sheet } from './ui/sheet'
import { openChat } from './chat/chat-events'
import { Logo } from './logo'
import { ScrollProgress } from './scroll-progress'
import { ThemeSwitch } from './theme-switch'

// Site header (design system v4, docs/design-system-v4.md «Шапка»): one stable floating bar. At the top of
// the page it is clear; once the page scrolls the thick material fades in behind it (opacity only, the
// geometry never changes, so nothing jumps), with a soft scroll edge instead of a divider line. A hover
// pill slides between the links on the ui spring; the locale is a two-letter segmented control; one
// clear CTA. Phones get the full-screen Sheet (ui/sheet.tsx): focus trapped, Esc closes, scroll locked.
export function Header({
  locale,
  dict,
  cabinet = false,
}: {
  locale: Locale
  dict: Dict
  cabinet?: boolean
}) {
  const pathname = usePathname()
  const reduce = useReducedMotion()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const { scrollY } = useScroll()

  // Only flips a boolean when crossing the threshold, so React re-renders twice per page, not per frame.
  useMotionValueEvent(scrollY, 'change', (y) => {
    const next = y > 24
    if (next !== scrolled) setScrolled(next)
  })

  const other: Locale = locale === 'ru' ? 'en' : 'ru'
  const otherPath = pathname.replace(/^\/(ru|en)(?=\/|$)/, `/${other}`)

  const links = [
    { href: homeAnchor(locale, 'products'), label: dict.nav.products },
    { href: `/${locale}/ai-team#agents`, label: dict.nav.agents },
    { href: `/${locale}/ai-team`, label: dict.nav.aiTeams },
    { href: `/${locale}/solutions`, label: dict.nav.solutions },
    { href: homeAnchor(locale, 'demo'), label: dict.nav.demo },
    { href: `/${locale}/how-we-work`, label: dict.nav.process },
    { href: homeAnchor(locale, 'pricing'), label: dict.nav.pricing },
  ]

  const localeSwitch = (
    <div className="flex items-center rounded-full bg-fill p-0.5 font-mono text-[11px] uppercase">
      <span aria-current="true" className="rounded-full bg-elevated px-2 py-1 text-fg shadow-card">
        {locale}
      </span>
      <Link
        href={otherPath}
        hrefLang={other}
        lang={other}
        className="rounded-full px-2 py-1 text-muted transition-colors hover:text-fg"
      >
        {other}
      </Link>
    </div>
  )

  return (
    <header className="print-hidden fixed inset-x-0 top-0 z-40 px-2 pt-2 md:px-3 md:pt-3">
      <ScrollProgress />
      <div
        className="relative mx-auto flex h-14 max-w-6xl items-center justify-between rounded-full pr-2 pl-5"
      >
        {/* The material: fades in behind the bar once the page scrolls (opacity only). */}
        <span
          aria-hidden="true"
          data-header-material
          className={cn(
            'material-thick pointer-events-none absolute inset-0 -z-10 rounded-full transition-opacity duration-300 ease-out-quint',
            scrolled ? 'opacity-100' : 'opacity-0',
          )}
        />
        <Link
          href={`/${locale}`}
          aria-label="Fir Tech"
          onClick={() => setOpen(false)}
          className="shrink-0"
        >
          <Logo />
        </Link>

        <nav
          className="hidden items-center lg:flex"
          aria-label={dict.nav.menu}
          onPointerLeave={() => setHovered(null)}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onPointerEnter={() => setHovered(link.href)}
              onFocus={() => setHovered(link.href)}
              onBlur={() => setHovered(null)}
              className="relative rounded-full px-3.5 py-2 text-callout text-muted transition-colors hover:text-fg focus-visible:text-fg"
            >
              {hovered === link.href ? (
                <motion.span
                  layoutId="nav-hover"
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 rounded-full bg-fill-strong"
                  transition={reduce ? { duration: 0 } : spring.snappy}
                />
              ) : null}
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {cabinet && (
            <Link
              href={`/${locale}/cabinet`}
              data-place="header-cabinet"
              className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-callout whitespace-nowrap text-muted transition-colors hover:text-fg lg:inline-flex"
            >
              <UserCircle size={18} aria-hidden="true" />
              {/* The longer label only from xl, so the bar never crowds at 1024px; it stays for screen readers. */}
              <span className="sr-only xl:not-sr-only">
                <CabinetNavLabel signedIn={dict.nav.cabinet} start={dict.nav.cabinetStart} />
              </span>
            </Link>
          )}
          <ThemeSwitch copy={dict.theme} className="hidden sm:inline-flex" />
          <div className="hidden sm:block">{localeSwitch}</div>
          <Link
            href={`/${locale}/builder`}
            data-cta="header"
            className={cn(buttonStyles.small, 'hidden sm:inline-flex')}
          >
            {dict.nav.cta}
          </Link>
          <IconButton
            label={open ? dict.nav.close : dict.nav.menu}
            tone="outline"
            className="lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <List size={18} aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} label={dict.nav.menu} side="top" id="mobile-menu" portal={false} className="px-5 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="flex h-12 items-center justify-between">
          <Link href={`/${locale}`} aria-label="Fir Tech" onClick={() => setOpen(false)}>
            <Logo />
          </Link>
          <IconButton label={dict.nav.close} tone="outline" onClick={() => setOpen(false)}>
            <X size={18} aria-hidden="true" />
          </IconButton>
        </div>
        <nav className="mt-6 flex-1 overflow-y-auto" aria-label={dict.nav.menu}>
          <ul className="flex flex-col">
            {links.map((link, i) => (
              <motion.li
                key={link.href}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring.ui, delay: 0.03 + i * staggerStep }}
              >
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="group flex items-center justify-between border-b border-b-hairline border-line py-4 font-display text-title-2 font-semibold"
                >
                  {link.label}
                  <ArrowUpRight
                    size={22}
                    aria-hidden="true"
                    className="text-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent-text"
                  />
                </Link>
              </motion.li>
            ))}
          </ul>
        </nav>
        <div className="grid gap-3 pt-6">
          <Link
            href={`/${locale}/builder`}
            data-cta="menu"
            onClick={() => setOpen(false)}
            className={cn(buttonStyles.primary, 'w-full')}
          >
            {dict.nav.cta}
          </Link>
          {cabinet && (
            <Link
              href={`/${locale}/cabinet`}
              onClick={() => setOpen(false)}
              className={cn(buttonStyles.secondary, 'w-full')}
            >
              <UserCircle size={18} aria-hidden="true" className="text-accent-text" />
              <CabinetNavLabel signedIn={dict.nav.cabinet} start={dict.nav.cabinetStart} />
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              openChat('menu')
            }}
            className={cn(buttonStyles.secondary, 'w-full')}
          >
            <ChatCircleDots
              size={18}
              weight="fill"
              aria-hidden="true"
              className="text-accent-text"
            />
            {dict.nav.ask}
          </button>
          <div className="flex items-center justify-center gap-3 pt-2">
            <ThemeSwitch copy={dict.theme} />
            {localeSwitch}
          </div>
        </div>
      </Sheet>
    </header>
  )
}
