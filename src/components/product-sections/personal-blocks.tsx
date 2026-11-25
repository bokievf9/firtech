import { ArrowRight } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { handText, whoText } from '@/content/builder-personal'
import { buttonClass } from '@/lib/cn'
import { personaKinds, personalBuilderHref, skillGroups, type SkillGroupId } from '@/lib/personal-page'
import { ChatOpenButton } from '../chat/chat-open-button'
import { PageHero } from '../page-hero'
import { PlanLevels } from '../products/plan-levels'
import { Badge } from '../ui'
import { PersonalLive } from './personal-live'
import { QuestionChips } from './question-chips'
import { SectionShell, type ProductSectionContext } from './shell'
import { SkillGrid } from './skill-grid'
import { productIcons } from '../products/product-icons'
import type { PersonalHand } from '@/lib/builder-ids'

type Props = { ctx: ProductSectionContext; band?: boolean }

// The blocks of the «Персональный ИИ» page (front v4, owner 2026-11-22: «слишком много текста», one visual section for
// the skills, the demo locked when signed out, no founder section). Names of people and skills come from the builder's
// own strings (content/builder-personal.ts), so the page and the builder say the same words.

// First screen: the result, one line, Fira, two actions. The price is in the levels below.
export function PersonalHero({ ctx }: { ctx: ProductSectionContext }) {
  const { locale, dict, page } = ctx
  const Glyph = productIcons.personal
  const hero = page.heroCta!
  return (
    <PageHero
      title={page.result}
      portal
      portalAlt={dict.film.name}
      lead={page.lead}
      attrs={{ 'data-product-section': 'hero' }}
      before={
        <Badge tone="glass" className="gap-2">
          <Glyph size={14} aria-hidden="true" />
          {dict.products.items.personal.name}
        </Badge>
      }
    >
      <Link href={personalBuilderHref(locale)} data-cta="product_page_personal_build" className={buttonClass('primary', 'lg')}>
        {hero.cta}
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
      <ChatOpenButton source="product_personal" fallbackHref="#plans" className={buttonClass('glass', 'lg')}>
        {hero.ask}
      </ChatOpenButton>
    </PageHero>
  )
}

// «Что умеет»: twelve skill tiles of the builder's `hand` ids in three groups.
export function SkillsBlock({ ctx, band }: Props) {
  const { locale, page } = ctx
  const copy = page.skills!
  const lang = locale
  const groups = copy.groups.map((g) => ({
    id: g.id,
    name: g.name,
    tiles: skillGroups[g.id as SkillGroupId].map((id) => ({
      id,
      name: handText[id].name[lang],
      hint: handText[id].hint[lang],
      example: copy.examples[id] ?? '',
    })),
  }))
  return (
    <SectionShell id="skills" title={copy.title} sub={copy.sub} band={band}>
      <SkillGrid groups={groups} />
    </SectionShell>
  )
}

// «Кто вы»: persona picker, the compact day and the demo (live when signed in, locked when signed out).
export function PersonaBlock({ ctx, band }: Props) {
  const { locale, dict, page } = ctx
  const copy = page.myday!
  const people = personaKinds.map((id) => ({ id: id as string, name: whoText[id].name[locale] }))
  const skillNames = Object.fromEntries((Object.keys(handText) as PersonalHand[]).map((id) => [id, handText[id].name[locale]]))
  return (
    <SectionShell id="myday" title={copy.title} sub={copy.sub} band={band}>
      <PersonalLive copy={copy} people={people} skillNames={skillNames} gate={dict.demoGate} badge={dict.demoSection.exampleBadge} locale={locale} />
    </SectionShell>
  )
}

// The three levels as subscription cards (live prices, own-key switch), one short «для кого» line each.
export function PlansBlock({ ctx, band }: Props) {
  const { dict, page } = ctx
  const copy = page.plans!
  return (
    <SectionShell id="plans" title={copy.title} sub={copy.sub} band={band}>
      <PlanLevels products={dict.products} copy={dict.productPage.planLevels} sub={dict.subscription} />
    </SectionShell>
  )
}

// Three steps on a hairline, then the builder button.
export function StartBlock({ ctx, band }: Props) {
  const { locale, page, id } = ctx
  const copy = page.start!
  const href = id === 'personal' ? personalBuilderHref(locale) : ctx.buildHref
  return (
    <SectionShell id="start" title={copy.title} band={band}>
      <ol className="grid gap-8 md:grid-cols-3 md:gap-6" data-start-steps>
        {copy.steps.map((step, i) => (
          <li key={step.title} className="relative md:pt-10">
            <span aria-hidden="true" className="absolute top-0 left-0 hidden h-px w-full bg-line md:block" />
            <span className="grid size-9 place-items-center rounded-full bg-accent font-mono text-callout text-accent-ink md:absolute md:top-0 md:-translate-y-1/2">{i + 1}</span>
            <h3 className="mt-3 text-headline font-semibold md:mt-0">{step.title}</h3>
            <p className="mt-1 text-callout text-muted">{step.text}</p>
          </li>
        ))}
      </ol>
      <div className="mt-12">
        <Link href={href} data-cta={`product_page_${id}_start`} className={buttonClass('primary', 'lg')}>
          {copy.cta}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </SectionShell>
  )
}

// Four short questions as expandable chips.
export function QuestionsBlock({ ctx, band }: Props) {
  const copy = ctx.page.questions!
  return (
    <SectionShell id="questions" title={copy.title} band={band} className="pb-section">
      <QuestionChips items={ctx.page.objections.slice(0, 4)} />
    </SectionShell>
  )
}
