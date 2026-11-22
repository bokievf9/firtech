// Front v3 (owner review 2026-11-22): the hero, the names, the nav, the new pages, FAQ and contact
// placement, the page tails, the demo state machine and the chat persona.
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
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
const { productCatalog, kindsByCategory } = await import('../src/content/builder-catalog.ts')
const { notFoundText } = await import('../src/content/not-found.ts')
const { footerColumns, localePages, homeSections } = await import('../src/lib/home.ts')
const { bareLocalePages } = await import('../src/lib/i18n.ts')
const { productIds } = await import('../src/lib/products.ts')
const { bookingStart, bookingOptions, bookingNext } = await import('../src/lib/demo-booking.ts')
const { chatRequestSchema, personas } = await import('../src/lib/chat.ts')
const { askReceptionist } = await import('../src/lib/chat-hq.ts')
const { mainPartTerm, allSolutionKinds, solutionCopy } = await import('../src/lib/solutions.ts')
const { presets, quote } = await import('../src/lib/builder.ts')
const { stagesFor } = await import('../src/lib/payment-stages.ts')
const sitemap = (await import('../src/app/sitemap.ts')).default

const dicts = [['ru', ru], ['en', en]]
const read = (file) => readFileSync(file, 'utf8')

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name)
    if (statSync(file).isDirectory()) yield* walk(file)
    else yield file
  }
}
function* strings(value, at = '') {
  if (typeof value === 'string') yield [at, value]
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, `${at}[${i}]`)
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) yield* strings(v, at ? `${at}.${k}` : k)
}

test('names: «бот» leaves every product name, the new names are in place', () => {
  const names = {
    personal: ['Персональный ИИ', 'Personal AI'],
    company: ['ИИ-компания', 'AI company'],
    admin: ['ИИ-администратор', 'AI booking assistant'],
    receptionist: ['ИИ-менеджер заявок', 'AI lead manager'],
    automation: ['Автоматизация процессов', 'Process automation'],
    content: ['Контент на автопилоте', 'Content on autopilot'],
    miniapp: ['Telegram Mini App', 'Telegram Mini App'],
    implementation: ['ИИ-отдел под ключ', 'AI department, turnkey'],
  }
  for (const id of productIds) {
    assert.equal(ru.products.items[id].name, names[id][0], id)
    assert.equal(en.products.items[id].name, names[id][1], id)
    assert.doesNotMatch(ru.products.items[id].name, /бот/i, id)
    assert.doesNotMatch(en.products.items[id].name, /\bbot\b/i, id)
    assert.doesNotMatch(ru.productPage.items[id].metaTitle, /бот/i, id)
    assert.doesNotMatch(en.productPage.items[id].metaTitle, /\bbot\b/i, id)
  }
  const catalogIds = { personal: 'personal', company: 'company', admin: 'adminbot', receptionist: 'intake', automation: 'automation', content: 'content', miniapp: 'miniapp', implementation: 'aiteam' }
  for (const id of productIds) {
    assert.equal(productCatalog[catalogIds[id]].name.ru, names[id][0], `catalogue ru ${id}`)
    assert.equal(productCatalog[catalogIds[id]].name.en, names[id][1], `catalogue en ${id}`)
  }
  // The ladder titles and the tab labels never say «бот» either.
  for (const [at, text] of strings(ru.ladder.tracks)) if (/\.title$/.test(at)) assert.doesNotMatch(text, /бот/i, at)
  // «Бот» is a delivery channel, never a name (owner 2026-11-22): the classic service reads «Агенты в Telegram».
  assert.doesNotMatch(ru.services.items.bots.name, /бот/i)
  assert.equal(ru.services.items.bots.name, 'Агенты в Telegram')
  assert.equal(en.services.items.bots.name, 'Telegram agents')
})

