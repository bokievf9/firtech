import { ArrowDown, ArrowRight, CheckCircle, Gear, PaperPlaneTilt, ShieldCheck } from '@phosphor-icons/react/ssr'
import type { ComponentType } from 'react'
import type { Dict } from '@/content'
import { Reveal } from '../reveal'
import { Card } from '../ui'

const icons: ComponentType<{ size?: number; weight?: 'duotone'; 'aria-hidden'?: boolean | 'true'; className?: string }>[] = [Gear, PaperPlaneTilt, CheckCircle, ShieldCheck]

// How the agents work together, as four steps in a row: you set the rules, they prepare, you approve in your channel,
// trust grows. Arrows between the cards (down on phones, right from md).
export function TogetherFlow({ copy }: { copy: Dict['aiTeams']['together'] }) {
  return (
    <ol className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-stretch" data-together-flow>
      {copy.steps.flatMap((step, i) => {
        const Icon = icons[i] ?? Gear
        const card = (
          <li key={step.title} className="flex">
            <Reveal delay={i * 0.06} className="w-full">
              <Card className="h-full">
                <span className="grid size-10 place-items-center rounded-tile bg-pine text-accent-text">
                  <Icon size={22} weight="duotone" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-headline font-semibold">{step.title}</h3>
                <p className="mt-1 text-footnote text-muted">{step.text}</p>
              </Card>
            </Reveal>
          </li>
        )
        if (i === copy.steps.length - 1) return [card]
        return [
          card,
          <li key={`${step.title}-arrow`} aria-hidden="true" className="flex items-center justify-center text-faint">
            <ArrowDown size={20} className="md:hidden" />
            <ArrowRight size={20} className="hidden md:block" />
          </li>,
        ]
      })}
    </ol>
  )
}
