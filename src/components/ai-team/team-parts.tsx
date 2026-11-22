import {
  BuildingOffice,
  Files,
  Handshake,
  Headset,
  Kanban,
  Megaphone,
} from '@phosphor-icons/react/ssr'
import type { ComponentType } from 'react'
import type { Dict } from '@/content'
import { aiTeamAccent, type AiTeamId, type AiTeamTrust } from '@/lib/ai-teams'
import { cn } from '@/lib/cn'

export const aiTeamIcons: Record<AiTeamId, ComponentType<{ size?: number; weight?: 'duotone'; 'aria-hidden'?: boolean | 'true' }>> = {
  marketing: Megaphone,
  sales: Handshake,
  support: Headset,
  production: Kanban,
  backoffice: Files,
  company: BuildingOffice,
}

// A department glyph on its tinted square (department colours from globals.css).
export function TeamGlyph({ id, size = 22, className }: { id: AiTeamId; size?: number; className?: string }) {
  const Glyph = aiTeamIcons[id]
  const accent = aiTeamAccent[id]
  return (
    <span
      className={cn('grid size-11 shrink-0 place-items-center rounded-xl', accent.soft, accent.text, className)}
    >
      <Glyph size={size} weight="duotone" aria-hidden="true" />
    </span>
  )
}

// How much the agent does alone: a plain text chip, no status dot.
export function TrustChip({ trust, dict }: { trust: AiTeamTrust | string; dict: Dict }) {
  const label = dict.aiTeams.trust[trust as AiTeamTrust] ?? trust
  return (
    <span className="inline-flex rounded-full border border-line-strong px-2.5 py-0.5 text-xs text-muted">
      {label}
    </span>
  )
}
