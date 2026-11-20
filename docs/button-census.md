# Button census (2026-11-21)

Owner, 2026-11-21: «протестировать каждый процесс, каждую кнопку» before go-live. This is the list of
every user-facing action of the public site and the owner panel, how each one is verified and where it
stands. Elements were collected from the live DOM (Playwright against the dev mocks) and from
`src/components/admin/{hub,pult,control,golive}`; if you add a button, add a row.

## How it is verified

| Tag | Meaning |
|---|---|
| `E:<name>` | Playwright test in `tests/e2e/` (`npm run test:e2e`), name in the legend below |
| `U:<file>` | node:test unit test in `tests/` (`npm test`) |
| `manual` | needs a live service (Supabase, HQ, Telegram, Google) or a human; not covered by any test |

Status: **pass** = covered by a test that passed on 2026-11-21 (or fixed by this work and covered),
**fail** = a bug found and not fixed (cause in one line), **untested** = no test touches the action yet.
A row with a pass says what the test really asserts; clicking and seeing no console error is not the same as
asserting the result, and the row says which one it is.

### How the suite runs

`npm run test:e2e` starts `next dev` on port 3417 (`E2E_PORT`) from `playwright.config.ts` and drives
Playwright's own chromium from `~/Library/Caches/ms-playwright` (version 1.65.1 matches the cached
build 1255; `PW_CHROMIUM_PATH` overrides the binary; no browser is downloaded by the suite). It runs
against **dev**, not `next start`: every site mock (HQ chat, office, pay, audit, cabinet) is gated on
`NODE_ENV !== 'production'`, so a production server would need a live HQ. The server gets a throwaway
`DATA_DIR` (`$TMPDIR/firtech-e2e-data`, wiped per run: `admin.json` with two hand-written sessions,
`golive.json`), a dummy Supabase pair (`http://127.0.0.1:9`, so the cabinet counts as configured and the
sign-in gate shows, without any network) and every HQ and Telegram variable empty, so nothing real is
touched and no lead leaves the machine. Before the tests, `global-setup.ts` requests every route one at a
time (concurrent first compiles broke `next dev`, JSON.parse on its own manifests). Run time on this
machine is about 3 minutes. CI: `.github/workflows/e2e.yml`, `workflow_dispatch` only, never part of the
deploy.

Legend of `E:` tags (file : test title):

| Tag | Test |
|---|---|
| `E:matrix` | public.spec : «renders clean in every size, theme and language: <page>», one test per page: ru at 1440 and 390 in light and dark, en at 1440 light and 390 dark, status below 400 (404 for the unknown invoice), `data-theme` applied, no horizontal overflow, no console errors or page errors |
| `E:404` | public.spec : «unknown path gives the branded 404 with a search» (/ru, /en, outside the locales) |
| `E:404-search` | public.spec : «404 search filters the page list» |
| `E:links` | public.spec : «every header and footer link resolves 200 (ru / en)» |
| `E:anchors` | public.spec : «header and footer anchors on the home page point at sections that exist» |
| `E:files` | public.spec : «machine files answer 200» (robots, sitemap, llms.txt, rss.xml, health, prices, office/public, status) |
| `E:theme` | public.spec : «theme switch flips the page and remembers the choice» |
| `E:lang` | public.spec : «language switch goes to the same page in the other language» |
| `E:menu` | public.spec : «mobile menu opens and links to the builder» |
| `E:hero` | public.spec : «home: hero and bento calls to action lead where they say» |
| `E:faq` | public.spec : «home: FAQ items open and close» |
| `E:ref` | public.spec : «referral link generator builds a ?ref= link and copies it» |
| `E:status` | public.spec : «status page shows the systems list from the dev mock» |
| `E:builder` | flows.spec : «builder: walk through all 8 steps to the summary, estimate and PDF page» |
| `E:builder-link` | flows.spec : «builder: a build link opens on the right step with the quote» |
| `E:pdf-gate` | flows.spec : «builder: the PDF button asks for a sign-in before the estimate» |
| `E:estimate` | flows.spec : «estimate page lists the build as rows and offers print» |
| `E:contact` | flows.spec : «contact form: empty submit shows field errors, a filled one asks to sign in» |
| `E:lead-api` | flows.spec : «API: a lead without an account is refused (401 auth_required), bad origin is 403» |
| `E:audit` | flows.spec : «audit form: validation, then the sign-in gate» |
| `E:pay` | flows.spec : «pay page: mock invoice shows methods, QR and copy» |
| `E:pay-404` | flows.spec : «pay page: wrong key and unknown number show the not-found state» |
| `E:cab-login` | flows.spec : «cabinet login: Google button with the G mark, email form, sign-up and forgot tabs» |
| `E:cab-noindex` | flows.spec : «cabinet pages are noindex» |
| `E:chat` | flows.spec : «chat widget opens, sends and answers in mock mode, then closes» |
| `E:chat-open` | flows.spec : «chat opens from the hero button and from the #demo link» |
| `E:chat-enter` | flows.spec : «chat: Enter sends right after opening (queued behind the greeting), Shift+Enter makes a new line» |
| `E:chat-api` | flows.spec : «chat API: validation (400) and mock answer (200)» |
| `E:service` | flows.spec : «service page: «Посчитать» picks the format in the calculator» |
| `E:solution` | flows.spec : «solution page opens the builder with its preset» |
| `E:adm-login` | admin.spec : «admin login page renders the code form for a visitor without a session» |
| `E:adm-guard` | admin.spec : «admin pages and API refuse a visitor without a session» |
| `E:hub` | admin.spec : «hub loads with counters, presence switch and the office» (also the phone variant «hub fits a phone») |
| `E:keys` | admin.spec : «keys 1-7 open the panels, Esc closes, 8 opens the go-live page» |
| `E:tabs` | admin.spec : «panel tabs switch and the counters open their panels» |
| `E:panels` | admin.spec : «every department panel renders its tabs without console errors» |
| `E:director` | admin.spec : «Director: approving a card lowers the counter; the chat answers a command; the task filter narrows the board» |
| `E:backoffice` | admin.spec : «Back office: invoice actions are there and «Напомнить» answers with a toast» |
| `E:palette` | admin.spec : «⌘K opens the palette, filters and closes with Esc» |
| `E:adm-theme` | admin.spec : «theme switch flips the panel theme» |
| `E:golive` | admin.spec : «go-live page: start, tick, note and reset through the API and the buttons» |
| `E:golive-fit` | admin.spec : «go-live page fits both themes and a phone» |
| `E:csv` | admin.spec : «CSV export answers with a csv for the owner» |
| `E:logout` | admin.spec : «logout ends the session» |
| `E:ai-team` | public.spec : «AI team: the index lists six departments and every card opens its page» |
| `E:ai-agent` | public.spec : «AI team: a department page lists its agents and an agent page opens the builder or the chat» |
| `E:pay-how` | public.spec : «pay-how: the three steps of paying in USDT are on the page and no local currency is quoted» |
| `E:bare` | public.spec : «bare paths of known pages redirect to a language» (307, then 200) |
| `E:keys-9-0` | admin.spec : «keys 9 and 0 open the review centre and the chats» |
| `E:review` | admin.spec : «review centre: rail with counts, queue, J/K step, the revise composer and the trend link dialog» |
| `E:chats` | admin.spec : «chats: a thread opens, the reply box sends with Enter and the answer joins the thread» |
| `E:prices` | admin.spec : «Company / Цены: edit one price in the panel, see it saved, reset it through the API» (throwaway data dir) |
| `E:accept-pult` | admin.spec : «Production: the project drawer accepts a paid, delivered stage for the client» |
| `U:cabinet-milestones` | node:test `tests/cabinet-milestones.test.mjs`: milestone parsing, track rows, the accept call and its 409 codes, mock, route, Пульт whitelist and drawer helpers |
| `U:cabinet-stage-render` | node:test `tests/cabinet-stage-render.test.mjs`: the real `ProjectsCard` and `LeadsSection` rendered to markup with the dev mock (the cabinet needs a Supabase session, which e2e does not have) |
| `U:bare-paths` | node:test `tests/bare-paths.test.mjs`: the proxy redirect for every bare page |

