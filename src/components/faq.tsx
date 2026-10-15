'use client'

import { Plus } from '@phosphor-icons/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useId, useState } from 'react'
import { cn } from '@/lib/cn'

export function Faq({
  title,
  items,
  id,
}: {
  title: string
  items: { q: string; a: string }[]
  id?: string
}) {
  const [open, setOpen] = useState<number | null>(0)
  const reduce = useReducedMotion()
  const base = useId()

  return (
    <section id={id} className="mx-auto grid max-w-7xl gap-10 px-4 py-24 md:px-8 md:py-32 lg:grid-cols-12">
      <h2 className="text-4xl font-semibold tracking-[-0.03em] md:text-5xl lg:col-span-4">{title}</h2>
      <div className="lg:col-span-8">
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
                  className="flex w-full items-center justify-between gap-6 py-6 text-left text-lg font-medium md:text-xl"
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
                    <p className="max-w-[62ch] pb-7 leading-relaxed text-muted">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </section>
  )
}