test('hero: no numbers, two lines, the two actions, the guarantee and the 5-minute promise', () => {
  const numbers = /\d|\b(один|два|три|четыре|пять|шесть|семь|восемь|девять|десять|one|two|three|four|five|six|seven|eight|nine|ten)\b/i
  for (const [locale, dict] of dicts) {
    assert.equal(dict.hero.lines.length, 2, locale)
    for (const text of [dict.hero.title, ...dict.hero.lines, dict.hero.sub, dict.hero.eyebrow, ...Object.values(dict.hero.sequence)])
      assert.doesNotMatch(text, numbers, `${locale}: ${text}`)
    assert.match(dict.sla.line, /5/)
    assert.ok(dict.guarantee.line)
  }
  assert.equal(ru.hero.lines[0], 'ИИ берёт рутину на себя,')
  assert.equal(ru.nav.cta, 'Собрать проект')
  assert.equal(ru.hero.chatCta, 'Спросить агента')
  assert.equal(ru.nav.ask, 'Спросить агента')
  const hero = read('src/components/hero/hero.tsx')
  assert.match(hero, /\/builder/)
  assert.match(hero, /ChatOpenButton/)
  assert.match(hero, /GuaranteeLine/)
  assert.match(hero, /dict\.sla\.line/)
  assert.match(hero, /\/ai-team/)
  // No product numbers in the sequence either.
  const sequence = read('src/components/hero/hero-sequence.tsx')
  assert.doesNotMatch(sequence, /padStart/)
  assert.doesNotMatch(sequence, /copy\.of/)
})

test('builder is «Сборка проекта» everywhere and the word «калькулятор» is gone', () => {
  assert.equal(ru.nav.builder, 'Сборка проекта')
  assert.match(ru.builder.metaTitle, /^Сборка проекта/)
  assert.equal(ru.footer.pages.builder, 'Сборка проекта')
  for (const [locale, dict] of dicts)
    for (const [at, text] of strings(dict)) {
      if (at.startsWith('cabinet.')) continue
      assert.doesNotMatch(text, /калькулятор|calculator/i, `${locale} ${at}`)
      if (locale === 'ru') assert.doesNotMatch(text, /конструктор/i, `${locale} ${at}`)
    }
  for (const [at, text] of strings(productCatalog)) assert.doesNotMatch(text, /калькулятор|calculator/i, at)
  for (const [at, text] of strings(notFoundText)) assert.doesNotMatch(text, /калькулятор|calculator/i, at)
  assert.doesNotMatch(read('src/lib/solutions.ts'), /калькулятор|calculator/i)
  for (const kind of kindsByCategory.flatMap((g) => g.kinds)) {
    const rows = read('src/content/builder-catalog.ts')
    assert.doesNotMatch(rows, /Калькулятор|calculator/i, kind)
  }
})