## 1. Public site: every page

| Page | Element | What it does | Leads to / calls | Verified by | Status |
|---|---|---|---|---|---|
| all pages (35 routes x ru/en) | the page itself | renders | `/{ru,en}` home, builder, estimate, 4 services, solutions list + cafe, blog list + 3 articles, audit, status, compare, referral, pay-how, ai-team index, 6 department pages, 3 agent pages (trend-scout, lead-handler, billing), terms, privacy, pay (valid and unknown), cabinet, cabinet/login, cabinet/reset | `E:matrix` (390 and 1440, both themes) | pass |
| all pages | 404 | branded 404 with search | `[locale]/not-found`, `global-not-found` | `E:404`, `E:404-search` | pass |
| `/ru/pay/<unknown>` | not-found state | showed the light page for a dark visitor (no `data-theme` on `<html>`) | `ThemeInit` | `E:matrix` (pay FT-2026-999) | pass (bug fixed, see Bugs) |

## 2. Header, footer, global

| Page | Element | What it does | Leads to / calls | Verified by | Status |
|---|---|---|---|---|---|
| all | «К содержимому» | skip link | `#main` | `E:anchors` | pass |
| all | logo `fir.tech` | home | `/{locale}` | `E:links` | pass |
| all | «Продукты», «Демо», «Цены», «Как работаем», «Вопросы» | scroll to home sections | `/{locale}#products|demo|pricing|process|faq` | `E:links` (200), `E:anchors` (target ids exist) | pass |
| all | «Конструктор» | builder | `/{locale}/builder` | `E:links`, `E:menu` | pass |
| all | «Личный кабинет» (signed out) / «Get started» | cabinet; hidden when Supabase is not configured | `/{locale}/cabinet` | `E:links` (shown with the dummy Supabase pair) | pass |
| all | theme switch (sun/moon, header and mobile menu) | flips light/dark, stores `fir-theme` | localStorage, `<html data-theme>` | `E:theme`, `E:matrix` (both themes), `U:site-theme` | pass |
| all | language switch RU / EN | same page in the other language | `/{other}/<same path>` | `E:lang` | pass |
| all | «Обсудить проект» (header) | scrolls to the contact form | `/{locale}#contact` | `E:links`, `E:anchors` | pass |
| all (mobile) | «Меню» | opens the menu | links as above | `E:menu` | pass |
| all (mobile) | sticky mobile CTA | opens contact | `mobile-cta.tsx` | `E:matrix` (renders, no overflow) | untested (click) |
| footer | Instagram, Telegram `@firtech_bot`, «Написать в Telegram» | external | `instagram.com/firtech.pro`, `t.me/firtech_bot` | `E:links` (hrefs present) | pass (links not followed) |
| footer | Products (7 anchors), Services (4), Solutions («Все решения» + 5 niches), Studio («Блог», «Сравнение», «Рефералы», «Бесплатный аудит», «Статус систем», «Политика конфиденциальности», «Оферта»), «English»/«Русский» | navigation | internal pages | `E:links` (every internal href returns 200), `U:site-b1` (footer columns) | pass |
| footer | «Наверх» | scroll to top | `#` | none | untested |
| all | chat button «Чат с ИИ-приёмщиком» | opens the chat | see section 9 | `E:chat` | pass |

