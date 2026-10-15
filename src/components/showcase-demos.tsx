'use client'

import {
  Bell,
  Browser,
  Check,
  Coffee,
  InstagramLogo,
  Minus,
  Plus,
  Robot,
  Scissors,
  ShoppingBag,
  Sparkle,
  TelegramLogo,
} from '@phosphor-icons/react'
import { AnimatePresence, LayoutGroup, motion, useInView } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import { useReducedMotion } from '@/lib/use-reduced-motion'

type T = Dict['showcase']['demo']
const ease = [0.16, 1, 0.3, 1] as const

// Steps through a scripted scene while it is on screen, then starts over. Reduced motion jumps
// straight to the final step, so the finished result is still visible.
function useScene(durations: number[]) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.35 })
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  const last = durations.length - 1

  useEffect(() => {
    if (reduce || !inView) return
    const timer = setTimeout(() => setStep((s) => (s >= last ? 0 : s + 1)), durations[step])
    return () => clearTimeout(timer)
  }, [step, inView, reduce, durations, last])

  return { ref, step: reduce ? last : step, reduce: !!reduce }
}

function Phone({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'relative mx-auto flex h-[400px] w-[220px] flex-col overflow-hidden rounded-[34px] border border-line-strong bg-bg p-2.5 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.8)]',
        className,
      )}
    >
      <span className="mx-auto mb-2 h-1.5 w-16 shrink-0 rounded-full bg-line-strong" />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] bg-surface">
        {children}
      </div>
    </div>
  )
}

function Toast({
  show,
  icon,
  children,
  className,
}: {
  show: boolean
  icon: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, transition: { duration: 0.25 } }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className={cn(
            'absolute z-20 flex w-[230px] items-start gap-2.5 rounded-2xl border border-line-strong bg-surface-2/95 p-3 text-[12px] leading-snug shadow-[0_20px_50px_-20px_rgb(0_0_0/0.9)] backdrop-blur',
            className,
          )}
        >
          {icon}
          <span>{children}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Coffee shop: two taps on the menu, one on "Order", and the barista's Telegram lights up.
export function CafeDemo({ t, business }: { t: T; business: string }) {
  const { ref, step } = useScene([1400, 900, 900, 1100, 3200])
  const items = [
    { name: t.latte, price: '$2.5', at: 1 },
    { name: t.cappuccino, price: '$2.2', at: -1 },
    { name: t.croissant, price: '$1.8', at: 2 },
  ]
  const count = items.filter((i) => i.at > 0 && step >= i.at).length

  return (
    <div ref={ref} className="relative py-6">
      <Phone>
        <div className="bg-[linear-gradient(160deg,var(--color-pine),var(--color-surface))] px-4 pt-4 pb-4">
          <Coffee size={22} weight="duotone" className="text-accent" />
          <p className="mt-2 text-[15px] font-semibold">{business}</p>
          <p className="text-[11px] text-muted">{t.menu}</p>
        </div>
        <ul className="grid gap-2 p-3">
          {items.map((item) => {
            const added = item.at > 0 && step >= item.at
            return (
              <li
                key={item.name}
                className="flex items-center justify-between rounded-xl bg-bg/60 px-3 py-2.5 text-[12px]"
              >
                <span>
                  <span className="block font-medium">{item.name}</span>
                  <span className="font-mono text-faint">{item.price}</span>
                </span>
                <motion.span
                  animate={added ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                  transition={{ duration: 0.35 }}
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full transition-colors duration-300',
                    added ? 'bg-accent text-accent-ink' : 'border border-line-strong text-muted',
                  )}
                >
                  {added ? <Check size={12} weight="bold" /> : <Plus size={12} />}
                </motion.span>
              </li>
            )
          })}
        </ul>
        <div className="mt-auto p-3">
          <motion.div
            animate={step === 3 ? { scale: [1, 0.95, 1] } : { scale: 1 }}
            className={cn(
              'flex h-10 items-center justify-between rounded-full px-4 text-[12px] font-medium transition-colors duration-300',
              step >= 3 ? 'bg-pine text-accent' : 'bg-accent text-accent-ink',
            )}
          >
            <span>{step >= 3 ? <Check size={14} weight="bold" /> : t.order}</span>
            <span className="font-mono">
              {t.cart}: {count}
            </span>
          </motion.div>
        </div>
      </Phone>
      <Toast
        show={step >= 3}
        className="top-0 right-0 sm:-right-6"
        icon={
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#2aabee]/15 text-[#5cc4f5]">
            <TelegramLogo size={14} weight="fill" />
          </span>
        }
      >
        {t.orderAlert}
      </Toast>
    </div>
  )
}

