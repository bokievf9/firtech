import { allArticles } from '@/lib/blog-hq'
import { siteUrl } from '@/lib/site'

// RSS feed of the Russian articles (bundled and from HQ), newest first. Refreshed every 5 minutes.
export const revalidate = 300

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

export async function GET() {
  const list = (await allArticles()).filter((article) => article.published)
  const items = list.map((article) => {
    const link = `${siteUrl}/ru/blog/${article.slug}`
    return [
      '    <item>',
      `      <title>${escapeXml(article.ru.title)}</title>`,
      `      <link>${link}</link>`,
      `      <guid isPermaLink="true">${link}</guid>`,
      `      <description>${escapeXml(article.ru.description)}</description>`,
      `      <pubDate>${new Date(`${article.date}T00:00:00Z`).toUTCString()}</pubDate>`,
      '    </item>',
    ].join('\n')
  })
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>Fir Tech</title>',
    `    <link>${siteUrl}/ru/blog</link>`,
    '    <description>Блог Fir Tech: сайты, боты и автоматизация для малого бизнеса</description>',
    '    <language>ru</language>',
    `    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
  return new Response(xml, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8' },
  })
}