## 3. Home `/{locale}`

| Block | Element | What it does | Leads to / calls | Verified by | Status |
|---|---|---|---|---|---|
| hero | «Собрать в конструкторе» | builder | `/{locale}/builder` | `E:hero` | pass |
| hero | «Поговорить с приёмщиком» | opens the chat | `#demo` + chat | `E:chat-open` | pass |
| hero | «Бесплатный аудит сайта…» | audit page | `/{locale}/audit` | `E:hero` (href present) | pass |
| hero | «Подробнее о продукте» | scrolls to the product card | `#product-admin` | `E:anchors` | pass |
| hero | 7 product dots «Показать продукт: …» | bring a product forward | client state | `E:matrix` (renders) | untested (click) |
| products bento | 7 cards, each «Собрать в конструкторе» | builder with the product picked (`?b=...~p.<id>`) | `/{locale}/builder?b=` | `E:hero` (first card clicked), hrefs listed in the census run | pass (first card), untested (other 6) |
| products bento | «Обсудить» (adminbot card) | scrolls to the contact form with the product as `source` | `#contact` | none | untested |
| products bento | «Попробовать демо», «Демо бота» | demo salon deep link | `t.me/firtech_bot?start=demo_salon` | `E:hero` (href attached) | pass |
| products bento | «Открыть чат» (receptionist card) | opens the chat | chat | `E:chat-open` | pass |
| products bento | 4 classic services (cards) | service pages | `/{locale}/services/{websites,bots,apps,automation}` | `E:links` no (home body); `E:matrix` renders each page | untested (card click) |
| demo `#demo` | «Демо-салон в Telegram», «Открыть чат» | deep link, chat | `t.me`, chat | `E:chat-open` | pass |
| proof `#proof` | live counts | `GET /api/office/public` | HQ office (dev demo) | `E:files` (200) | pass |
| process `#process` | timeline | render | - | `E:matrix` | pass |
| pricing `#pricing` | «Условия гарантии» | terms anchor | `/{locale}/terms#terms-guarantee` | none | untested |
| pricing | «Почему дешевле агентства» | compare | `/{locale}/compare` | `E:matrix` (page renders) | untested (click) |
| pricing | «Открыть конструктор» | builder | `/{locale}/builder` | none | untested |
| pricing | calculator: 4 service tabs, variant radios (Лендинг, Сайт компании, Интернет-магазин), extras (Второй язык, Заявки в Telegram, Онлайн-оплата, Панель для правок) | live price from `pricing.ts`, hand-off to the contact form | `firtech:estimate` event | `U:logic`, `U:builder` (prices), `E:service` (variant pick) | pass (variant), untested (extras clicks) |
| pricing | «Обсудить проект» | contact | `#contact` | none | untested |
| FAQ `#faq` | 9 question buttons | expand/collapse | - | `E:faq` | pass |
| FAQ | «Сравнение: фрилансер, агентство или мы», «Порекомендуйте нас…», «Бесплатный аудит вашего сайта» | links | compare, referral, audit | `E:matrix` (pages render) | untested (click) |

## 4. Contact form (home, services, solutions, blog, builder)

| Element | What it does | Leads to / calls | Verified by | Status |
|---|---|---|---|---|
| «Имя», «Telegram или телефон» | required fields, inline errors | client validation | `E:contact` | pass |
| «Услуга», «Бюджет» selects, «Задача» textarea, honeypot `website` | fields | - | `U:logic` (schema) | pass (schema), untested (UI) |
| «Выбрать время созвона» | slot picker (Mon-Fri 10-18 Dushanbe) | `GET /api/slots` | `U:logic` (booking rules) | untested (UI) |
| «Отправить заявку», signed out | shows «войдите или создайте аккаунт» and the inline sign-in step; saves a 24 h draft | `LeadAuthStep` | `E:contact` | pass |
| «Отправить заявку», signed in | `POST /api/lead` then redirect to `/{locale}/cabinet?lead=<id>` | `/api/lead` | `U:cabinet-leads`, `U:site-d`, `U:lead-forward` | untested (needs a real Supabase session) |
| `POST /api/lead` without a session | 401 `auth_required`; bad Origin 403 | `/api/lead` | `E:lead-api`, `U:audit-2026-11-19` | pass |
| «политике конфиденциальности» | privacy | `/{locale}/privacy` | `E:matrix` | pass |
| «Написать в Telegram», `@firtech_bot` | external | `t.me/firtech_bot` | `E:links` | pass |

## 5. Builder `/{locale}/builder`

