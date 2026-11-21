import {
  ArrowRight,
  Brain,
  ChatCircleDots,
  CheckCircle,
  Cube,
  FileText,
  Gift,
  Globe,
  Microphone,
  ShieldCheck,
  TelegramLogo,
  UsersThree,
} from '@phosphor-icons/react/ssr'
import type { ProductBlocks } from '@/content/product-pages'
import { buttonStyles, cn } from '@/lib/cn'
import { ChatOpenButton } from '../chat/chat-open-button'
import { Reveal } from '../reveal'
import { SpotlightCard } from '../spotlight-card'
import { MyDay } from './my-day'
import { PultTour } from './pult-tour'
import { SectionShell } from './shell'

// Blocks of the two flagship pages (owner 2026-11-22): «Персональный ИИ» (day, memory, where it lives, setup,
// the founder's live cases) and «ИИ-компания» (company map, the control room tour, knowledge, trust levels, the
// team, four rollout stages), plus the pilot offer both carry. Each takes its copy from productPage.items.<id>.
type Band = { band?: boolean }
type Req<K extends keyof ProductBlocks> = NonNullable<ProductBlocks[K]>

const card = 'rounded-card border border-line bg-surface'
const lime = 'border-accent-text/40 bg-[linear-gradient(160deg,var(--color-pine),var(--color-surface)_70%)]'

export function MyDayBlock({ copy, band, note }: { copy: Req<'myday'>; note: string } & Band) {
  return (
    <SectionShell id="myday" title={copy.title} sub={copy.sub} band={band}>
      <MyDay copy={copy} note={note} />
    </SectionShell>
  )
}

