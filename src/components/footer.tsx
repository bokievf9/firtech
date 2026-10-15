import Link from 'next/link'
import type { Dict } from '@/content'
import { homeAnchor } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { serviceSlugs, telegramHandle, telegramUrl } from '@/lib/site'
import { Logo } from './logo'

export function Footer({ locale, dict }: { locale: Locale; dict: Dict }) {
  const other: Locale = locale === 'ru' ? 'en' : 'ru'
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 md:grid-cols-12 md:px-8">
        <div className="md:col-span-5">
          <Logo />
          <p className="mt-5 max-w-[38ch] text-sm leading-relaxed text-muted">{dict.footer.tagline}</p>
        </div>
        <nav className="md:col-span-3" aria-label={dict.footer.services}>
          <p className="text-sm font-medium">{dict.footer.services}</p>
          <ul className="mt-4 grid gap-2.5 text-sm text-muted">
            {serviceSlugs.map((slug) => (
              <li key={slug}>
                <Link href={`/${locale}/services/${slug}`} className="transition-colors hover:text-fg">
                  {dict.services.items[slug].name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav className="md:col-span-4" aria-label={dict.footer.company}>
          <p className="text-sm font-medium">{dict.footer.company}</p>
          <ul className="mt-4 grid gap-2.5 text-sm text-muted">
            <li>
              <Link href={homeAnchor(locale, 'pricing')} className="transition-colors hover:text-fg">
                {dict.nav.pricing}
              </Link>
            </li>
            <li>
              <Link href={homeAnchor(locale, 'process')} className="transition-colors hover:text-fg">
                {dict.nav.process}
              </Link>
            </li>
            <li>
              <Link href={homeAnchor(locale, 'contact')} className="transition-colors hover:text-fg">
                {dict.nav.cta}
              </Link>
            </li>
            {telegramUrl && (
              <li>
                <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-fg">
                  Telegram {telegramHandle}
                </a>
              </li>
            )}
          </ul>
        </nav>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-line px-4 py-6 text-[13px] text-faint sm:flex-row sm:items-center sm:justify-between md:px-8">
        <p>
          © {new Date().getFullYear()} Fir Tech. {dict.footer.rights}
        </p>
        <Link href={`/${other}`} hrefLang={other} className="transition-colors hover:text-fg">
          {dict.footer.language}
        </Link>
      </div>
    </footer>
  )
}
