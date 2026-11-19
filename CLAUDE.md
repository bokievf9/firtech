# Project: Fir Tech (firtech.pro)

Lives in `fir-tech/firtech/`; the workspace rules in `../CLAUDE.md` (git identity, language, safety)
apply here too. Marketing site of the Fir Tech studio: websites, Telegram bots, apps and business
automation for clients in the CIS (mainly Tajikistan) and abroad.

## Stack
- Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, Motion (`motion/react`),
  Phosphor icons (`@phosphor-icons/react`, `/ssr` in server components), zod.
- Fonts: Onest (Cyrillic-first, text), Geologica (display: hero and section titles, `font-display`,
  sharpness axis) and JetBrains Mono (data) via `next/font` (`src/app/fonts.ts`).
- Brand: wordmark `fir.tech` ("fir" is from the founder's name, not the tree) in Unbounded 700
  with a lime dot (`src/components/logo.tsx`, font in `fonts.ts` and `assets/fonts` for the OG
  image). Avatars and files in `brand/` (`1-fir.png` is the chosen avatar).
- Public site: one dark theme. The owner panel (/admin) also has a light theme (`data-theme="light"` on <html>, tokens at the top of `globals.css`, switch in the admin header, choice in localStorage). One accent ("fir lime"). Design tokens and shape rules are at the top of
  `src/app/globals.css`; keep to them.

## Structure
- `src/app/[locale]/`: pages for `ru` and `en` (home, `services/[slug]` for websites, bots, apps,
  automation), all statically generated. `src/proxy.ts` sends `/` to the visitor's language.
- `src/content/ru.ts` and `en.ts`: every visible text. `en` is typed against `ru`, so both must keep
  the same shape. No em or en dashes in copy (use a hyphen).
- `src/lib/pricing.ts`: starting prices and calculator prices in USD. **Prices are owner decisions**:
  change them only on the owner's word (current set decided 2026-11-19: below the RU/CIS freelance
  market, extras about half the old prices; `contentPlans` = content subscription, `agentPlans` =
  Dono and Polly).
- `src/app/api/lead/route.ts`: contact form endpoint, sends the lead to Telegram.
- Home page order (stage B1, products lead; `homeSections` in `src/lib/home.ts`, tested): hero
  (`#top`, kinetic headline over a 3D product stage; on lg a 250vh scroll track brings the seven
  products forward one by one, phones rotate them on a timer), products bento (`#products`, old
  `#services` anchor kept; seven cards from `src/lib/products.ts` with CSS mini-demos, «для кого»,
  «что внутри», price, «Собрать в конструкторе» opening the builder with the product picked via the
  `p.<id>` chunk, plus the four classic services), demo (`#demo`, opens the receptionist chat),
  proof (`#proof`: Dono, Polly, Fir Tech HQ with live counts from `/api/office/public`), process
  (`#process`, sticky horizontal timeline with the rules), pricing (`#pricing`: builder teaser and
  calculator), FAQ + contact on one screen (`#faq`, `#contact`), footer (products, services,
  solutions, studio columns, Instagram, giant wordmark; links from `footerColumns`, tested).
  Product prices: `productPrice` = the builder catalogue product's parts priced by `quote()`
  (pricing.ts), the personal agent shows `agentPlans` (pricing.ts, owner-approved), the rest say
  «по смете». Never type a price into copy. Mini-demos are labelled «Пример интерфейса»; no
  invented reviews or statistics anywhere. The pixel office lives only in /admin/office now. 404:
  `components/not-found/not-found-view.tsx` (search over `notFoundText.pages`) for `[locale]` and
  `src/app/global-not-found.tsx` (`experimental.globalNotFound`) for paths outside the locales.
