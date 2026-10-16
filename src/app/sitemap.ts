import type { MetadataRoute } from 'next'
import { locales } from '@/lib/i18n'
import { serviceSlugs, siteUrl } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['', '/builder', ...serviceSlugs.map((slug) => `/services/${slug}`), '/privacy']
  return paths.flatMap((path) =>
    locales.map((locale) => ({
      url: `${siteUrl}/${locale}${path}`,
      changeFrequency: path === '/privacy' ? ('yearly' as const) : ('monthly' as const),
      priority: path === '/privacy' ? 0.2 : path ? 0.8 : 1,
      alternates: {
        languages: Object.fromEntries(locales.map((l) => [l, `${siteUrl}/${l}${path}`])),
      },
    })),
  )
}
