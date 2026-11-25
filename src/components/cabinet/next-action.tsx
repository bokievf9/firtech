'use client'

import { ArrowUpRight, Hourglass } from '@phosphor-icons/react'
import type { Dict } from '@/content'
import { actionControl, type NextAction } from '@/lib/cabinet-docs'
import { buttonClass, cn } from '@/lib/cn'
import { AcceptStageButton } from './accept-stage'
import { TabLink } from './tab-link'
import { fill } from './ui'

// «Что сейчас нужно от вас» (cabinet v3, owner 2026-11-22: the next action as ONE big button): accept
// the proposal, sign the contract, pay a stage, accept a stage, or a calm line when only we are
// working. Accepting and signing happen in the document viewer (the client must be able to read first),
// paying opens the pay page, accepting a stage is done in place.
const big = buttonClass('primary', 'lg')

export function NextActionBlock({
  action,
  dict,
  projectId,
  compact = false,
}: {
  action: NextAction
  dict: Dict
  // The project the stage belongs to (needed to accept a stage).
  projectId?: number
  compact?: boolean
}) {
  const t = dict.cabinet.v3.next
  const control = actionControl(action)
  const n = action.stageNo !== null ? String(action.stageNo) : null
  const label =
    action.kind === 'accept_quote'
      ? t.accept_quote.button
      : action.kind === 'sign_contract'
        ? t.sign_contract.button
        : action.kind === 'pay_stage'
          ? n
            ? fill(t.pay_stage.button, { n })
            : t.pay_stage.buttonAny
          : action.kind === 'accept_stage'
            ? n
              ? fill(t.accept_stage.button, { n })
              : t.accept_stage.buttonAny
            : ''
  const text = action.kind === 'wait' && action.text ? action.text : t[action.kind].text

  if (control.control === 'none') {
    return (
      <div className="flex items-start gap-3 rounded-tile border border-hairline border-line bg-surface-2/60 p-4 text-callout text-muted" data-next-action="wait">
        <Hourglass size={20} weight="duotone" aria-hidden="true" className="mt-0.5 shrink-0 text-faint" />
        <p className="leading-relaxed">{text}</p>
      </div>
    )
  }

  return (
    <div
      className={cn('rounded-card border border-accent-text/40 bg-accent/[0.08]', compact ? 'p-4' : 'p-5 md:p-6')}
      data-next-action={action.kind}
    >
      <p className="text-footnote text-muted">{t.title}</p>
      <p className="mt-1 max-w-[56ch] text-callout leading-relaxed text-fg">{text}</p>
      <div className="mt-4">
        {control.control === 'pay_link' && (
          <a href={control.href} className={big} data-big-action>
            {label}
            <ArrowUpRight size={18} weight="bold" aria-hidden="true" />
          </a>
        )}
        {control.control === 'open_doc' && (
          <TabLink tab="documents" extra={control.docId ? { doc: control.docId } : {}} className={big} data-big-action>
            {label}
          </TabLink>
        )}
        {control.control === 'accept_stage' && projectId !== undefined && (
          <AcceptStageButton dict={dict} projectId={projectId} stageNo={control.stageNo} label={label} big hint={false} />
        )}
        {control.control === 'accept_stage' && projectId === undefined && (
          <TabLink tab="projects" className={big}>
            {label}
          </TabLink>
        )}
      </div>
    </div>
  )
}