| Step | Element | What it does | Verified by | Status |
|---|---|---|---|---|
| all | step bar (8 buttons) | go to a reachable step (later ones disabled) | `E:builder` (`aria-current`), `E:builder-link` | pass (state), untested (clicking a bar button) |
| all | «Назад», «Дальше» / «К итогу» | previous / next step, history entries | `E:builder` (Дальше x6), `U:builder` | pass (Дальше), untested (Назад) |
| 1 Бизнес | 10 category tabs (Все, Еда, ...) | filter niches | `E:builder` («Еда») | pass (one tab) |
| 1 Бизнес | 56 niche cards | picks the kind, preset build, goes to step 2 | `E:builder` («Кафе и ресторан»), `U:builder-catalog` (presets) | pass |
| 2 Что собираем | 10 product cards (7 products + site, bot, app) | toggle; price and parts follow | `E:builder` (toggle off/on), `U:builder` | pass |
| 3 Цель | 5 goal cards, 4 channel chips | toggle | `E:builder` («Запись клиентов», «Instagram») | pass (one each) |
| 4 Что делаем | 4 service groups, variants | add/remove parts | `E:builder` («Интернет-магазин») | pass (one) |
| 5 Функции | extras with price (`+$..`) | toggle, total moves | `E:builder` (first extra), `U:builder` | pass |
| 6 Стиль | 19 ready looks | restyles the mockup, never the price | `E:builder` («Люкс»), `U:builder-catalog` | pass (one) |
| 6 Стиль | «Настроить» | opens the five axes (palette, type, shape, density, mood) | `E:builder` (clicked, no console error) | untested (axis controls) |
| 7 Детали | pages slider, language chips (RU, EN, TJ, UZ), «Логотип», «Тексты», «Фото», «Домен», «Хостинг», two URL inputs, deadline chips, «Пожелания» | brief; two or more languages turn on the `language` option | `E:builder` (slider, «Как можно скорее», textarea), `U:builder` | pass (those), untested (language and asset chips, URL inputs) |
| 8 Итог | 4 x «Изменить» | back to the step | `E:builder` (first one) | pass (one), untested (other 3) |
| 8 Итог | «Скопировать ссылку» | copies `/{locale}/builder?b=...` | `E:builder` (clipboard) | pass |
| 8 Итог | «Скачать смету (PDF)» | name + contact gate, then the estimate page | `E:pdf-gate` (sign-in step shown) | pass (gate); untested (signed-in open of the estimate) |
| 8 Итог | «Отправить сборку» (2 places) | hands the build to the contact form (lead `bundle`) | `E:builder` (visible) , `U:cabinet-leads` | untested (click and send) |
| 8 Итог | «Условия гарантии» | terms | none | untested |
| link | `?b=...&step=8` | decodes the build | `E:builder-link` | pass |

## 6. Estimate, services, solutions

| Page | Element | What it does | Leads to / calls | Verified by | Status |
|---|---|---|---|---|---|
| estimate | table rows | one row per part and extra with exact prices | `estimateDoc()` | `E:estimate`, `U:estimate-pdf` | pass |
| estimate | «Сохранить как PDF» | `window.print()` | print dialog | `E:estimate` (button visible) | pass (visible), untested (print dialog) |
| estimate | «Назад в конструктор», build link | back to the build | `/{locale}/builder?b=` | `E:estimate` (link present) | pass |
| estimate | `noindex` | robots meta | - | `E:estimate` | pass |
| services (4) | hero CTA «Обсудить проект» | contact | `#contact` | `E:matrix` | untested (click) |
| services | «Рассчитать точнее» | scrolls to the calculator | `#pricing` | `E:matrix` | untested (click) |
| services | «Посчитать в калькуляторе: <format>» | picks the format in the calculator | `firtech:pick` event | `E:service` | pass |
| services | «Хочу так же» (concepts) | contact | `#contact` | none | untested |
| services | service FAQ | expand | - | `E:faq` (home FAQ, same component) | pass |
| services | «Нужно несколько услуг сразу?» | builder | `/{locale}/builder` | none | untested |
| solutions list | 56 niche cards | niche pages | `/{locale}/solutions/<kind>` | `E:matrix` (list), `U:solutions` | pass |
| solution `<kind>` | «Собрать такой проект» | builder with the preset | `/{locale}/builder?b=...k.<kind>` | `E:solution`, `U:solutions` | pass |
| solution | «Обсудить», niche FAQ, related niches | contact, expand, links | - | `E:matrix` (renders) | untested (click) |

## 7. Blog, audit, status, compare, referral, terms, privacy

| Page | Element | What it does | Leads to / calls | Verified by | Status |
|---|---|---|---|---|---|
| blog list | 3 article cards | article | `/{locale}/blog/<slug>` | `E:matrix` (list and each article render) | pass (render), untested (click) |
| article | «Все статьи», «Открыть конструктор», 2 related links | navigation | blog, builder | `E:matrix` | untested (click) |
| article | contact form | see section 4 | - | `E:contact` (same component) | pass |
| `/rss.xml`, `/sitemap.xml` | feeds | RSS (ru), sitemap | - | `E:files`, `U:blog`, `U:blog-hq` | pass |
| audit | «Заказать аудит» (empty) | field errors | client validation | `E:audit` | pass |
| audit | «Заказать аудит» (valid, signed out) | sign-in step | `LeadAuthStep` | `E:audit` | pass |
| audit | submit signed in | `POST /api/audit` (mock `{ok:true,mock:true}` in dev) | `/api/audit` | `U:site-e`, `U:audit-2026-11-19` | untested (needs a session) |
| status | systems list and 60 s refresh | `GET /api/status` | HQ status (dev mock) | `E:status`, `E:files`, `U:status-line`, `U:site-e` | pass |
| compare | «Посмотреть наш HQ», «Открыть конструктор», «Написать в Telegram» | links | `#proof`, builder, `t.me` | `E:matrix` | untested (click) |
| referral | name field | builds `<site>/<locale>?ref=<slug>` | - | `E:ref` | pass |
| referral | «Скопировать ссылку» | clipboard | - | `E:ref` | pass |
| referral | «Собрать проект в конструкторе», «Написать в Telegram» | links | builder, `t.me` | `E:matrix` | untested (click) |
| terms | «Политика конфиденциальности» | link | privacy | `E:matrix`, `U:site-c` | pass (render) |
| privacy | text, consent link target | render | - | `E:matrix` | pass |
| ai-team index | 6 department cards, agent strip, «Собрать в конструкторе», «Обсудить» | department pages, builder with `p.aiteam`, chat, `#contact` | `E:matrix`, `E:ai-team` (cards open the pages, «По смете» shown), `U:ai-teams` | pass (cards), untested (CTA clicks) |
| ai-team department and agent pages | «Агенты отдела» links, agent CTA, other departments | `/{locale}/ai-team/agent/<id>`, builder, lead `source` `agent-<id>` | `E:matrix`, `E:ai-agent`, `U:ai-teams` | pass (navigation), untested (lead send) |
| pay-how | the three steps of paying in USDT | render, links from the pay page, terms, cabinet | `E:matrix`, `E:pay-how`, `U:golive-copy` | pass |
| bare paths `/terms`, `/privacy`, `/pay-how`, `/services/*`... | redirect to the visitor's language (contracts and offers link them without one) | `src/proxy.ts` | `E:bare`, `U:bare-paths` | pass |
| `?ref=<slug>` | stores the slug 30 days, adds `start=ref_<slug>` to bot links | `RefCapture`, `RefLinks` | `U:site-d` | pass (unit), untested (browser) |

