import {
  ArrowDown,
  ArrowRight,
  Buildings,
  ChatCircleDots,
  FileText,
  Files,
  Handshake,
  Headset,
  Plus,
  Receipt,
  Scroll,
  GlobeSimple,
  PencilSimpleLine,
  BookOpen,
  UserCircle,
  Users,
} from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { ComponentType } from 'react'
import { buttonClass } from '@/lib/cn'
import { FiraFlat } from '../fira/fira-flat'
import { ChatOpenButton } from '../chat/chat-open-button'
import { PageHero } from '../page-hero'
import { CompanyPlan } from '../products/plan-levels'
import { productIcons } from '../products/product-icons'
import { Badge, Card, GlassCard } from '../ui'
import { CompanyDemo } from './company-demo'
import { SectionShell, type ProductSectionContext } from './shell'

type Glyph = ComponentType<{ size?: number; weight?: 'duotone'; 'aria-hidden'?: boolean | 'true'; className?: string }>

const sourceIcons: Record<string, Glyph> = { site: GlobeSimple, price: Receipt, docs: FileText, rules: Scroll }
const outputIcons: Record<string, Glyph> = { staff: Users, clients: UserCircle }
const dayIcons: Record<string, Glyph> = {
  sales: Handshake,
  support: Headset,
  knowledge: BookOpen,
  backoffice: Files,
  content: PencilSimpleLine,
}

const well = 'grid size-10 shrink-0 place-items-center rounded-tile bg-pine text-accent-text'

// First screen of «ИИ вашей компании» (front v4): the result, one line, Fira, two actions. A conversation is the
// first action (owner 2026-11-22), the builder the second. The price is in the subscription block below.
export function CompanyHero({ ctx }: { ctx: ProductSectionContext }) {
  const { id, dict, page, buildHref } = ctx
  const Glyph = productIcons.company
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
          {dict.products.items[id].name}
        </Badge>
      }
    >
      <ChatOpenButton source="product_company_call" fallbackHref="#cdemo" className={buttonClass('primary', 'lg')}>
        <ChatCircleDots size={18} weight="fill" aria-hidden="true" />
        {hero.ask}
      </ChatOpenButton>
      <Link href={buildHref} data-cta="product_page_company_build" className={buttonClass('glass', 'lg')}>
        {hero.cta}
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </PageHero>
  )
}

function Connector() {
  return (
    <div aria-hidden="true" className="flex items-center justify-center text-faint">
      <ArrowDown size={22} className="lg:hidden" />
      <ArrowRight size={22} className="hidden lg:block" />
    </div>
  )
}

