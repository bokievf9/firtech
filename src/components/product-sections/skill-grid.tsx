'use client'

import {
  BellRinging,
  CalendarBlank,
  EnvelopeSimple,
  FileText,
  GraduationCap,
  Heartbeat,
  House,
  MagnifyingGlass,
  PencilSimpleLine,
  PhoneCall,
  Translate,
  Wallet,
} from '@phosphor-icons/react'
import type { ComponentType } from 'react'
import { useState } from 'react'
import { GlassCard } from '@/components/ui'
import { cn } from '@/lib/cn'

export const skillIcons: Record<string, ComponentType<{ size?: number; weight?: 'duotone'; 'aria-hidden'?: boolean | 'true' }>> = {
  mail: EnvelopeSimple,
  calendar: CalendarBlank,
  study: GraduationCap,
  money: Wallet,
  health: Heartbeat,
  languages: Translate,
  content: PencilSimpleLine,
  home: House,
  docs: FileText,
  reminders: BellRinging,
  calls: PhoneCall,
  search: MagnifyingGlass,
}

export type SkillTile = { id: string; name: string; hint: string; example: string }
export type SkillGroup = { id: string; name: string; tiles: SkillTile[] }

// «Что умеет»: twelve tiles in three groups, no paragraphs. A tile shows the icon, the builder's name and a short hint;
// the one-line example replaces the hint on hover or focus and on tap (one open tile at a time). The two lines share
// one grid cell, so the tile never changes height.
export function SkillGrid({ groups }: { groups: SkillGroup[] }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="grid gap-8" data-skills>
      {groups.map((group) => (
        <div key={group.id} data-skill-group={group.id}>
          <h3 className="text-footnote font-medium text-muted">{group.name}</h3>
          <ul className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {group.tiles.map((tile) => {
              const Glyph = skillIcons[tile.id]!
              const shown = open === tile.id
              return (
                <li key={tile.id} className="flex">
                  <GlassCard
                    as="button"
                    type="button"
                    aria-pressed={shown}
                    data-skill={tile.id}
                    onClick={() => setOpen(shown ? null : tile.id)}
                    className="group/tile pressable lift flex w-full flex-col items-start gap-3 p-4 text-left md:p-5"
                    padded={false}
                  >
                    <span className="grid size-10 place-items-center rounded-tile bg-pine text-accent-text">
                      <Glyph size={22} weight="duotone" aria-hidden="true" />
                    </span>
                    <span className="text-headline font-semibold">{tile.name}</span>
                    <span className="grid w-full">
                      <span
                        className={cn(
                          'col-start-1 row-start-1 text-footnote text-muted transition-opacity duration-200 group-hover/tile:opacity-0 group-focus-visible/tile:opacity-0',
                          shown && 'opacity-0',
                        )}
                      >
                        {tile.hint}
                      </span>
                      <span
                        className={cn(
                          'col-start-1 row-start-1 text-footnote text-fg opacity-0 transition-opacity duration-200 group-hover/tile:opacity-100 group-focus-visible/tile:opacity-100',
                          shown && 'opacity-100',
                        )}
                      >
                        {tile.example}
                      </span>
                    </span>
                  </GlassCard>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
