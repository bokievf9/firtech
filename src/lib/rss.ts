import { allArticles } from '@/lib/blog-hq'
import { siteUrl } from '@/lib/site'

// RSS 2.0 feed of the blog in one language (bundled and HQ articles), newest first.
// `/rss.xml` is the Russian feed, `/rss-en.xml` the English one.
export type RssLocale = 'ru' | 'en'

const channel = {
  ru: { path: '/rss.xml', description: 'Блог Fir Tech: сайты, боты и автоматизация для малого бизнеса' },
  en: { path: '/rss-en.xml', description: 'Fir Tech blog: websites, AI agents and automation for small business' },
} as const

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

export async function rssResponse(locale: RssLocale): Promise<Response> {
  const list = (await allArticles()).filter((article) => article.published)
  const items = list.map((article) => {
    const link = `${siteUrl}/${locale}/blog/${article.slug}`
    return [
      '    <item>',
      `      <title>${escapeXml(article[locale].title)}</title>`,
      `      <link>${link}</link>`,
      `      <guid isPermaLink="true">${link}</guid>`,
      `      <description>${escapeXml(article[locale].description)}</description>`,
      `      <pubDate>${new Date(`${article.date}T00:00:00Z`).toUTCString()}</pubDate>`,
      '    </item>',
    ].join('\n')
  })
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>Fir Tech</title>',
    `    <link>${siteUrl}/${locale}/blog</link>`,
    `    <description>${channel[locale].description}</description>`,
    `    <language>${locale}</language>`,
    `    <atom:link href="${siteUrl}${channel[locale].path}" rel="self" type="application/rss+xml" />`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } })
}
