import type { MetadataRoute } from 'next'
import { locales } from '@/lib/i18n'
import { serviceSlugs, siteUrl } from '@/lib/site'
import { solutionKinds } from '@/lib/solutions'

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    '',
    '/builder',
    ...serviceSlugs.map((slug) => `/services/${slug}`),
    '/solutions',
    ...solutionKinds.map((kind) => `/solutions/${kind}`),
  ]
  return paths.flatMap((path) =>
    locales.map((locale) => ({
      url: `${siteUrl}/${locale}${path}`,
      changeFrequency: 'monthly' as const,
      priority: path ? 0.8 : 1,
      alternates: {
        languages: Object.fromEntries(locales.map((l) => [l, `${siteUrl}/${l}${path}`])),
      },
    })),
  )
}
