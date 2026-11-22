'use client'

import { ArrowRight } from '@phosphor-icons/react'
import Link from 'next/link'
import { useEffect, useId, useState } from 'react'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import { ChatOpenButton } from '../chat/chat-open-button'
import { TabList } from '../ui/tabs'
import { DemoAssistant } from './demo-assistant'
import { DemoChat } from './demo-chat'

export const demoTabIds = ['receptionist', 'personal'] as const
export type DemoTabId = (typeof demoTabIds)[number]

// The tabs of #demo (owner 2026-11-23): only live demos, the receptionist chat with a niche selector and the
// «Персональный ИИ» chat. Arrow keys move between the tabs; the chat stays mounted so a conversation survives a switch.
export function DemoTabs({
  dict,
  locale,
  names,
  buildHrefs,
}: {
  dict: Dict
  locale: 'ru' | 'en'
  names: Record<DemoTabId, string>
  buildHrefs: Record<DemoTabId, string>
}) {
  const t = dict.demoSection
  const base = useId()
  const [active, setActive] = useState<DemoTabId>('receptionist')

  // Back from the sign-in page (`/<locale>?demo=<tab>#demo`): the same tab opens again.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('demo')
    const id = demoTabIds.find((x) => x === wanted)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the query string is only known in the browser
    if (id) setActive(id)
  }, [])

  return (
    <div>
      <TabList
        base={base}
        label={t.tabsLabel}
        value={active}
        onChange={setActive}
        items={demoTabIds.map((id) => ({ id, label: names[id] }))}
        itemProps={(id) => ({ 'data-demo-tab': id })}
      />

      <div className="mt-8">
        <div role="tabpanel" id={`${base}-panel-receptionist`} aria-labelledby={`${base}-tab-receptionist`} hidden={active !== 'receptionist'}>
          <DemoChat copy={t.receptionist} gate={dict.demoGate} badge={t.exampleBadge} locale={locale} />
        </div>
        <div role="tabpanel" id={`${base}-panel-personal`} aria-labelledby={`${base}-tab-personal`} hidden={active !== 'personal'}>
          {active === 'personal' && <DemoAssistant copy={t.personal} gate={dict.demoGate} locale={locale} badge={t.exampleBadge} compact />}
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link href={buildHrefs[active]} data-cta={`demo_build_${active}`} className={cn(buttonStyles.primary, 'group')}>
          {t.cta}
          <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
        <ChatOpenButton source="demo" fallbackHref="#demo" className={buttonStyles.secondary}>
          {t.ask}
        </ChatOpenButton>
      </div>
    </div>
  )
}
