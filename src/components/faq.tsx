'use client'

import { Plus } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useState } from 'react'
import { cn } from '@/lib/cn'
import { RiseText } from './rise-text'
import { useReducedMotion } from '@/lib/use-reduced-motion'

export function Faq({
  title,
  items,
  id,
}: {
  title: string
  items: { q: string; a: string }[]
  id?: string
}) {
  return (
    <section
      id={id}
      className="mx-auto grid max-w-7xl gap-10 px-4 py-24 md:px-8 md:py-36 lg:grid-cols-12"
    >
      <RiseText
        text={title}
        className="font-display text-title font-semibold lg:col-span-4"
      />
      <div className="lg:col-span-8">
        <FaqList items={items} />
      </div>
    </section>
  )
}

// The accordion alone, for layouts that place it next to something else (FAQ + contact).
export function FaqList({ items, compact = false }: { items: { q: string; a: string }[]; compact?: boolean }) {
  const [open, setOpen] = useState<number | null>(0)
  const reduce = useReducedMotion()
  const base = useId()

  return (
    <div>
      {items.map((item, i) => {
        const isOpen = open === i
        const panel = `${base}-${i}`
        return (
          <div key={item.q} className="border-b border-line first:border-t">
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panel}
                onClick={() => setOpen(isOpen ? null : i)}
                className={cn(
                  'flex w-full items-center justify-between gap-6 text-left font-medium',
                  compact ? 'py-4 text-base md:text-lg' : 'py-6 text-lg md:text-xl',
                )}
              >
                {item.q}
                <Plus
                  size={18}
                  className={cn(
                    'shrink-0 text-accent transition-transform duration-300 ease-out-expo',
                    isOpen && 'rotate-45',
                  )}
                />
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={panel}
                  initial={reduce ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={reduce ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <p className={cn('max-w-[62ch] leading-relaxed text-muted', compact ? 'pb-5 text-[15px]' : 'pb-7')}>
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
