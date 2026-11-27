import {
  Brain,
  ChatCircleDots,
  CheckCircle,
  FileText,
  Globe,
  ShieldCheck,
  UsersThree,
} from '@phosphor-icons/react/ssr'
import type { ProductBlocks } from '@/content/product-pages'
import { buttonStyles, cn } from '@/lib/cn'
import { ChatOpenButton } from '../chat/chat-open-button'
import type { ProductSectionContext } from './shell'
import { Reveal } from '../reveal'
import { PultTour } from './pult-tour'
import { SectionShell } from './shell'

// Blocks of the «ИИ-компания» flagship page (owner 2026-11-22): company map, the control room tour, knowledge, trust
// levels, the team, four rollout stages. The Personal AI page has its own blocks in
// personal-blocks.tsx. Each takes its copy from productPage.items.<id>.
type Band = { band?: boolean }
type Req<K extends keyof ProductBlocks> = NonNullable<ProductBlocks[K]>

const card = 'rounded-card border border-line bg-surface'
const lime = 'border-accent-text/40 bg-[linear-gradient(160deg,var(--color-pine),var(--color-surface)_70%)]'

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

// The paid pilot of the flagships (owner 2026-11-25, replaces the free one): the first stage is the pilot, the
// length comes from `pricing.guarantee.pilotDays`, the terms are the guarantee line.
export function PilotBlock({ ctx, band }: { ctx: ProductSectionContext } & Band) {
  const t = ctx.guarantee.pilot
  return (
    <section id="pilot" data-product-section="pilot" data-tour="pilot" className={cn(band && 'border-y border-line bg-surface/40')}>
      <div className="mx-auto site-container py-section">
        <Reveal>
          <div className={cn('grid gap-8 rounded-card border p-6 md:p-10 lg:grid-cols-12 lg:items-center', lime)}>
            <div className="lg:col-span-8">
              <ShieldCheck size={30} weight="duotone" aria-hidden="true" className="text-accent-text" />
              <h2 className="mt-4 font-display text-title font-semibold text-balance">{t.title}</h2>
              <p className="mt-4 max-w-[56ch] text-lead text-muted">{t.text}</p>
              <p className="mt-3 max-w-[56ch] text-callout text-faint">{ctx.guarantee.line}</p>
            </div>
            <div className="lg:col-span-4">
              <ChatOpenButton source={`product_${ctx.id}_pilot`} fallbackHref="#next" className={buttonStyles.primary}>
                <ChatCircleDots size={18} weight="fill" aria-hidden="true" />
                {t.cta}
              </ChatOpenButton>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
