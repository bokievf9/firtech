import { ChatCircleDots, ShieldCheck } from '@phosphor-icons/react/ssr'
import type { GuaranteeCtx } from '@/lib/guarantee'
import { buttonClass } from '@/lib/cn'
import { ChatOpenButton } from '../chat/chat-open-button'
import { Card } from '../ui'

// Blocks of an agent page (/ai-team/agent/[id]) that come from the AI-native contract (owner 2026-11-25).

// The paid pilot, compact: the first stage is the pilot (length from `pricing.guarantee.pilotDays`).
export function AgentPilot({ id, guarantee }: { id: string; guarantee: GuaranteeCtx }) {
  const t = guarantee.pilot
  return (
    <Card tone="accent" data-agent-pilot className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex gap-3">
        <ShieldCheck size={24} weight="duotone" aria-hidden="true" className="mt-0.5 shrink-0 text-accent-text" />
        <div>
          <h2 className="text-title-3 font-semibold">{t.title}</h2>
          <p className="mt-1.5 max-w-[60ch] text-callout text-muted">{t.text}</p>
        </div>
      </div>
      <ChatOpenButton source={`product_${id}_pilot`.slice(0, 40)} fallbackHref="#next" className={buttonClass('primary', 'md')}>
        <ChatCircleDots size={18} weight="fill" aria-hidden="true" />
        {t.cta}
      </ChatOpenButton>
    </Card>
  )
}