## 8. Pay page `/{locale}/pay/<number>?k=<key>`

| Element | What it does | Leads to / calls | Verified by | Status |
|---|---|---|---|---|
| page with the mock invoice (FT-2026-001, key `demo`) | invoice summary, amount to pay | `GET HQ /pay/<n>?k=` (mock in dev) | `E:pay`, `U:pay` | pass |
| method tabs «TRON (TRC20)», «TON» | switch network, address and QR | client state | `E:pay` (TON tab) | pass |
| QR block | QR of the address | `qrcode` | `E:pay` (QR element visible) | pass |
| «Скопировать» | copies address or amount | clipboard | `E:pay` (clipboard non-empty) | pass |
| polling (every few seconds while unpaid) | `GET /api/pay/<n>?k=` | `/api/pay/[number]` | `E:pay-404` (API 200 / 404), `U:pay` | pass (API), untested (status change in the UI) |
| «Если что-то пошло не так» | support link | `t.me` | `E:pay` (present) | pass |
| explorer link (paid invoice, tx id) | opens tronscan / tonviewer | external | `U:pay` | untested (UI) |
| wrong key / unknown number | 404 with the «Счёт не найден» state | `not-found.tsx` | `E:pay-404`, `E:matrix` | pass |

## 9. Cabinet `/{locale}/cabinet*`

| Element | What it does | Leads to / calls | Verified by | Status |
|---|---|---|---|---|
| login: tabs «Войти» / «Создать аккаунт» | switch the form | client state | `E:cab-login` | pass |
| login: email, password, «Войти» | `signInAction` (Supabase password) | `actions.ts` | `U:cabinet-auth` (mapping), `E:cab-login` (fields shown) | untested (real sign-in) |
| «Продолжить с Google» with the «G» mark | starts OAuth in the browser, Google account picker | Supabase OAuth, `/cabinet/auth/callback` | `E:cab-login` (button and mark present), `U:cabinet-auth` | pass (render), untested (the Google round trip: `cab-google` in go-live) |
| sign-up: name, email, password, «Создать аккаунт» | `signUpAction`, confirmation email | Supabase, Resend SMTP | `U:cabinet-auth` | untested (`cab-email` in go-live) |
| «Забыли пароль?» | reset form, `forgotAction`, email link to `/cabinet/reset` | Supabase | `E:cab-login` (opens the email field), `E:matrix` (`/cabinet/reset`) | pass (UI), untested (email) |
| reset page «Запросить письмо» | request a link / set a new password (`resetPasswordAction`) | Supabase | `E:matrix` | untested (flow) |
| confirm / callback retry | `/cabinet/auth/confirm`, `/cabinet/auth/callback` | Supabase | `U:cabinet-auth` | untested (browser) |
| `/cabinet/health` | yes/no per setting | - | none (not in the page list) | untested |
| signed in: tabs «Обзор», «Заявки», projects, invoices, documents (`?tab=`) | tab switch, 30 s refresh only on Заявки | `/api/cabinet/leads` | `U:cabinet-tabs`, `U:cabinet-process` | untested (browser) |
| Проекты: stage track | per stage «оплата» (with «Оплатить этап»), «в работе», «приёмка», «принят» with the date | `milestones[]` of by-email | `U:cabinet-milestones`, `U:cabinet-stage-render` (real component, mock project with three stages) | pass (render, unit), untested (browser: needs a session) |
| Проекты: «Принять этап» | `POST /api/cabinet/projects/<pid>/milestones/<no>/accept` -> HQ accept; 409 `not_ready` / `not_paid` become sentences | HQ `POST /clients/<id>/projects/<pid>/milestones/<no>/accept` | `U:cabinet-milestones` (call, codes, route source, mock), `U:cabinet-stage-render` (button shown only on the awaiting stage) | pass (unit), untested (browser click) |
| Заявки: «Сейчас: Этап N: ...» | current stage line on a request that is a project | `stageLineFor` | `U:cabinet-milestones`, `U:cabinet-stage-render` | pass (unit) |
| offers (in Обзор and under the other tabs) | state-based offers, `cabinet_offer_click` | `lib/cabinet-offers.ts` | `U:cabinet-offers` | pass (unit), untested (browser) |
| ticket form «Написать менеджеру» | `POST /api/cabinet/tickets` -> HQ `createClientTicket` | HQ | `U:cabinet`, `U:cabinet-hq` | untested (browser) |
| lead reply box (Заявки) | reply to a request | `/api/cabinet/leads/[id]` | `U:cabinet-leads` | untested (browser) |
| profile form «Сохранить» | `updateProfileAction` (`public.profiles`) | Supabase | `U:cabinet` | untested |
| referral link copy | copies `/<locale>/?ref=<slug>` | clipboard | `U:cabinet` (`cabinetRefLink`) | untested (browser) |
| «Выйти» | `logoutAction` | Supabase | none | untested |
| account deletion: «Удалить аккаунт» -> confirm / cancel | `deleteAccountAction` (service role, else a ticket) | Supabase admin | `U:cabinet-auth` | untested (destructive, needs a throwaway account) |
| all cabinet pages | `noindex`, `cache-control: private, no-store` | `proxy.ts` | `E:cab-noindex` | pass |

