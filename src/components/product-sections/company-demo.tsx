'use client'

import { ArrowRight, ChatCircleDots } from '@phosphor-icons/react'
import { useCabinetUser } from '@/components/cabinet/use-cabinet-user'
import { openChat } from '@/components/chat/chat-events'
import { DemoGateBar } from '@/components/demo/demo-gate-ui'
import type { Dict } from '@/content'
import type { ProductBlocks } from '@/content/product-pages'
import { buttonClass } from '@/lib/cn'
import { demoLoginHref } from '@/lib/demo-gate'

// Ask Fira on the company page (owner 2026-11-22: the demo is for signed-in clients and must look so). Signed out:
// a frame with a labelled scripted example and the lock plate (sign in, sign up by code). Signed in: the real chat of
// the site opens (the company has no persona of its own yet, so the demo is the general Fira chat).
export function CompanyDemo({
  copy,
  gate,
  badge,
  name,
  locale,
}: {
  copy: NonNullable<ProductBlocks['cdemo']>
  gate: Dict['demoGate']
  badge: string
  name: string
  locale: 'ru' | 'en'
}) {
  const { state: me } = useCabinetUser()
  const locked = me.status === 'out' || me.status === 'loading'
  return (
    <div className="material-thick flex max-w-3xl flex-col overflow-hidden rounded-panel" data-company-demo={locked ? 'locked' : 'live'}>
      <div className="flex items-center gap-3 border-b border-b-hairline border-glass-line px-4 py-3">
        <span className="grid size-9 place-items-center rounded-full bg-pine font-brand text-xs text-accent-text">ft</span>
        <p className="min-w-0 flex-1 truncate text-callout font-medium">{name}</p>
        {locked && (
          <span className="rounded-full bg-accent/15 px-3 py-1 text-caption text-accent-text" data-company-example>
            {badge}
          </span>
        )}
      </div>
      {locked ? (
        <div className="grid gap-4 p-4">
          <ol className="grid gap-2.5" data-example-log>
            <li className="ml-auto max-w-[88%] rounded-[18px] rounded-br-md bg-accent px-4 py-2.5 text-[15px] leading-snug text-accent-ink">{copy.ask}</li>
            <li className="max-w-[88%] rounded-[18px] rounded-bl-md bg-surface-2 px-4 py-2.5 text-[15px] leading-snug">
              {copy.answer}
              <span className="mt-1.5 block text-footnote text-muted">{copy.source}</span>
            </li>
          </ol>
          <DemoGateBar variant="plate" gate={gate} href={demoLoginHref(locale, `/${locale}/products/company#cdemo`)} locked={me.status === 'loading'} />
        </div>
      ) : (
        <div className="flex flex-col items-start gap-4 p-card">
          <p className="text-body">{copy.signedIn}</p>
          <button type="button" onClick={() => openChat('product_company_demo')} data-cta="chat_product_company_demo" className={buttonClass('primary', 'md')}>
            <ChatCircleDots size={18} weight="fill" aria-hidden="true" />
            {copy.open}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
