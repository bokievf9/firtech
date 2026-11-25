// Go-live copy (2026-11-21): the response promise, the guarantee on the first screen, the
// «Как оплатить» page, the /compare contrast block and the removal of the old 50/50 wording.
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
const { articles } = await import('../src/content/blog/index.ts')
const { notFoundText } = await import('../src/content/not-found.ts')
const { footerColumns, localePages } = await import('../src/lib/home.ts')
const sitemap = (await import('../src/app/sitemap.ts')).default
const { GET: llms } = await import('../src/app/llms.txt/route.ts')

function* strings(value, at = '') {
  if (typeof value === 'string') yield [at, value]
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, `${at}[${i}]`)
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) yield* strings(v, at ? `${at}.${k}` : k)
}
const dicts = [['ru', ru], ['en', en]]

test('sla: the response promise is in both dictionaries, the contact block, the FAQ and llms.txt', async () => {
  assert.equal(
    ru.sla.line,
    'Ответ менеджера в течение 5 минут в рабочее время. Всё, что касается цен и сроков, подтверждает менеджер проекта.',
  )
  assert.match(en.sla.line, /within 5 minutes in working hours/)
  const body = await (await llms()).text()
  for (const [locale, dict] of dicts) {
    assert.equal(dict.contact.sub, dict.sla.line, `${locale} contact`)
    assert.ok(dict.faq.items.some((i) => i.a.startsWith(dict.sla.line.split('. ')[0])), `${locale} faq`)
    assert.ok(body.includes(dict.sla.llms), `${locale} llms.txt`)
  }
})

test('hero: the guarantee is on the first screen (the hairline row since design v5)', () => {
  const hero = readFileSync('src/components/hero/hero.tsx', 'utf8')
  assert.match(hero, /guaranteeLine\(dict, locale, pricing, 'short'\)/)
  const g = readFileSync('src/components/guarantee-line.tsx', 'utf8')
  assert.match(g, /guaranteeLine\(dict, locale, pricing, short/)
  for (const [, dict] of dicts) assert.ok(dict.guarantee.line.length > 20)
})

test('pay-how: page, localePages, sitemap with alternates, 404 search, footer and the links to it', async () => {
  assert.ok(localePages.includes('pay-how'))
  assert.ok(existsSync('src/app/[locale]/pay-how/page.tsx'))
  const entries = await sitemap()
  const urls = entries.map((e) => e.url)
  for (const [locale, dict] of dicts) {
    assert.ok(urls.some((u) => u.endsWith(`/${locale}/pay-how`)), `${locale} sitemap`)
    const company = footerColumns(locale).find((c) => c.id === 'company')
    assert.ok(company.links.some((l) => l.href === `/${locale}/pay-how`), `${locale} footer`)
    assert.ok(dict.footer.pages['pay-how'], `${locale} footer label`)
    assert.ok(notFoundText[locale].pages.some((p) => p.path === '/pay-how'), `${locale} 404`)
    assert.ok(dict.faqLinks['pay-how'], `${locale} faq link`)
    assert.ok(dict.cabinet.cards.payHow, `${locale} cabinet`)
    assert.ok(dict.pay.howLink, `${locale} pay page`)
  }
  const entry = entries.find((e) => e.url.endsWith('/ru/pay-how'))
  assert.deepEqual(Object.keys(entry.alternates.languages), ['ru', 'en'])
  const body = await (await llms()).text()
  assert.ok(body.includes('/ru/pay-how') && body.includes('/en/pay-how'))
  assert.match(readFileSync('src/components/pay/pay-view.tsx', 'utf8'), /pay-how/)
  assert.match(readFileSync('src/app/[locale]/terms/page.tsx', 'utf8'), /pay-how/)
  assert.match(readFileSync('src/components/cabinet/documents-panel.tsx', 'utf8'), /pay-how/)
  assert.match(readFileSync('src/components/faq-contact.tsx', 'utf8'), /pay-how/)
})

test('pay-how: meta 120-160, same sections in both locales, covers the required topics', () => {
  for (const [locale, dict] of dicts) {
    const t = dict.payHow
    assert.ok(t.metaDescription.length >= 120 && t.metaDescription.length <= 160, `${locale} ${t.metaDescription.length}`)
    assert.ok(t.metaTitle.length <= 70, `${locale} title`)
    assert.deepEqual(t.sections.map((s) => s.id), ['guarantee', 'estimate', 'pay', 'stages', 'subscription', 'faq'])
    const all = [...strings(t.sections)].map(([, s]) => s).join(' ')
    assert.doesNotMatch(all, /USDT|TRC20|Tonkeeper|крипт|crypto/i, `${locale} no crypto`)
    assert.ok(t.banner && t.entityNote, `${locale} banner and entity note`)
    assert.equal(t.sections[0].id, 'guarantee', `${locale} guarantee first`)
    assert.doesNotMatch(all, /\$\s?\d|\d\s?%/, `${locale} typed price or percent`)
  }
})

test('compare: the contrast block exists in both locales with the same rows', () => {
  const ids = ['price', 'code', 'payment', 'guarantee', 'demo', 'entity', 'method']
  for (const [locale, dict] of dicts) {
    const c = dict.comparePage.contrast
    assert.deepEqual(c.rows.map((r) => r.id), ids, locale)
    for (const row of c.rows) assert.ok(row.label && row.market && row.us, `${locale} ${row.id}`)
    assert.ok(c.title && c.marketLabel && c.usLabel && c.payLink, locale)
    const text = [...strings(c)].map(([, s]) => s).join(' ')
    assert.doesNotMatch(text, /\d/, `${locale} no numbers`)
  }
  assert.match(readFileSync('src/app/[locale]/compare/page.tsx', 'utf8'), /comparePage|t\.contrast/)
})

test('stages: no 50% or «половина» wording outside the small-project sentence and the terms', () => {
  const bad = /50\s?%|50\/50|половин|\bhalf\b|after acceptance|после приёмки/i
  const skip = /^(terms)\./ // the terms keep the small-project rule: two stages, 50% and 50%
  for (const [locale, dict] of dicts)
    for (const [at, text] of strings(dict)) {
      if (skip.test(at)) continue
      if (/^comparePage\.contrast/.test(at)) assert.doesNotMatch(text, bad, `${locale} ${at}`)
      else if (/^(faq|builder|guarantee|referral|pay|payHow|hero|contact)\b/.test(at)) assert.doesNotMatch(text, bad, `${locale} ${at}`)
    }
  for (const a of articles)
    for (const l of ['ru', 'en']) for (const [at, text] of strings(a[l])) assert.doesNotMatch(text, bad, `${a.slug} ${l} ${at}`)
  const cost = articles.find((a) => a.slug === 'website-cost-2026')
  const flat = [...strings(cost.ru)].map(([, s]) => s).join(' ')
  assert.match(flat, /по этапам: каждый этап до его начала/)
})