## 10. 404 and chat

| Element | What it does | Leads to / calls | Verified by | Status |
|---|---|---|---|---|
| 404 search box | filters the page list | `notFoundText.pages` | `E:404-search` | pass |
| 404 links «Главная», «Продукты», «Конструктор», «Решения», «Блог», «Обсудить проект», «На главную» | navigation | internal | `E:404` (renders) | untested (click) |
| 404 «Спросить приёмщика» | opens the chat | chat | none | untested |
| chat button (all pages) | opens the panel, mock banner «Демо-режим» | - | `E:chat`, `E:chat-open` | pass |
| chat quick replies («Сайт», «Telegram-бот», «ИИ-агент», «Другое», «За неделю», …) | send a canned answer | `POST /api/chat` | `E:chat` («За неделю») | pass (one), untested (others) |
| chat chip «Демо» | sends `demo` | `/api/chat` | none | untested |
| chat textarea + «Отправить» | sends a message, mock answer in 3 steps | `POST /api/chat` (mock, header `x-chat-mode: mock`) | `E:chat`, `E:chat-api`, `U:chat` | pass |
| chat contact step | asks for contact; mock never creates a lead | `/api/chat` | `E:chat` (input shown) | pass (shown), untested (send) |
| chat «Закрыть чат» | closes the panel | - | `E:chat` | pass |
| `POST /api/chat` validation | 400 on bad session/message | `/api/chat` | `E:chat-api` | pass |
| Enter in the textarea (Shift+Enter = new line) | sends; while the greeting is still in flight the message is queued and goes out when the chat is free (before the fix Enter did nothing and kept the text) | - | `E:chat-enter` | pass (bug fixed, see Bugs) |

## 11. Owner panel: login and hub

| Page | Element | What it does | Leads to / calls | Verified by | Status |
|---|---|---|---|---|---|
| `/admin/login` | «Получить код в Telegram» | sends a one-time code to the owner's chat; then the 6-digit input | `POST /api/admin/code`, `/api/admin/login` | `E:adm-login` (page), `U:admin`, `U:telegram` | pass (page), untested (code flow needs Telegram) |
| `/admin/*`, `/api/admin/*` | session guard | redirect to login, 401 | `admin-guard.ts` | `E:adm-guard`, `U:admin` | pass |
| `/admin` | redirect | `/admin/office` | - | `E:adm-guard` | pass |
| `/admin/office` | presence «На месте» / «Не на месте» (also named on phones) | `POST HQ presence` (mock) | `/api/admin/hq/presence` | `E:hub`, `U:hq-admin` | pass |
| hub | counters «Одобрения», «Новые лиды», «Ждут оплаты», «Открытые тикеты» | open Director/approvals, Sales/leads, Back office/invoices, Support/tickets | - | `E:hub` (visible), `E:tabs` («Ждут оплаты») | pass (payments), untested (other 3 clicks) |
| hub | ⌘K / Ctrl+K | command palette with HQ search | `GET /api/admin/hq/...` | `E:palette`, `U:pult-v3` | pass |
| hub | keys 1-7 | open the 7 panels (1 Director ... 7 Company), Esc closes | - | `E:keys` | pass |
| hub | keys 9 and 0, chips «Ревью N» and «Чаты N» | `/admin/review`, `/admin/chats` | `E:keys-9-0` | pass (keys), untested (chips) |
| hub | key 8 and the go-live chip | `/admin/golive` | - | `E:keys` | pass |
| hub | theme button | admin light/dark | localStorage | `E:adm-theme`, `U:pult-theme` | pass |
| hub | «Ещё» menu: «Скачать заявки в CSV» | `GET /api/admin/export` | `/api/admin/export` | `E:csv` | pass |
| hub | «Ещё»: «Выйти» | ends this session | `POST /api/admin/logout` | `E:logout` | pass |
| hub | «Ещё»: «Выйти на всех устройствах» | revokes all sessions | `/api/admin/logout` (all) | `U:admin` | untested (browser; would end the shared test session) |
| office | zoom «Приблизить» / «Отдалить», «Имена», «На весь экран», wheel, drag, F | camera | canvas | `E:hub` (canvas), `U:pixel-office`, `U:office-v2` | untested (clicks) |
| office | 5 room zone buttons (badge counts) | open the room's panel | - | none | untested (click) |
| hub (phone) | layout | no overflow, named presence radios | - | `E:hub` (phone) | pass |

## 12. Owner panel: department panels (`src/components/admin/{hub,pult,control}`)

Panels open from the zones, the counters, keys 1-7 and ⌘K. All tabs of all panels are opened and checked for
console errors by `E:panels` (mock data). Actions are against the HQ mock (in-memory); the writes go through
the whitelist proxy `/api/admin/hq/[...path]` (`U:hq-admin` and `U:pult-v3` cover the whitelist and the body schemas).

