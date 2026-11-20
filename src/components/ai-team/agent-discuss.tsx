'use client'

import { agentSource, type AgentId } from '@/lib/ai-teams'
import { sendEstimate } from '@/lib/estimate-event'
import { useReducedMotion } from '@/lib/use-reduced-motion'

// «Обсудить» on an agent page: hands the contact form the agent as the lead `source` and scrolls to
// it. The href keeps `?agent=<id>` for a plain click without JS and for sharing the link.
export function AgentDiscuss({ id, label, className }: { id: AgentId; label: string; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <a
      href={`?agent=${id}#contact`}
      data-cta={`agent_${id}_discuss`}
      className={className}
      onClick={(event) => {
        event.preventDefault()
        sendEstimate({ service: 'automation', source: agentSource(id) })
        document.getElementById('contact')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      }}
    >
      {label}
    </a>
  )
}
