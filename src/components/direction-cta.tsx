'use client'

import { ArrowRight } from '@phosphor-icons/react'
import { track } from '@/lib/analytics'
import { directionService, type DirectionId } from '@/lib/directions'
import { sendEstimate } from '@/lib/estimate-event'
import { useReducedMotion } from '@/lib/use-reduced-motion'

// "Discuss" on a direction card: preselects the service in the contact form, hands it the card id
// as the lead `source` and scrolls to the form.
export function DirectionCta({ id, label }: { id: DirectionId; label: string }) {
  const reduce = useReducedMotion()
  return (
    <button
      type="button"
      onClick={() => {
        sendEstimate({ service: directionService[id], source: id })
        track('direction_discuss', { source: id })
        document
          .getElementById('contact')
          ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      }}
      className="relative z-10 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-[background-color,transform] duration-300 ease-out-expo hover:bg-accent-strong active:scale-[0.98]"
    >
      {label}
      <ArrowRight size={14} aria-hidden="true" />
    </button>
  )
}