// What it remembers: three columns (people, habits, promises), each fact with what the AI does with it.
export function MemoryBlock({ copy, band }: { copy: Req<'memory'> } & Band) {
  return (
    <SectionShell id="memory" title={copy.title} sub={copy.sub} band={band}>
      <div className="grid gap-gutter md:grid-cols-3" data-memory>
        {copy.groups.map((group, g) => (
          <Reveal key={group.name} delay={g * 0.06} className="h-full">
            <div className={cn(card, 'h-full p-5 md:p-6')}>
              <p className="font-mono text-xs tracking-[0.14em] text-accent-text uppercase">{group.name}</p>
              <ul className="mt-5 grid gap-4">
                {group.items.map((item) => (
                  <li key={item.fact} className="border-t border-line pt-4 first:border-0 first:pt-0">
                    <p className="font-medium leading-snug">{item.fact}</p>
                    <p className="mt-1.5 flex gap-2 text-sm leading-snug text-muted">
                      <ArrowRight size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-accent-text" />
                      {item.use}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
      <p className="mt-6 flex max-w-[70ch] gap-2 text-sm leading-relaxed text-muted">
        <ShieldCheck size={18} weight="duotone" aria-hidden="true" className="shrink-0 text-accent-text" />
        {copy.control}
      </p>
    </SectionShell>
  )
}

const liveIcons = [TelegramLogo, Microphone, Cube, ShieldCheck]

// Where it lives: Telegram, voice, its own container, the data stays yours.
export function LivesBlock({ copy, band }: { copy: Req<'lives'> } & Band) {
  return (
    <SectionShell id="lives" title={copy.title} sub={copy.sub} band={band}>
      <ul className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-4" data-lives>
        {copy.items.map((item, i) => {
          const Glyph = liveIcons[i] ?? Cube
          return (
            <li key={item.title}>
              <Reveal delay={i * 0.05} className="h-full">
                <div className={cn(card, 'h-full p-6')}>
                  <Glyph size={26} weight="duotone" aria-hidden="true" className="text-accent-text" />
                  <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.text}</p>
                </div>
              </Reveal>
            </li>
          )
        })}
      </ul>
    </SectionShell>
  )
}

// How we set it up: four steps on a line, «when» above each.
export function SetupBlock({ copy, band }: { copy: Req<'setup'> } & Band) {
  return (
    <SectionShell id="setup" title={copy.title} sub={copy.sub} band={band}>
      <ol className="relative grid gap-gutter md:grid-cols-4" data-setup>
        <span aria-hidden="true" className="absolute top-4 right-0 left-0 hidden h-px bg-line md:block" />
        {copy.steps.map((step, i) => (
          <li key={step.title} className="relative">
            <Reveal delay={i * 0.07}>
              <span className="relative grid size-8 place-items-center rounded-full bg-accent font-mono text-sm text-accent-ink">{i + 1}</span>
              <p className="mt-4 font-mono text-xs tracking-[0.14em] text-accent-text uppercase">{step.when}</p>
              <h3 className="mt-2 text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{step.text}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </SectionShell>
  )
}

// The founder's own AIs as two «живой пример» cards, without prices (they are not sold on their own).
export function CasesBlock({ copy, band }: { copy: Req<'cases'> } & Band) {
  return (
    <SectionShell id="cases" title={copy.title} sub={copy.sub} band={band}>
      <ul className="grid gap-gutter md:grid-cols-2" data-cases>
        {copy.items.map((item, i) => (
          <li key={item.name}>
            <Reveal delay={i * 0.08} className="h-full">
              <SpotlightCard className={cn('h-full rounded-card border p-6 md:p-8', lime)}>
                <p className="inline-flex rounded-full bg-accent/15 px-3 py-1 text-xs text-accent-text">{copy.label}</p>
                <h3 className="mt-5 font-display text-3xl font-semibold tracking-tight">{item.name}</h3>
                <p className="mt-1 text-muted">{item.role}</p>
                <ul className="mt-6 grid gap-2.5">
                  {item.does.map((line) => (
                    <li key={line} className="flex gap-2.5">
                      <CheckCircle size={18} weight="fill" aria-hidden="true" className="mt-0.5 shrink-0 text-accent-text" />
                      {line}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 border-t border-line pt-4 text-sm text-faint">{item.runs}</p>
              </SpotlightCard>
            </Reveal>
          </li>
        ))}
      </ul>
      <p className="mt-6 max-w-[60ch] text-sm text-muted">{copy.note}</p>
    </SectionShell>
  )
}

// The map of the AI company: you on top, Fira as the Director, then the departments with their roles and one
// example each. Built as a tree (lines in CSS), different from the simpler org chart of the AI department page.
export function StructureBlock({ copy, band }: { copy: Req<'structure'> } & Band) {
  return (
    <SectionShell id="structure" title={copy.title} sub={copy.sub} band={band}>
      <div data-structure className="grid justify-items-center gap-4">
        <Reveal className="w-full max-w-md">
          <div className={cn(card, 'p-5 text-center')}>
            <p className="font-mono text-xs tracking-[0.14em] text-faint uppercase">{copy.owner.name}</p>
            <p className="mt-2 leading-snug">{copy.owner.does}</p>
          </div>
        </Reveal>
        <span aria-hidden="true" className="h-6 w-px bg-line-strong" />
        <Reveal className="w-full max-w-md" delay={0.06}>
          <div className={cn('rounded-card border p-5 text-center', lime)}>
            <p className="font-display text-xl font-semibold">{copy.director.name}</p>
            <p className="mt-2 leading-snug text-muted">{copy.director.does}</p>
          </div>
        </Reveal>
        <span aria-hidden="true" className="h-6 w-px bg-line-strong" />
        <ul className="grid w-full gap-gutter sm:grid-cols-2 lg:grid-cols-4">
          {copy.depts.map((dept, i) => (
            <li key={dept.name}>
              <Reveal delay={0.1 + i * 0.05} className="h-full">
                <div className={cn(card, 'flex h-full flex-col p-5')}>
                  <h3 className="text-lg font-semibold">{dept.name}</h3>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {dept.roles.map((role) => (
                      <li key={role} className="rounded-full border border-line-strong px-2.5 py-1 text-xs text-muted">
                        {role}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-auto border-t border-line pt-3 text-sm leading-snug text-muted">{dept.example}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-6 text-sm text-muted">{copy.note}</p>
    </SectionShell>
  )
}

export function PultBlock({ copy, band }: { copy: Req<'pult'> } & Band) {
  return (
    <SectionShell id="pult" title={copy.title} sub={copy.sub} band={band}>
      <PultTour copy={copy} />
    </SectionShell>
  )
}

const sourceIcons = [FileText, Globe, ChatCircleDots]

// Knowledge: three sources flow into one answer with its source.
export function KnowledgeBlock({ copy, band }: { copy: Req<'knowledge'> } & Band) {
  return (
    <SectionShell id="knowledge" title={copy.title} sub={copy.sub} band={band}>
      <div className="grid items-center gap-gutter lg:grid-cols-12" data-knowledge>
        <ul className="grid gap-3 lg:col-span-5">
          {copy.sources.map((s, i) => {
            const Glyph = sourceIcons[i] ?? FileText
            return (
              <li key={s.name}>
                <Reveal delay={i * 0.06}>
                  <div className={cn(card, 'flex items-center gap-4 p-4')}>
                    <Glyph size={24} weight="duotone" aria-hidden="true" className="shrink-0 text-accent-text" />
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-sm text-muted">{s.text}</p>
                    </div>
                  </div>
                </Reveal>
              </li>
            )
          })}
        </ul>
        <div aria-hidden="true" className="hidden justify-center lg:col-span-1 lg:flex">
          <Brain size={30} weight="duotone" className="text-accent-text" />
        </div>
        <Reveal className="lg:col-span-6" delay={0.15}>
          <div className="glass rounded-panel p-4 md:p-6">
            <p className="ml-auto max-w-[85%] rounded-[18px] rounded-br-md bg-accent px-4 py-2.5 text-[15px] leading-snug text-accent-ink">{copy.ask}</p>
            <p className="mt-2.5 max-w-[92%] rounded-[18px] rounded-bl-md bg-surface-2 px-4 py-3 text-[15px] leading-snug">{copy.answer}</p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1 text-xs text-muted">
              <FileText size={13} aria-hidden="true" className="text-accent-text" />
              {copy.source}
            </p>
          </div>
        </Reveal>
      </div>
    </SectionShell>
  )
}

// Trust levels as a rising staircase: each step higher than the last.
export function TrustBlock({ copy, band }: { copy: Req<'trust'> } & Band) {
  return (
    <SectionShell id="trust" title={copy.title} sub={copy.sub} band={band}>
      <ol className="grid items-end gap-gutter md:grid-cols-3" data-trust>
        {copy.levels.map((level, i) => (
          <li key={level.name} className={cn(i === 1 && 'md:pt-10', i === 0 && 'md:pt-20')}>
            <Reveal delay={i * 0.08} className="h-full">
              <div className={cn('flex h-full flex-col rounded-card border p-6', i === copy.levels.length - 1 ? lime : 'border-line bg-surface')}>
                <p className="font-mono text-xs text-accent-text">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="mt-3 text-xl font-semibold">{level.name}</h3>
                <p className="mt-2 leading-relaxed text-muted">{level.text}</p>
                <p className="mt-auto border-t border-line pt-3 text-sm">{level.example}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
      <p className="mt-6 flex gap-2 text-sm text-muted">
        <ShieldCheck size={18} weight="duotone" aria-hidden="true" className="shrink-0 text-accent-text" />
        {copy.note}
      </p>
    </SectionShell>
  )
}

export function TeamGetsBlock({ copy, band }: { copy: Req<'teamgets'> } & Band) {
  return (
    <SectionShell id="teamgets" title={copy.title} sub={copy.sub} band={band}>
      <ul className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-4" data-teamgets>
        {copy.items.map((item, i) => (
          <li key={item.title}>
            <Reveal delay={i * 0.05} className="h-full">
              <div className={cn(card, 'h-full p-6')}>
                <UsersThree size={24} weight="duotone" aria-hidden="true" className="text-accent-text" />
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.text}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}

// Four rollout stages, what happens and what you see at each (the money per stage is in the price block below).
export function RolloutBlock({ copy, band }: { copy: Req<'rollout'> } & Band) {
  return (
    <SectionShell id="rollout" title={copy.title} sub={copy.sub} band={band}>
      <ol className="grid gap-3" data-rollout>
        {copy.stages.map((stage, i) => (
          <li key={stage.title}>
            <Reveal delay={Math.min(i, 3) * 0.05}>
              <div className={cn(card, 'grid gap-3 p-5 md:grid-cols-[3rem_minmax(0,1.2fr)_minmax(0,1fr)] md:items-start md:gap-6 md:p-6')}>
                <span className="grid size-9 place-items-center rounded-full bg-accent font-mono text-sm text-accent-ink">{i + 1}</span>
                <div>
                  <h3 className="text-lg font-semibold">{stage.title}</h3>
                  <p className="mt-1.5 leading-relaxed text-muted">{stage.text}</p>
                </div>
                <p className="flex gap-2 text-sm leading-snug md:border-l md:border-line md:pl-6">
                  <CheckCircle size={16} weight="fill" aria-hidden="true" className="mt-0.5 shrink-0 text-accent-text" />
                  {stage.see}
                </p>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </SectionShell>
  )
}

// The pilot offer of the flagships (owner 2026-11-22): the first one or two pilots free for a case study and a review.
export function PilotBlock({ copy, band, id }: { copy: Req<'pilot'>; id: string } & Band) {
  return (
    <section id="pilot" data-product-section="pilot" className={cn(band && 'border-y border-line bg-surface/40')}>
      <div className="mx-auto max-w-7xl px-4 py-section md:px-8">
        <Reveal>
          <div className={cn('grid gap-8 rounded-card border p-6 md:p-10 lg:grid-cols-12 lg:items-center', lime)}>
            <div className="lg:col-span-7">
              <Gift size={30} weight="duotone" aria-hidden="true" className="text-accent-text" />
              <h2 className="mt-4 font-display text-title font-semibold text-balance">{copy.title}</h2>
              <p className="mt-4 max-w-[56ch] text-lead text-muted">{copy.text}</p>
            </div>
            <div className="lg:col-span-5">
              <ul className="grid gap-2.5">
                {copy.terms.map((term) => (
                  <li key={term} className="flex gap-2.5">
                    <CheckCircle size={18} weight="fill" aria-hidden="true" className="mt-0.5 shrink-0 text-accent-text" />
                    {term}
                  </li>
                ))}
              </ul>
              <ChatOpenButton source={`product_${id}_pilot`} fallbackHref="#next" className={cn(buttonStyles.primary, 'mt-6')}>
                <ChatCircleDots size={18} weight="fill" aria-hidden="true" />
                {copy.cta}
              </ChatOpenButton>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
