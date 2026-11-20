import 'server-only'
import { articles as bundled, showDrafts } from '../content/blog/index'
import { fillArticlePrices } from '../content/blog/prices'
import { getPricing } from './pricing-store'
import type { Article, ArticleContent, Block, ListItem } from '../content/blog/types'

const DEFAULT_URL = 'http://127.0.0.1:8787/blog'
const TIMEOUT_MS = 3000
const MAX_ARTICLES = 200
const MAX_BLOCKS = 300
const MAX_TEXT = 20000

// Articles approved in HQ. HQ serves `GET /blog?lang=all` as `{ ok: true, articles: Article[] }`
// without a token; each article has exactly the site's `Article` shape. This never throws and
// returns nothing but validated articles: anything malformed is dropped, any failure gives [].
// Development without HQ_BLOG_URL does not call HQ at all.

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown, max = MAX_TEXT): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max

function listItem(value: unknown): ListItem | null {
  if (text(value)) return value
  if (isRecord(value) && text(value.title) && text(value.text))
    return { title: value.title, text: value.text }
  return null
}

function block(value: unknown): Block | null {
  if (!isRecord(value)) return null
  switch (value.type) {
    case 'p':
    case 'h2':
      return text(value.text) ? { type: value.type, text: value.text } : null
    case 'list': {
      if (!Array.isArray(value.items) || value.items.length === 0 || value.items.length > 100)
        return null
      if (value.ordered !== undefined && typeof value.ordered !== 'boolean') return null
      const items = value.items.map(listItem)
      if (items.some((item) => item === null)) return null
      return {
        type: 'list',
        ...(value.ordered === undefined ? {} : { ordered: value.ordered }),
        items: items as ListItem[],
      }
    }
    case 'callout':
      if (!text(value.text) || (value.title !== undefined && !text(value.title))) return null
      return {
        type: 'callout',
        ...(value.title === undefined ? {} : { title: value.title as string }),
        text: value.text,
      }
    case 'cta':
      if (value.title !== undefined && !text(value.title, 300)) return null
      if (value.text !== undefined && !text(value.text, 1000)) return null
      return {
        type: 'cta',
        ...(value.title === undefined ? {} : { title: value.title as string }),
        ...(value.text === undefined ? {} : { text: value.text as string }),
      }
    default:
      return null
  }
}

function content(value: unknown): ArticleContent | null {
  if (!isRecord(value)) return null
  if (!text(value.title, 300) || !text(value.description, 1000)) return null
  if (!Array.isArray(value.blocks) || value.blocks.length === 0 || value.blocks.length > MAX_BLOCKS)
    return null
  const blocks = value.blocks.map(block)
  if (blocks.some((b) => b === null)) return null
  return { title: value.title, description: value.description, blocks: blocks as Block[] }
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

// An unknown value as a site Article, or null. Only published articles pass; the result is rebuilt
// from the known fields, so nothing extra from HQ reaches a page.
export function parseArticle(value: unknown): Article | null {
  if (!isRecord(value)) return null
  const { slug, date } = value
  if (typeof slug !== 'string' || slug.length > 120 || !SLUG.test(slug)) return null
  if (value.published !== true) return null
  if (typeof date !== 'string' || !DATE.test(date) || Number.isNaN(Date.parse(date))) return null
  const ru = content(value.ru)
  const en = content(value.en)
  if (!ru || !en) return null
  return { slug, published: true, date, ru, en }
}

export async function fetchHqArticles(
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): Promise<Article[]> {
  const configured = env.HQ_BLOG_URL?.trim()
  if (!configured && env.NODE_ENV !== 'production') return []
  try {
    const base = (configured || DEFAULT_URL).replace(/\/$/, '')
    const res = await fetcher(`${base}?lang=all`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    } as RequestInit)
    if (!res.ok) return []
    const body: unknown = await res.json()
    if (!isRecord(body) || body.ok !== true || !Array.isArray(body.articles)) return []
    const seen = new Set<string>()
    const out: Article[] = []
    for (const raw of body.articles.slice(0, MAX_ARTICLES)) {
      const article = parseArticle(raw)
      if (article && !seen.has(article.slug)) {
        seen.add(article.slug)
        out.push(article)
      }
    }
    return out
  } catch {
    return []
  }
}

// HQ articles merged with the bundled ones: HQ wins on an equal slug, newest first (equal dates keep
// HQ first, then the bundled order). Bundled drafts show only when `drafts` is set (next dev).
export function mergeArticles(hq: Article[], local: Article[], drafts = false): Article[] {
  const bySlug = new Map<string, Article>()
  for (const article of local) if (drafts || article.published) bySlug.set(article.slug, article)
  for (const article of hq) if (article.published) bySlug.set(article.slug, article)
  return [...bySlug.values()].sort((a, b) => b.date.localeCompare(a.date))
}

export async function allArticles(
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
  drafts = showDrafts,
): Promise<Article[]> {
  // The bundled articles carry price tokens; the live pricing fills them (owner edits, no deploy).
  const pricing = await getPricing()
  return mergeArticles(
    await fetchHqArticles(env, fetcher),
    bundled.map((article) => fillArticlePrices(article, pricing)),
    drafts,
  )
}

export async function findArticle(slug: string): Promise<Article | undefined> {
  return (await allArticles()).find((article) => article.slug === slug)
}
