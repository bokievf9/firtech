// Guarantee, referral page, comparison page (2026-11-19): copy rules, meta, routes, referral flow.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
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
const { footerColumns, localePages } = await import('../src/lib/home.ts')
const { referralPercent } = await import('../src/lib/pricing.ts')
const referral = await import('../src/lib/referral.ts')
const { leadSchema } = await import('../src/lib/lead.ts')
const { forwardLead } = await import('../src/lib/lead-forward.ts')
const { estimateDoc } = await import('../src/lib/estimate-doc.ts')
const { decodeBuild } = await import('../src/lib/builder.ts')
const sitemap = (await import('../src/app/sitemap.ts')).default

function* strings(value, at = '') {
  if (typeof value === 'string') yield [at, value]
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, `${at}[${i}]`)
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) yield* strings(v, at ? `${at}.${k}` : k)
}

const dicts = [['ru', ru], ['en', en]]
const newCopy = (dict) => [dict.guarantee, dict.referral, dict.comparePage, dict.faqLinks, dict.faq, dict.terms]

test('new pages: in localePages, sitemap with alternates, footer, labels, files', () => {
  for (const page of ['referral', 'compare']) {
    assert.ok(localePages.includes(page), page)
    assert.ok(existsSync(`src/app/[locale]/${page}/page.tsx`), page)
  }
  const urls = sitemap().map((e) => e.url)
  for (const [locale, dict] of dicts) {
    for (const page of ['referral', 'compare']) {
      assert.ok(urls.some((u) => u.endsWith(`/${locale}/${page}`)), `${locale} ${page}`)
      const company = footerColumns(locale).find((c) => c.id === 'company')
      assert.ok(company.links.some((l) => l.href === `/${locale}/${page}`), `footer ${locale} ${page}`)
      assert.ok(dict.footer.pages[page], `label ${locale} ${page}`)
    }
  }
  for (const e of sitemap().filter((e) => /\/(referral|compare)$/.test(e.url)))
    assert.deepEqual(Object.keys(e.alternates.languages), ['ru', 'en'])
})

test('new pages: titles up to 70, meta descriptions 120-160 (percent filled)', () => {
  for (const [locale, dict] of dicts) {
    const referralTitle = referral.fillReferralPercent(dict.referral.metaTitle)
    const referralDesc = referral.fillReferralPercent(dict.referral.metaDescription)
    for (const [label, title, desc] of [
      ['referral', referralTitle, referralDesc],
      ['compare', dict.comparePage.metaTitle, dict.comparePage.metaDescription],
    ]) {
      assert.ok(title.length <= 70 && !title.includes('{'), `${locale} ${label} title: ${title.length}`)
      assert.ok(desc.length >= 120 && desc.length <= 160 && !desc.includes('{'), `${locale} ${label} description: ${desc.length}`)
    }
  }
})

test('new copy: no long dashes, no AI tells, no dollar amounts', () => {
  const tells = [
    /\bэто не [^.!?]{1,60}, а\b/i,
    /\bне просто [^.!?]{1,60}, а\b/i,
    /\bit'?s not [^.!?]{1,60}, it'?s\b/i,
    /\bnot (just|only|merely) [^.!?]{1,60}, (but|it)\b/i,
    /\bбез [^,.!?]{1,30}, без [^,.!?]{1,30}, (и )?без\b/i,
    /, (позволяя|делая|помогая|обеспечивая|allowing|making|helping|ensuring)\b/i,
  ]
  for (const [name, dict] of dicts)
    for (const [at, text] of strings(newCopy(dict))) {
      assert.doesNotMatch(text, /[–—]/, `${name} ${at}`)
      assert.doesNotMatch(text, /\$\s?\d/, `${name} ${at}`)
      for (const re of tells) assert.doesNotMatch(text, re, `${name} ${at}`)
    }
})

test('compare: 8-10 rows, three columns each, no figures or invented names', () => {
  for (const [name, dict] of dicts) {
    const rows = dict.comparePage.rows
    assert.ok(rows.length >= 8 && rows.length <= 10, name)
    for (const row of rows)
      for (const col of ['freelancer', 'agency', 'fir']) {
        assert.ok(row[col] && row.label, `${name} ${row.id} ${col}`)
        assert.doesNotMatch(row[col], /\d/, `${name} ${row.id} ${col}`)
      }
  }
})

