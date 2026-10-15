'use client'

import { Check, PaperPlaneTilt, TelegramLogo, UserCircle } from '@phosphor-icons/react'
import { AnimatePresence, motion, useInView } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import { useReducedMotion } from '@/lib/use-reduced-motion'

// A working miniature of what we sell: an enquiry sent from a website lands in Telegram and in
// the CRM. Phases: 0 typing, 1 sent, 2 Telegram alert, 3 CRM updated; then it loops.
const PHASE_MS = [2600, 1100, 1500, 3400]
const ease = [0.16, 1, 0.3, 1] as const

export function LeadFlowDemo({ t }: { t: Dict['hero']['demo'] }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.3 })
  const [phase, setPhase] = useState(0)
  const [cycle, setCycle] = useState(0)
  const shown = reduce ? 3 : phase

  useEffect(() => {
    if (reduce || !inView) return
    const timer = setTimeout(() => {
      if (phase === PHASE_MS.length - 1) {
        setPhase(0)
        setCycle((c) => c + 1)
      } else {
        setPhase(phase + 1)
      }
    }, PHASE_MS[phase])
    return () => clearTimeout(timer)
  }, [phase, inView, reduce])

  return (
    <figure ref={ref} className="relative">
      <div className="relative grid gap-3 md:gap-4">
        {/* Website form */}
        <div className="rounded-card border border-line bg-surface p-5 md:mr-16">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium">{t.siteTitle}</span>
            <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[11px] text-muted">
              {t.site}
            </span>
          </div>
          <div className="grid gap-2.5">
            <Field>
              <Typed key={`n${cycle}`} text={t.name} active={!reduce} />
            </Field>
            <Field>
              <Typed key={`t${cycle}`} text={t.task} active={!reduce} delay={1.1} />
            </Field>
          </div>
          <div
            className={cn(
              'mt-4 flex h-10 items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors duration-500',
              shown >= 1 ? 'bg-pine text-accent' : 'bg-accent text-accent-ink',
            )}
          >
            {shown >= 1 ? <Check size={16} weight="bold" /> : <PaperPlaneTilt size={16} />}
            {shown >= 1 ? t.sent : t.send}
          </div>
        </div>

        {/* Telegram alert */}
        <div className="min-h-[132px] md:ml-16">
          <AnimatePresence mode="wait">
            {shown >= 2 && (
              <motion.div
                key={`tg${cycle}`}
                initial={reduce ? false : { opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                transition={{ duration: 0.6, ease }}
                className="rounded-card border border-line bg-surface-2 p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-[#2aabee]/15 text-[#5cc4f5]">
                    <TelegramLogo size={18} weight="fill" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{t.bot}</span>
                      <span className="font-mono text-[11px] text-faint">{t.botTime}</span>
                    </div>
                    <p className="text-sm text-accent">{t.botNew}</p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-bg/60 px-3.5 py-3 text-[13px]">
                  <dt className="text-faint">{t.botName}</dt>
                  <dd>{t.name}</dd>
                  <dt className="text-faint">{t.botTask}</dt>
                  <dd className="truncate">{t.task}</dd>
                </dl>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CRM row */}
        <div className="rounded-card border border-line bg-surface p-4 md:mr-8 md:ml-6">
          <div className="flex items-center gap-3">
            <UserCircle size={32} weight="duotone" className="shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{t.crmLead}</p>
              <p className="truncate text-[13px] text-faint">
                {t.crm}
                {shown >= 3 && <span> / {t.crmManager}</span>}
              </p>
            </div>
            <motion.span
              key={shown >= 3 ? 'work' : 'new'}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease }}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-xs font-medium',
                shown >= 3 ? 'bg-accent text-accent-ink' : 'border border-line-strong text-muted',
              )}
            >
              {shown >= 3 ? t.crmWork : t.crmNew}
            </motion.span>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 max-w-sm text-[13px] leading-relaxed text-faint">
        {t.caption}
      </figcaption>
    </figure>
  )
}

function Field({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-10 items-center rounded-xl border border-line bg-bg/60 px-3.5 text-sm">
      {children}
    </div>
  )
}

function Typed({ text, active, delay = 0 }: { text: string; active: boolean; delay?: number }) {
  const [count, setCount] = useState(active ? 0 : text.length)

  useEffect(() => {
    if (!active) return
    let i = 0
    let interval: ReturnType<typeof setInterval> | undefined
    const start = setTimeout(() => {
      interval = setInterval(() => {
        i += 1
        setCount(i)
        if (i >= text.length && interval) clearInterval(interval)
      }, 34)
    }, delay * 1000)
    return () => {
      clearTimeout(start)
      if (interval) clearInterval(interval)
    }
  }, [active, delay, text])

  return (
    <span className="truncate">
      {text.slice(0, count)}
      {active && count < text.length && count > 0 && (
        <span className="ml-px inline-block h-4 w-px translate-y-0.5 animate-pulse bg-accent" />
      )}
    </span>
  )
}
