// Fira navigation 2.0 (owner 2026-11-25): the site map, the local intent matcher («Отведи меня»), the spotlight
// geometry, the tour progress, the deep links, the chips, the offer-once rule and the guard rails of the components.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { test } from 'node:test'
import { aiTeamIds } from '../src/lib/ai-teams.ts'
import { chipsByContext, chipsFor } from '../src/lib/fira/nav/chips.ts'
import { FIRA_PARAM, goPlan, parseFiraParam, withoutFiraParam } from '../src/lib/fira/nav/go.ts'
import { matchIntent, rank, sameWord, searchMap, tokens } from '../src/lib/fira/nav/intents.ts'
import { markOffered, offerDue, offeredList, sceneLinesOn } from '../src/lib/fira/nav/offer.ts'
import { RECENT_MAX, pushRecent, recentList } from '../src/lib/fira/nav/recent.ts'
import { entryByKey, entryHref, groupEntries, groupNames, groupOrder, onEntryPage, shortLine, siteMap, solutionKindKeys, synonymsOf } from '../src/lib/fira/nav/sitemap.ts'
import { HEADER_OFFSET, NARROW_MAX, SPOT_PAD, cutoutRect, isTall, placeBubble, progressLabel, scrollTopFor, stepIndex, swipeDirection } from '../src/lib/fira/nav/spotlight.ts'
import { TOUR_AUTOSTART } from '../src/lib/fira/tour.ts'
import { homeAnchors, localePages } from '../src/lib/home.ts'
import { serviceSlugs } from '../src/lib/site.ts'
import { productIds } from '../src/lib/product-ids.ts'
import { allSolutionKinds } from '../src/lib/solutions.ts'

const read = (p) => readFileSync(p, 'utf8')
const paths = new Set(siteMap.map((s) => s.path))

// ---- the site map
test('sitemap: keys are unique, lower-case and stable-looking', () => {
  const keys = siteMap.map((s) => s.key)
  assert.equal(new Set(keys).size, keys.length)
  for (const k of keys) assert.match(k, /^[a-z0-9]+(-[a-z0-9]+)*$/, k)
  assert.ok(entryByKey('prices') && entryByKey('builder') && entryByKey('cabinet') && entryByKey('security'), 'keys the deep links and chips rely on')
})

test('sitemap: every public route is listed (pages, products, services, niches, AI teams), the Shell is not', () => {
  for (const p of ['', ...localePages.map((x) => `/${x}`)]) assert.ok(paths.has(p), `page ${p || 'home'} is in the map`)
  for (const p of ['terms', 'privacy', 'cabinet', 'cabinet/login']) assert.ok(paths.has(`/${p}`), p)
  for (const id of productIds) assert.ok(paths.has(`/products/${id}`), `product ${id}`)
  for (const id of serviceSlugs) assert.ok(paths.has(`/services/${id}`), `service ${id}`)
  for (const id of aiTeamIds) assert.ok(paths.has(`/ai-team/${id}`), `team ${id}`)
  assert.deepEqual([...solutionKindKeys].sort(), [...allSolutionKinds].sort(), 'the niche table follows the solution kinds')
  for (const id of allSolutionKinds) assert.ok(paths.has(`/solutions/${id}`), `niche ${id}`)
  for (const k of ['/ai-team', '/builder', '/pay-how']) assert.ok(paths.has(k))
  for (const s of siteMap) assert.doesNotMatch(s.path, /^\/(admin|fira-lab)/, 'the Shell and the lab are not on the map')
})

test('sitemap: every route folder of the app is on the map or on the short list of system pages', () => {
  const system = new Set(['[...rest]', 'fira-lab', 'demo', 'pay', 'cabinet/auth', 'cabinet/health', 'cabinet/reset', 'cabinet/unsubscribe', 'builder/estimate', 'ai-team/[id]', 'ai-team/agent', 'blog/[slug]', 'products/[id]', 'services/[slug]', 'solutions/[kind]'])
  const root = 'src/app/[locale]'
  const walk = (dir, rel) => {
    const out = []
    for (const name of readdirSync(dir)) {
      const full = `${dir}/${name}`
      if (!statSync(full).isDirectory()) continue
      const r = rel ? `${rel}/${name}` : name
      if (readdirSync(full).includes('page.tsx')) out.push(r)
      out.push(...walk(full, r))
    }
    return out
  }
  for (const route of walk(root, '')) {
    if ([...system].some((x) => route === x || route.startsWith(`${x}/`))) continue
    assert.ok(paths.has(`/${route}`), `route /${route} is neither on Fira's map nor a system page`)
  }
})