- Demo, audit, status (2026-11-19, contract `agents/docs/public-api.md`): the demo salon is the deep link
  `https://t.me/firtech_bot?start=demo_salon` (`src/lib/demo.ts`; `#demo` block, product cards admin and Mini App,
  chat chip «Демо» that sends `demo`; links carry `data-place` `demo_salon*`). `/[locale]/audit`: form to
  `POST /api/audit` (zod in `src/lib/audit.ts`, 5 per IP per 10 min, honeypot `website`, forwards to
  `${LEAD_INTAKE_URL}/audit` with `x-lead-token`, 8 s; development without HQ = `{ok:true, mock:true}`; sends `ref` from
  `fir-ref`; goal `audit_sent`). `/[locale]/status`: server page plus a client island refreshing `GET /api/status` every
  60 s; `src/lib/status.ts` (normalizer, only known fields, no URLs) and `status-hq.ts` (60 s cache, 3 s timeout,
  `HQ_STATUS_URL` optional, else the origin of `LEAD_INTAKE_URL` + `/status`; the site row comes from its own `/api/health`
  when HQ says `unknown`; dev mock). Both pages are in `localePages`, the sitemap and the footer «Студия». Tests: `tests/site-e.test.mjs`.
- Builder (`/[locale]/builder`, logic in `src/lib/builder.ts`, tested): the visitor combines
  services, options and extras into one quote. Prices are exact (owner 2026-11-19: no ranges; `quote()` lines
  are `price: number`, `estimate()` returns a number); domain, hosting, server and paid third-party services are
  never included and the line saying so is `builder.scope` (`scopeLine()` in `estimate-doc.ts`, varies with the
  brief's `has`), shown in the summary, the PDF notes and the lead text. Prices come from `pricing.ts`; `bundleDiscount`
  (owner decision: 10% off the one-time total from two parts) and terms are shown per part, never
  summed. The build lives in `?b=` so it can be shared; the lead arrives as service `bundle` with
  the full list and the link.
  Eight full-screen steps (business, products, goal, parts, features, style, details, summary); the
  step is in `?step=` (1-based; old `?s=` links map to the new order) with history entries.
  Catalogue: `src/content/builder-catalog.ts` holds every kind (56, in 10 categories; row = emoji,
  mock block, default goals, 1-2 usual products, preset as an encoded build, RU/EN name, headline,
  lead, 3 pains, 3 gets), the products and the style names. Presets, products and quotes derive
  from it; prices only from `pricing.ts`. Products (`adminbot intake automation content miniapp
  agent aiteam site bot app`): a priced product pre-selects its parts; unpriced ones (`content`,
  `agent`) show "по смете" in the builder, are listed apart in the quote, estimate and lead and are
  never summed; on the product cards both show their subscription plans (`contentPlans`, `agentPlans`).
  `aiteam` = `automation.assistant.training`. The brief (goals, channels, style, details) and the kind/products ride in `?b=` as
  extra chunks (`k.` kind, `p.` products, `g.` `c.` `s.` old style, `y.` new style axes, `d.`,
  base64url `u.`/`w.`); old links decode as before. Style: five axes (16 palettes, 7 type pairs,
  shape, density, mood) plus 19 ready looks (kits) in `src/lib/builder-style.ts`; it only restyles
  the mockup via CSS variables and never changes the price, except website languages (two or more
  turn on the `language` option). `leadSummary` (`estimate-doc.ts`) builds the lead text (max 1500).
  The summary also links to `/[locale]/builder/estimate?b=...` (noindex, decoded on the client,
  rows from `estimateDoc` in `src/lib/estimate-doc.ts`): an A4 estimate saved as PDF via the print
  dialog. Site chrome carries `.print-hidden`; print rules are at the end of `globals.css`.
- Service pages (`services/[slug]`): hero with the service's live miniature, included, formats
  (`ServiceVariants`; "Estimate" picks the format in the calculator via `pickInCalculator`), steps
  (`Process` with `serviceDetails.<slug>.steps`), concepts (`ServiceConcepts`, labelled as
  concepts), pricing, FAQ, contact, other services.
- Solutions (`/[locale]/solutions`, `/[locale]/solutions/[kind]`, kinds in `src/lib/solutions.ts` =
  builder `businessKinds` without `other`; `allSolutionKinds`, copy via `solutionCopy`, the footer lists only the original five): niche pages for search built on `presets[kind]`
  (price from `quote()`, CTA opens the builder with that preset, mockup `BuilderPreview` labelled
  as a concept). Changing a preset changes its page.
- Blog (`/[locale]/blog`): articles are typed data in `src/content/blog/` (one file each, ru + en).
  Only `published: true` reaches production and the sitemap; drafts show in `next dev` with a
  "Черновик" badge. Publish = set `published: true` and the date. Article prices come from
  `src/content/blog/prices.ts`; tests fail on hardcoded prices or long dashes.
- Privacy (`/[locale]/privacy`, texts in `privacy`): a template pending a lawyer's review, linked
  from the form consent (`[brackets]` mark the link) and the footer. Update it with a new date
  whenever form fields, storage or analytics change.
- Stage C (pre-client audit, 2026-11-19, `docs/pre-client-checklist.md`): `telegramUrl` falls back to
  `@firtech_bot` (`defaultTelegramBot` in `src/lib/site.ts`); service-page meta texts hold a `{price}`
  token filled by `fillServicePrice` (`src/lib/seo.ts`); meta descriptions must be 120-160 characters
  and copy must have no long dashes, AI tells or dollar amounts (`tests/site-c.test.mjs`); `/terms`
  (`terms` in the dictionaries, `components/legal-doc.tsx` shared with privacy) is a full draft
  (2026-11-19: individual contractor without a legal entity, 50% prepayment, USDT TRC20/TON or an
  online wallet named in the estimate, two rounds of revisions, 7-day acceptance, liability capped
  at the paid amount; contractor «Fir Tech», contact `hello@firtech.pro`, law of Tajikistan, filled
  on the owner's word 2026-11-19; `placeholder` stays in the dictionary for future gaps); `llms.txt`
  comes from the products and `pricing.ts`.
- Guarantee, referral, comparison (owner decisions 2026-11-19): the money-back sentence («первый экран
  или первый сценарий не понравился, возвращаем предоплату») is `guarantee.line` in the dictionaries,
  shown by `components/guarantee-line.tsx` in `#pricing` and the builder summary, in the estimate notes
  (`estimateDoc().guarantee`), in the FAQ, in `llms.txt` (`guarantee.llms`); the rule is the `guarantee`
  section of `terms` (after `payment`, 7 days, full return minus network fees). `/[locale]/referral`
  (`referral` dictionary, link generator `components/referral-link.tsx`) pays `referralPercent`
  (`pricing.ts`, number 10) of the referred client's estimate; copy carries the `{percent}` token
  (`fillReferralPercent` in `src/lib/referral.ts`), never a typed percent. `/[locale]/compare`
  (`comparePage` dictionary, words only, no figures or named competitors). Both are in `localePages`,
  the sitemap and the footer «Студия» column; links from `#pricing` and under the home FAQ.
- `?ref=<slug>` flow: `RefCapture` on the home page stores the sanitized slug in localStorage for 30 days
  (`fir-ref` = `{slug, exp}`; sessionStorage when localStorage throws; `storedRef()` in `src/lib/referral.ts`);
  `RefLinks` (layout) adds `?start=ref_<slug>` to every `t.me/firtech_bot` link without its own `start`
  (`demo_salon` wins); the audit form and the chat send `ref` too; the contact form (and the builder hand-off through it) sends `source: 'ref:<slug>'`
  (wins over a showcase source); `leadSchema.source` accepts `ref:[a-z0-9_-]{1,32}`; `forwardLead`
  passes `source` to HQ only when not empty (HQ rejects an empty one). HQ's `chatSchema` is not strict, so the chat payload now carries `ref` (ignored by HQ until it reads
  it: TODO in `chat-hq.ts`). Tests: `tests/site-d.test.mjs`.
- Analytics: Yandex Metrika (`src/components/yandex-metrika.tsx`) only when `NEXT_PUBLIC_YM_ID` is
  set; the privacy page shows its analytics section only then. On since 2026-10-18 with counter
  113665084 (public id, kept in `.env.local`; `scripts/deploy/manual.sh` and the CI variable pass
  it at build time). Tag options: Webvisor, click map, link tracking, accurate bounce, `ssr`;
  inputs carry `ym-disable-keys` so typed text is never recorded. Goals via `track()` in
  `src/lib/analytics.ts` (the `Goal` union is the list to mirror in Metrika as "JavaScript event"
  goals, identifier = goal name); `t.me` links are counted by one listener (give new ones a
  `data-place`) and main buttons by `data-cta`.
- Motion: Motion (`motion/react`) in client leaf components, motion values for pointer effects.
  Use `useReducedMotion` from `@/lib/use-reduced-motion` (hydration-safe), not Motion's own;
  `MotionProvider` (MotionConfig `reducedMotion="user"`) wraps the layout. Logos come from
  `simple-icons` (pinned exact version).

## Leads
- Public POST routes (`/api/lead`, `/api/chat`, `/api/audit`): `checkPublicPost` (`src/lib/public-post.ts`) requires
  `content-type: application/json` (415) and, when `Origin` is present, the site origin (`NEXT_PUBLIC_SITE_URL`, or
  localhost outside production; 403). The visitor IP (`visitorIp`: `x-real-ip`, else first `x-forwarded-for` hop, like the
  limiters) goes to HQ in header `x-visitor-ip` on every forward (not sent when 'local'). Tests: `tests/audit-2026-11-19.test.mjs`.
- `GET /api/prices` (`force-static`, `cache-control: public, max-age=600`): `pricesJson()` in `src/lib/prices-json.ts`
  from `pricing.ts` and `products.ts` (starting prices, catalog, extras, plans, referral percent, products); the agents read it
  instead of copies. Bump `PRICES_UPDATED_AT` when prices change.
- Security headers (`next.config.ts`, all paths): nosniff, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`,
  `Permissions-Policy` (microphone only on `/admin/echo`), HSTS in production (nginx sends none, so no duplicate). No CSP yet.
- Payment copy (owner 2026-11-19): USDT (TRC20/TON) or an online wallet named in the estimate, 50% before the start and 50%
  after acceptance, stages from the estimate for projects over a month; never cards, Kaspi, Payme, Click as our own methods
  and never «за каждый этап отдельно». The free audit is promised «в течение рабочего дня после заявки, обычно быстрее».
  The public office maps `blocked` to `waiting`.
- Env (in `.env.local`, see `.env.example`): `TELEGRAM_BOT_TOKEN` (bot from @BotFather),
  `TELEGRAM_CHAT_ID` (the owner's user id or a group id: send the bot a message, then read
  `chat.id` from `https://api.telegram.org/bot<token>/getUpdates`), `NEXT_PUBLIC_TELEGRAM_USERNAME`
  (public username for the "write in Telegram" link; empty hides it), `NEXT_PUBLIC_SITE_URL`.
- Without the bot env, dev mode logs the lead to the console and production returns 503.
- Lead Intake (agents repo, `apps/lead-intake`): `src/lib/lead-forward.ts` POSTs each lead to
  `${LEAD_INTAKE_URL}/lead` (header `x-lead-token: LEAD_INTAKE_TOKEN`, JSON as the agent's `webLeadSchema`:
  name, contact, service, budget, message, estimate, locale, page, slot). Fail-open: no env or a failed
  request (5 s timeout) is only logged without lead text; saving and Telegram go on as before. Not awaited.
  Keep the field list in sync with `../agents/apps/lead-intake/src/webhook.ts`. The agent is not on the
  server yet, so leave both vars empty in production until it is deployed.
- Honeypot field `website` and an in-memory limit of 5 requests per IP per 10 minutes.

- Leads are saved first to `$DATA_DIR/leads.json` (`src/lib/store.ts`; fine because there is one
  PM2 process), then sent to Telegram, so an outage loses nothing and unsent leads go out later.
  `DATA_DIR` must be outside the release folder on the VPS, and backed up.
- Bot (`src/lib/lead-bot.ts`, webhook `/api/telegram` checked with `TELEGRAM_WEBHOOK_SECRET`):
  status buttons under each lead, `/leads`, booking confirm/reschedule, and `/start lead_<id>_<hmac>`
  links a client to their lead (button after the form, needs `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`).
  Only `TELEGRAM_CHAT_ID` may press buttons. `scripts/telegram-webhook.mjs set` after deploy;
  `scripts/telegram-poll.mjs` forwards updates to localhost for testing (delete the webhook first).
- Owner panel `/admin` (`src/app/admin`, API `src/app/api/admin`, copy `src/content/admin.ts`,
  logic `src/lib/admin-*.ts`): login by a one-time code the bot sends to `TELEGRAM_CHAT_ID` (5 min,
  5 tries, 1 per minute, 10 per hour); 30-day sessions in `$DATA_DIR/admin.json` (hashes only,
  revocable; back it up with `leads.json`). Pages and `/api/admin/*` check the session on the
  server, POSTs also check `Origin`. Status and booking changes go through `setLeadStatus` and
  `bookingAction` in `lead-bot.ts`, shared with the bot buttons. Private `notes` never leave the
  site. Bot `/admin` sends the link. Since 2026-11-19 (owner: «в админке всё кроме офиса не нужно») the
  panel has ONE page, the control center below; `/admin` redirects to `/admin/office`, the old overview
  (Pulse), `/admin/leads` and `/admin/calendar` and their code are deleted (404). Site-form leads and
  call bookings live inside the control center as panels «Лиды» and «Созвоны» (see below).
  The admin shell nav shows only «Офис», the theme switch and logout.
- Пульт `/admin/office` (control center, stage 1 since 2026-11-19, nav link «Офис»): the owner's
  workplace instead of the Director bot. Top bar with the presence switch («На месте» / «Не на месте»;
  the page pings HQ every 60 s while visible, HQ goes «away» by itself and sends to Telegram),
  badges and HQ link; the pixel office below (click a person or department to filter tasks); then
  panels Входящие, Одобрения, Задачи (board + drawer), Директор (chat to `/say` and `/command`),
  Учения, then «Лиды» and «Созвоны» (`src/components/admin/control/`). Browser calls only `/api/admin/hq/[...path]`, a
  session-checked whitelist proxy (`src/lib/hq-admin.ts`, 5 s timeout) to `HQ_ADMIN_URL` (default
  `http://127.0.0.1:8787/admin`, header `x-admin-token: HQ_ADMIN_TOKEN`, falls back to
  `HQ_OFFICE_TOKEN`); unset in development = in-memory mock `src/lib/hq-admin-mock.ts`. View models
  `src/lib/hq-admin-view.ts`, tests `tests/hq-admin.test.mjs`, notes «Пульт (этап 1)» in
  `docs/office-design-notes.md`. The page uses `AdminShell wide` (fluid to 1760 px, then 88vw).
- Panels «Лиды» and «Созвоны» of the пульт (`control/leads-panel.tsx`, `calls-panel.tsx`, mounted by
  `crm-panels.tsx` in `control-center.tsx`; data hook `crm-data.ts` polls `GET /api/admin/leads` every
  30 s; view models `src/lib/admin-crm.ts`, tests `tests/admin-crm.test.mjs`). They show the site-form
  store (`leads.json`) only: status chips and counts, search, the lead drawer (`lead-drawer.tsx`,
  private notes, booking, status through `/api/admin/leads/[id]` = `setLeadStatus`/`bookingAction`
  like the bot buttons) and «Экспорт CSV» of the visible list. Telegram and web-chat leads live in
  «Задачи» under Продажи. Calls: today, pending ones with confirm/move, and a two-week Mon-Fri view.
  Badges (new leads, calls today) are in the phone tab bar, whose panel registry is `tabs` in
  `control-center.tsx`; add a panel there and it gets a tab. Side by side from 1920 px.
- CRM panels of the пульт, stage 2 («Разведка», «Клиенты», «Тикеты», «Документы», «Проекты»,
  «Рекомендации», «Отзывы»; `control/*-panel.tsx`, shared `crm-hq-ui.tsx`, data `crm-hq-data.ts`, view
  models `src/lib/admin-crm-hq.ts`, tests `tests/admin-crm-hq.test.mjs`): fed by HQ `GET /admin/crm/*`
  through the same proxy (whitelist `CRM_ENDPOINTS` in `hq-admin.ts`; only POST `crm/prospects/<id>` and
  `crm/tickets/<id>` write: status and owner note). Polled every 30 s with `crm/summary` for the tab
  badges; `available: false` renders «Воркер ещё не запускался», never zeros. A reply to a client is not
  sent from the panel: the ticket drawer calls the Director command `ticket`. Contract:
  `agents/docs/admin-crm-api.md`; notes «Пульт (этап 2, CRM)» in `docs/office-design-notes.md`.
- Live office on that page («Живой офис»): a pixel-art office on canvas in the
  spirit of Lumio (engine `src/components/pixel-office/`, shared with the public hero; admin wrapper `src/components/admin/office/pixel-office.tsx`; tests `tests/pixel-office.test.mjs`):
  a desk and a little person per agent whose behaviour shows the status, window light from the
  sun in the company's TZ; status strip above, feed, people by department, routines, funnel and
  products below. Sprites are palette-indexed strings, no image assets or libraries. The page polls
  `/api/admin/office` (10 s, 60 s on a hidden tab); that handler checks the admin session and reads
  HQ's JSON (contract: `../docs/office-api.md`, code `src/lib/office-hq.ts`, types and pure helpers
  `src/lib/office-view.ts`, tests `tests/office-view.test.mjs`). Env: `HQ_OFFICE_URL` (default
  `http://127.0.0.1:8787/office`; unset in development = built-in mock `src/lib/office-mock.ts`) and
  `HQ_OFFICE_TOKEN` (header `x-office-token`, server only, never returned). 3 s timeout; on failure
  the page shows «HQ не отвечает» over dimmed last data. Design notes: `docs/office-design-notes.md`.
  Office v2 (2026-11-19): reception with visitors (`scene.visitors`), approvals carried to the
  Director and reactions, props per department, weather for Dushanbe (`GET /api/office/weather`,
  Open-Meteo, 10 min cache, fail-soft to clear; `src/lib/office-weather.ts`), elevator, doors,
  clocks, lounge TV, growing plants; camera (wheel/pinch zoom 2x-6x, drag, follow, fullscreen,
  name tags); static layers cached per zoom level; dev `?office=rain|snow|night|stats`. Contract
  `scene` block in `office-view.ts` (`normalizeScene`), tests `tests/office-v2.test.mjs`.