// «Один мозг компании»: what Fira knows on the left, Fira in the middle, who she answers on the right, and the roles
// below as chips that plug into her (skills, not an org chart).
export function BrainBlock({ ctx, band }: { ctx: ProductSectionContext; band?: boolean }) {
  const { dict, page } = ctx
  const copy = page.brain!
  return (
    <SectionShell id="brain" title={copy.title} sub={copy.sub} band={band}>
      <div data-brain>
        <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_minmax(0,1.1fr)_auto_1fr]">
          <Card className="flex flex-col gap-4" data-brain-sources>
            <p className="text-footnote font-medium text-muted">{copy.sourcesLabel}</p>
            <ul className="grid gap-3">
              {copy.sources.map((s) => {
                const Icon = sourceIcons[s.id] ?? FileText
                return (
                  <li key={s.id} className="flex items-center gap-3" data-brain-source={s.id}>
                    <span className={well}>
                      <Icon size={20} weight="duotone" aria-hidden="true" />
                    </span>
                    <span className="text-headline font-semibold">{s.name}</span>
                  </li>
                )
              })}
            </ul>
          </Card>
          <Connector />
          <GlassCard thickness="thick" className="flex flex-col items-center justify-center gap-2 text-center" data-brain-center>
            <FiraFlat emotion="idle" context="dashboard" className="block size-28 md:size-32" />
            <p className="font-display text-title-3 font-semibold">{dict.film.name}</p>
            <p className="text-callout text-muted">{copy.centerLine}</p>
          </GlassCard>
          <Connector />
          <Card className="flex flex-col gap-4" data-brain-outputs>
            <p className="text-footnote font-medium text-muted">{copy.outputsLabel}</p>
            <ul className="grid gap-4">
              {copy.outputs.map((o) => {
                const Icon = outputIcons[o.id] ?? Users
                return (
                  <li key={o.id} className="flex items-start gap-3" data-brain-output={o.id}>
                    <span className={well}>
                      <Icon size={20} weight="duotone" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-headline font-semibold">{o.name}</span>
                      <span className="mt-0.5 block text-footnote text-muted">{o.line}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>

        <div className="mt-4 flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong p-card" data-brain-roles>
          <p className="text-footnote font-medium text-muted">{copy.rolesLabel}</p>
          <ul className="flex flex-wrap justify-center gap-2">
            {copy.roles.map((role) => (
              <li key={role} className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-4 py-2 text-callout font-medium text-accent-text">
                <Buildings size={16} weight="duotone" aria-hidden="true" />
                {role}
              </li>
            ))}
            <li className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line-strong px-4 py-2 text-callout text-muted">
              <Plus size={14} aria-hidden="true" />
              {copy.more}
            </li>
          </ul>
          <p className="text-footnote text-faint">{copy.note}</p>
        </div>
      </div>
    </SectionShell>
  )
}

// «День компании с ИИ»: five moments on a hairline, one line each.
export function CdayBlock({ ctx, band }: { ctx: ProductSectionContext; band?: boolean }) {
  const copy = ctx.page.cday!
  return (
    <SectionShell id="cday" title={copy.title} sub={copy.sub} band={band}>
      <ol className="relative grid gap-6 border-l border-l-hairline border-line pl-8 md:max-w-2xl" data-company-day>
        {copy.items.map((item) => {
          const Icon = dayIcons[item.icon] ?? Buildings
          return (
            <li key={item.time} className="relative" data-company-hour={item.time}>
              <span
                aria-hidden="true"
                className="absolute top-0 -left-[3.1rem] grid size-9 place-items-center rounded-full border border-hairline border-line bg-elevated text-accent-text"
              >
                <Icon size={17} weight="duotone" aria-hidden="true" />
              </span>
              <p className="text-footnote text-muted">
                <span className="font-mono text-fg">{item.time}</span> {item.role}
              </p>
              <p className="mt-1 text-body">{item.text}</p>
            </li>
          )
        })}
      </ol>
    </SectionShell>
  )
}

// Ask Fira: signed out = the locked plate over a labelled scripted example; signed in = the real chat opens.
export function CdemoBlock({ ctx, band }: { ctx: ProductSectionContext; band?: boolean }) {
  const { dict, locale, page } = ctx
  const copy = page.cdemo!
  return (
    <SectionShell id="cdemo" title={copy.title} sub={copy.sub} band={band}>
      <CompanyDemo copy={copy} gate={dict.demoGate} badge={dict.demoSection.exampleBadge} name={dict.film.name} locale={locale} />
    </SectionShell>
  )
}

// The subscription card (setup, monthly, own key, per-employee line from the live pricing) and three short points.
export function CplanBlock({ ctx, band }: { ctx: ProductSectionContext; band?: boolean }) {
  const { dict, page } = ctx
  const copy = page.cplan!
  return (
    <SectionShell id="cplan" title={copy.title} sub={copy.sub} band={band}>
      <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-5">
          <CompanyPlan sub={dict.subscription} />
        </div>
        <ul className="grid gap-6 lg:col-span-7 lg:pt-2" data-company-points>
          {copy.points.map((point) => (
            <li key={point.title} className="border-t border-t-hairline border-line pt-4">
              <h3 className="text-headline font-semibold">{point.title}</h3>
              <p className="mt-1 text-callout text-muted">{point.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  )
}
