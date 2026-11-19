import type { Metadata } from 'next'
import { getDict } from '@/content'
import { isLocale } from '@/lib/i18n'

// Every cabinet page is private and per visitor: never indexed, never in the sitemap.
export async function generateMetadata({ params }: LayoutProps<'/[locale]/cabinet'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDict(locale).cabinet
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    robots: { index: false, follow: false },
    alternates: { canonical: `/${locale}/cabinet` },
  }
}

export default function CabinetLayout({ children }: LayoutProps<'/[locale]/cabinet'>) {
  return children
}
