import { channelName, type ChannelId } from '@/lib/channels'
import { personalChannelOrder } from '@/lib/personal-page'
import type { Dict } from '@/content'
import { channelIcons } from '../product-sections/channels-block'

// «Где живёт» for teams and agents: the seven channels as equal chips in one row, Telegram not first (owner 2026-11-22: Telegram is one
// channel among many, never the only one). The full strip with a line per channel lives on the product pages.
export function ChannelsRow({ dict, locale, order = personalChannelOrder }: { dict: Dict; locale: string; order?: readonly ChannelId[] }) {
  return (
    <div data-channels-row>
      <h2 className="text-title-2 font-semibold">{dict.channelsStrip.title}</h2>
      <p className="mt-2 max-w-[52ch] text-callout text-muted">{dict.aiTeams.page.channelsLine}</p>
      <ul className="mt-5 flex flex-wrap gap-2">
        {order.map((id) => {
          const Glyph = channelIcons[id]
          return (
            <li key={id} data-channel={id} className="material-regular inline-flex items-center gap-2 rounded-full border border-hairline border-glass-line px-4 py-2 text-callout">
              <Glyph size={18} weight="duotone" aria-hidden="true" className="text-accent-text" />
              {channelName(id, locale)}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