| Panel / tab | Element | What it does | Calls | Verified by | Status |
|---|---|---|---|---|---|
| Директор / Входящие | notification rows | open the object (lead, invoice, approval, ticket, project) in its panel | `GET hub`, `inbox/read` | `E:panels`, `U:pult-v3` | untested (row click) |
| Директор / Одобрения | «Выпустить сейчас» | releases the queue | `POST approvals/...` | `E:panels` (renders) | untested |
| Директор / Одобрения | «Одобрить» (A), «Отклонить» (R) (with confirm), part chips («Всё целиком», «Пост в канал», «Сторис»), «Править» | approve / reject / edit | `POST approvals/<id>` | `E:director` (approve lowers the counter), `U:hq-admin` | pass (approve), untested (reject, edit, parts) |
| Директор / Задачи | 6 department filters, task cards, «Повторить» | filter, open drawer, retry | `GET tasks`, `POST tasks/<id>/retry` | `E:director` (filter narrows), `E:panels` | pass (filter), untested (drawer, retry) |
| Директор / Чат | 5 command chips (`/status`, `/tasks`, `/approve`, `/costs`, `/builders`), textarea, «Отправить», clear | talk to the Director | `POST say`, `POST command` | `E:director` (`/status` echoes) | pass (chip), untested (free text, clear) |
| Директор / Лента | live feed | render | `GET /api/admin/office` | `E:panels` | pass (render) |
| Директор / Учения | department select, «Запустить учения», «Таблица», «Очистить» | drill | `GET/POST drill` | `E:panels` (renders) | untested |
| Маркетинг / Контент | week arrows «Прошлая/Следующая неделя», «Эта неделя», content cards | week calendar, card drawer | `GET content?week=` | `E:panels` (renders) | untested (clicks) |
| Маркетинг / Контент | drawer: «Одобрить», «Править» (revise note), «Отклонить», re-render, platform select + «Опубликовано», kit tabs, slide arrows, MP4/PNG files | content writes | `POST content/<id>`, `GET /api/admin/files/*` | `U:pult-v3`, `U:hq-admin` | untested (browser) |
| Маркетинг / Цифры | week arrows, funnel, site events, blog, YouTube, money | render | `GET metrics/week` | `E:panels` | pass (render), untested (arrows) |
| Продажи / Лиды | stage kanban (drag/move), search, filter chips, lead drawer: stage, «Потеряно» with reason, note, reply, call time, links to client and documents | lead funnel writes | `POST crm/leads/<id>`, `.../reply`, `.../call` | `E:panels` (renders), `U:pult-v3` | untested (writes) |
| Продажи / Клиенты | search, «Все»/«С кабинетом», client 360 with links to leads, projects, invoices, tickets | read, cross-links | `GET crm/clients/<id>` | `E:panels` | untested (clicks) |
| Продажи / Заявки с сайта | «Экспорт CSV», status chips, search, lead drawer: status, booking ok/move, notes, Telegram, phone, copy | `leads.json` | `/api/admin/leads/<id>`, `/api/admin/export` | `E:csv`, `U:admin-crm` | pass (CSV), untested (drawer) |
| Продажи / Созвоны | week list, «ок», «перенести» | booking actions | `/api/admin/leads/<id>` | `U:admin-crm`, `U:telegram` | untested |
| Продажи / Разведка | status and niche chips, search, prospect rows, status moves | prospect writes | `POST crm/prospects/<id>` | `E:panels`, `U:admin-crm-hq` | untested (moves) |
| Поддержка / Тикеты | filters «Открытые/Просрочены/Отвечены/Все», search, ticket drawer: reply, «Отвечен», «Открыт», note | ticket writes | `POST crm/tickets/<id>` | `E:panels`, `U:pult-v3` | untested (writes) |
| Производство / Проекты | kanban, search, drawer: milestone toggle, deadline, status move, note, issues | project writes | `POST crm/projects/<id>` | `E:panels`, `U:pult-v3` | untested (writes) |
| Производство / Проекты | drawer: «Принять этап» on a stage awaiting acceptance (client found by name, then HQ accept; 409 reasons shown) | `GET crm/clients?q=`, `POST clients/<id>/projects/<pid>/milestones/<no>/accept` (whitelist) | `E:accept-pult`, `U:cabinet-milestones` | pass |
| Бэк-офис / Счета | status filters, search, «Ссылка» (pay link), «Транзакция» (explorer), «Напомнить клиенту», «Оплачено вручную», «Аннулировать» | invoice writes | `POST crm/invoices/<id>` | `E:backoffice` (buttons present, «Напомнить» answers), `U:pult-v3` | pass (remind), untested (mark paid, void, link copy) |
| Бэк-офис / Документы | kind and status chips, search | render | `GET crm/documents` | `E:panels`, `U:admin-crm-hq` | pass (render) |
| Бэк-офис / Рекомендации | status chips, search | render | `GET crm/referrals` | `E:panels` | pass (render) |
| Бэк-офис / Отзывы | list | render | `GET crm/reviews` | `E:panels` | pass (render) |
| Компания | routine toggles and «Запустить сейчас: <routine>» (5), trust level switches (5), playbook rows (open drawer), costs, workers | company controls | `GET company`, `POST company/...` | `E:panels` (renders), `U:pult-v3` | untested (writes) |
| Компания / Цены | every price editable in place (Enter saves, Esc cancels), «Вернуть по умолчанию», history, API range refusal 422 | `GET/POST /api/admin/prices` | `E:prices` (edit in the panel, API reset, 422 and 403), `U:pricing-store` | pass (one price edited), untested (stage shares, «Сбросить всё») |
| every panel | «Шире» / «Уже», «Закрыть панель», Esc | resize, close | - | `E:keys` (Esc, open), `E:tabs` | pass (open/close), untested (resize) |

## 13. Go-live `/admin/golive`