// Salon: the client picks a stylist, a day and a time in the bot; a reminder arrives later.
export function SalonDemo({ t }: { t: T }) {
  const { ref, step } = useScene([1200, 1000, 1000, 1000, 1600, 3000])
  const days = t.days
  const enter = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, ease },
  }

  return (
    <div ref={ref} className="relative py-6">
      <Phone>
        <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Scissors size={15} />
          </span>
          <span className="text-[13px] font-medium">Beauty Bot</span>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3 text-[12px] leading-snug">
          <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface-2 px-3 py-2">
            {t.master}?
          </p>
          {step >= 1 && (
            <motion.p
              {...enter}
              className="ml-auto rounded-2xl rounded-br-md bg-accent px-3 py-2 text-accent-ink"
            >
              {t.masterName}
            </motion.p>
          )}
          {step >= 2 && (
            <motion.div {...enter} className="grid grid-cols-4 gap-1.5">
              {days.map((d, i) => (
                <span
                  key={d}
                  className={cn(
                    'rounded-lg py-1.5 text-center font-mono text-[11px] transition-colors duration-300',
                    i === 2 && step >= 3
                      ? 'bg-accent text-accent-ink'
                      : 'border border-line-strong text-muted',
                  )}
                >
                  {d}
                </span>
              ))}
            </motion.div>
          )}
          {step >= 3 && (
            <motion.div {...enter} className="flex gap-1.5">
              {['11:00', '14:30', '17:00'].map((slot) => (
                <span
                  key={slot}
                  className={cn(
                    'rounded-full px-2.5 py-1 font-mono text-[11px] transition-colors duration-300',
                    slot === '14:30' && step >= 4
                      ? 'bg-accent text-accent-ink'
                      : 'border border-line-strong text-muted',
                  )}
                >
                  {slot}
                </span>
              ))}
            </motion.div>
          )}
          {step >= 4 && (
            <motion.p
              {...enter}
              className="flex max-w-[90%] items-center gap-2 rounded-2xl rounded-bl-md bg-pine px-3 py-2 text-accent"
            >
              <Check size={13} weight="bold" className="shrink-0" />
              {t.booked}
            </motion.p>
          )}
        </div>
      </Phone>
      <Toast
        show={step >= 5}
        className="bottom-2 left-0 sm:-left-6"
        icon={
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Bell size={14} weight="fill" />
          </span>
        }
      >
        {t.reminder}
      </Toast>
    </div>
  )
}

