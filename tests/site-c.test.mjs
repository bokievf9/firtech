// Stage C (pre-first-client audit): copy lint, meta lengths, sitemap, legal pages, Telegram links.
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
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

const { default: ru } = await import('../src/content/ru.ts')
const { default: en } = await import('../src/content/en.ts')
const { articles } = await import('../src/content/blog/index.ts')
const { kindCatalog, productCatalog } = await import('../src/content/builder-catalog.ts')
const { allSolutionKinds, solutionCopy } = await import('../src/lib/solutions.ts')
const { serviceSlugs } = await import('../src/lib/site.ts')
const { fillServicePrice } = await import('../src/lib/seo.ts')
const sitemap = (await import('../src/app/sitemap.ts')).default

// Every string of a value with its path.
function* strings(value, at = '') {
  if (typeof value === 'string') yield [at, value]
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, `${at}[${i}]`)
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) yield* strings(v, at ? `${at}.${k}` : k)
}

const copy = [
  ['ru', ru],
  ['en', en],
  ['catalog.kinds', kindCatalog],
  ['catalog.products', productCatalog],
  ['blog', articles.map((a) => ({ ru: a.ru, en: a.en }))],
]

test('copy: no long dashes anywhere in the visible texts', () => {
  for (const [name, value] of copy)
    for (const [at, text] of strings(value)) assert.doesNotMatch(text, /[–—]/, `${name} ${at}`)
})

test('copy: no AI tells (not X but Y, triads of "no/without")', () => {
  const tells = [
    /\bэто не [^.!?]{1,60}, а\b/i,
    /\bне просто [^.!?]{1,60}, а\b/i,
    /\bне только [^.!?]{1,60}, но и\b/i,
    /\bit'?s not [^.!?]{1,60}, it'?s\b/i,
    /\bnot (just|only|merely) [^.!?]{1,60}, (but|it)\b/i,
    /\bбез [^,.!?]{1,30}, без [^,.!?]{1,30}, (и )?без\b/i,
    /\bno [^,.!?]{1,30}, no [^,.!?]{1,30}, (and )?no\b/i,
    /, (позволяя|делая|помогая|обеспечивая|allowing|making|helping|ensuring)\b/i,
  ]
  for (const [name, value] of copy)
    for (const [at, text] of strings(value))
      for (const re of tells) assert.doesNotMatch(text, re, `${name} ${at}: ${text.slice(0, 80)}`)
})

