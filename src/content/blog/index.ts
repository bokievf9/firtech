import type { Locale } from '../../lib/i18n'
import { stopLosingLeads } from './stop-losing-leads'
import type { Article, ArticleContent, Block } from './types'
import { websiteCost2026 } from './website-cost-2026'
import { websiteOrBot } from './website-or-bot'

export type { Article, ArticleContent, Block, ListItem } from './types'

// Newest first; equal dates keep this order.
export const articles: Article[] = [websiteCost2026, websiteOrBot, stopLosingLeads].sort((a, b) =>
  b.date.localeCompare(a.date),
)

// Drafts are visible in `next dev` so the owner can review them, never in a production build.
export const showDrafts = process.env.NODE_ENV !== 'production'

export function visibleArticles(drafts = showDrafts): Article[] {
  return articles.filter((article) => drafts || article.published)
}

export function getArticle(slug: string, drafts = showDrafts): Article | undefined {
  return visibleArticles(drafts).find((article) => article.slug === slug)
}

function blockText(block: Block): string {
  switch (block.type) {
    case 'list':
      return block.items
        .map((item) => (typeof item === 'string' ? item : `${item.title} ${item.text}`))
        .join(' ')
    case 'callout':
      return `${block.title ?? ''} ${block.text}`
    case 'cta':
      return ''
    default:
      return block.text
  }
}

// Every visible string of an article, for word counts and copy checks.
export function articleText(content: ArticleContent): string {
  return [content.title, content.description, ...content.blocks.map(blockText)].join(' ')
}

export function wordCount(content: ArticleContent): number {
  const text = [content.title, ...content.blocks.map(blockText)].join(' ')
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length
}

// Minutes at about 180 words a minute, at least one.
export function readingTime(content: ArticleContent): number {
  return Math.max(1, Math.round(wordCount(content) / 180))
}

export function formatArticleDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}