// Delivery: a Telegram Mini App with a cart that fills up and pays in one tap.
export function DeliveryDemo({ t }: { t: T }) {
  const { ref, step } = useScene([1200, 900, 900, 1200, 3200])
  const items = [
    { name: t.plov, price: 6, at: 1 },
    { name: t.samsa, price: 2, at: 2 },
    { name: t.lagman, price: 5, at: -1 },
    { name: t.tea, price: 1, at: 2 },
  ]
  const inCart = items.filter((i) => i.at > 0 && step >= i.at)
  const total = inCart.reduce((s, i) => s + i.price, 0)

  return (
    <div ref={ref} className="relative py-6">
      <Phone>
        <div className="flex items-center justify-between border-b border-line px-3.5 py-3 text-[13px]">
          <span className="font-medium">Mini App</span>
          <span className="relative">
            <ShoppingBag size={18} className="text-muted" />
            <AnimatePresence>
              {inCart.length > 0 && (
                <motion.span
                  key={inCart.length}
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-2 flex size-4 items-center justify-center rounded-full bg-accent font-mono text-[9px] text-accent-ink"
                >
                  {inCart.length}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </div>
        <ul className="grid grid-cols-2 gap-2 p-3">
          {items.map((item) => {
            const added = item.at > 0 && step >= item.at
            return (
              <li
                key={item.name}
                className={cn(
                  'rounded-xl border p-2 text-[11px] transition-colors duration-300',
                  added ? 'border-accent/50 bg-accent/[0.06]' : 'border-line bg-bg/50',
                )}
              >
                <span className="mb-2 block h-12 rounded-lg bg-[linear-gradient(150deg,var(--color-pine),var(--color-surface-2))]" />
                <span className="block font-medium">{item.name}</span>
                <span className="flex items-center justify-between font-mono text-faint">
                  ${item.price}
                  {added ? <Minus size={11} className="text-accent" /> : <Plus size={11} />}
                </span>
              </li>
            )
          })}
        </ul>
        <div className="mt-auto p-3">
          <div
            className={cn(
              'flex h-10 items-center justify-center gap-2 rounded-full text-[12px] font-medium transition-colors duration-300',
              step >= 4 ? 'bg-pine text-accent' : 'bg-accent text-accent-ink',
            )}
          >
            {step >= 4 ? (
              <>
                <Check size={14} weight="bold" />
                {t.paid}
              </>
            ) : (
              <>
                {t.pay} <span className="font-mono">${total}</span>
              </>
            )}
          </div>
        </div>
      </Phone>
    </div>
  )
}

// Sales: leads from three channels drop into one pipeline, the AI answers, a deal moves to "paid".
export function SalesDemo({ t }: { t: T }) {
  const { ref, step } = useScene([900, 700, 700, 1200, 1400, 1300, 3000])
  const leads = [
    { id: 'a', label: t.leadA, icon: Browser, at: 1 },
    { id: 'b', label: t.leadB, icon: InstagramLogo, at: 2 },
    { id: 'c', label: t.leadC, icon: TelegramLogo, at: 3 },
  ]
  const column = (id: string) => {
    if (id === 'b' && step >= 4) return step >= 6 ? 'done' : 'work'
    if (id === 'a' && step >= 5) return 'work'
    return 'new'
  }
  const cols = [
    { id: 'new', label: t.colNew },
    { id: 'work', label: t.colWork },
    { id: 'done', label: t.colDone },
  ]

  return (
    <div ref={ref} className="relative w-full max-w-[460px] py-6">
      <div className="rounded-[22px] border border-line-strong bg-bg p-3 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.8)]">
        <div className="mb-3 flex items-center gap-2 px-1 text-[12px] text-muted">
          <Robot size={15} className="text-accent" />
          CRM
        </div>
        <LayoutGroup>
          <div className="grid grid-cols-3 gap-2">
            {cols.map((col) => (
              <div key={col.id} className="min-h-[230px] rounded-xl bg-surface p-2">
                <p className="mb-2 px-1 font-mono text-[10px] text-faint uppercase">{col.label}</p>
                <div className="grid gap-1.5">
                  {leads
                    .filter((l) => step >= l.at && column(l.id) === col.id)
                    .map(({ id, label, icon: Icon }) => (
                      <motion.div
                        key={id}
                        layoutId={`lead-${id}`}
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                        className={cn(
                          'rounded-lg border p-2 text-[11px] leading-tight',
                          col.id === 'done'
                            ? 'border-accent/50 bg-accent/[0.08]'
                            : 'border-line bg-surface-2',
                        )}
                      >
                        <Icon
                          size={13}
                          className={col.id === 'done' ? 'text-accent' : 'text-muted'}
                        />
                        <span className="mt-1.5 block">{label}</span>
                      </motion.div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </LayoutGroup>
      </div>
      <Toast
        show={step >= 3 && step < 6}
        className="right-0 -bottom-2 sm:-right-4"
        icon={
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Sparkle size={14} weight="fill" />
          </span>
        }
      >
        {t.aiReply}
      </Toast>
    </div>
  )
}