| Element | What it does | Calls | Verified by | Status |
|---|---|---|---|---|
| page | 100svh shader stage, odometer, 41 checklist items in 8 blocks | `GET /api/admin/golive` | `E:golive`, `E:golive-fit`, `U:golive` | pass |
| «Запустить 72 часа» (+ confirm «Да») | starts the 72 h timer | `POST {action:'start'}` | `E:golive` | pass |
| «Перезапустить» | restart | `POST {action:'start'}` | `U:golive` | untested (browser) |
| «Сбросить» (+ confirm «Сбросить») | clears the timer, keeps ticks | `POST {action:'reset'}` | `E:golive` (UI and API, ticks kept) | pass |
| item checkbox | tick with time and rollback | `POST {action:'toggle'}` | `E:golive` (API), `U:golive` | pass (API), untested (checkbox click) |
| item note | saved on blur (max 300) | `POST {action:'note'}` | `E:golive` (API), `U:golive` | pass (API), untested (field) |
| block navigation, «Наверх», row expand | scroll, reveal | - | `E:golive-fit` (renders) | untested (clicks) |
| «Назад в офис», theme button | navigation, theme | - | `E:golive-fit` (link visible) | pass |
| API guard | 401 without session, 403 bad Origin, 400 unknown action | `/api/admin/golive` | `E:golive`, `U:golive` | pass |
| top-bar chip | countdown text | - | `U:golive` (`chipText`) | pass |

## 14. Review centre `/admin/review` and chats `/admin/chats`

| Element | What it does | Calls | Verified by | Status |
|---|---|---|---|---|
| review: department rail (7, with counts) | switches the queue | `GET review?status=all` | `E:review` (seven entries, counts, one switch), `U:review` | pass |
| review: queue, J / K, position counter, «Предыдущий» / «Следующий» | steps through the items | - | `E:review` (J then K), `U:review` | pass (keys), untested (arrow buttons) |
| review: «Правки» (R) composer | opens the revise note, Esc closes it | `POST review/<id>` (revise) | `E:review` (opens, fills, Esc), `U:review` | pass (open and close), untested (send) |
| review: «Одобрить» (A), «Править» (E), «Отклонить» (X), «Выложить сейчас» (P), «Перенести» (T), «Отправить» (S), «Позвонить» (C) | decisions, optimistic with rollback | `POST review/<id>` | `U:review`, `U:hq-admin` | untested (browser) |
| review: «Скинуть ссылку» | dialog with the link and a note, host check, Esc closes | `POST trends` | `E:review` (rejects a foreign host, accepts a YouTube link, toast) | pass |
| review: versions, media stage, details sheet | v1/v2, video, carousel | - | `U:review` | untested (browser) |
| chats: list, thread opens | threads with channels and unread | `GET chats`, `GET chats/<id>` | `E:chats`, `U:chats` | pass |
| chats: reply box (Enter sends, Shift+Enter new line) | owner reply joins the thread | `POST chats/<id>/reply` | `E:chats` (Enter), `U:chats` | pass (Enter), untested (Shift+Enter) |
| chats: filters, links «Открыть лид / тикет / клиента» | filter, jump to the Пульт panel | - | `U:chats` | untested (browser) |

## Totals

Counted as rows of the tables above (one row can stand for a group of identical controls, as written). A row is `pass` when everything it names is covered, `untested` when nothing is, and «pass in part» when the Status cell names both (for example the first card clicked, the other six not).

| Section | pass | pass in part, rest untested | fail | untested |
|---|---|---|---|---|
| 1 pages | 3 | 0 | 0 | 0 |
| 2 header, footer, global | 12 | 0 | 0 | 2 |
| 3 home | 10 | 2 | 0 | 8 |
| 4 contact form | 5 | 1 | 0 | 2 |
| 5 builder | 9 | 5 | 0 | 3 |
| 6 estimate, services, solutions | 7 | 1 | 0 | 5 |
| 7 other pages | 11 | 4 | 0 | 4 |
| 8 pay | 6 | 1 | 0 | 1 |
| 9 cabinet | 3 | 5 | 0 | 12 |
| 10 404 and chat | 6 | 2 | 0 | 3 |
| 11 owner login and hub | 10 | 3 | 0 | 3 |
| 12 department panels | 5 | 8 | 0 | 12 |
| 13 go-live | 6 | 2 | 0 | 2 |
| 14 review centre and chats | 3 | 3 | 0 | 3 |
| **all** | **96** | **37** | **0** | **60** |

The totals were recounted from the tables on 2026-11-21 (section 10 holds 6 pass, 2 in part, 3 untested rows; the earlier table had it one row off) and section 14 was added with the review centre and the chats.

`fail` is 0 because the two bugs the suite found were small and are fixed (below); they stay in the tables as
`pass` with the test that now guards them. `untested` is mostly three groups: everything behind a real Supabase
session (cabinet signed in, lead send), every write inside the department panels (the HQ mock is in-memory and
the proxy schemas are unit-tested, but no browser test drives the writes), and clicks on plain navigation links
whose target page already has its own render test.

## Bugs found by the suite

| # | Where | Cause | State |
|---|---|---|---|
| 1 | `/{locale}/pay/<unknown number or wrong key>` | the page calls `notFound()` after fetching the invoice; Next renders an error shell and the client takes over without the server-inserted theme script, so `<html>` had no `data-theme` (a dark visitor saw a light page). `E:matrix` (pay FT-2026-999) caught it | fixed: `ThemeInit` runs the same script from an effect when the attribute is missing (`src/components/theme-init.tsx`); with the fix a production build (`next start`, HQ stubbed to answer 404) shows `data-theme="dark"`; whether the bug also happened in production before the fix was not checked |
| 2 | `/admin/office` on a phone | the two presence radios had no accessible name below `sm` (the label span is `hidden sm:inline`) | fixed: `aria-label` on the radios (`src/components/admin/hub/hub.tsx`); `E:hub` (phone) asserts the names |

Observed, not a bug: the 404 pages answer with `<html id="__next_error__">` in `next dev` (Next's shell for
`notFound()` after data fetching).

| 3 | chat textarea | Enter pressed while the greeting request was in flight returned silently (`submit` bailed on `pending`) and kept the text; reproduced with a delayed first `/api/chat` answer | fixed: the message is queued and sent when the chat is free (`chat-panel.tsx`); `E:chat-enter` |
