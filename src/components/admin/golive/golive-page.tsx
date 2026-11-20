'use client'

import { ArrowLeft, ArrowUp } from '@phosphor-icons/react'
import { motion, MotionConfig, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ThemeToggle } from '@/components/admin/theme-toggle'
import { Toast, type ToastMessage } from '@/components/admin/control/toast'
import { fill, useClock, useGolive } from '@/components/admin/hub/golive'
import { btn, btnDanger, btnPrimary, useConfirm } from '@/components/admin/hub/ui'
import { goliveText as t } from '@/content/golive'
import { cn } from '@/lib/cn'
import { agoText, formatDeadline, GOLIVE_HOURS, remaining, type Remaining } from '@/lib/golive'
import { Checklist } from './checklist'
import { Digit } from './odometer'
import { StageField, type StageFieldHandle } from './stage-field'

const ease = [0.23, 1, 0.32, 1] as const

function Pair({ a, b, labels, dir, reduce, digitsA = 2 }: { a: number; b: number; labels: [string, string]; dir: 1 | -1; reduce: boolean; digitsA?: number }) {
  const cells = [
    { v: a, label: labels[0], digits: digitsA, key: 'a' },
    { v: b, label: labels[1], digits: 2, key: 'b' },
  ]
  return (
    <div className="flex items-start">
      {cells.map((c, i) => (
        <div key={c.key} className="flex items-start">
          {i === 1 ? <Colon /> : null}
          <div className="flex flex-col items-center">
            <span className="flex leading-none">
              {[...String(c.v).padStart(c.digits, '0')].map((ch, k) => (
                <Digit key={k} value={Number(ch)} dir={dir} reduce={reduce} />
              ))}
            </span>
            <span className="mt-[0.35em] font-sans text-xs font-normal tracking-wide text-fg/80 sm:text-sm">{c.label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

const Colon = ({ className }: { className?: string }) => (
  <span aria-hidden="true" className={cn('golive-colon block h-[1em] w-[0.4em] text-center leading-[1] text-faint', className)}>
    :
  </span>
)

function Clock({ r, started, reduce }: { r: Remaining; started: boolean; reduce: boolean }) {
  const dir = r.over ? 1 : -1
  const v = started ? r : { days: 3, hours: 0, minutes: 0, seconds: 0 }
  const label = `${v.days} ${t.units[0]}, ${v.hours} ${t.units[1]}, ${v.minutes} ${t.units[2]}, ${v.seconds} ${t.units[3]}`
  return (
    <div
      role="timer"
      aria-label={label}
      style={{ fontSize: 'var(--golive-fs)' }}
      className={cn(
        'flex flex-col items-center gap-[0.5em] font-brand font-semibold tabular-nums transition-[opacity,color] duration-500 [--golive-fs:min(21vw,13svh)] md:flex-row md:items-start md:gap-0 md:[--golive-fs:min(12vw,30svh)]',
        r.over && started ? 'text-danger' : 'text-fg',
        !started && 'opacity-40',
      )}
    >
      <Pair a={v.days} b={v.hours} labels={[t.labels[0], t.labels[1]]} dir={dir} reduce={reduce} digitsA={Math.max(2, String(v.days).length)} />
      <Colon className="hidden md:block" />
      <Pair a={v.minutes} b={v.seconds} labels={[t.labels[2], t.labels[3]]} dir={dir} reduce={reduce} />
    </div>
  )
}

function Ring({ percent, done, total, reduce }: { percent: number; done: number; total: number; reduce: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={fill(t.progress, { n: done, m: total, p: percent })} className="shrink-0 -rotate-90">
        <circle cx="32" cy="32" r="27" fill="none" strokeWidth="5" className="stroke-surface-3" />
        <motion.circle
          cx="32"
          cy="32"
          r="27"
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
          className="stroke-accent"
          initial={false}
          animate={{ strokeDashoffset: 1 - percent / 100 }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 90, damping: 22 }}
        />
      </svg>
      <p className="text-left text-sm leading-tight">
        <span className="block font-brand text-xl tabular-nums">{percent}%</span>
        <span className="text-muted">
          Готово <span className="font-mono tabular-nums text-fg">{done}</span> из <span className="font-mono tabular-nums text-fg">{total}</span>
        </span>
      </p>
    </div>
  )
}

export function GolivePage() {
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const notify = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => setToast({ id: Date.now() + Math.random(), text, tone }), [])
  const closeToast = useCallback(() => setToast(null), [])
  const golive = useGolive(notify)
  const { data, error, reload, send } = golive
  const now = useClock()
  const reduce = useReducedMotion() ?? false
  const { ask, dialog } = useConfirm()
  const field = useRef<StageFieldHandle>(null)
  const hero = useRef<HTMLElement>(null)
  const [heroVisible, setHeroVisible] = useState(true)

  const started = !!data?.state.deadline
  const r = remaining(data?.state.deadline, now)
  const over = started && r.over
  const percent = data?.progress.percent ?? 0

  // One soft pulse of the shader per second tick, and the shader follows over/progress.
  useEffect(() => {
    if (started && !over) field.current?.pulse()
  }, [r.seconds, started, over])
  useEffect(() => field.current?.setOver(over), [over])
  useEffect(() => field.current?.setProgress(percent / 100), [percent])

  useEffect(() => {
    const el = hero.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setHeroVisible(e?.isIntersecting ?? true), { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const start = async () => {
    const preview = formatDeadline(new Date(Date.now() + GOLIVE_HOURS * 3_600_000).toISOString())
    if (await ask(fill(t.startConfirm, { h: GOLIVE_HOURS, d: preview }), { yes: t.yes })) void send({ action: 'start', hours: GOLIVE_HOURS })
  }
  const reset = async () => {
    if (await ask(t.resetConfirm, { yes: t.reset, danger: true })) void send({ action: 'reset' })
  }

  const rise = (i: number) => ({
    initial: reduce ? false : ({ opacity: 0, y: 14 } as const),
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay: 0.06 * i, ease },
  })

  return (
    <MotionConfig reducedMotion="user">
      <main className="bg-bg text-fg">
        <section ref={hero} aria-label={t.title} className="relative isolate flex min-h-[100svh] flex-col overflow-hidden">
          <StageField ref={field} reduce={reduce} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--color-bg)_55%,transparent),transparent_70%)]" />
          <header className="relative z-10 flex items-center justify-between gap-3 px-3 py-3 sm:px-6">
            <Link href="/admin/office" aria-label={t.backLabel} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-bg/60 px-4 text-sm backdrop-blur transition-colors hover:border-accent hover:text-accent-text">
              <ArrowLeft size={16} aria-hidden="true" />
              {t.back}
            </Link>
            <ThemeToggle />
          </header>

          <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-7 px-4 pt-2 pb-10 text-center sm:gap-9">
            <motion.h1 {...rise(0)} className="font-brand text-base tracking-wide text-fg/80 sm:text-lg">
              {t.title}
            </motion.h1>
            <motion.div {...rise(1)}>
              <Clock r={r} started={started} reduce={reduce} />
            </motion.div>

            <motion.div {...rise(2)} className="min-h-12 text-sm sm:text-base">
              {!data ? (
                error ? (
                  <div role="alert" className="flex flex-col items-center gap-2">
                    <p className="text-danger">{t.loadFailed}</p>
                    <button type="button" onClick={() => void reload()} className={btn}>
                      {t.retry}
                    </button>
                  </div>
                ) : (
                  <p role="status" className="text-muted">
                    {t.loading}
                  </p>
                )
              ) : over ? (
                <p className="font-medium text-danger">
                  {t.over} <span className="font-normal text-muted">({fill(t.overAgo, { t: agoText(r) })})</span>
                </p>
              ) : started ? (
                <p className="text-fg/80">
                  {t.deadline}: <span className="font-mono tabular-nums text-fg">{formatDeadline(data.state.deadline!)}</span> ({t.tz})
                </p>
              ) : (
                <p className="text-fg/80">{t.notStartedHint}</p>
              )}
            </motion.div>

            <motion.div {...rise(3)} className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
              {data ? <Ring percent={data.progress.percent} done={data.progress.done} total={data.progress.total} reduce={reduce} /> : null}
              {data ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {started ? (
                    <>
                      <button type="button" onClick={start} className={btn}>
                        {t.restart}
                      </button>
                      <button type="button" onClick={reset} className={btnDanger}>
                        {t.reset}
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={start} className={cn(btnPrimary, '!min-h-12 !px-6 !text-base')}>
                      {fill(t.start, { h: GOLIVE_HOURS })}
                    </button>
                  )}
                </div>
              ) : null}
            </motion.div>
          </div>
        </section>

        {data ? <Checklist data={data} send={send} /> : null}

        <button
          type="button"
          inert={heroVisible}
          aria-label={t.top}
          onClick={() => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })}
          className={cn(
            'fixed right-4 bottom-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-elevated px-4 text-sm shadow-dialog transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-accent motion-reduce:transition-none sm:right-6 sm:bottom-6',
            heroVisible ? 'translate-y-3 opacity-0' : 'translate-y-0 opacity-100',
          )}
        >
          <ArrowUp size={16} aria-hidden="true" />
          {t.top}
        </button>
        <Toast message={toast} onClose={closeToast} />
        {dialog ? createPortal(dialog, document.body) : null}
      </main>
    </MotionConfig>
  )
}
