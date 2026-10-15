'use client'

import { List, X } from '@phosphor-icons/react'
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { Dict } from '@/content'
import { buttonStyles, cn, homeAnchor } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { Logo } from './logo'
import { ScrollProgress } from './scroll-progress'

export function Header({ locale, dict }: { locale: Locale; dict: Dict }) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { scrollY } = useScroll()

  // Only flips a boolean when crossing the threshold, so React re-renders twice per page, not per frame.
  useMotionValueEvent(scrollY, 'change', (y) => {
    const next = y > 12
    if (next !== scrolled) setScrolled(next)
  })

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const other: Locale = locale === 'ru' ? 'en' : 'ru'
  const otherPath = pathname.replace(/^\/(ru|en)(?=\/|$)/, `/${other}`)

  const links = [
    { href: homeAnchor(locale, 'services'), label: dict.nav.services },
    { href: homeAnchor(locale, 'examples'), label: dict.nav.examples },
    { href: homeAnchor(locale, 'pricing'), label: dict.nav.pricing },
    { href: homeAnchor(locale, 'process'), label: dict.nav.process },
    { href: homeAnchor(locale, 'faq'), label: dict.nav.faq },
  ]

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-[background-color,border-color] duration-300',
        scrolled || open
          ? 'border-b border-line bg-bg/80 backdrop-blur-xl'
          : 'border-b border-transparent',
      )}
    >
      <ScrollProgress />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:h-[72px] md:px-8">
        <Link href={`/${locale}`} aria-label="Fir Tech" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label={dict.nav.menu}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted transition-colors hover:text-fg"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <Link
            href={otherPath}
            hrefLang={other}
            className="rounded-full px-3 py-2 font-mono text-xs uppercase text-muted transition-colors hover:text-fg"
          >
            {other}
          </Link>
          <Link
            href={homeAnchor(locale, 'contact')}
            className={cn(buttonStyles.small, 'hidden sm:inline-flex')}
          >
            {dict.nav.cta}
          </Link>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-full border border-line-strong lg:hidden"
            aria-expanded={open}
            aria-label={open ? dict.nav.close : dict.nav.menu}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={18} /> : <List size={18} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            key="mobile"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="h-[calc(100dvh-64px)] border-t border-line bg-bg px-4 pt-6 lg:hidden"
            aria-label={dict.nav.menu}
          >
            <ul className="flex flex-col">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block border-b border-line py-4 text-2xl font-medium tracking-tight"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={homeAnchor(locale, 'contact')}
              onClick={() => setOpen(false)}
              className={cn(buttonStyles.primary, 'mt-8 w-full')}
            >
              {dict.nav.cta}
            </Link>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}
