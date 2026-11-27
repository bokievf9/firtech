import { ArrowRight, ChatCircleDots, HandWaving, ShieldCheck } from '@phosphor-icons/react/ssr'
import type { Dict } from '@/content'
import type { GuaranteeCtx } from '@/lib/guarantee'
import { buttonClass } from '@/lib/cn'
import { ChatOpenButton } from '../chat/chat-open-button'
import { Blueprint } from '../motion/blueprint'
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

// «Позвать человека» as a feature: the text from the contract and a small picture made of v5 primitives (a Card with
// chat bubbles, the button and the summary note); no images.
export function AgentHandoff({ dict }: { dict: Dict }) {
  const t = dict.aiTeams.agents.page.handoff
  return (
    <Card data-agent-handoff className="grid gap-6 lg:grid-cols-12 lg:items-center">
      <div className="lg:col-span-5">
        <HandWaving size={26} weight="duotone" aria-hidden="true" className="text-accent-text" />
        <h2 className="mt-3 text-title-3 font-semibold">{t.title}</h2>
        <p className="mt-2 max-w-[48ch] text-callout text-muted">{t.text}</p>
      </div>
      <div role="img" aria-label={t.illustration} className="grid gap-2.5 lg:col-span-7">
        <Blueprint aria-hidden="true" className="isolate grid gap-2.5 text-footnote sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-3" lineClassName="-z-10 hidden h-px w-full sm:top-1/2 sm:left-0 sm:block">
          <div className="grid gap-2">
            <p className="max-w-[28ch] rounded-tile rounded-bl-sm border border-line bg-surface px-3 py-2">{t.client}</p>
            <p className="max-w-[28ch] justify-self-end rounded-tile rounded-br-sm bg-accent/15 px-3 py-2 text-fg">{t.agent}</p>
          </div>
          <div className="flex items-center gap-2 sm:flex-col">
            <span data-node className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 font-medium text-accent-ink">
              <HandWaving size={14} weight="fill" />
              {t.button}
            </span>
            <ArrowRight size={16} className="text-faint max-sm:hidden sm:rotate-90" />
          </div>
          <p data-node className="rounded-tile border border-accent-text/40 bg-accent/10 px-3 py-2 text-fg">{t.summary}</p>
        </Blueprint>
      </div>
    </Card>
  )
}