- Public live office (home hero, stage A): `GET /api/office/public` (no session) reads the same HQ
  office through `fetchOffice` and returns only `PublicOffice` (`src/lib/office-public.ts`):
  departments `{id,title}`, agents `{id,title,status}`, director status, counts `{agents, working,
  waiting, tasksRunning, doneToday}`, `quietHours`, `tz`, `generatedAt`, `demo`. Never task titles,
  activity or costs (tested in `tests/office-public.test.mjs`). 15 s in-memory cache
  (`src/lib/office-public-hq.ts`); HQ unset in dev or unavailable = deterministic demo company with
  `demo: true` (the hero labels it «Демо»). The hero polls it every 15 s (60 s on a hidden tab). The
  canvas engine is shared with the admin office (`src/components/pixel-office/`).
- Receptionist chat (stage A): floating widget in the locale layout (`src/components/chat/`), opened
  by its button, the hero's secondary button, the `#demo` section and `/<locale>#demo`. `POST
  /api/chat` (`src/app/api/chat/route.ts`, logic `src/lib/chat.ts` and `src/lib/chat-hq.ts`, tests
  `tests/chat.test.mjs`) validates (uuid session, `ru|en`, 1..1000 chars after HTML stripping),
  limits 30 messages per IP per hour and forwards to HQ: `POST ${HQ_CHAT_URL}` (default
  `http://127.0.0.1:8787/chat`) with header `x-chat-token: ${HQ_CHAT_TOKEN}` (falls back to
  `LEAD_INTAKE_TOKEN`), 20 s timeout. Unset `HQ_CHAT_URL` in development = scripted mock (3 steps and a
  contact request, never creates a lead, header `x-chat-mode: mock` shows «Демо-режим»). Production
  never uses the mock. Contract in `docs/site-design-notes.md`. Visitor texts are never logged.
