import { ArrowRight, ArrowUp, InstagramLogo, TelegramLogo } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { CabinetNavLabel } from './cabinet/cabinet-nav-label'
import type { Dict } from '@/content'
import { buttonStyles, cn, homeAnchor } from '@/lib/cn'
import { footerColumns, type FooterLink } from '@/lib/home'
import type { Locale } from '@/lib/i18n'
import { instagramUrl, telegramHandle, telegramUrl } from '@/lib/site'
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
    services: f.services,
    solutions: dict.solutions.nav,
    company: f.company,
  }
  const label = (link: FooterLink) => {
    switch (link.kind) {
      case 'product':
        return dict.products.items[link.id].name
      case 'service':
        return dict.services.items[link.id].name
      case 'solution':
        return dict.builder.kinds[link.id]
      default:
        return f.pages[link.id as keyof typeof f.pages] ?? link.id
    }
  }

  return (
    <footer className="print-hidden relative overflow-hidden border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-8 px-4 pt-20 pb-16 md:flex-row md:items-end md:justify-between md:px-8 md:pt-28">
        <p className="max-w-[16ch] font-display text-title font-semibold">{f.ctaTitle}</p>
        <Magnetic>
          {telegramUrl ? (
            <a
              href={telegramUrl}
              data-place="footer-cta"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonStyles.primary, 'group px-8 py-4 text-base')}
            >
              <TelegramLogo size={18} weight="fill" />
              {dict.contact.telegramCta}
              <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
            </a>
          ) : (
            <Link
              href={homeAnchor(locale, 'contact')}
              data-cta="footer"
              className={cn(buttonStyles.primary, 'group px-8 py-4 text-base')}
            >
              {dict.nav.cta}
              <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          )}
        </Magnetic>
      </div>

      <div className="mx-auto grid max-w-7xl gap-12 border-t border-line px-4 py-16 md:grid-cols-12 md:px-8">
        <div className="md:col-span-12 lg:col-span-3">
          <Logo />
          <p className="mt-5 max-w-[34ch] text-sm leading-relaxed text-muted">{f.tagline}</p>
          <p className="mt-8 text-sm font-medium">{f.social}</p>
          <div className="mt-3 flex gap-2">
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="grid size-10 place-items-center rounded-full border border-line-strong text-muted transition-colors hover:border-fg/40 hover:text-fg"
            >
              <InstagramLogo size={18} />
            </a>
            {telegramUrl && (
              <a
                href={telegramUrl}
                data-place="footer"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Telegram ${telegramHandle ?? ''}`}
                className="grid size-10 place-items-center rounded-full border border-line-strong text-muted transition-colors hover:border-fg/40 hover:text-fg"
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
              col.id === 'products' && 'lg:col-span-3',
            )}
          >
            <p className="text-sm font-medium">{titles[col.id]}</p>
            <ul className="mt-4 grid gap-2.5 text-sm text-muted">
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

      <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-line px-4 py-6 text-[13px] text-faint sm:flex-row sm:items-center sm:justify-between md:px-8">
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
          fir<span className="text-accent [-webkit-text-fill-color:var(--color-accent)]">.</span>tech
        </p>
      </Reveal>
    </footer>
  )
}
