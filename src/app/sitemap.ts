import type { MetadataRoute } from 'next'
import { articles } from '@/content/blog'
import { locales } from '@/lib/i18n'
import { serviceSlugs, siteUrl } from '@/lib/site'
import { allSolutionKinds } from '@/lib/solutions'

const legal = ['/privacy', '/terms']

export default function sitemap(): MetadataRoute.Sitemap {
  // Published articles only: drafts never reach the sitemap, even when built in dev.
  const posts = articles.filter((article) => article.published)
  const paths = [
    '',
    '/builder',
    ...serviceSlugs.map((slug) => `/services/${slug}`),
    '/solutions',
    ...allSolutionKinds.map((kind) => `/solutions/${kind}`),
    // The list joins once there is something to read.
    ...(posts.length ? ['/blog'] : []),
    ...posts.map((article) => `/blog/${article.slug}`),
    '/privacy',
    '/terms',
  ]
  return paths.flatMap((path) =>
    locales.map((locale) => ({
      url: `${siteUrl}/${locale}${path}`,
      changeFrequency: legal.includes(path) ? ('yearly' as const) : ('monthly' as const),
      priority: legal.includes(path) ? 0.2 : path ? 0.8 : 1,
      alternates: {
        languages: Object.fromEntries(locales.map((l) => [l, `${siteUrl}/${l}${path}`])),
      },
    })),
  )
}