- Echo is OFF since 2026-11-10 (owner: not needed yet): everything below works only with
  `ECHO_ENABLED=1` (`src/lib/echo-flag.ts`); otherwise the Pulse bar, panel and "ask Echo" button are
  hidden, `/admin/echo` and `/api/admin/echo*` answer 404 and the nav link is gone (re-add it in
  `admin-shell.tsx` when turning it back on). Code is kept.
- Echo (`/admin/echo`): the owner's control room. Projects, tasks, goals and
  milestones are typed data in `src/content/control.ts` (edit there on the owner's word; progress
  numbers are the owner's estimates). Live: project health (`src/lib/project-health.ts`, each
  `healthUrl` checked from the server, cached 30 s) and lead counts. Hologram on canvas
  (`components/admin/hologram.tsx`, reacts to idle/listening/thinking/speaking and the voice level),
  voice in by the browser's speech recognition (Chrome), voice out by speech synthesis.
  `/api/admin/echo` (loop in `src/lib/echo-chat.ts`) streams Claude's reply (`@anthropic-ai/sdk`,
  default `claude-sonnet-5-5` $2/$10 per MTok, low effort; `claude-opus-5-5` $4/$20 only on the
  owner's toggle or words like "подумай серьёзно" / "на Opus"; `fallbacks: "default"`, tool_choice
  stays auto because forced tool use is a 400 on these models). Tools (`src/lib/echo-tools.ts`,
  zod-validated, stores injected): add_task, update_task, list_tasks, delete_task, lead_counts,
  blocked_on_owner, instagram_today; up to 5 model calls per message, each executed action is
  streamed as a `[[act:...]]` marker that the console shows as a chip and never speaks.
  delete_task is two-step and enforced by the server (`Confirmations`): the first call only records
  a pending deletion; it runs only when the owner's NEXT message is an explicit yes and the same id
  is requested again, the model cannot confirm itself. Spend: `echo-spend.ts` prices per model and
  every call of a loop; daily cap `ECHO_DAILY_USD` (default $3), 40 model calls per 10 min per
  session (loop calls count). Voice in: push to talk (hold the mic or Space, release sends; tap
  toggles) with the browser's speech recognition (Chrome/Edge), text field elsewhere. Voice out:
  `speak()` in `src/lib/echo-voice.ts` uses `/api/admin/echo/tts` when `ECHO_TTS_URL` points to
  Piper's HTTP server on loopback (404 otherwise, then speechSynthesis); numbers and advice in
  `docs/echo-voice.md`. The briefing (`src/lib/echo.ts`) and every tool result carry lead counts
  only, never names, contacts or texts (tested). Needs `ANTHROPIC_API_KEY` in
  `shared/.env.production`; without it the page works and the chat explains how to turn it on.
  The key lives only in that file on the server (chmod 600): the owner created it on 2026-10-19,
  rotated it the same day and sets it themselves in a terminal. Never put it in the repo, a chat
  or a log, and never print it to check it (compare hashes if needed). Daily spend cap
  `ECHO_DAILY_USD` (default $3).