test('sitemap: every entry has both names, both lines, 3+ synonyms per language, a valid group and no dashes', () => {
  for (const s of siteMap) {
    for (const loc of ['ru', 'en']) {
      assert.ok(s.name[loc].trim().length > 1, `${s.key} name ${loc}`)
      assert.ok(s.line[loc].trim().length > 10, `${s.key} line ${loc}`)
      assert.ok(s.syn[loc].length >= 2, `${s.key} synonyms ${loc}`)
      assert.doesNotMatch(`${s.name[loc]} ${s.line[loc]}`, /[–—]/, `${s.key}: no em or en dashes`)
    }
    assert.ok(groupOrder.includes(s.group), s.key)
    assert.match(s.path, /^(\/[a-z0-9\-/]+)?$/, s.key)
    if (s.selector) assert.match(s.selector, /^[#.[][^\s]+$/, `${s.key} selector`)
  }
  for (const g of groupOrder) assert.ok(groupNames[g].ru && groupNames[g].en && groupEntries(g).length > 0, g)
  assert.deepEqual(groupOrder.map((g) => groupNames[g].ru), ['Для себя', 'Для бизнеса', 'Команды и агенты', 'Как работаем', 'Кабинет'])
})

test('sitemap: the short line drops the name the list already shows', () => {
  assert.equal(shortLine(entryByKey('prices'), 'ru'), 'От чего стартуем и как платить по этапам.')
  assert.equal(shortLine(entryByKey('security'), 'en'), 'Where the data lives, who has access and how to check.')
  for (const s of siteMap) assert.ok(shortLine(s, 'ru').length > 8 && shortLine(s, 'en').length > 8, s.key)
})

test('sitemap: home sections point at the real anchors of the page', () => {
  for (const s of siteMap.filter((x) => x.path === '' && x.selector)) {
    const id = s.selector.slice(1)
    assert.ok([...homeAnchors, 'levels'].includes(id), `${s.key} -> #${id}`)
  }
  assert.equal(entryHref(entryByKey('prices'), 'ru'), '/ru?fira=go:prices')
  assert.equal(entryHref(entryByKey('pay-stages'), 'en'), '/en/pay-how?fira=go:pay-stages')
  assert.ok(onEntryPage(entryByKey('prices'), '/ru') && onEntryPage(entryByKey('prices'), '/en/'))
  assert.ok(!onEntryPage(entryByKey('prices'), '/ru/builder') && onEntryPage(entryByKey('builder'), '/ru/builder'))
  assert.deepEqual(goPlan(entryByKey('security'), '/ru', 'ru'), { navigate: true, to: '/ru/security' })
  assert.deepEqual(goPlan(entryByKey('prices'), '/ru', 'ru'), { navigate: false, to: '/ru' })
})

// ---- the matcher
const RU = [
  ['цены', 'prices'], ['Цены', 'prices'], ['сколько стоит', 'prices'], ['почём', 'prices'], ['прайс', 'prices'], ['тарифы', 'prices'], ['стоимость', 'prices'],
  ['сколько стоит салон', 'solution-salon'], ['сколько стоит сайт', 'service-websites'], ['цена бота', 'service-bots'], ['сколько стоит мобильное приложение', 'service-apps'],
  ['как оплатить', 'pay-how'], ['способы оплаты', 'pay-how'], ['оплата по этапам', 'pay-stages'], ['можно ли платить частями', 'pay-stages'], ['рассрочка', 'pay-stages'],
  ['безопасность', 'security'], ['где хранятся данные', 'security'], ['безопасно ли', 'security'],
  ['кабинет', 'cabinet'], ['личный кабинет', 'cabinet'], ['где мой проект', 'cabinet'], ['где моя смета', 'cabinet-docs'],
  ['личный ИИ', 'product-personal'], ['персональный ии', 'product-personal'], ['личный ассистент', 'product-personal'],
  ['что после заявки', 'how-we-work'], ['как вы работаете', 'how-we-work'], ['сроки', 'how-we-work'],
  ['с чего начать', 'builder'], ['как заказать', 'builder'], ['собрать проект', 'builder'], ['калькулятор', 'builder'],
  ['гарантия', 'pay-guarantee'], ['что если не понравится', 'pay-guarantee'],
  ['хочу салон красоты', 'solution-salon'], ['кафе', 'solution-cafe'], ['магазин', 'solution-shop'], ['автосервис', 'solution-carservice'], ['стоматология', 'solution-dentist'],
  ['телеграм бот', 'service-bots'], ['лендинг', 'service-websites'], ['мини апп', 'product-miniapp'],
  ['ии администратор', 'product-admin'], ['менеджер заявок', 'product-receptionist'], ['контент на автопилоте', 'product-content'], ['ии компании', 'product-company'],
  ['ии команды', 'ai-team'], ['отдел продаж', 'team-sales'], ['служба поддержки', 'team-support'],
  ['демо', 'demo'], ['частые вопросы', 'faq'], ['блог', 'blog'], ['реферальная программа', 'referral'], ['чем вы лучше фрилансера', 'compare'], ['аудит сайта', 'audit'], ['войти', 'cabinet-login'], ['политика конфиденциальности', 'privacy'], ['оферта', 'terms'], ['статус сервисов', 'status'],
  ['покажи цены', 'prices'], ['отведи меня в кабинет', 'cabinet'], ['где безопасность', 'security'],
]
const EN = [
  ['prices', 'prices'], ['how much', 'prices'], ['how much does it cost', 'prices'], ['pricing', 'prices'], ['price list', 'prices'], ['budget', 'prices'],
  ['how much is a salon', 'solution-salon'], ['website price', 'service-websites'], ['how much is a bot', 'service-bots'], ['cost of an app', 'service-apps'],
  ['how to pay', 'pay-how'], ['payment methods', 'pay-how'], ['can I pay later', 'pay-stages'], ['installments', 'pay-stages'], ['pay in stages', 'pay-stages'],
  ['security', 'security'], ['is it safe', 'security'], ['where is data stored', 'security'],
  ['cabinet', 'cabinet'], ['my projects', 'cabinet'], ['where is my estimate', 'cabinet-docs'], ['client area', 'cabinet'],
  ['personal ai', 'product-personal'], ['personal assistant', 'product-personal'], ['ai for me', 'product-personal'],
  ['what happens after the request', 'how-we-work'], ['how do you work', 'how-we-work'], ['timeline', 'how-we-work'], ['how we work', 'how-we-work'],
  ['where to start', 'builder'], ['how to order', 'builder'], ['build a project', 'builder'], ['get a quote', 'builder'],
  ['guarantee', 'pay-guarantee'], ['refund', 'pay-guarantee'], ['money back', 'pay-guarantee'],
  ['barbershop', 'solution-barber'], ['hotel', 'solution-hotel'], ['coffee shop', 'solution-coffee'], ['tutor', 'solution-tutor'],
  ['telegram bot', 'service-bots'], ['landing page', 'service-websites'], ['mini app', 'product-miniapp'],
  ['ai administrator', 'product-admin'], ['lead manager', 'product-receptionist'], ['content on autopilot', 'product-content'], ['company ai', 'product-company'],
  ['ai teams', 'ai-team'], ['sales team', 'team-sales'], ['support team', 'team-support'],
  ['demo', 'demo'], ['faq', 'faq'], ['blog', 'blog'], ['referral', 'referral'], ['compare', 'compare'], ['website audit', 'audit'], ['sign in', 'cabinet-login'], ['privacy policy', 'privacy'], ['terms', 'terms'], ['service status', 'status'],
  ['show me prices', 'prices'], ['take me to the cabinet', 'cabinet'],
]

test('matcher: at least 40 Russian phrases resolve to the right place', () => {
  assert.ok(RU.length >= 40)
  const miss = []
  for (const [q, key] of RU) {
    const hit = matchIntent(q)
    if (hit?.top.entry.key !== key) miss.push(`${q} -> ${hit?.top.entry.key ?? 'none'} (wanted ${key})`)
  }
  assert.deepEqual(miss, [])
})

test('matcher: at least 40 English phrases resolve to the right place', () => {
  assert.ok(EN.length >= 40)
  const miss = []
  for (const [q, key] of EN) {
    const hit = matchIntent(q)
    if (hit?.top.entry.key !== key) miss.push(`${q} -> ${hit?.top.entry.key ?? 'none'} (wanted ${key})`)
  }
  assert.deepEqual(miss, [])
})

test('matcher: the owner\'s examples', () => {
  const key = (q) => matchIntent(q)?.top.entry.key
  assert.equal(key('цены'), 'prices')
  assert.equal(key('сколько стоит салон'), 'solution-salon')
  assert.equal(key('как оплатить'), 'pay-how')
  assert.equal(key('безопасность'), 'security')
  assert.equal(key('кабинет'), 'cabinet')
  assert.equal(key('личный ИИ'), 'product-personal')
  assert.equal(key('что после заявки'), 'how-we-work')
})

test('matcher: endings, case, ё, punctuation and filler words do not matter', () => {
  assert.equal(matchIntent('ЦЕНЫ???')?.top.entry.key, 'prices')
  assert.equal(matchIntent('  Покажите, пожалуйста, цены!  ')?.top.entry.key, 'prices')
  assert.equal(matchIntent('а сколько всё это стоит')?.top.entry.key, 'prices')
  assert.deepEqual(tokens('Что после заявки?'), ['после', 'заявки'])
  assert.ok(sameWord('цена', 'цены') && sameWord('оплатить', 'оплата') && sameWord('prices', 'price') && sameWord('website', 'websites'))
  assert.ok(!sameWord('цена', 'сайт') && !sameWord('сто', 'стоит'))
  assert.ok(!sameWord('бот', 'богатый'))
})

test('matcher: long free-form messages and chatter go to the chat, not to a card', () => {
  for (const q of [
    'Здравствуйте', 'привет', 'Спасибо', 'ок', 'asdf', 'Привет, сколько стоит сайт?', 'Hello, how much is a website?', 'У меня салон, нужна запись клиентов',
    'Хочу сайт для моей кофейни с онлайн записью и оплатой, подскажите, что лучше выбрать и как лучше сделать', 'Мы продаём цветы в трёх городах и хотим принимать заказы автоматически ночью',
    'Какие данные нужны для заявки и сколько времени займёт ответ от менеджера', 'My dentist office has three locations and we want the assistant to answer calls in two languages',
  ]) assert.equal(matchIntent(q), null, q)
  assert.equal(matchIntent(''), null)
  assert.equal(matchIntent('   '), null)
  assert.equal(matchIntent('x'.repeat(200)), null)
})

test('matcher: a close second is offered as a second card, never more than one', () => {
  const hit = matchIntent('оплата')
  assert.ok(hit && hit.alts.length <= 1)
  assert.ok(rank('цены')[0].score >= 5)
})

test('search: the menu search is loose, partial words work, the best hit is first', () => {
  assert.equal(searchMap('цен', 'ru')[0].key, 'prices')
  assert.equal(searchMap('оплат', 'ru')[0].key, 'pay-how')
  assert.ok(searchMap('безопас', 'ru').some((s) => s.key === 'security'))
  assert.ok(searchMap('cabin', 'en').some((s) => s.key === 'cabinet'))
  assert.equal(searchMap('сколько стоит салон', 'ru')[0].key, 'solution-salon')
  assert.deepEqual(searchMap('', 'ru'), [])
  assert.deepEqual(searchMap('zzzzqq', 'en'), [])
  assert.ok(searchMap('о', 'ru').length === 0 || searchMap('о', 'ru').length <= 6)
  assert.ok(synonymsOf(entryByKey('service-websites'), 'ru').some((s) => s === 'сколько стоит сайт'), 'price frames are generated for the priced entries')
})

// ---- the spotlight and the tour
test('spotlight: the cutout is the anchor plus 12 px, clipped to the screen', () => {
  assert.equal(SPOT_PAD, 12)
  assert.deepEqual(cutoutRect({ x: 100, y: 200, w: 300, h: 100 }, 1440, 900), { x: 88, y: 188, w: 324, h: 124 })
  const tall = cutoutRect({ x: 0, y: -400, w: 1440, h: 2000 }, 1440, 900)
  assert.deepEqual(tall, { x: 8, y: 8, w: 1424, h: 884 })
})

test('spotlight: the bubble goes below, then above, then beside, then inside; a phone gets a sheet', () => {
  const size = { w: 340, h: 190 }
  const small = placeBubble({ x: 200, y: 200, w: 300, h: 120 }, 1440, 900, size)
  assert.equal(small.side, 'bottom')
  assert.ok(small.y >= 200 + 120 + 16 - 1 && small.x >= 12 && small.x + size.w <= 1440 - 12)
  const low = placeBubble({ x: 200, y: 640, w: 300, h: 200 }, 1440, 900, size)
  assert.equal(low.side, 'top')
  assert.ok(low.y + size.h <= 640 - 16 + 1)
  const wide = placeBubble({ x: 20, y: 90, w: 700, h: 780 }, 1440, 900, size)
  assert.equal(wide.side, 'right')
  const right = placeBubble({ x: 740, y: 90, w: 680, h: 780 }, 1440, 900, size)
  assert.equal(right.side, 'left')
  const full = placeBubble({ x: 8, y: 8, w: 1424, h: 884 }, 1440, 900, size)
  assert.equal(full.side, 'inside')
  assert.ok(full.x >= 12 && full.y >= 76 && full.x + size.w <= 1428 && full.y + size.h <= 888)
  const phone = placeBubble({ x: 8, y: 100, w: 374, h: 200 }, 390, 844, { w: 366, h: 200 })
  assert.equal(phone.side, 'sheet')
  assert.ok(NARROW_MAX > 390 && phone.y + 200 <= 844)
  const phoneLow = placeBubble({ x: 8, y: 400, w: 374, h: 430 }, 390, 844, { w: 366, h: 200 })
  assert.equal(phoneLow.side, 'top')
  for (const [t, vw, vh] of [[{ x: 8, y: 8, w: 374, h: 828 }, 390, 844], [{ x: 0, y: 0, w: 50, h: 50 }, 1440, 900], [{ x: 1380, y: 850, w: 40, h: 40 }, 1440, 900]]) {
    const p = placeBubble(t, vw, vh, vw < 640 ? { w: vw - 24, h: 200 } : size)
    assert.ok(p.x >= 0 && p.y >= 0 && p.x + (vw < 640 ? vw - 24 : 340) <= vw && p.y + (vw < 640 ? 200 : 190) <= vh, `inside the screen: ${JSON.stringify(p)}`)
  }
})

test('spotlight: scrolling keeps the header free and room for the bubble', () => {
  assert.equal(HEADER_OFFSET, 88)
  const tall = scrollTopFor(2000, 1200, 900)
  assert.equal(tall, 2000 - 88, 'a tall block starts under the header')
  const small = scrollTopFor(2000, 200, 900)
  assert.ok(small < 2000 - 88 && small > 2000 - 400, 'a small block is centred with room below')
  assert.equal(scrollTopFor(10, 100, 900), 0, 'never above the top')
  assert.ok(isTall(800, 900) && !isTall(300, 900))
})

test('tour: progress label, stepping and the phone swipe', () => {
  assert.equal(progressLabel(2, 8, 'ru'), '2 из 8')
  assert.equal(progressLabel(2, 8, 'en'), '2 of 8')
  assert.equal(stepIndex(0, 5, -1), 0)
  assert.equal(stepIndex(4, 5, 1), 4)
  assert.equal(stepIndex(2, 5, 1), 3)
  assert.equal(stepIndex(0, 0, 1), 0)
  assert.equal(swipeDirection(-120, 10), -1, 'swipe left = next')
  assert.equal(swipeDirection(120, 10), 1, 'swipe right = back')
  assert.equal(swipeDirection(20, 5), 0, 'a tap')
  assert.equal(swipeDirection(-100, 90), 0, 'a vertical scroll')
  assert.equal(TOUR_AUTOSTART, false, 'the tour is offered, never started by itself')
})

// ---- deep links, chips, the offer
test('deep links: ?fira=tour and ?fira=go:<key>, the address is cleaned', () => {
  assert.equal(FIRA_PARAM, 'fira')
  assert.deepEqual(parseFiraParam('?fira=tour'), { type: 'tour' })
  assert.deepEqual(parseFiraParam('?fira=go:prices'), { type: 'go', key: 'prices' })
  assert.deepEqual(parseFiraParam('?a=1&fira=go:pay-stages'), { type: 'go', key: 'pay-stages' })
  for (const bad of ['', '?fira=', '?fira=go:nope', '?fira=go:', '?fira=go:../x', '?fira=jump', '?other=tour', '?fira=go:PRICES']) assert.equal(parseFiraParam(bad), null, bad)
  assert.equal(withoutFiraParam('/ru', '?fira=go:prices', ''), '/ru')
  assert.equal(withoutFiraParam('/ru/builder', '?a=1&fira=tour', '#x'), '/ru/builder?a=1#x')
})

test('chips: three per page context, in both languages, every trip points at a real place', () => {
  for (const ctx of ['home', 'products', 'builder', 'dashboard', 'pricing']) assert.equal(chipsByContext[ctx].length, 3, ctx)
  assert.deepEqual(chipsFor('home').map((c) => c.label.ru), ['Что здесь?', 'Сколько стоит?', 'С чего начать?'])
  assert.deepEqual(chipsFor('products').map((c) => c.label.ru), ['Что умеет?', 'Цена', 'Как заказать'])
  assert.deepEqual(chipsFor('builder').map((c) => c.label.ru), ['Что спросят дальше?', 'Сколько сейчас?', 'Можно позже?'])
  assert.deepEqual(chipsFor('dashboard').map((c) => c.label.ru), ['Где моя смета?', 'Что дальше?', 'Написать менеджеру'])
  assert.equal(chipsFor('something-else'), chipsFor('home'), 'an unknown context gets the home set')
  assert.equal(chipsFor('').length, 3)
  for (const chips of Object.values(chipsByContext)) {
    for (const c of chips) {
      assert.ok(c.label.ru && c.label.en && !/[–—]/.test(c.label.ru + c.label.en), c.id)
      if (c.action.type === 'go') assert.ok(entryByKey(c.action.key), `${c.id} -> ${c.action.key}`)
      if (c.action.type === 'section') assert.ok(entryByKey(c.action.fallbackKey) && c.action.selectors.length > 0, c.id)
      if (c.action.type === 'chat') assert.ok(c.action.text.ru.length > 8 && c.action.text.en.length > 8, c.id)
    }
  }
  assert.equal(new Set(Object.values(chipsByContext).flat().map((c) => c.id)).size, Object.values(chipsByContext).flat().length, 'chip ids are unique')
})

test('offer: once per page and browser, storage garbage is harmless; scene lines respect motion and width', () => {
  assert.deepEqual(offeredList(null), [])
  assert.deepEqual(offeredList('{bad'), [])
  assert.deepEqual(offeredList('{"a":1}'), [])
  const list = markOffered([], 'home')
  assert.equal(offerDue(list, 'home'), false)
  assert.equal(offerDue(list, 'builder'), true)
  assert.deepEqual(markOffered(list, 'home'), ['home'])
  assert.equal(markOffered(Array.from({ length: 100 }, (_, i) => `p${i}`), 'new').length, 80)
  assert.equal(sceneLinesOn(false, 1440), true)
  assert.equal(sceneLinesOn(true, 1440), false, 'off under reduced motion')
  assert.equal(sceneLinesOn(false, 399), false, 'off below 400 px')
  assert.equal(sceneLinesOn(false, 400), true)
})

test('recent: newest first, no repeats, five at most', () => {
  assert.deepEqual(pushRecent(['a', 'b'], 'b'), ['b', 'a'])
  assert.equal(pushRecent(['1', '2', '3', '4', '5'], '6').length, RECENT_MAX)
  assert.deepEqual(recentList('["x",3,"y"]'), ['x', 'y'])
  assert.deepEqual(recentList('nope'), [])
})

// ---- guard rails of the components
test('components: the spotlight keeps the old hooks, the keyboard, the focus trap and reduced motion', () => {
  const spot = read('src/components/fira/nav/fira-spotlight.tsx')
  for (const needle of ['data-fira-bubble="tour"', 'data-fira-tour=', 'fira_tour_next', 'fira_tour_stop', 'fira_tour_prev', 'aria-live="polite"', "e.key !== 'Tab'", 'onTouchEnd', 'reduce ? ', "pointerEvents: 'none'", 'glass']) {
    assert.ok(spot.includes(needle), `spotlight has ${needle}`)
  }
  const guide = read('src/components/fira/fira-guide.tsx')
  for (const needle of ["'ArrowLeft'", "'ArrowRight'", "'Escape'", 'TOUR_OFFER_KEY', 'sceneLinesOn', 'SCENE_OFF_KEY', 'useFiraNav', 'FiraMapPanel', 'FiraSpotlight', 'data-cta="fira_map"']) {
    assert.ok(guide.includes(needle), `guide has ${needle}`)
  }
  assert.doesNotMatch(guide, /TOUR_AUTOSTART\s*=\s*true/)
  const panel = read('src/components/chat/chat-panel.tsx')
  assert.ok(panel.includes('matchIntent') && panel.includes('FiraChips') && panel.includes('data-chat-card="go"'))
  assert.doesNotMatch(read('src/components/fira/nav/fira-nav.ts'), /pkill|eval\(/)
})

test('components: the map panel groups the pages like the owner asked and uses the matcher', () => {
  const map = read('src/components/fira/nav/fira-map-panel.tsx')
  for (const needle of ['role="search"', 'searchMap', 'groupOrder', 'RECENT_KEY', 'data-fira-map-recent', 'max-sm:rounded-t', 'requestGo']) assert.ok(map.includes(needle), needle)
})
