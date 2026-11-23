'use client'

import { Crown, Handshake, Hammer, Lifebuoy, Megaphone, Wallet, type Icon } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'
import { deptTheme } from '@/lib/shell-theme'
import { initials, panelOfDept, presenceBadge, type Presence } from '@/lib/team'

const DEPT_ICON: Record<string, Icon> = { director: Crown, marketing: Megaphone, sales: Handshake, support: Lifebuoy, production: Hammer, backoffice: Wallet }

const TONE: Record<'ok' | 'warn' | 'muted' | 'off', string> = {
  ok: 'bg-accent',
  warn: 'bg-warn',
  muted: 'bg-faint',
  off: 'border border-line-strong bg-transparent',
}

// The coloured dot and its words (the dot alone never carries the meaning).
export function PresenceDot({ presence, withLabel = true, className }: { presence: Presence; withLabel?: boolean; className?: string }) {
  const b = presenceBadge(presence)
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-muted', className)} data-presence={presence}>
      <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', TONE[b.tone])} />
      {withLabel ? b.label : <span className="sr-only">{b.label}</span>}
    </span>
  )
}

// Avatar: the initials of the role on the department's tint, with the department icon in the corner.
export function Avatar({ title, dept, size = 40 }: { title: string; dept: string; size?: number }) {
  const panel = panelOfDept(dept)
  const t = deptTheme(panel)
  const Ico = DEPT_ICON[panel] ?? Crown
  return (
    <span aria-hidden="true" className={cn('relative inline-grid shrink-0 place-items-center rounded-full font-medium', t.cls.chip)} style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}>
      {initials(title)}
      <span className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-surface ring-1 ring-line">
        <Ico size={10} weight="fill" className={t.cls.text} />
      </span>
    </span>
  )
}
