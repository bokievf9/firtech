'use client'

import { ArrowRight, TelegramLogo } from '@phosphor-icons/react'
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { buttonStyles, cn, homeAnchor } from '@/lib/cn'
import { telegramUrl } from '@/lib/site'

// Phone-only bar with the main action, shown once the hero is scrolled away and hidden again
// while the contact form itself is on screen (no point pointing at what you are looking at).
export function MobileCta({
  locale,
  label,
  telegramLabel,
}: {
  locale: string
  label: string
  telegramLabel: string
}) {
  const pathname = usePathname()
  const { scrollY } = useScroll()
  const [pastHero, setPastHero] = useState(false)
  const [atForm, setAtForm] = useState(false)

  useMotionValueEvent(scrollY, 'change', (y) => {
    const next = y > window.innerHeight * 0.8
    if (next !== pastHero) setPastHero(next)
  })

  useEffect(() => {
    const target = document.getElementById('contact')
    if (!target) return
    const io = new IntersectionObserver(([entry]) => setAtForm(entry?.isIntersecting ?? false), {
      rootMargin: '0px 0px -30% 0px',
    })
    io.observe(target)
    return () => io.disconnect()
  }, [])

  // The builder has its own bottom bar with the running total.
  const show = pastHero && !atForm && !pathname.endsWith('/builder')

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 96, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 96, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="print-hidden fixed inset-x-3 bottom-3 z-40 flex gap-2 rounded-full border border-line-strong bg-bg/85 p-1.5 backdrop-blur-xl sm:hidden"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <Link
            href={homeAnchor(locale, 'contact')}
            data-cta="mobile_bar"
            className={cn(buttonStyles.primary, 'flex-1 py-3')}
          >
            {label}
            <ArrowRight size={16} />
          </Link>
          {telegramUrl && (
            <a
              href={telegramUrl}
              data-place="mobile-cta"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={telegramLabel}
              className="flex size-12 shrink-0 items-center justify-center rounded-full border border-line-strong text-tg"
            >
              <TelegramLogo size={20} weight="fill" />
            </a>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
