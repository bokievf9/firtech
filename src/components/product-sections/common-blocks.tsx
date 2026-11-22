import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChatCircleDots,
  Check,
  ShieldCheck,
  TelegramLogo,
  X,
} from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { buttonStyles, cn } from '@/lib/cn'
import { ladderOfProduct } from '@/lib/product-page'
import { ChatOpenButton } from '../chat/chat-open-button'
import { DemoAssistant } from '../demo/demo-assistant'
import { DemoBooking } from '../demo/demo-booking'
import { DemoChat } from '../demo/demo-chat'
import { HeroIntro } from '../hero-intro'
import { CapabilityMock, type MockKind } from '../products/capability-mock'
import { FiraHero } from '../products/fira-hero'
import { CompanyPlan, PlanLevels } from '../products/plan-levels'
import { productIcons } from '../products/product-icons'
import { ProductPriceTag } from '../products/product-price'
import { Reveal } from '../reveal'
import { SpotlightCard } from '../spotlight-card'
import { StageTable } from '../stage-table'
import { SectionShell, type ProductSectionContext } from './shell'

type Props = { ctx: ProductSectionContext; band?: boolean }

// First screen: the client's result is the headline, the product name sits above it, then the lead, the two main
// actions and the live price card.
// Flagships: the AI company shows Fira as its face and puts the call first (owner 2026-11-22).
export function ProductHero({ ctx }: Props) {
  const { id, locale, dict, page, buildHref, layout, telegramUrl } = ctx
  const t = dict.productPage
  const item = dict.products.items[id]
  const rung = ladderOfProduct(id)
  const Glyph = productIcons[id]
  const build = (
    <Link
      href={buildHref}
      data-cta={`product_page_${id}_build`}
      className={cn(layout.callFirst ? buttonStyles.secondary : buttonStyles.primary, 'group')}
    >
      {t.cta}
      <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
    </Link>
  )
  return (
    <section className="mx-auto grid max-w-7xl items-end gap-12 px-4 pt-32 pb-20 md:px-8 md:pt-40 lg:grid-cols-12" data-product-section="hero">
      <HeroIntro className="lg:col-span-8">
        <Link href={`/${locale}#products`} className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg">
          <ArrowLeft size={14} aria-hidden="true" />
          {t.back}
        </Link>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-line-strong text-accent-text">
            <Glyph size={22} aria-hidden="true" />
          </span>
          <p className="text-sm font-medium">{item.name}</p>
          {rung && (
            <Link href={`/${locale}#levels`} className="rounded-full bg-accent/15 px-3 py-1 text-xs text-accent-text">
              {t.ladderLabel}: {dict.ladder.levels[rung.level]}
            </Link>
          )}
        </div>
        <h1 className="mt-5 max-w-[20ch] font-display text-[2.4rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-6xl">
          {page.result}
        </h1>
        <p className="mt-6 max-w-[56ch] text-lead text-muted">{page.lead}</p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          {layout.callFirst ? (
            <>
              <ChatOpenButton source={`product_${id}_call`} fallbackHref={telegramUrl ?? '#price'} className={buttonStyles.primary}>
                <ChatCircleDots size={18} weight="fill" aria-hidden="true" />
                {t.readiness.hot.call}
              </ChatOpenButton>
              {build}
            </>
          ) : (
            <>
              {build}
              <ChatOpenButton source={`product_${id}`} fallbackHref="#price" className={buttonStyles.secondary}>
                {t.ask}
              </ChatOpenButton>
            </>
          )}
        </div>
      </HeroIntro>
      <Reveal className="lg:col-span-4" delay={0.3}>
        {layout.face === 'fira' && <FiraHero label={dict.film.name} />}
        <div className={cn('rounded-card border border-line bg-surface p-7', layout.face === 'fira' && '-mt-6 relative')}>
          <ProductPriceTag id={id} copy={dict.products} className="[&_span]:text-2xl sm:[&_span]:text-3xl [&_p]:text-base" />
          <p className="mt-6 border-t border-line pt-5 text-sm leading-relaxed text-muted">{item.forWhom}</p>
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-faint">
            <ShieldCheck size={16} weight="duotone" aria-hidden="true" className="shrink-0 text-accent-text" />
            {dict.guarantee.line}
          </p>
        </div>
      </Reveal>
    </section>
  )
}

