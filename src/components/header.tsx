'use client'

import { ArrowUpRight, ChatCircleDots, List, UserCircle, X } from '@phosphor-icons/react'
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { Dict } from '@/content'
import { buttonStyles, cn, homeAnchor } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { openChat } from './chat/chat-events'
import { Logo } from './logo'
import { ScrollProgress } from './scroll-progress'

// Site header (stage A, navbar.gallery patterns): a full-width transparent bar on top of the page
// that condenses into a floating glass pill once the page scrolls; a hover highlight slides
// between the links; locale switch as a two-letter segmented control; one clear CTA. Phones get a
// full-screen sheet with large links (Esc closes, focus moves in and back, page scroll locked).
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
  const menuButton = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll()

  // Only flips a boolean when crossing the threshold, so React re-renders twice per page, not per frame.
  useMotionValueEvent(scrollY, 'change', (y) => {
    const next = y > 24
    if (next !== scrolled) setScrolled(next)
  })

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(
      () => sheetRef.current?.querySelector<HTMLElement>('a, button')?.focus(),
      50,
    )
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const button = menuButton.current
    return () => {
      document.body.style.overflow = ''
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      button?.focus()
    }
  }, [open])

  const other: Locale = locale === 'ru' ? 'en' : 'ru'
  const otherPath = pathname.replace(/^\/(ru|en)(?=\/|$)/, `/${other}`)

  const links = [
    { href: homeAnchor(locale, 'products'), label: dict.nav.products },
    { href: homeAnchor(locale, 'demo'), label: dict.nav.demo },
    { href: homeAnchor(locale, 'pricing'), label: dict.nav.pricing },
    { href: `/${locale}/builder`, label: dict.nav.builder },
    { href: homeAnchor(locale, 'process'), label: dict.nav.process },
    { href: homeAnchor(locale, 'faq'), label: dict.nav.faq },
  ]

  const localeSwitch = (
    <div className="flex items-center rounded-full border border-line p-0.5 font-mono text-[11px] uppercase">
      <span aria-current="true" className="rounded-full bg-fg/10 px-2 py-1 text-fg">
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
    <header className="print-hidden fixed inset-x-0 top-0 z-40">
      <ScrollProgress />
      <div
        className={cn(
          'mx-auto flex items-center justify-between transition-[max-width,height,margin,padding,background-color,border-color,box-shadow] duration-500 ease-out-expo',
          scrolled
            ? 'glass mx-3 mt-3 h-14 max-w-5xl rounded-full pr-2 pl-5 md:mx-auto'
            : 'h-16 max-w-7xl border border-transparent px-4 md:h-[72px] md:px-8',
        )}
      >
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
              className="relative rounded-full px-3.5 py-2 text-sm text-muted transition-colors hover:text-fg focus-visible:text-fg"
            >
              {hovered === link.href ? (
                <motion.span
                  layoutId="nav-hover"
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 rounded-full bg-fg/[0.07]"
                  transition={
                    reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }
                  }
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
              className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted transition-colors hover:text-fg lg:inline-flex"
            >
              <UserCircle size={18} aria-hidden="true" />
              {dict.nav.cabinet}
            </Link>
          )}
          <div className="hidden sm:block">{localeSwitch}</div>
          <Link
            href={homeAnchor(locale, 'contact')}
            data-cta="header"
            className={cn(buttonStyles.small, 'hidden sm:inline-flex')}
          >
            {dict.nav.cta}
          </Link>
          <button
            ref={menuButton}
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-full border border-line-strong lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? dict.nav.close : dict.nav.menu}
            onClick={() => setOpen((v) => !v)}
          >
            <List size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            key="sheet"
            id="mobile-menu"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={dict.nav.menu}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex flex-col bg-bg/95 px-5 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden"
          >
            <div className="flex h-12 items-center justify-between">
              <Link href={`/${locale}`} aria-label="Fir Tech" onClick={() => setOpen(false)}>
                <Logo />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={dict.nav.close}
                className="inline-flex size-10 items-center justify-center rounded-full border border-line-strong"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <nav className="mt-8 flex-1 overflow-y-auto" aria-label={dict.nav.menu}>
              <ul className="flex flex-col">
                {links.map((link, i) => (
                  <motion.li
                    key={link.href}
                    initial={reduce ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.04 + i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="group flex items-center justify-between border-b border-line py-4 font-display text-[2rem] leading-none font-semibold tracking-tight"
                    >
                      {link.label}
                      <ArrowUpRight
                        size={22}
                        aria-hidden="true"
                        className="text-faint transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent"
                      />
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </nav>
            <div className="grid gap-3 pt-6">
              <Link
                href={homeAnchor(locale, 'contact')}
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
                  <UserCircle size={18} aria-hidden="true" className="text-accent" />
                  {dict.nav.cabinet}
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
                  className="text-accent"
                />
                {dict.hero.chatCta}
              </button>
              <div className="flex justify-center pt-2">{localeSwitch}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
