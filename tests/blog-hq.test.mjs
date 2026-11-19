import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

// 'server-only' throws outside a server bundle; stub it for plain Node.
const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true }
    if (specifier.startsWith('@/')) {
      const base = new URL(specifier.slice(2), src).href
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
        try {
          return next(candidate, context)
        } catch {}
      }
    }
    return next(specifier, context)
  },
})

const { parseArticle, fetchHqArticles, mergeArticles, allArticles } = await import('../src/lib/blog-hq.ts')
const { articles } = await import('../src/content/blog/index.ts')

const content = (title) => ({
  title,
  description: `${title} description`,
  blocks: [
    { type: 'p', text: 'Text' },
    { type: 'h2', text: 'Heading' },
    { type: 'list', ordered: true, items: ['one', { title: 'two', text: 'details' }] },
    { type: 'callout', title: 'Note', text: 'Body' },
    { type: 'cta' },
  ],
})
const hqArticle = (slug, date = '2026-11-18', extra = {}) => ({
  slug,
  published: true,
  date,
  ru: content(`RU ${slug}`),
  en: content(`EN ${slug}`),
  ...extra,
})
const reply = (body, status = 200) => async () =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const prod = { NODE_ENV: 'production', HQ_BLOG_URL: 'http://hq.test/blog' }

test('parseArticle: accepts the site Article shape and rebuilds it from known fields', () => {
  const a = parseArticle({ ...hqArticle('good-one'), secret: 'x' })
  assert.deepEqual(a, hqArticle('good-one'))
  assert.equal('secret' in a, false)
})

test('parseArticle: rejects anything malformed', () => {
  const bad = [
    null,
    'text',
    [],
    hqArticle('Bad Slug'),
    hqArticle(''),
    hqArticle('ok', '2026-13-45'),
    hqArticle('ok', '18.11.2026'),
    hqArticle('ok', '2026-11-18', { published: false }),
    hqArticle('ok', '2026-11-18', { published: undefined }),
    hqArticle('ok', '2026-11-18', { en: undefined }),
    hqArticle('ok', '2026-11-18', { ru: { ...content('x'), blocks: [] } }),
    hqArticle('ok', '2026-11-18', { ru: { ...content('x'), title: '' } }),
    hqArticle('ok', '2026-11-18', { ru: { ...content('x'), blocks: [{ type: 'script', text: 'x' }] } }),
    hqArticle('ok', '2026-11-18', { ru: { ...content('x'), blocks: [{ type: 'p', text: 5 }] } }),
    hqArticle('ok', '2026-11-18', { ru: { ...content('x'), blocks: [{ type: 'list', items: [] }] } }),
    hqArticle('ok', '2026-11-18', { ru: { ...content('x'), blocks: [{ type: 'list', items: [{ title: 'a' }] }] } }),
  ]
  for (const value of bad) assert.equal(parseArticle(value), null, JSON.stringify(value)?.slice(0, 80))
})

test('fetchHqArticles: reads ?lang=all, keeps valid articles, drops bad and duplicate ones', async () => {
  let url = ''
  const fetcher = async (u) => {
    url = String(u)
    return reply({ ok: true, articles: [hqArticle('a'), { slug: 'broken' }, hqArticle('a'), hqArticle('b')] })()
  }
  const list = await fetchHqArticles(prod, fetcher)
  assert.equal(url, 'http://hq.test/blog?lang=all')
  assert.deepEqual(list.map((a) => a.slug), ['a', 'b'])
})

test('fetchHqArticles: defaults to the loopback URL in production', async () => {
  let url = ''
  await fetchHqArticles({ NODE_ENV: 'production' }, async (u) => {
    url = String(u)
    return reply({ ok: true, articles: [] })()
  })
  assert.equal(url, 'http://127.0.0.1:8787/blog?lang=all')
})

test('fetchHqArticles: development without HQ_BLOG_URL does not call HQ', async () => {
  let called = false
  const list = await fetchHqArticles({ NODE_ENV: 'development' }, async () => {
    called = true
    return reply({ ok: true, articles: [hqArticle('a')] })()
  })
  assert.deepEqual(list, [])
  assert.equal(called, false)
})

test('fetchHqArticles: any failure gives [] and never throws', async () => {
  const failures = [
    async () => {
      throw new Error('ECONNREFUSED')
    },
    async () => {
      throw Object.assign(new Error('timeout'), { name: 'TimeoutError' })
    },
    reply({ ok: false }, 500),
    reply({ ok: false, error: 'x' }),
    reply({ ok: true }),
    reply({ ok: true, articles: 'no' }),
    reply('not an object'),
    async () => new Response('<html>', { status: 200 }),
  ]
  for (const fetcher of failures) assert.deepEqual(await fetchHqArticles(prod, fetcher), [])
})

test('mergeArticles: HQ wins on an equal slug, newest first, only published', () => {
  const local = articles.filter((a) => a.published)
  const slug = local[0].slug
  const win = hqArticle(slug, '2030-01-01')
  const fresh = hqArticle('only-in-hq', '2029-05-05')
  const merged = mergeArticles([fresh, win], articles)
  assert.equal(merged.filter((a) => a.slug === slug).length, 1)
  assert.equal(merged.find((a) => a.slug === slug).ru.title, `RU ${slug}`)
  assert.deepEqual(merged.slice(0, 2).map((a) => a.slug), [slug, 'only-in-hq'])
  const dates = merged.map((a) => a.date)
  assert.deepEqual(dates, [...dates].sort().reverse())
  assert.ok(merged.every((a) => a.published))
  // Bundled drafts are hidden unless drafts are on; an unpublished HQ article never shows.
  const draft = { ...local[0], slug: 'draft-one', published: false }
  assert.equal(mergeArticles([], [draft]).length, 0)
  assert.equal(mergeArticles([], [draft], true).length, 1)
  assert.equal(mergeArticles([{ ...fresh, published: false }], []).length, 0)
})

test('allArticles: falls back to the bundled articles when HQ is down', async () => {
  const down = async () => {
    throw new Error('down')
  }
  const list = await allArticles(prod, down, false)
  assert.deepEqual(list.map((a) => a.slug), articles.filter((a) => a.published).map((a) => a.slug).sort((x, y) => {
    const dx = articles.find((a) => a.slug === x).date
    const dy = articles.find((a) => a.slug === y).date
    return dy.localeCompare(dx)
  }))
  const withHq = await allArticles(prod, reply({ ok: true, articles: [hqArticle('from-hq')] }), false)
  assert.ok(withHq.some((a) => a.slug === 'from-hq'))
})

test('rss.xml: RU articles with title, link, description and pubDate, escaped', async () => {
  const { GET } = await import('../src/app/rss.xml/route.ts')
  const res = await GET()
  assert.match(res.headers.get('content-type'), /application\/rss\+xml/)
  const xml = await res.text()
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0"/)
  const published = articles.filter((a) => a.published)
  assert.equal(xml.split('<item>').length - 1, published.length)
  for (const a of published) {
    assert.ok(xml.includes(`/ru/blog/${a.slug}</link>`), a.slug)
    assert.ok(xml.includes(new Date(`${a.date}T00:00:00Z`).toUTCString()), a.slug)
  }
  assert.doesNotMatch(xml, /&(?!amp;|lt;|gt;|quot;|apos;)/)
})
