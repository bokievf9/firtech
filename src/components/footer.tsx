import { ArrowRight, ArrowUp, ChatCircleDots, InstagramLogo, TelegramLogo } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { CabinetNavLabel } from './cabinet/cabinet-nav-label'
import type { Dict } from '@/content'
import { buttonClass, cn } from '@/lib/cn'
import { footerColumns, type FooterLink } from '@/lib/home'
import type { Locale } from '@/lib/i18n'
import { instagramUrl, telegramHandle, telegramUrl } from '@/lib/site'
import { ChatOpenButton } from './chat/chat-open-button'
import { Logo } from './logo'
import { GlowBlob, OrbitRing } from './ui/glow'
import { Magnetic } from './magnetic'
import { Reveal } from './reveal'

// Site footer (design v5, docs/design-system-v5.md): a call to action over a lime glow and an orbit ring,
// the brand with social links, four link columns led by the products, a legal row between hairlines, and
// the page ends on a giant wordmark (Manrope 800).
// Columns come from footerColumns (src/lib/home.ts), tested to point at real routes.
export function Footer({
  locale,
  dict,
  cabinet = false,
}: {
  locale: Locale
  dict: Dict
  cabinet?: boolean
}) {
  const other: Locale = locale === 'ru' ? 'en' : 'ru'
  const f = dict.footer
  const columns = footerColumns(locale)
  const titles = {
    products: f.products,
    agents: f.agents,
    services: f.services,
    solutions: dict.solutions.nav,
    company: f.company,
  }
  const label = (link: FooterLink) => {
    switch (link.kind) {
      case 'product':
        return dict.products.items[link.id].name
      case 'agent':
        return dict.aiTeams.agents.items[link.id].title
      case 'service':
        return dict.services.items[link.id].name
      case 'solution':
        return dict.builder.kinds[link.id]
      default:
        return f.pages[link.id as keyof typeof f.pages] ?? link.id
    }
  }

  return (
    <footer className="print-hidden relative overflow-hidden border-t border-t-hairline border-line bg-surface">
      <GlowBlob className="-top-40 -right-40 size-[560px]" />
      <OrbitRing className="-top-48 right-[4%] hidden size-[440px] md:block" />
      <div data-fira-react="cta" className="relative mx-auto flex max-w-7xl flex-col items-start gap-8 px-4 pt-20 pb-16 md:flex-row md:items-end md:justify-between md:px-8 md:pt-28">
        <p className="h-display h-display-section max-w-[16ch] font-extrabold">{f.ctaTitle}</p>
        <div className="flex flex-col items-start gap-4 md:items-end">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Magnetic>
              <Link
                href={`/${locale}/builder`}
                data-cta="footer_build"
                className={cn(buttonClass('primary', 'lg'), 'group')}
              >
                {dict.nav.cta}
                <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </Magnetic>
            <ChatOpenButton
              source="footer"
              fallbackHref={`/${locale}#demo`}
              className={buttonClass('glass', 'lg')}
            >
              <ChatCircleDots size={18} weight="fill" aria-hidden="true" className="text-accent-text" />
              {dict.nav.ask}
            </ChatOpenButton>
          </div>
          {telegramUrl && (
            <a
              href={telegramUrl}
              data-place="footer-cta"
              className="inline-flex items-center gap-1.5 text-footnote text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-fg"
            >
              <TelegramLogo size={14} weight="fill" aria-hidden="true" />
              {f.telegramLink}
            </a>
          )}
        </div>
      </div>

      <div className="relative mx-auto grid max-w-7xl gap-12 border-t border-t-hairline border-line px-4 py-16 md:grid-cols-12 md:px-8">
        <div className="md:col-span-12 lg:col-span-2">
          <Logo />
          <p className="mt-5 max-w-[34ch] text-footnote text-muted">{f.tagline}</p>
          <p className="mt-8 text-footnote font-bold">{f.social}</p>
          <div className="mt-3 flex gap-2">
            <a
              href={instagramUrl}
              aria-label="Instagram"
              className="pressable grid size-10 place-items-center rounded-full btn-glass text-muted hover:text-fg"
            >
              <InstagramLogo size={18} />
            </a>
            {telegramUrl && (
              <a
                href={telegramUrl}
                data-place="footer"
                aria-label={`Telegram ${telegramHandle ?? ''}`}
                className="pressable grid size-10 place-items-center rounded-full btn-glass text-muted hover:text-fg"
              >
                <TelegramLogo size={18} />
              </a>
            )}
          </div>
        </div>
        {columns.map((col) => (
          <nav
            key={col.id}
            aria-label={titles[col.id]}
            className={cn(
              'md:col-span-6 lg:col-span-2',
            )}
          >
            <p className="text-footnote font-bold">{titles[col.id]}</p>
            <ul className="mt-4 grid gap-2.5 text-footnote text-muted">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-fg">
                    {label(link)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="relative mx-auto flex max-w-7xl flex-col gap-3 border-t border-t-hairline border-line px-4 py-6 text-caption text-faint sm:flex-row sm:items-center sm:justify-between md:px-8">
        <p>
          © {new Date().getFullYear()} Fir Tech. {f.rights}
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {cabinet && (
            <Link href={`/${locale}/cabinet`} className="transition-colors hover:text-fg">
              <CabinetNavLabel signedIn={dict.nav.cabinet} start={dict.nav.cabinetStart} />
            </Link>
          )}
          <Link href={`/${locale}/privacy`} className="transition-colors hover:text-fg">
            {dict.privacy.footerLink}
          </Link>
          <Link href={`/${locale}/terms`} className="transition-colors hover:text-fg">
            {dict.terms.footerLink}
          </Link>
          <Link href={`/${other}`} hrefLang={other} className="transition-colors hover:text-fg">
            {f.language}
          </Link>
          <a href="#" className="inline-flex items-center gap-1.5 transition-colors hover:text-fg">
            {f.top}
            <ArrowUp size={13} />
          </a>
        </div>
      </div>

      <Reveal className="pointer-events-none select-none" delay={0.1}>
        <p
          aria-hidden="true"
          className="wordmark-fill font-brand -mb-[0.16em] text-center text-[21vw] leading-none font-extrabold tracking-[-0.05em] whitespace-nowrap"
        >
          fir<span className="text-accent-text [-webkit-text-fill-color:var(--color-accent)]">.</span>tech
        </p>
      </Reveal>
    </footer>
  )
}