test('copy: no hardcoded dollar amounts, prices come from pricing.ts', () => {
  // Budget ranges of the form and mock-up demo content are not prices of ours.
  const allowed = /(^|\.)(budget|budgets|botFaqAnswer|aiReply)(\.|\[|$)/
  // Article prices are filled from src/content/blog/prices.ts (see blog.test.mjs).
  for (const [name, value] of copy.filter(([n]) => n !== 'blog'))
    for (const [at, text] of strings(value))
      if (!allowed.test(at) && !/^catalog\.kinds.*menu/.test(`${name}${at}`))
        assert.doesNotMatch(text, /\$\s?\d/, `${name} ${at}`)
})

test('copy: dictionaries have no removed sections', () => {
  for (const dict of [ru, en])
    for (const key of ['pains', 'compare', 'trust', 'regions', 'picker', 'directions'])
      assert.equal(key in dict, false, key)
})

test('seo: meta descriptions are 120-160 characters in both locales', () => {
  const check = (label, text) =>
    assert.ok(text.length >= 120 && text.length <= 160, `${label}: ${text.length}`)
  for (const [locale, dict] of [
    ['ru', ru],
    ['en', en],
  ]) {
    check(`${locale} home`, dict.meta.description)
    for (const key of ['builder', 'solutions', 'blog', 'privacy', 'terms'])
      check(`${locale} ${key}`, dict[key].metaDescription)
    for (const slug of serviceSlugs)
      check(`${locale} service ${slug}`, fillServicePrice(dict.serviceDetails[slug].metaDescription, slug))
    for (const kind of allSolutionKinds)
      check(`${locale} solution ${kind}`, solutionCopy(kind, locale, dict).metaDescription)
    for (const a of articles) check(`${locale} post ${a.slug}`, a[locale].description)
  }
})

test('seo: titles are present and not too long', () => {
  for (const [locale, dict] of [['ru', ru], ['en', en]]) {
    assert.ok(dict.meta.title.length <= 70, `${locale} home title`)
    for (const slug of serviceSlugs) {
      const title = fillServicePrice(dict.serviceDetails[slug].metaTitle, slug)
      assert.ok(title.length <= 70 && !title.includes('{'), `${locale} ${slug}: ${title}`)
    }
  }
})

test('sitemap: every page, 55 solutions, services, blog, legal pages, with alternates', () => {
  const entries = sitemap()
  const urls = entries.map((e) => e.url)
  assert.equal(new Set(urls).size, urls.length)
  for (const locale of ['ru', 'en']) {
    const has = (p) => assert.ok(urls.some((u) => u.endsWith(`/${locale}${p}`)), `${locale}${p}`)
    for (const p of ['', '/builder', '/solutions', '/privacy', '/terms']) has(p)
    for (const slug of serviceSlugs) has(`/services/${slug}`)
    for (const kind of allSolutionKinds) has(`/solutions/${kind}`)
    for (const a of articles.filter((x) => x.published)) has(`/blog/${a.slug}`)
  }
  assert.equal(allSolutionKinds.length, 55)
  const alt = entries[0].alternates.languages
  assert.deepEqual(Object.keys(alt).sort(), ['en', 'ru'])
  assert.equal(urls.some((u) => u.includes('/admin') || u.includes('/estimate')), false)
})

test('terms: page, both dictionaries, placeholders and footer link', () => {
  assert.ok(existsSync('src/app/[locale]/terms/page.tsx'))
  for (const dict of [ru, en]) {
    const t = dict.terms
    assert.ok(t.sections.length >= 8 && t.draftNote && t.footerLink)
    const text = JSON.stringify(t.sections)
    assert.ok(text.includes(t.placeholder), 'placeholders present')
    assert.ok(dict.privacy.draftNote)
  }
  assert.equal(ru.terms.placeholder, '[заполнит владелец]')
  assert.match(readFileSync('src/components/footer.tsx', 'utf8'), /\/terms/)
})

test('privacy: covers the chat, the client bot, session storage and Metrika', () => {
  for (const dict of [ru, en]) {
    const ids = dict.privacy.sections.map((s) => s.id)
    for (const id of ['chat', 'bot', 'cookies', 'analytics']) assert.ok(ids.includes(id), id)
    assert.match(JSON.stringify(dict.privacy.sections), /firtech_bot/)
  }
})

test('telegram: every t.me link in the code goes to the client bot', () => {
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(ts|tsx)$/.test(name)) files.push(full)
    }
  }
  walk('src')
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/t\.me\/(\$\{[^}]+\}|[A-Za-z0-9_]+)/g)) {
      const ok = /^(\$\{(telegramUsername|botUsername)\}|firtech_bot)$/.test(m[1])
      assert.ok(ok || file.includes('admin'), `${file}: ${m[0]}`)
    }
  }
})

test('telegram: the public username falls back to @firtech_bot', async () => {
  const site = await import('../src/lib/site.ts')
  if (!process.env.NEXT_PUBLIC_TELEGRAM_USERNAME) {
    assert.equal(site.telegramUrl, 'https://t.me/firtech_bot')
    assert.equal(site.telegramHandle, '@firtech_bot')
  }
  assert.equal(site.defaultTelegramBot, 'firtech_bot')
})

test('telegram: the lead form success text names the bot', () => {
  assert.match(ru.contact.successText, /@firtech_bot/)
  assert.match(en.contact.successText, /@firtech_bot/)
})

test('manifest and icons: present, themed, referenced', async () => {
  for (const f of ['src/app/icon.png', 'src/app/apple-icon.png', 'src/app/favicon.ico', 'src/app/manifest.ts'])
    assert.ok(existsSync(f), f)
  const manifest = (await import('../src/app/manifest.ts')).default()
  assert.equal(manifest.theme_color, '#0a0d0b')
  for (const icon of manifest.icons) assert.ok(existsSync(`src/app${icon.src}`), icon.src)
  assert.match(readFileSync('src/app/[locale]/layout.tsx', 'utf8'), /themeColor: '#0a0d0b'/)
})

test('lead route keeps the honeypot, the rate limit and the Telegram + HQ forwarding', () => {
  const route = readFileSync('src/app/api/lead/route.ts', 'utf8')
  assert.match(route, /if \(lead\.website\) return NextResponse\.json\(\{ ok: true \}\)/)
  assert.match(route, /MAX_PER_WINDOW = 5/)
  assert.match(route, /forwardLead\(/)
  assert.match(route, /notifyOwner\(/)
})
