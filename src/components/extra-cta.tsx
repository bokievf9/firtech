'use client'

import { ArrowRight } from '@phosphor-icons/react'
import { track } from '@/lib/analytics'
import { sendEstimate } from '@/lib/estimate-event'
import type { LeadService } from '@/lib/site'
import { useReducedMotion } from '@/lib/use-reduced-motion'

// Picks the service in the contact form and scrolls to it, so a visitor who clicked "Discuss" on a
// card lands on a form that already knows what they want.
export function ExtraCta({ service, label }: { service: LeadService; label: string }) {
  const reduce = useReducedMotion()
  return (
    <button
      type="button"
      onClick={() => {
        sendEstimate({ service })
        track('extra_discuss', { service })
        document
          .getElementById('contact')
          ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      }}
      className="relative z-10 inline-flex items-center gap-1.5 text-sm font-medium text-fg transition-colors hover:text-accent-text"
    >
      {label}
      <ArrowRight size={14} />
    </button>
  )
}