test('nav: products, AI departments, solutions, demo, how we work, prices, one CTA to the builder', () => {
  const header = read('src/components/header.tsx')
  for (const item of ["'products'", '/ai-team', '/solutions', "'demo'", '/how-we-work', "'pricing'"]) assert.ok(header.includes(item), item)
  assert.match(header, /dict\.nav\.aiTeams/)
  assert.match(header, /dict\.nav\.solutions/)
  assert.equal(ru.nav.aiTeams, 'ИИ-отделы')
  assert.equal(ru.nav.solutions, 'Решения')
  assert.equal(en.nav.aiTeams, 'AI departments')
  assert.match(header, /href=\{`\/\$\{locale\}\/builder`\}/)
  assert.doesNotMatch(header, /#contact|'contact'/)
  assert.doesNotMatch(read('src/components/mobile-cta.tsx'), /#contact|TelegramLogo|telegramUrl/)
  assert.match(read('src/app/[locale]/ai-team/page.tsx'), /Ladder/)
})

test('new pages: how-we-work and the product pages are registered everywhere', async () => {
  assert.ok(localePages.includes('how-we-work'))
  assert.ok(existsSync('src/app/[locale]/how-we-work/page.tsx'))
  assert.ok(existsSync('src/app/[locale]/products/[id]/page.tsx'))
  assert.ok(bareLocalePages.includes('how-we-work') && bareLocalePages.includes('products'))
  assert.match(read('src/proxy.ts'), /how-we-work\|products/)
  const urls = (await sitemap()).map((e) => e.url)
  for (const locale of ['ru', 'en']) assert.ok(urls.some((u) => u.endsWith(`/${locale}/how-we-work`)), locale)
  for (const locale of ['ru', 'en']) assert.ok(notFoundText[locale].pages.some((p) => p.path === '/how-we-work'), `404 ${locale}`)
  for (const locale of ['ru', 'en']) {
    const company = footerColumns(locale).find((c) => c.id === 'company')
    assert.ok(company.links.some((l) => l.href === `/${locale}/how-we-work`), `footer ${locale}`)
    assert.equal(company.links.some((l) => l.href.endsWith('#contact')), false)
  }
  const { GET } = await import('../src/app/llms.txt/route.ts')
  const llms = await (await GET()).text()
  assert.match(llms, /\/en\/how-we-work/)
  assert.match(llms, /\/ru\/how-we-work/)
  for (const [, dict] of dicts) {
    assert.ok(dict.how.metaDescription.length >= 120 && dict.how.metaDescription.length <= 160, dict.how.metaDescription.length)
    assert.ok(dict.how.metaTitle.length <= 70)
    assert.equal(dict.how.stages.length, 4)
    for (const s of dict.how.stages) assert.ok(s.title && s.text && s.you && s.cabinet && s.who)
    for (const key of ['acceptanceTitle', 'paymentTitle', 'guaranteeTitle', 'dislikeTitle', 'toolsTitle', 'approvalsTitle']) assert.ok(dict.how[key], key)
  }
  const page = read('src/app/[locale]/how-we-work/page.tsx')
  assert.match(page, /GuaranteeLine/)
  assert.match(page, /pay-how/)
  assert.doesNotMatch(page, /ContactSection|#contact/)
  // The home #process is the short version with a link to the page.
  assert.match(read('src/components/work-timeline.tsx'), /how-we-work/)
})

test('home: sections in order with solutions and FAQ, anchors, no contact section', () => {
  assert.deepEqual([...homeSections], ['hero', 'pains', 'demo', 'products', 'office', 'solutions', 'process', 'pricing', 'faq', 'footer'])
  const page = read('src/app/[locale]/page.tsx')
  assert.match(page, /SolutionsHome/)
  assert.match(page, /DemoSection/)
  const faq = read('src/components/faq-contact.tsx')
  assert.doesNotMatch(faq, /ContactForm/)
  assert.match(faq, /data-ask-strip/)
  assert.equal(ru.askStrip.title, 'Остались вопросы?')
  assert.match(ru.askStrip.cta, /Спросить агента/)
})

test('FAQ only on the home page, no contact section anywhere outside the cabinet (the builder sends the lead itself)', () => {
  const pages = [...walk('src/app/[locale]')].filter((f) => f.endsWith('.tsx') && !f.includes(`${path.sep}cabinet${path.sep}`))
  const withFaq = pages.filter((f) => /<Faq\b|faqJsonLd\(|FaqList|FaqContact/.test(read(f))).map((f) => f.replaceAll(path.sep, '/'))
  assert.deepEqual(withFaq.sort(), ['src/app/[locale]/page.tsx'])
  const withContact = pages.filter((f) => /ContactSection|ContactForm|id="contact"/.test(read(f))).map((f) => f.replaceAll(path.sep, '/'))
  assert.deepEqual(withContact, [])
  for (const f of pages) assert.doesNotMatch(read(f), /#contact|'contact'\)/, f)
  const components = [...walk('src/components')].filter((f) => f.endsWith('.tsx') && !f.includes(`${path.sep}cabinet${path.sep}`) && !f.includes(`${path.sep}admin${path.sep}`))
  const importers = components.filter((f) => /from '\.\/contact-form'|from '\.\/contact-section'/.test(read(f))).map((f) => f.replaceAll(path.sep, '/'))
  assert.deepEqual(importers, ['src/components/contact-section.tsx'])
  // The contact section has no Telegram card any more.
  assert.doesNotMatch(read('src/components/contact-section.tsx'), /telegramUrl|TelegramLogo/)
  // The builder's last step sends the lead itself: the send block carries the old #contact anchor.
  assert.match(read('src/components/builder-send.tsx'), /id="contact"/)
  assert.match(read('src/components/builder-send.tsx'), /\/api\/lead/)
  assert.doesNotMatch(read('src/app/[locale]/builder/page.tsx'), /ContactSection/)
})

test('page tails: the footer ends every page with «Собрать проект» and «Спросить агента», Telegram is a small third link', () => {
  const footer = read('src/components/footer.tsx')
  const build = footer.indexOf('/builder')
  const ask = footer.indexOf('dict.nav.ask')
  const telegram = footer.indexOf('f.telegramLink')
  assert.ok(build > 0 && ask > build && telegram > ask)
  assert.match(footer, /ChatOpenButton/)
  assert.doesNotMatch(footer, /dict\.contact\.telegramCta/)
  assert.equal(ru.nav.cta, 'Собрать проект')
  assert.equal(ru.nav.ask, 'Спросить агента')
  assert.equal(en.nav.cta, 'Build a project')
  assert.equal(en.nav.ask, 'Ask an agent')
  assert.match(read('src/app/[locale]/layout.tsx'), /<Footer /)
})

test('solutions on the home page: exactly the six top niches from homeSolutionKinds and one «Все решения» button', async () => {
  const mod = read('src/components/solutions-home.tsx')
  assert.match(mod, /homeSolutionKinds = \['salon', 'clinic', 'cafe', 'onlineschool', 'carservice', 'shop'\]/)
  assert.match(mod, /data-cta="solutions_all"/)
  assert.doesNotMatch(mod, /PER_CATEGORY|SolutionGroups/)
  assert.equal(existsSync('src/components/solution-groups.tsx'), false)
  for (const [, dict] of dicts) assert.ok(dict.solutionsHome.all && dict.solutionsHome.from)
  assert.match(read('src/components/header.tsx'), /nav\.solutions/)
})

test('solution pages: stages from the template, first stage, timeline, new CTAs, no FAQ or contact section', () => {
  const page = read('src/app/[locale]/solutions/[kind]/page.tsx')
  for (const part of ['stagesFor', 'StageTable', 'mainPartTerm', 'data-first-stage', 'ChatOpenButton', 't.cta', 't.discuss'])
    assert.ok(page.includes(part), part)
  assert.doesNotMatch(page, /ContactSection|<Faq|#contact/)
  assert.equal(ru.solutions.cta, 'Собрать это решение')
  assert.equal(ru.solutions.discuss, 'Спросить агента')
  for (const kind of ['salon', 'shop', 'clinic', 'cafe']) {
    const q = quote(presets[kind])
    const stages = stagesFor(presets[kind], q.total)
    assert.ok(stages.length >= 2, kind)
    assert.equal(stages.reduce((sum, s) => sum + s.amountUsd, 0), q.total, kind)
    assert.match(mainPartTerm(presets[kind], q.lines, ru), /\S/, kind)
  }
  assert.equal(allSolutionKinds.length, 55)
  // Meta stays within 120-160 for every generated solution page.
  for (const [locale, dict] of dicts)
    for (const kind of allSolutionKinds) {
      const m = solutionCopy(kind, locale, dict).metaDescription.length
      assert.ok(m >= 120 && m <= 160, `${locale} ${kind} ${m}`)
    }
})

test('llms.txt: the product lines carry the new names and the product page', async () => {
  const { GET } = await import('../src/app/llms.txt/route.ts')
  const llms = await (await GET()).text()
  for (const id of productIds) {
    const line = llms.split('\n').find((l) => l.includes(en.products.items[id].name) && l.includes(`/en/products/${id}`))
    assert.ok(line, `en ${id}`)
    assert.ok(llms.split('\n').some((l) => l.includes(ru.products.items[id].name) && l.includes(`/ru/products/${id}`)), `ru ${id}`)
  }
  assert.doesNotMatch(llms, /Бот-администратор|Admin bot|Личный агент|Внедрение ИИ/)
})

test('demo: tabs per product, the chat persona is validated and forwarded, the booking dialogue is a state machine', async () => {
  const demo = read('src/components/demo/demo-tabs.tsx')
  for (const id of ['receptionist', 'admin', 'personal', 'automation', 'content', 'miniapp', 'implementation']) assert.ok(demo.includes(`'${id}'`), id)
  // all seven products are shown, the scripted ones carry the «Пример» badge
  assert.match(demo, /DemoBuilt[^>]*product="automation"/)
  assert.match(demo, /DemoBuilt[^>]*product="miniapp"/)
  assert.match(demo, /DemoAssistant/)
  for (const [, dict] of dicts) assert.ok(dict.demoSection.exampleBadge && dict.demoSection.personal.prompts.length === 5 && dict.demoSection.automation.intro && dict.demoSection.miniapp.intro)
  // v4: the tablist is the shared TabList primitive (roles and keys live in components/ui/tabs.tsx).
  assert.match(demo, /<TabList/)
  for (const needle of ['role="tablist"', 'role="tab"', 'aria-selected', 'ArrowRight', 'Home', 'End']) assert.ok(read('src/components/ui/tabs.tsx').includes(needle), needle)
  assert.doesNotMatch(read('src/components/demo-section.tsx') + demo + read('src/components/demo/demo-booking.tsx'), /t\.me\//)
  assert.equal(ru.demoSection.title, 'Попробуйте сейчас')
  assert.deepEqual([...personas], ['salon', 'clinic', 'shop', 'cafe', 'service', 'courses', 'personal'])
  for (const [, dict] of dicts) for (const id of personas.filter((p) => p !== 'personal')) assert.ok(dict.demoSection.receptionist.niches[id] && dict.demoSection.receptionist.hints[id].length === 3 && dict.demoSection.receptionist.chips[id] && dict.chat.demoChip[id], id)
  // The Telegram pull-back reply: builder button first, then Telegram.
  const { ctaActions } = await import('../src/lib/chat-cta.ts')
  assert.deepEqual(ctaActions({ builderLink: '/ru/builder?b=k.cafe', cta: ['builder', 'telegram'] }, 'https://t.me/x').map((a) => a.kind), ['builder', 'telegram'])
  const base = { sessionId: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b', locale: 'ru', message: 'hi', page: '/' }
  assert.equal(chatRequestSchema.safeParse({ ...base, persona: 'salon' }).success, true)
  assert.equal(chatRequestSchema.safeParse({ ...base, persona: 'bank' }).success, false)
  assert.equal(chatRequestSchema.safeParse(base).success, true)
  let sent
  const fetcher = async (_u, init) => ((sent = JSON.parse(init.body)), { ok: true, status: 200, json: async () => ({ ok: true, reply: 'hi', state: 'chat' }) })
  await askReceptionist({ ...base, persona: 'clinic' }, { HQ_CHAT_URL: 'http://hq.local/chat', HQ_CHAT_TOKEN: 't', NODE_ENV: 'production' }, fetcher)
  assert.equal(sent.persona, 'clinic')
  await askReceptionist(base, { HQ_CHAT_URL: 'http://hq.local/chat', HQ_CHAT_TOKEN: 't', NODE_ENV: 'production' }, fetcher)
  assert.equal('persona' in sent, false)
  // A demo request never creates a lead: a contact is answered by the route.
  const route = read('src/app/api/chat/route.ts')
  assert.match(route, /if \(parsed\.data\.persona\) \{[\s\S]*auth_required[\s\S]*wouldCreateLead/)
  // HQ reads persona and ref now (2026-11-22): the TODO(agents) notes are gone.
  assert.doesNotMatch(read('src/lib/chat.ts') + read('src/lib/chat-hq.ts'), /TODO\(agents\)/)
  assert.match(read('src/components/demo/demo-chat.tsx'), /callPersona\(forNiche/)
  assert.match(read('src/components/demo/persona-call.ts'), /persona \}\)/)
})

test('demo booking: a full dialogue walks service, master, time, reminder, review and restarts', () => {
  const copy = ru.demoSection.admin
  let s = bookingStart(copy)
  assert.equal(s.step, 'service')
  assert.deepEqual(bookingOptions(s, copy), copy.services)
  s = bookingNext(s, 1, copy)
  assert.equal(s.step, 'master')
  assert.equal(s.service, copy.services[1])
  s = bookingNext(s, 0, copy)
  s = bookingNext(s, 1, copy)
  assert.equal(s.step, 'confirm')
  assert.equal(s.time, copy.times[1])
  assert.match(s.log.at(-1).text, new RegExp(copy.times[1]))
  assert.doesNotMatch(s.log.at(-1).text, /\{/)
  s = bookingNext(s, 0, copy)
  assert.equal(s.step, 'reminder')
  assert.match(s.log.at(-1).text, new RegExp(copy.times[1]))
  s = bookingNext(s, 1, copy)
  assert.equal(s.log.at(-1).text, copy.moved)
  s = bookingNext(s, 0, copy)
  assert.equal(s.step, 'review')
  s = bookingNext(s, 1, copy)
  assert.equal(s.step, 'end')
  assert.match(s.log.at(-1).text, new RegExp(copy.fairReply))
  // An index out of range changes nothing; the last step restarts.
  assert.equal(bookingNext(s, 9, copy), s)
  assert.equal(bookingNext(s, 0, copy).step, 'service')
  assert.equal(bookingNext(s, 0, copy).log.length, 1)
  // Every option of every step has a label, in both languages.
  for (const dict of [ru, en]) {
    const c = dict.demoSection.admin
    let st = bookingStart(c)
    for (let i = 0; i < 12 && st.step !== 'end'; i++) {
      const options = bookingOptions(st, c)
      assert.ok(options.length >= 1 && options.every(Boolean))
      st = bookingNext(st, 0, c)
    }
    assert.equal(st.step, 'end')
  }
})

test('leftovers 2026-11-22: the home has no estimator, the cabinet stub points to the builder, the chat button hides on scroll', () => {
  assert.ok(!existsSync('src/components/estimator.tsx'), 'the estimator component is deleted')
  assert.doesNotMatch(read('src/components/pricing-section.tsx'), /Estimator/)
  const service = read('src/app/[locale]/services/[slug]/page.tsx')
  assert.doesNotMatch(service, /Estimator|PricingSection|ContactSection|FaqSection/, 'service pages have no estimator, FAQ or contact section')
  assert.match(service, /StageTable/)
  assert.match(service, /ChatOpenButton/)
  assert.doesNotMatch(read('src/components/service-variants.tsx'), /pickInCalculator|firtech:pick/)
  assert.doesNotMatch(read('src/components/cabinet/cabinet-soon.tsx'), /#contact|homeAnchor/)
  assert.match(read('src/components/cabinet/cabinet-soon.tsx'), /\/builder/)
  const widget = read('src/components/chat/chat-widget.tsx')
  assert.match(widget, /SCROLL_IDLE_MS = 1500/)
  assert.match(widget, /quietRoute = .*builder\|cabinet/)
  assert.match(widget, /BUILDER_STEP_EVENT/)
  assert.match(read('src/components/builder.tsx'), /BUILDER_STEP_EVENT/)
  for (const [, dict] of dicts) {
    assert.equal(typeof dict.pricingHome.title, 'string')
    assert.doesNotMatch(dict.pricingHome.title + dict.pricingHome.sub, /Оценка|Оцените|estimate/i)
  }
  assert.equal(ru.aiTeams.agents.page.finalTitle, 'Подключить этого агента')
  assert.equal(en.aiTeams.agents.page.finalTitle, 'Connect this agent')
  assert.equal(ru.aiTeams.page.finalTitle, 'Запустить этот отдел')
  assert.equal(en.aiTeams.page.finalTitle, 'Launch this department')
})