test('referralPercent is the only source of the number', () => {
  assert.equal(referral.fillReferralPercent('{percent}'), `${referralPercent}%`)
  assert.equal(referralPercent, 10)
  for (const [name, dict] of dicts) {
    const text = JSON.stringify(dict.referral)
    assert.match(text, /\{percent\}/, name)
    assert.doesNotMatch(text, /\d+\s?%/, name)
    assert.doesNotMatch(text, new RegExp(`\\b${referralPercent}\\b`), name)
  }
  for (const file of ['src/app/[locale]/referral/page.tsx', 'src/components/referral-link.tsx']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /\b10\s?%/, file)
  }
})

test('ref slug: letters, digits, _ and -, 32 characters at most', () => {
  const s = referral.sanitizeRefSlug
  assert.equal(s('@Ivan_Petrov'), 'ivan_petrov')
  assert.equal(s('  anna-k  '), 'anna-k')
  assert.equal(s('Иван Петров'), 'ivan_petrov')
  assert.equal(s('a.b'), 'a_b')
  assert.equal(s('<script>x</script>'), 'scriptxscript')
  assert.equal(s('a'.repeat(80)).length, 32)
  assert.equal(s('!!!'), '')
  assert.equal(s(null), '')
  assert.match(s('Zz09_-.x y'), /^[a-z0-9_-]+$/)
  assert.equal(referral.refSource('@Bob'), 'ref:bob')
  assert.equal(referral.refSource(''), '')
  assert.equal(referral.refFromSearch('?ref=Bob%20X&utm=1'), 'bob_x')
  assert.equal(referral.refFromSearch('?utm=1'), '')
  assert.equal(referral.refLink('https://firtech.pro/', 'ru', 'bob'), 'https://firtech.pro/ru?ref=bob')
})

test('lead: schema accepts ref sources and the forward carries them', async () => {
  const base = { name: 'Тест', contact: '@test' }
  assert.equal(leadSchema.parse({ ...base, source: 'ref:bob_1' }).source, 'ref:bob_1')
  assert.equal(leadSchema.parse({ ...base, source: 'ref:' + 'a'.repeat(32) }).source.length, 36)
  assert.equal(leadSchema.safeParse({ ...base, source: 'ref:' + 'a'.repeat(33) }).success, false)
  assert.equal(leadSchema.safeParse({ ...base, source: 'ref:Bad Slug' }).success, false)
  assert.equal(leadSchema.safeParse({ ...base, source: 'other:x' }).success, false)
  const env = { LEAD_INTAKE_URL: 'http://intake.local:8787', LEAD_INTAKE_TOKEN: 't' }
  const bodies = []
  const fetchImpl = async (_url, init) => (bodies.push(JSON.parse(init.body)), { ok: true, status: 200 })
  await forwardLead(leadSchema.parse({ ...base, source: 'ref:bob' }), undefined, env, fetchImpl)
  await forwardLead(leadSchema.parse(base), undefined, env, fetchImpl)
  assert.equal(bodies[0].source, 'ref:bob')
  // HQ rejects an empty source, so the field is left out.
  assert.equal('source' in bodies[1], false)
})

test('contact form and home page wire the ref flow', () => {
  assert.match(readFileSync('src/components/contact-form.tsx', 'utf8'), /refSource\(storedRef\(\)\)/)
  assert.match(readFileSync('src/app/[locale]/page.tsx', 'utf8'), /<RefCapture \/>/)
  assert.match(readFileSync('src/lib/referral.ts', 'utf8'), /fir-ref/)
})

test('guarantee: pricing, builder summary, estimate notes, FAQ, terms, llms.txt', async () => {
  for (const f of ['src/components/pricing-section.tsx', 'src/components/builder-summary.tsx'])
    assert.match(readFileSync(f, 'utf8'), /<GuaranteeLine/, f)
  const doc = estimateDoc(decodeBuild('apps.pwa'), ru, 'ru')
  assert.equal(doc.guarantee, ru.guarantee.line)
  assert.match(readFileSync('src/components/estimate-sheet.tsx', 'utf8'), /doc\.guarantee/)
  for (const [name, dict] of dicts) {
    assert.ok(dict.faq.items.some((i) => /guarantee|prepayment/i.test(i.a) || /предоплат/.test(i.a)), `faq ${name}`)
    const ids = dict.terms.sections.map((s) => s.id)
    assert.equal(ids[ids.indexOf('payment') + 1], 'guarantee', name)
    const sec = dict.terms.sections.find((s) => s.id === 'guarantee')
    assert.match(sec.text.join(' '), /7/, name)
  }
  const { GET } = await import('../src/app/llms.txt/route.ts')
  const body = await GET().text()
  assert.ok(body.includes(ru.guarantee.llms) && body.includes(en.guarantee.llms))
})
