// Security page (owner audit 2026-11-24): «Безопасность и данные» is registered everywhere, its copy has
// the nine sections and no dashes or AI tells (copy-qa scans the `security` dictionary too).
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

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

const { default: ru } = await import('../src/content/ru.ts')
const { default: en } = await import('../src/content/en.ts')
const { notFoundText } = await import('../src/content/not-found.ts')
const { footerColumns, localePages } = await import('../src/lib/home.ts')
const { bareLocalePages } = await import('../src/lib/i18n.ts')
const sitemap = (await import('../src/app/sitemap.ts')).default
const read = (file) => readFileSync(file, 'utf8')

const ids = ['where', 'who', 'model', 'backups', 'access', 'never', 'deletion', 'analytics', 'report']

test('security page: file, localePages, bare path, proxy, sitemap, 404 list, llms.txt', async () => {
  assert.ok(existsSync('src/app/[locale]/security/page.tsx'))
  assert.ok(localePages.includes('security'))
  assert.ok(bareLocalePages.includes('security'))
  assert.match(read('src/proxy.ts'), /\|security\)/)
  const urls = (await sitemap()).map((e) => e.url)
  for (const locale of ['ru', 'en']) assert.ok(urls.some((u) => u.endsWith(`/${locale}/security`)), `sitemap ${locale}`)
  for (const locale of ['ru', 'en']) assert.ok(notFoundText[locale].pages.some((p) => p.path === '/security'), `404 ${locale}`)
  const { GET } = await import('../src/app/llms.txt/route.ts')
  const llms = await (await GET()).text()
  assert.match(llms, /\/en\/security/)
  assert.match(llms, /\/ru\/security/)
})

test('security page: footer «Студия» column, privacy page and builder summary link to it', () => {
  for (const locale of ['ru', 'en']) {
    const company = footerColumns(locale).find((c) => c.id === 'company')
    assert.ok(company.links.some((l) => l.href === `/${locale}/security`), `footer ${locale}`)
  }
  assert.equal(ru.footer.pages.security, 'Безопасность и данные')
  assert.equal(en.footer.pages.security, 'Security and data')
  assert.match(read('src/app/[locale]/privacy/page.tsx'), /\/security/)
  assert.match(read('src/components/builder-send.tsx'), /\/security/)
  assert.equal(ru.security.builderLink, 'Как мы бережём данные')
})

test('security page: nine sections in order, dated 24 November 2026, incident contact', () => {
  for (const [locale, dict] of [['ru', ru], ['en', en]]) {
    assert.deepEqual(dict.security.sections.map((s) => s.id), ids, locale)
    assert.match(dict.security.updated, /24/)
    assert.ok(dict.security.sections.at(-1).text.join(' ').includes('hello@firtech.pro'), locale)
  }
  assert.equal(ru.security.title, 'Безопасность и данные')
  assert.equal(en.security.title, 'Security and data')
})

test('security page: no long dashes, exclamation marks or AI tells', () => {
  const tells = [/\bэто не [^.!?]{1,60}, а\b/i, /\bне просто [^.!?]{1,60}, а\b/i, /\bit'?s not [^.!?]{1,60}, it'?s\b/i, /\bnot (just|only) [^.!?]{1,60}, (but|it)\b/i, /\bбез [^,.!?]{1,30}, без [^,.!?]{1,30}, (и )?без\b/i, /\bno [^,.!?]{1,30}, no [^,.!?]{1,30}, (and )?no\b/i, /уникальн|инновацион|бесшовн|\brobust\b|\bseamless/i]
  function* strings(v) {
    if (typeof v === 'string') yield v
    else if (Array.isArray(v)) for (const x of v) yield* strings(x)
    else if (v && typeof v === 'object') for (const x of Object.values(v)) yield* strings(x)
  }
  for (const [locale, dict] of [['ru', ru], ['en', en]])
    for (const text of strings(dict.security)) {
      assert.doesNotMatch(text, /[–—!]/, `${locale}: ${text.slice(0, 60)}`)
      for (const re of tells) assert.doesNotMatch(text, re, `${locale}: ${text.slice(0, 60)}`)
    }
})
