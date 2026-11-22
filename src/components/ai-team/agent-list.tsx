import { ArrowUpRight } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import { agentCopy, agentOffer, agentPath, aiTeamPath, type AgentId } from '@/lib/ai-teams'
import { cn } from '@/lib/cn'
import { Badge, Card } from '../ui'
import { TeamGlyph } from './team-parts'

// One agent as a card (v4): the department glyph, the name, the one-line result, how much it does alone and the link
// to the team it belongs to. The whole card opens the agent page (stretched title link); the team link sits above it.
export function AgentCard({ id, locale, dict, showTeam = true, className }: { id: AgentId; locale: string; dict: Dict; showTeam?: boolean; className?: string }) {
  const copy = agentCopy(id, dict)
  const offer = agentOffer(id)
  const t = dict.aiTeams
  return (
    <Card interactive className={cn('group flex h-full flex-col gap-3', className)} data-agent-card={id}>
      <div className="flex items-start justify-between gap-3">
        <TeamGlyph id={offer.dept} />
        <ArrowUpRight
          size={18}
          aria-hidden="true"
          className="mt-1 shrink-0 text-faint transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent-text"
        />
      </div>
      <h3 className="text-title-3 font-semibold">
        <Link href={`/${locale}${agentPath(id)}`} className="after:absolute after:inset-0 after:rounded-card">
          {copy.title}
        </Link>
      </h3>
      <p className="text-callout text-muted">{copy.headline}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <Badge className="whitespace-normal">{t.trust[offer.trust]}</Badge>
        {showTeam && (
          <Link
            href={`/${locale}${aiTeamPath(offer.dept)}`}
            className="relative z-10 text-footnote text-muted underline-offset-4 hover:text-accent-text hover:underline"
          >
            {t.agents.page.partOf} {t.items[offer.dept].title}
          </Link>
        )}
      </div>
    </Card>
  )
}
