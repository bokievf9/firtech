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
import { Magnetic } from './magnetic'
import { Reveal } from './reveal'

// Site footer (stage B1, footer.design patterns): a call to action, the brand with social links,
// four link columns led by the products, a legal row, and the page ends on a giant wordmark.
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
    <footer className="print-hidden relative overflow-hidden border-t border-t-hairline border-line">
      <div data-fira-react="cta" className="mx-auto flex site-container flex-col items-start gap-8 pt-20 pb-16 md:flex-row md:items-end md:justify-between md:pt-28">
        <p className="max-w-[16ch] font-display text-title font-semibold">{f.ctaTitle}</p>
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
              className={buttonClass('secondary', 'lg')}
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

      <div className="mx-auto grid site-container gap-12 border-t border-t-hairline border-line py-16 md:grid-cols-12">
        <div className="md:col-span-12 lg:col-span-2">
          <Logo />
          <p className="mt-5 max-w-[34ch] text-footnote text-muted">{f.tagline}</p>
          <p className="mt-8 text-footnote font-semibold">{f.social}</p>
          <div className="mt-3 flex gap-2">
            <a
              href={instagramUrl}
              aria-label="Instagram"
              className="pressable grid size-10 place-items-center rounded-full bg-fill text-muted hover:bg-fill-strong hover:text-fg"
            >
              <InstagramLogo size={18} />
            </a>
            {telegramUrl && (
              <a
                href={telegramUrl}
                data-place="footer"
                aria-label={`Telegram ${telegramHandle ?? ''}`}
                className="pressable grid size-10 place-items-center rounded-full bg-fill text-muted hover:bg-fill-strong hover:text-fg"
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
            <p className="text-footnote font-semibold">{titles[col.id]}</p>
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

      <div className="mx-auto flex site-container flex-col gap-3 border-t border-t-hairline border-line py-6 text-caption text-faint sm:flex-row sm:items-center sm:justify-between">
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
          className="wordmark-fill font-brand -mb-[0.18em] text-center text-[18.5vw] leading-none font-bold tracking-[-0.06em] whitespace-nowrap"
        >
          fir<span className="text-accent-text [-webkit-text-fill-color:var(--color-accent)]">.</span>tech
        </p>
      </Reveal>
    </footer>
  )
}