// A working demo right on the page: the real lead-manager chat, the booking scenario or the assistant.
export function DemoBlock({ ctx, band }: Props) {
  const copy = ctx.page.demo
  if (!copy || !ctx.layout.demo) return null
  const d = ctx.dict.demoSection
  return (
    <SectionShell id="demo" title={copy.title} sub={copy.sub} band={band}>
      <div className="rounded-card border border-line bg-surface p-4 md:p-8" data-product-demo={ctx.layout.demo}>
        {ctx.layout.demo === 'chat' && <DemoChat copy={d.receptionist} gate={ctx.dict.demoGate} badge={d.exampleBadge} locale={ctx.locale} />}
        {ctx.layout.demo === 'booking' && <DemoBooking copy={d.admin} badge={d.exampleBadge} />}
        {ctx.layout.demo === 'assistant' && <DemoAssistant copy={d.personal} gate={ctx.dict.demoGate} locale={ctx.locale} badge={d.exampleBadge} />}
      </div>
    </SectionShell>
  )
}

// What it does: a list with a one-line example and a small CSS picture each.
export function CapabilitiesBlock({ ctx, band }: Props) {
  const t = ctx.dict.productPage
  return (
    <SectionShell id="capabilities" title={t.capabilitiesTitle} band={band}>
      <ul className="grid gap-gutter md:grid-cols-6">
        {ctx.page.capabilities.map((cap, i) => (
          <li key={cap.title} className={cn(i < 2 ? 'md:col-span-3' : 'md:col-span-2')}>
            <Reveal delay={(i % 3) * 0.06} className="h-full">
              <SpotlightCard className="flex h-full flex-col gap-4 rounded-card border border-line bg-surface p-5 md:p-6">
                <CapabilityMock kind={cap.mock as MockKind} example={cap.example} chips={cap.chips} />
                <h3 className="text-xl font-semibold tracking-tight">{cap.title}</h3>
                <p className="leading-relaxed text-muted">{cap.text}</p>
                <p className="mt-auto border-t border-line pt-3 text-sm text-muted">
                  <span className="text-faint">{t.exampleLabel}: </span>
                  {cap.example}
                </p>
              </SpotlightCard>
            </Reveal>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-faint">{t.mockNote}</p>
    </SectionShell>
  )
}

// The first day, week and month.
export function FirstBlock({ ctx, band }: Props) {
  const t = ctx.dict.productPage
  return (
    <SectionShell id="first" title={t.firstTitle} band={band}>
      <ol className="grid gap-gutter md:grid-cols-3">
        {(['day', 'week', 'month'] as const).map((key, i) => (
          <li key={key}>
            <Reveal delay={i * 0.07} className="h-full">
              <div className="h-full rounded-card border border-line bg-surface p-6 md:p-7">
                <p className="font-mono text-xs tracking-[0.14em] text-accent-text uppercase">{t.first[key]}</p>
                <p className="mt-4 leading-relaxed">{ctx.page.first[key]}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </SectionShell>
  )
}

function Lines({ lines, yes }: { lines: string[]; yes: boolean }) {
  return (
    <ul className="mt-6 grid gap-3">
      {lines.map((line) => (
        <li key={line} className={cn('flex gap-3', !yes && 'text-muted')}>
          {yes ? (
            <Check size={16} weight="bold" aria-hidden="true" className="mt-1 shrink-0 text-accent-text" />
          ) : (
            <X size={16} weight="bold" aria-hidden="true" className="mt-1 shrink-0 text-faint" />
          )}
          {line}
        </li>
      ))}
    </ul>
  )
}

function TwoColumns({ id, left, right, band }: { id: string; left: [string, string[]]; right: [string, string[]]; band?: boolean }) {
  return (
    <section id={id} data-product-section={id} data-tour={id} className={cn(band && 'border-y border-line bg-surface/40')}>
      <div className="mx-auto grid max-w-7xl gap-x-gutter gap-y-12 px-4 py-section md:grid-cols-2 md:px-8">
        <Reveal>
          <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{left[0]}</h2>
          <Lines lines={left[1]} yes />
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{right[0]}</h2>
          <Lines lines={right[1]} yes={false} />
        </Reveal>
      </div>
    </section>
  )
}

// What we need from you and what it does not do.
export function ScopeBlock({ ctx, band }: Props) {
  const t = ctx.dict.productPage
  return <TwoColumns id="scope" band={band} left={[t.needsTitle, ctx.page.needs]} right={[t.notTitle, ctx.page.not]} />
}

// What the price includes and what is paid separately.
export function IncludedBlock({ ctx, band }: Props) {
  const t = ctx.dict.productPage
  return <TwoColumns id="included" band={band} left={[t.includedTitle, ctx.page.inPrice]} right={[t.notIncludedTitle, ctx.page.notInPrice]} />
}

// The live price, the stage table of the product's template and the term of the main part (all from pricing).
export function PriceBlock({ ctx, band }: Props) {
  const { id, dict, locale, payment, term } = ctx
  const t = dict.productPage
  return (
    <SectionShell id="price" title={t.priceTitle} sub={t.priceSub} band={band}>
      <Reveal>
        <div className="rounded-card border border-line bg-surface p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            {/* The Personal AI shows its three levels as cards below instead of the plan lines. */}
            {id !== 'personal' && id !== 'company' && (
              <ProductPriceTag id={id} copy={dict.products} className="[&_span]:text-2xl sm:[&_span]:text-3xl [&_p]:text-base" />
            )}
            {term && (
              <div className="md:text-right" data-product-term>
                <p className="text-sm text-faint">{t.termLabel}</p>
                <p className="mt-1 font-mono text-xl">{term}</p>
              </div>
            )}
          </div>
          {id === 'personal' && (
            <div className="mt-8">
              <PlanLevels products={dict.products} copy={t.planLevels} sub={dict.subscription} />
            </div>
          )}
          {id === 'company' && (
            <div className="mt-2">
              <CompanyPlan sub={dict.subscription} />
            </div>
          )}
          {payment.kind === 'stages' && payment.byQuote && <p className="mt-6 max-w-[60ch] text-sm leading-relaxed text-muted">{t.fromNote}</p>}
          {payment.kind === 'stages' && (
            <div className="mt-8">
              <StageTable stages={payment.stages} dict={dict} locale={locale} title={t.stageTitle} note={t.stageNote} />
            </div>
          )}
          {payment.kind === 'subscription' && <p className="mt-6 max-w-[60ch] text-sm leading-relaxed text-muted">{t.subscription}</p>}
          {payment.kind === 'quote' && <p className="mt-6 max-w-[60ch] text-sm leading-relaxed text-muted">{t.quoteNote}</p>}
          {term && <p className="mt-4 max-w-[60ch] text-[13px] leading-relaxed text-faint">{t.termNote}</p>}
        </div>
      </Reveal>
    </SectionShell>
  )
}

// The offer from the terms: the guarantee (word for word), payment by stages, two rounds of revisions, 7-day
// acceptance and 30 days of fixes. Nothing here is a new promise.
export function OfferBlock({ ctx, band }: Props) {
  const { dict, locale } = ctx
  const t = dict.productPage
  const items = [t.offer.stages, t.offer.revisions, t.offer.acceptance, t.offer.support]
  return (
    <SectionShell id="offer" title={t.offerTitle} sub={t.offerSub} band={band}>
      <div className="grid gap-gutter lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <div className="flex h-full flex-col rounded-card border border-accent-text/40 bg-[linear-gradient(150deg,var(--color-pine),var(--color-surface)_75%)] p-6 md:p-8">
            <ShieldCheck size={28} weight="duotone" aria-hidden="true" className="text-accent-text" />
            <h3 className="mt-4 text-xl font-semibold">{t.offer.guarantee}</h3>
            <p className="mt-3 text-lg leading-relaxed">{dict.guarantee.line}</p>
            <Link
              href={`/${locale}/terms#terms-guarantee`}
              className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm text-muted underline decoration-line-strong underline-offset-4 hover:text-accent-text"
            >
              {dict.guarantee.more}
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
        <ul className="grid gap-gutter sm:grid-cols-2 lg:col-span-7">
          {items.map((item, i) => (
            <li key={item.title}>
              <Reveal delay={0.05 + i * 0.05} className="h-full">
                <div className="h-full rounded-card border border-line bg-surface p-5 md:p-6">
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
      <Link
        href={`/${locale}/terms`}
        className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted underline decoration-line-strong underline-offset-4 hover:text-accent-text"
      >
        {t.offer.terms}
        <ArrowUpRight size={14} aria-hidden="true" />
      </Link>
    </SectionShell>
  )
}

// The doubts of this product's buyers with a straight answer each (cards, not an FAQ: the FAQ lives on the home page).
export function ObjectionsBlock({ ctx, band }: Props) {
  const t = ctx.dict.productPage
  return (
    <SectionShell id="objections" title={t.objectionsTitle} band={band}>
      <ul className="grid gap-gutter md:grid-cols-3" data-objections>
        {ctx.page.objections.map((o, i) => (
          <li key={o.q}>
            <Reveal delay={i * 0.06} className="h-full">
              <article className="h-full rounded-card border border-line bg-surface p-6">
                <h3 className="text-lg leading-snug font-semibold">{o.q}</h3>
                <p className="mt-3 leading-relaxed text-muted">{o.a}</p>
              </article>
            </Reveal>
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}

// Three next steps by readiness (docs/sales-playbook-site.md): cold = demo and the chat, warm = the builder with the
// product picked, hot = a call offered by the chat or Telegram.
export function ReadinessBlock({ ctx, band }: Props) {
  const { id, locale, dict, buildHref, telegramUrl, layout } = ctx
  const t = dict.productPage.readiness
  const demoHref = layout.demo ? '#demo' : `/${locale}#demo`
  const card = 'flex h-full flex-col rounded-card border p-6 md:p-7'
  const label = 'font-mono text-xs tracking-[0.14em] text-accent-text uppercase'
  return (
    <SectionShell id="next" title={t.title} sub={t.sub} band={band} className="pb-section">
      <ol className="grid gap-gutter lg:grid-cols-3" data-readiness>
        <li>
          <Reveal className="h-full">
            <div className={cn(card, 'border-line bg-surface')}>
              <p className={label}>{t.cold.label}</p>
              <h3 className="mt-3 text-xl font-semibold">{t.cold.title}</h3>
              <p className="mt-3 leading-relaxed text-muted">{t.cold.text}</p>
              <div className="mt-auto flex flex-wrap gap-3 pt-6">
                <Link href={demoHref} data-cta={`product_${id}_cold_demo`} className={buttonStyles.secondary}>
                  {t.cold.demo}
                </Link>
                <ChatOpenButton source={`product_${id}_cold`} fallbackHref={demoHref} className={buttonStyles.secondary}>
                  {dict.productPage.ask}
                </ChatOpenButton>
              </div>
            </div>
          </Reveal>
        </li>
        <li>
          <Reveal delay={0.06} className="h-full">
            <div className={cn(card, 'border-accent-text/40 bg-[linear-gradient(150deg,var(--color-pine),var(--color-surface)_75%)]')}>
              <p className={label}>{t.warm.label}</p>
              <h3 className="mt-3 text-xl font-semibold">{t.warm.title}</h3>
              <p className="mt-3 leading-relaxed text-muted">{t.warm.text}</p>
              <div className="mt-auto pt-6">
                <Link href={buildHref} data-cta={`product_page_${id}_final`} className={cn(buttonStyles.primary, 'group')}>
                  {dict.productPage.cta}
                  <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </Reveal>
        </li>
        <li>
          <Reveal delay={0.12} className="h-full">
            <div className={cn(card, 'border-line bg-surface')}>
              <p className={label}>{t.hot.label}</p>
              <h3 className="mt-3 text-xl font-semibold">{t.hot.title}</h3>
              <p className="mt-3 leading-relaxed text-muted">{t.hot.text}</p>
              <div className="mt-auto flex flex-wrap gap-3 pt-6">
                <ChatOpenButton source={`product_${id}_call`} fallbackHref={telegramUrl ?? '#price'} className={buttonStyles.secondary}>
                  <ChatCircleDots size={18} weight="fill" aria-hidden="true" className="text-accent-text" />
                  {t.hot.call}
                </ChatOpenButton>
                {telegramUrl && (
                  <a
                    href={telegramUrl}
                    data-place={`product_${id}`}
                    className="inline-flex items-center gap-2 self-center text-sm text-muted underline decoration-line-strong underline-offset-4 hover:text-accent-text"
                  >
                    <TelegramLogo size={16} aria-hidden="true" />
                    {t.hot.telegram}
                  </a>
                )}
              </div>
            </div>
          </Reveal>
        </li>
      </ol>
    </SectionShell>
  )
}