- Call booking: rules are owner settings in `src/lib/booking.ts` (Asia/Dushanbe, Mon-Fri
  10:00-18:00, 30 min), free slots at `/api/slots`, picked in the form, double booking blocked.

## Commands
- `npm run dev` (http://localhost:3001), `npm run typecheck`, `npm run lint`, `npm test`,
  `npm run build`.

## Infrastructure
- Domain `firtech.pro`: bought 2026-10-16 at Cloudflare (registrar and DNS). Records: `A @` and
  `A www` -> `201.79.122.133` (since 2026-11), DNS only (grey cloud), so Certbot can issue the certificate.
- Hosting: own VPS `firtech-sg-1` (`201.79.122.133`, Ubuntu 24.04, 4 GB, user `deploy`, SSH keys
  only). The old shared Vibely VPS (`68.183.177.183`) is destroyed; never deploy there. Node and
  PM2 come from `scripts/deploy/server-runtime.sh` (root, once, before `server-setup.sh`). A
  separate PM2 process `firtech` (one fork process, `ecosystem.config.cjs`) on 127.0.0.1:3001 and its own
  nginx site (`infra/nginx/firtech.conf` + snippet, Certbot SSL). Never edit Vibely's nginx files.
- Release model as Vibely: push to `main` -> GitHub Actions (`.github/workflows/deploy.yml`):
  checks, build in CI (`output: 'standalone'`), `scripts/deploy/assemble.sh`, upload to
  `/var/www/firtech/releases/<id>`, `activate.sh` boots it on 3098 first, switches `current`,
  restarts PM2, health-checks `/api/health` and rolls back on failure. The VPS never builds.
- Server layout (user `deploy`): `/var/www/firtech/{current,releases,incoming,shared}`;
  `shared/.env.production` (server secrets, chmod 600) and `shared/data` (lead store, survives
  deploys). One-time setup as root: `scripts/deploy/server-setup.sh`, then Certbot.
- Live since 2026-10-16 (first release deployed by hand from a clean checkout, same scripts).
  `scripts/deploy/manual.sh` stays as the fallback (clean `git archive` build with the public vars,
  checks first, `assemble.sh`, upload to `incoming/`, `activate.sh` as `deploy`; main only, or
  `DEPLOY_BRANCH=<branch>`) (key `~/.ssh/id_ed25519_firtech`, deploy user only; root access was
  removed after setup). Telegram webhook is set.
- Cron (user `deploy`, UTC): `*/5` `scripts/ops/watch.mjs` (public + local health, SSL expiry;
  Telegram on down/up changes only; cannot report a dead server, an external monitor would) and
  daily 03:15 `scripts/ops/backup.mjs` (14 dated copies in `shared/backups`, `leads.json` to the
  owner's Telegram when it changed). Log: `shared/ops.log`.
- GitHub (since 2026-10-19): private repo `bokievf9/firtech`, remote `origin`, over HTTPS (the SSH
  config maps github.com to Vibely's deploy key, so SSH would use the wrong key). **Pushing to
  `main` deploys** through CI (checks, build, upload, health check, rollback), so never push `main`
  without the owner's OK for a deploy. Feature branches are pushed only when useful; do not push
  branches with large media (`instagram-launch` carries about 50 MB of videos) unless the owner
  asks. Environment `production` (only `main` may deploy) has secrets `VPS_HOST`, `VPS_USER`,
  `VPS_SSH_KEY` (a dedicated key "github-actions-firtech", authorised for `deploy` on the server;
  the private half exists only in GitHub), `VPS_KNOWN_HOSTS` (fingerprint verified); repository
  variables `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_TELEGRAM_USERNAME`,
  `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, `NEXT_PUBLIC_YM_ID`.
