import type { Locale } from './i18n'

// A page's own `openGraph` replaces the layout's entirely (Next merges metadata shallowly), so
// every page spreads this in to keep the site name, locale and the share image
// (src/app/[locale]/opengraph-image.tsx). Links sent in Telegram then show the preview card.
export function shareBase(locale: Locale) {
  const images = [{ url: `/${locale}/opengraph-image`, width: 1200, height: 630 }]
  return {
    openGraph: {
      type: 'website' as const,
      siteName: 'Fir Tech',
      locale: locale === 'ru' ? 'ru_RU' : 'en_US',
      images,
    },
    twitter: { card: 'summary_large_image' as const, images },
  }
}
