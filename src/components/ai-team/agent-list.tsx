import { ArrowUpRight } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import { agentCopy, agentOffer, agentPath, type AgentId } from '@/lib/ai-teams'
import { cn } from '@/lib/cn'
import { TrustChip } from './team-parts'

// One agent as a link row: title, the one-line promise and two plain chips (how much it does alone,
// whether it can be taken without the department). Used on the index and the department pages.
export function AgentRow({ id, locale, dict, className }: { id: AgentId; locale: string; dict: Dict; className?: string }) {
  const copy = agentCopy(id, dict)
  const offer = agentOffer(id)
  const t = dict.aiTeams.agents
  return (
    <Link
      href={`/${locale}${agentPath(id)}`}
      className={cn(
        'group flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-5 transition-[border-color,transform] duration-300 ease-out-expo hover:-translate-y-0.5 hover:border-line-strong',
        className,
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-lg font-semibold tracking-tight">{copy.title}</span>
        <ArrowUpRight
          size={18}
          aria-hidden="true"
          className="mt-1 shrink-0 text-faint transition-[transform,color] duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent-text"
        />
      </span>
      <span className="text-sm leading-relaxed text-muted">{copy.promise}</span>
      <span className="mt-auto flex flex-wrap gap-2 pt-1">
        <TrustChip trust={offer.trust} dict={dict} />
        <span className="inline-flex rounded-full border border-line px-2.5 py-0.5 text-xs text-faint">
          {offer.standalone ? t.standaloneYes : t.standaloneNo}
        </span>
      </span>
    </Link>
  )
}
