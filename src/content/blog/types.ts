// Blog articles are typed data, one file per article, both languages side by side.
// Imports in this folder stay relative so `node --test` can load them without the `@/` alias.

export type ListItem = string | { title: string; text: string }

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'list'; ordered?: boolean; items: ListItem[] }
  | { type: 'callout'; title?: string; text: string }
  // Inline card that sends the reader to the builder; texts default to the dictionary's.
  | { type: 'cta'; title?: string; text?: string }

export type ArticleContent = {
  title: string
  description: string
  blocks: Block[]
}

export type Article = {
  slug: string
  // Only published articles reach production (lists, routes, sitemap). Drafts show in dev only.
  published: boolean
  // ISO date (YYYY-MM-DD). Set it to the publishing day when flipping `published`.
  date: string
  ru: ArticleContent
  en: ArticleContent
}
