'use client'

import { Check } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import type { Dict } from '@/content'
import { useReducedMotion } from '@/lib/use-reduced-motion'

// A tiny booking bot the visitor can actually use: pick a slot, get a confirmation.
export function BotChatDemo({ t }: { t: Dict['services']['chat'] }) {
  const reduce = useReducedMotion()
  const [picked, setPicked] = useState(false)
  const slots = ['11:00', t.pick, '17:00']
  const enter = reduce ? false : { opacity: 0, y: 10 }

  return (
    <div className="grid gap-2 text-[13px] leading-snug" aria-live="polite">
      <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-accent-ink">
        {t.user}
      </p>
      <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2">{t.bot}</p>
      <div className="flex gap-1.5">
        {slots.map((slot) => (
          <button
            key={slot}
            type="button"
            disabled={picked}
            onClick={() => setPicked(true)}
            className="rounded-full border border-line-strong px-3 py-1.5 font-mono text-xs transition-colors hover:border-accent-text hover:text-accent-text disabled:opacity-50 disabled:hover:border-line-strong disabled:hover:text-fg"
          >
            {slot}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {picked && (
          <motion.p
            initial={enter}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="flex max-w-[85%] items-center gap-2 rounded-2xl rounded-bl-md bg-pine px-3.5 py-2 text-accent-text"
          >
            <Check size={14} weight="bold" className="shrink-0" />
            {t.done}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
