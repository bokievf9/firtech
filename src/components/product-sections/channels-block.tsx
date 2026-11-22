import {
  Browser,
  Desktop,
  EnvelopeSimple,
  Microphone,
  PaperPlaneTilt,
  UserCircle,
  WhatsappLogo,
} from '@phosphor-icons/react/ssr'
import type { ComponentType } from 'react'
import { channelIds, channelLine, channelName, type ChannelId } from '@/lib/channels'
import { personalChannelOrder } from '@/lib/personal-page'
import { Reveal } from '../reveal'
import { SectionShell, type ProductSectionContext } from './shell'

const icons: Record<ChannelId, ComponentType<{ size?: number; weight?: 'duotone'; 'aria-hidden'?: boolean | 'true'; className?: string }>> = {
  telegram: PaperPlaneTilt,
  whatsapp: WhatsappLogo,
  web: Browser,
  cabinet: UserCircle,
  voice: Microphone,
  email: EnvelopeSimple,
  desktop: Desktop,
}

// «Где живёт»: every channel of the AI as an equal glass tile (owner 2026-11-22: Telegram is one channel among many).
// Data in src/lib/channels.ts; the quote says which of them a project includes.
export function ChannelsBlock({ ctx, band }: { ctx: ProductSectionContext; band?: boolean }) {
  const { dict, locale, id: product } = ctx
  // The Personal AI page lists them with Telegram in the middle, never first (owner 2026-11-22).
  const order = product === 'personal' ? personalChannelOrder : channelIds
  return (
    <SectionShell id="channels" title={dict.channelsStrip.title} sub={dict.channelsStrip.sub} band={band}>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-channels>
        {order.map((id, i) => {
          const Glyph = icons[id]
          return (
            <li key={id} data-channel={id}>
              <Reveal delay={(i % 4) * 0.05} className="h-full">
                <div className="glass flex h-full items-start gap-3 rounded-card border border-line p-4">
                  <Glyph size={24} weight="duotone" aria-hidden="true" className="mt-0.5 shrink-0 text-accent-text" />
                  <div>
                    <p className="font-medium">{channelName(id, locale)}</p>
                    <p className="mt-1 text-sm leading-snug text-muted">{channelLine(id, locale)}</p>
                  </div>
                </div>
              </Reveal>
            </li>
          )
        })}
      </ul>
    </SectionShell>
  )
}
