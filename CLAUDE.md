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
- Public site (owner 2026-11-21): the default follows the visitor's system scheme (stored choice wins, owner decision same day; `lib/theme.ts` `resolveTheme`), light on a white page / dark, with a sun/moon switch in the header and the mobile menu (`components/theme-switch.tsx`). The choice is in localStorage `fir-theme` (`light`|`dark`); `ThemeInit` (via `useServerInsertedHTML`, script in `lib/site-theme.ts`) sets `data-theme` on <html> before the first paint, falls back to the system scheme (`prefers-color-scheme` is read only in `theme-init.tsx`, never in CSS) and follows live system changes until a choice is stored. Tokens: the `@theme static` block at the top of `globals.css` holds the LIGHT values, `:root[data-theme='dark']` redefines them (same names); shadows and page decoration (`--shadow-card`, `--deco-*`, `--aurora-*`, `--hero-glow`...) are plain variables in `:root` and the dark block. Lime is a FILL under `text-accent-ink` (buttons, dots, bars); text and thin lines use `text-accent-text` / `border-accent-text` (dark green on light, the lime on dark), never `text-accent`. No raw `text-white`/`bg-black` in public components (`tests/site-theme.test.mjs` checks contrast of both token sets and this). The owner panel (/admin) sets `data-theme` explicitly (`dark` default, `light` stored in `firtech-admin-theme`; its light tokens apply to `html:not(.site)`, switch in the admin header). One accent ("fir lime"). The panel's seven departments have their own hues (`--color-dept-<id>`, `-soft`, `-text`, helper `deptTheme` in `src/lib/pult-theme.ts`) that tint only accents, never cards (`docs/pult.md`, «Темы и цвета отделов»). Design tokens and shape rules are at the top of
  `src/app/globals.css`; keep to them.

## Structure
- `src/app/[locale]/`: pages for `ru` and `en` (home, `services/[slug]` for websites, bots, apps,
  automation), all statically generated. `src/proxy.ts` sends `/` and every bare known page (`/terms`, `/privacy`, `/pay-how`, `/services/*`... list `bareLocalePages` in `lib/i18n.ts`, tested in `tests/bare-paths.test.mjs`) to the visitor's language, keeping the path and query.
- `src/content/ru.ts` and `en.ts`: every visible text. `en` is typed against `ru`, so both must keep
  the same shape. No em or en dashes in copy (use a hyphen).
- `src/lib/pricing.ts`: starting prices and calculator prices in USD. **Prices are owner decisions**:
  change them only on the owner's word (current set decided 2026-11-19: below the RU/CIS freelance
  market, extras about half the old prices; `contentPlans` = content subscription, `agentPlans` =
  Dono and Polly).
  **Editable prices (owner 2026-11-21: «правка всех цен в админке»)**: the numbers in `pricing.ts` are only the
  DEFAULTS (`defaultPricing`, type `Pricing`: starting prices, `catalog`, `extras`, plans, `bundleDiscount` percent,
  `referralPercent`, `smallProjectMaxUsd`, `stageShares`). The owner edits every price in the Пульт (Компания, tab «Цены»,
  ⌘K «Цены»); overrides live in `$DATA_DIR/prices.json` (`pricing-store.ts`: `{overrides, updatedAt, history[200]}`, atomic
  writes like `golive.json`; **back it up together with `leads.json`**, the daily backup script copies only `leads.json`;
  delete the file to go back to the defaults). `getPricing()` (server, per-request cached) = defaults + overrides, validated
  by zod (`pricing-edit.ts`; an invalid override is ignored with a server warning). Every pure helper (`quote`, `estimate`,
  `stagesFor`, `estimateDoc`, `leadSummary`, `productPrices`, `fillReferralPercent`...) takes a `pricing: Pricing` argument,
  default `defaultPricing` for tests. Components never import the constants: client code uses `usePricing()`
  (`PricingProvider` in the locale layout), server code `await getPricing()` (a test greps for this). Blog articles write
  `{price:...}` tokens (`content/blog/prices.ts`), filled by `allArticles()` from the live pricing. Pages revalidate every
  300 s (`revalidate` in the locale layout, `/llms.txt`); the save handler calls `revalidatePath('/', 'layout')`. Changing a
  default in `pricing.ts` still needs the owner's word and a deploy; live edits do not.
- `src/app/api/lead/route.ts`: contact form endpoint, sends the lead to Telegram.
- **Front v3 (owner review 2026-11-22, supersedes the home notes below where they differ).** Product names (ids and prices
  unchanged): `admin` ИИ-администратор, `receptionist` ИИ-менеджер заявок, `automation` Автоматизация процессов, `content` Контент на
  автопилоте, `miniapp` Telegram Mini App, `agent` Персональный ИИ-ассистент, `implementation` ИИ-отдел под ключ (EN in `products.items`
  and `builder-catalog.ts`); «бот» stays only as a delivery channel. The builder is «Сборка проекта» everywhere (nav, titles, buttons;
  the words «калькулятор» and «конструктор» are gone everywhere, the cabinet and the Пульт included (test in `copy-qa`); «приёмщик» is
  gone too, the lead agent is «Менеджер заявок» / «Lead manager»; the classic bots service reads «Агенты в Telegram»). Home order (`homeSections`): hero (headline in two lines about ИИ-агенты и автоматизация, no numbers; buttons «Собрать проект»
  and «Спросить агента», third item the link to `/ai-team`, then the guarantee and the 5-minute line), products (`#products`: seven
  cards each with «Подробнее» to `/[locale]/products/[id]`, the ladder `#levels`, the departments strip), demo (`#demo` «Попробуйте
  сейчас», tabs, `components/demo/`), solutions (`#solutions`: six cards from `homeSolutionKinds` in `components/solutions-home.tsx` (salon, clinic, cafe, onlineschool, carservice, shop) and the «Все решения» button; the «Сделано на себе» section was removed 2026-11-22, `dict.proof` keeps only `live` for the demo office tab and `/ai-team`), process (`#process`, short, links to `/how-we-work`), pricing (builder teaser and payment line only; the estimator is gone everywhere), faq (`#faq`: the only FAQ, with the «Остались вопросы? Спросите агента» strip), footer.
  **Product pages** `/[locale]/products/[id]` (`productPage` dictionary section, `lib/product-page.ts`, `components/products/
  capability-mock.tsx`): what it does as a list with a one-line example and a small CSS mock, first day/week/month, what we need,
  what it does not do, the live price (`ProductPriceTag`) and the stage table of the product's template (`productPayment`,
  `StageTable`), no FAQ (owner 2026-11-22: FAQ only on the home page; the useful answers sit in the capability texts), CTAs «Собрать проект» (product preselected) and
  «Спросить агента». **Since 2026-11-22 (owner: «у каждого продукта свой подход») each product page has its own structure**: the
  order of section blocks is `src/content/product-pages.ts` (`productPages[id].sections`, `demo` = chat|booking|assistant), the blocks
  are `src/components/product-sections/` (hero with the client's result as h1, demo, day by the hour, request flow, content week,
  roles, before/after, routines, phones, Telegram facts with sources, scenarios, knows/never promises, org chart, growth, plus the
  shared included/price+term/offer from the terms/objections/readiness CTAs), the texts `productPage.items.<id>` (`result`,
  `inPrice`, `notInPrice`, `objections` and the product's own block). Sales rules: `docs/sales-playbook-site.md`. Niche pages show a
  promise headline from `content/solution-promises.ts`; ai-team pages show `headline` as h1. **Ladder** (`lib/ladder.ts`, `components/ladder.tsx`, `ladder` section): per direction one agent -> on autopilot
  -> whole department (content: Контент-мейкер -> Контент на автопилоте -> Отдел маркетинга; sales: ИИ-менеджер заявок -> Продажи на
  автопилоте (agent page of the prospector) -> Отдел продаж; support: Служба поддержки -> Поддержка на автопилоте (monitoring) ->
  Отдел поддержки), on the home products section and on `/ai-team`; `/ai-team` is in the header as «ИИ-отделы». **Demo**: the receptionist
  tab is the real chat (`POST /api/chat` with `persona` = salon|clinic|shop; HQ ignores unknown fields today, TODO(agents) in
  `lib/chat.ts`; a demo request never creates a lead, the route answers contacts itself); the booking tab is the state machine in
  `lib/demo-booking.ts` (labelled «Пример»); the content tab shows the three newest published articles (neither `/api/office/public`
  nor the blog API carries a reel poster, so no poster); the department tab shows the live office counts. No demo-salon Telegram deep
  link anywhere (`lib/demo.ts` is deleted). **`/[locale]/how-we-work`** (`how` section): stages with what the client does, sees in the
  cabinet and who answers, acceptance, payment, guarantee, what if not liked, tools, approvals. **Tails**: the footer carries the two
  actions «Собрать проект» / «Спросить агента» on every page, Telegram is a small third link there only; the contact form is not a
  page section any more (the builder's last step sends the lead itself: `components/builder-send.tsx`, «Отправить проект в работу», sign-in gate and 24 h draft,
  `#contact` is the anchor of that button for old links); `Estimator` hands its pick to the builder. Solution pages show the full stage table, the first-stage price and the main part's timeline, CTAs «Собрать это
  решение» / «Спросить агента». Tests: `tests/front-v3.test.mjs`, `tests/products-pages.test.mjs`. Design notes: `docs/site-design-notes.md`.
- Home page order (stage B1, products lead; `homeSections` in `src/lib/home.ts`, tested): hero
  (`#top`, kinetic headline over a 3D product stage; on lg a 250vh scroll track brings the seven
  products forward one by one, phones rotate them on a timer), products bento (`#products`, old
  `#services` anchor kept; seven cards from `src/lib/products.ts` with CSS mini-demos, «для кого»,
  «что внутри», price, «Собрать проект» opening the builder with the product picked via the
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
  Payment stages (owner 2026-11-21, replaces 50/50): `paymentStages` and `smallProjectMaxUsd` (300) in `pricing.ts`,
  pure helpers in `src/lib/payment-stages.ts` (`stagesFor`, `stageTemplateForProduct`; the template of the most
  expensive part, a total under the limit = two stages 50/50, rounding to whole USD with the remainder on the last
  stage). `estimateDoc().stages` feeds the stage table (`Этап / Что входит / Доля / Сумма` plus `builder.stageRule`) in
  the summary and the A4 estimate, and one compact line in `leadSummary` (still within `leadLimit`).
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
- **Builder v2 (owner review 2026-11-22, supersedes the builder notes above where they differ; full notes `docs/builder-v2.md`).**
  Same eight steps and `?step=` (niche, what we build, goals, set, features, theme, details, preview). The first screen is the
  explainer plus three niches (salon, clinic, shop) and «Ещё ниши» (full grid by category, three each with its own «ещё»).
  What vs where: products (`what we build`) are never a place; an agent lives in a delivery channel (`delivery`: telegram, widget,
  whatsapp later, playground «Площадка Fir Tech») and may go without a site (`siteNeed` need|no|have; «не нужен» removes the site for
  good, `applySiteNeed` in `lib/builder-v2.ts`). Rules (goals per product family and niche, addon and extra filtering, required
  answers, preview modes) are pure in `lib/builder-v2.ts`, texts in `content/builder-v2.ts`, ids in `lib/builder-ids.ts`. Themes
  (10 by genre, 3 moods, motion preset) in `lib/builder-themes.ts`; palette and fonts are «тонкая настройка» inside a theme; old
  `s.`/`y.` links map to the closest theme (`closestTheme`) and are never rewritten. New `?b=` chunks: `t.<theme>.<mood>`,
  `l.<delivery>` (`l.none` = empty), `z.<need|no|have>`, and the new details as ONE `u.<base64url JSON>` chunk (told apart from an
  example link by its opening brace; capped, texts shortened first); the page count is gone (old `d.5` links still decode).
  Owner price rule: a second language cannot cost more than a lead channel; prices are untouched, the paid `language` option is
  hidden when it breaks the rule (`languageRuleBroken`) and listed in `docs/builder-v2.md`. The final step is the live preview
  (`builder-live-preview.tsx`): site prototype, agent chat (`POST /api/agent-demo` same-origin proxy to HQ
  `/agent/demo-<niche>/chat`, 20 per IP per 10 minutes, scripted lines when HQ is unreachable), playground window, department
  scheme, Mini App phone, content plan, process flow; «Отправить проект» still hands the lead to the contact form (sign-in gate).
  Tests: `tests/builder-v2.test.mjs`, `tests/e2e/builder-v2.spec.ts` (`SBORKA_SHOTS=<dir>` saves a screenshot of every step).
- Service pages (`services/[slug]`): hero with the service's live miniature (CTAs: «Собрать проект» to the builder with the
  service's product, `p.site` / `p.bot` / `p.app` / `p.automation`, then «Спросить агента» opens the chat), included, formats
  (`ServiceVariants`: «Собрать проект» on a format card is a link to `?b=<service>.<format>`), steps (`Process` with
  `serviceDetails.<slug>.steps`), concepts (`ServiceConcepts`, labelled as concepts), `#pricing` (live «от $» from
  `getPricing().startingPrice` plus the `StageTable` of the service's template, then the same two CTAs), other services.
  No estimator, no FAQ, no contact section (owner 2026-11-22; the only FAQ is on the home page). `Estimator`,
  `pickInCalculator` and the `estimator` copy are deleted; `dict.estimator` now holds only the catalogue (`catalog`, `variant`)
  that the builder reads. `/services/bots` is titled «Агенты в Telegram» (the word «бот» stays only as the channel in body copy).
- Solutions (`/[locale]/solutions`, `/[locale]/solutions/[kind]`, kinds in `src/lib/solutions.ts` =
  builder `businessKinds` without `other`; `allSolutionKinds`, copy via `solutionCopy`, the footer lists only the original five): niche pages for search built on `presets[kind]`
  (price from `quote()`, CTA opens the builder with that preset, mockup `BuilderPreview` labelled
  as a concept). Changing a preset changes its page.
- AI-team pages (2026-11-21, owner: each agent department can be a product on its own or the whole company; pages first,
  delivery to clients later): `/[locale]/ai-team` (index: flow card, bento of six offers, how it works, live proof block with
  `ProofLive` from `/api/office/public` labelled «это наш собственный офис», contact) and `/[locale]/ai-team/[id]` (`marketing sales
  support production backoffice company`; inside agents with a trust chip, routines, how it works, what we need from the client,
  delivery note, FAQ, others). Ids, department colours and links are in `src/lib/ai-teams.ts`; all text is the `aiTeams` section at the
  END of `ru.ts`/`en.ts` (same shape). Roles follow COMPANY.md, so a page says the scope goes into the quote. **No prices:**
  the pages show «По смете» (`aiTeams.quote`) and never a number; CTAs open the builder with `p.aiteam` (`aiTeamBuilderHref`),
  the receptionist chat (`ChatOpenButton`, source `aiteam*`) and `#contact` («Обсудить»). In `localePages`, the sitemap
  (`aiTeamPaths`), one footer link in «Продукты» (`footer.pages['ai-team']`) and a strip under the products bento (the seven cards
  stay seven). Tests: `tests/ai-teams.test.mjs`. Changing a price later = a new line from `pricing.ts`, never typed copy.
  Every agent is also a product (owner 2026-11-21: «каждого агента можно продавать отдельно»): `agentOffers` in `lib/ai-teams.ts` (19 roles, `standalone: false` only for the Director) with copy in `aiTeams.agents`, pages `/[locale]/ai-team/agent/[id]`, an «Агенты отдела» list on each department page and an «Или один агент» strip plus `#agents` section on the index; the agent CTA sends the lead `source` `agent-<id>` (`AgentDiscuss`), the pages are in the sitemap, the 404 list and `llms.txt`.
- Blog (`/[locale]/blog`): articles are typed data in `src/content/blog/` (one file each, ru + en).
  Only `published: true` reaches production and the sitemap; drafts show in `next dev` with a
  "Черновик" badge. Publish = set `published: true` and the date. Since 2026-11-19 HQ also publishes
  approved articles: `allArticles()` (`src/lib/blog-hq.ts`) = HQ `GET ${HQ_BLOG_URL||http://127.0.0.1:8787/blog}?lang=all`
  (3 s, validated by `parseArticle`, `[]` on any failure, `[]` in dev without the URL) merged with the bundled ones, HQ wins
  on an equal slug, newest first; blog pages, sitemap and `/rss.xml` (RU feed) use it with `revalidate = 300`, the slug route
  has `dynamicParams = true`. Tests: `tests/blog-hq.test.mjs`. Article prices come from
  `src/content/blog/prices.ts`; tests fail on hardcoded prices or long dashes.
- Privacy (`/[locale]/privacy`, texts in `privacy`): a template pending a lawyer's review, linked
  from the form consent (`[brackets]` mark the link) and the footer. Update it with a new date
  whenever form fields, storage or analytics change.
- Stage C (pre-client audit, 2026-11-19, `docs/pre-client-checklist.md`): `telegramUrl` falls back to
  `@firtech_bot` (`defaultTelegramBot` in `src/lib/site.ts`); service-page meta texts hold a `{price}`
  token filled by `fillServicePrice` (`src/lib/seo.ts`); meta descriptions must be 120-160 characters
  and copy must have no long dashes, AI tells or dollar amounts (`tests/site-c.test.mjs`); `/terms`
  (`terms` in the dictionaries, `components/legal-doc.tsx` shared with privacy) is a full draft
  (2026-11-19: individual contractor without a legal entity, payment by stages since 2026-11-21, USDT TRC20/TON or an
  online wallet named in the estimate, two rounds of revisions, 7-day acceptance, liability capped
  at the paid amount; contractor «Fir Tech», contact `hello@firtech.pro`, law of Tajikistan, filled
  on the owner's word 2026-11-19; `placeholder` stays in the dictionary for future gaps); `llms.txt`
  comes from the products and `pricing.ts`.
- Guarantee, referral, comparison (owner decisions 2026-11-19): the money-back sentence («первый экран
  или первый сценарий не понравился, возвращаем оплату первого этапа») is `guarantee.line` in the dictionaries,
  shown by `components/guarantee-line.tsx` in `#pricing` and the builder summary, in the estimate notes
  (`estimateDoc().guarantee`), in the FAQ, in `llms.txt` (`guarantee.llms`); the rule is the `guarantee`
  section of `terms` (after `payment`, 7 days, full return minus network fees). `/[locale]/referral`
  (`referral` dictionary, link generator `components/referral-link.tsx`) pays `referralPercent`
  (`pricing.ts`, number 10) of EACH paid stage of the referred client (owner 2026-11-21); copy carries the `{percent}` token
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
- Client cabinet (`/[locale]/cabinet`, owner decision 2026-11-19, full notes `docs/cabinet.md`): Supabase Auth (email +
  password with confirmation, Google only: no Apple sign-in, owner 2026-11-21) and `public.profiles` (`supabase/migrations/0001_profiles.sql`, RLS own row,
  `hq_synced_at`); projects, invoices, documents, tickets and referrals come from HQ by email through `src/lib/cabinet-hq.ts`
  (`fetchClientByEmail`, `createClientTicket`, `syncClientToHq`; `HQ_ADMIN_URL` + `HQ_ADMIN_TOKEN`, 4 s, short codes
  `hq_unreachable|hq_timeout|hq_error|not_found`, dev mock). Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (both needed, else the pages say «Кабинет скоро откроется» and header/footer links hide; baked in at build) and optional
  `SUPABASE_SERVICE_ROLE_KEY` (account deletion; without it the button makes a ticket). `src/proxy.ts` refreshes the session on
  cabinet routes only (never on the auth callback). Cabinet pages are `noindex`, not in the sitemap. Copy in `cabinet` of the dictionaries; the referral link
  is `cabinetRefLink` (`/<locale>/?ref=<slug>`), the percent comes from `referralPercent`. Tests: `tests/cabinet*.test.mjs`.
  Since 2026-11-20 (owner: «вход не работает», «заявки только с аккаунтом», «после заявки в кабинет»): Google starts in the browser
  (`oauth-button.tsx`), the callback passes `sb_flow_id`, accepts `token_hash`, writes cookies only on success and falls back to a
  browser retry (`/cabinet/auth/confirm`); errors map to sentences, codes only in the log; `/cabinet/health` shows yes/no per setting.
  Stale PKCE verifier cookies are cleaned in the callback and before each sign-in start (`auth-cookies.ts`); the nginx buffers in `infra/nginx` are required (else 502).
  Every lead path (contact form, builder hand-off, PDF estimate, audit, chat contact) needs a signed-in account: 401
  `auth_required` from `/api/lead` and `/api/audit` (`leadGate`, open while the cabinet is off), inline sign-in step with a
  24 h draft (`lead-draft.ts`, `draft=1`), identity `clientEmail/cabinetId/clientName` to HQ, redirect to
  `/<locale>/cabinet?lead=<leadId>`. Cabinet v3 (2026-11-22, `docs/cabinet.md` «Кабинет v3»; HQ contract `agents/docs/admin-crm-api.md` «Кабинет v3»): the home is the CLIENT'S project, never our office status. Tabs (`?tab=`, `lib/cabinet-tabs.ts`): Проекты (state in words, the one big `nextAction` button: accept the quote, sign the contract, pay or accept a stage, stage track or the road to the start, recent documents and messages; view model `lib/cabinet-view.ts`), Документы (viewer through the session-checked file proxy, «Принять КП», drawn e-signature pad `signature-pad.tsx`, payload `buildSignaturePayload` in `lib/cabinet-docs.ts`), Сообщения (messenger by threads `lib/cabinet-chat.ts`, 15 s refresh, unread badges), Ваш агент (only with an HQ playground agent, `lib/cabinet-agent.ts`), Материалы (uploads into the project thread), Рекомендации, Профиль. HQ calls and the full dev mock: `lib/cabinet-hq.ts` + `cabinet-hq-mock.ts`; routes `src/app/api/cabinet/{threads,documents,uploads,media,agent}`. The profile now saves for real (`lib/cabinet-profile.ts`, root cause in the docs; owner runs `supabase/migrations/0002_profiles_update.sql`) and reaches the CRM through `POST /admin/clients/:id`. Offers (`lib/cabinet-offers.ts`) are a slim strip under every tab (clicks `cabinet_offer_click`); the e-signature paragraph is `terms` section `esign`. The Google button has the «G» mark. The cabinet link reads «Личный кабинет» / «Get started»
  while signed out. Details: `docs/cabinet.md`.
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
- `GET /api/prices` (`force-dynamic`, `cache-control: public, max-age=60`): `pricesJson(pricing, updatedAt)` in
  `src/lib/prices-json.ts` from the LIVE pricing (defaults + the owner's overrides from the Пульт) and `products.ts`
  (starting prices, catalog, extras, plans, referral percent, `bundleDiscountPercent`, products); the agents read it
  instead of copies; since 2026-11-21 it also carries `stages` (templates: id, ru/en title, share) and `smallProjectMaxUsd`.
  `updatedAt` is the last edit in the Пульт (ISO), else `PRICES_UPDATED_AT` (the date of the defaults, 2026-11-21).
  HQ reloads it every 15 minutes (`PRICES_RELOAD_MS`) and at once on `POST /admin/prices/reload` (same `x-admin-token`; `agents/docs/admin-crm-api.md`), so agents see an edit within 15 minutes (the site cannot push to HQ).
- `/api/admin/prices` (session + Origin, JSON only): `GET` = defaults, overrides, merged, overridden paths, history (last 50),
  field list (path, ru label, group, unit, min/max/step); `POST {path, value}`, `{ops:[{path,value}|{reset}]}` (atomic) or
  `{action:'reset', path?}`; refusals are 422 with a key (`out_of_range:<path>`, `not_integer`, `stage_sum:<template>`...).
  Tests: `tests/pricing-store.test.mjs`.
- Security headers (`next.config.ts`, all paths): nosniff, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`,
  `Permissions-Policy` (microphone only on `/admin/echo`), HSTS in production (nginx sends none, so no duplicate). No CSP yet.
- Payment copy (owner 2026-11-19, stages 2026-11-21): USDT (TRC20/TON) or an online wallet named in the estimate; payment by
  stages, each stage BEFORE it starts and the last before handover (rule sentence `builder.stageRule`), projects under
  `smallProjectMaxUsd` in two stages 50/50, subscriptions monthly in advance; «50%» appears only in the terms
  (`{small}` token filled by `fillStageTokens`); the guarantee returns the first stage payment; never cards, Kaspi, Payme,
  Click as our own methods and never «за каждый этап отдельно». The free audit is promised «в течение рабочего дня после заявки, обычно быстрее».
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
  panel has ONE page, the пульт below; `/admin` redirects to `/admin/office`, the old overview
  (Pulse), `/admin/leads` and `/admin/calendar` and their code are deleted (404). Site-form leads and
  call bookings live in the Sales panel as tabs «Заявки с сайта» and «Созвоны» (see below).
  The admin shell nav shows only «Офис», the theme switch and logout.
- Пульт v3 `/admin/office` (owner 2026-11-20, full notes `docs/pult.md`): the live pixel office fills the screen and is the hub
  (`src/components/admin/hub/`). Every room is a zone (click = its department's panel, hover = name, counters and a desk lamp
  glow from HQ `GET /admin/hub`); slim top bar (presence «На месте» / «Не на месте», counters одобрения, лиды, оплаты, тикеты,
  `⌘K` palette with HQ search, theme, menu). Panels slide in from the right over the animating office (two widths, full screen on
  phones; Esc closes, keys 1-6 departments, 7 the company): Директор (уведомления from `hub.inbox` with links to objects,
  одобрения, задачи + task drawer, чат, лента, учения), Маркетинг (Контент: week calendar, MP4/PNG through `/api/admin/files/*`,
  captions, Telegram-card actions; Цифры: funnel, site events against the previous week, blog, YouTube, money), Продажи (Лиды:
  kanban by `stage` with drawer, reply, call, notes; Клиенты 360; Заявки с сайта and Созвоны = `leads.json` as before; Разведка),
  Поддержка (tickets, SLA 4 h), Производство (projects kanban, milestones, deadlines, issues), Бэк-офис (Счета: remind, paid by
  hand, void, pay link, tronscan/tonviewer; Документы, Рекомендации, Отзывы), Компания (server room: routines, costs, trust
  levels, playbooks, workers). CRM panels are `src/components/admin/pult/*`, stage 1-2 panels render bare inside tabs
  (`BarePanel` in `cc-panel.tsx`). Writes are optimistic with rollback and a toast. View models `src/lib/pult.ts` (tests
  `tests/pult-v3.test.mjs`), dev mock `src/lib/pult-mock.ts` (wired into `hq-admin-mock.ts`). Contract: `pult-v3` (HQ side in
  `agents/docs/admin-crm-api.md`). Browser calls only `/api/admin/hq/[...path]`, a session-checked whitelist proxy
  (`src/lib/hq-admin.ts`: `ENDPOINTS`, `CRM_ENDPOINTS`, `PULT_ENDPOINTS`, 5 s timeout, client ids `c:<name>` URL-encoded) to
  `HQ_ADMIN_URL` (default `http://127.0.0.1:8787/admin`, header `x-admin-token: HQ_ADMIN_TOKEN`, falls back to
  `HQ_OFFICE_TOKEN`); unset in development = in-memory mock. Renders: `/api/admin/files/[...path]` (`src/lib/hq-files.ts`,
  `safeRenderPath`, Range passed, type from the extension, dev SVG placeholder). Go-live plan (owner 2026-11-21): a countdown chip in the top bar, key `8` and ⌘K open the full-screen page `/admin/golive` (shader stage with an odometer `DD : HH : MM : SS` and the 41-item checklist with notes below it, `src/components/admin/golive/`) for the 72-hour timer, stored in `$DATA_DIR/golive.json` (back it up with `leads.json`); API `/api/admin/golive`, logic `src/lib/golive.ts`, list `src/content/golive.ts`, notes in `docs/pult.md`.
- Review centre and chats (owner 2026-11-21, `docs/pult.md` «Ревью-центр и чаты»): `/admin/review` is a full-screen editing-room page (departments rail with `counts`, 9:16 video / carousel / document stage, text fields read-only until `E`, versions v1/v2, revise note, keys A E R X P T S C J K, the optimistic decision flow, the Trendwatcher link composer) and `/admin/chats` the client threads with owner replies, both over the same whitelist proxy (`REVIEW_ENDPOINTS` in `src/lib/hq-admin.ts`, view models `src/lib/review.ts` and `src/lib/chats.ts`, dev mock `src/lib/review-mock.ts`). The office top bar has the chips «Ревью N» and «Чаты N» (keys `9`, `0`, ⌘K); the old approvals list in the Director panel links to the review centre. Since 2026-11-22 `E` on a text document opens a full-screen Word-like editor (`review/doc-editor.tsx`, helpers `lib/doc-editor.ts` and `lib/diff.ts`: toolbar, ⌘F find and replace, word diff against v1, local draft every 5 s, «Сохранить как версию» = `edit` v+1, also on the back-office Documents tab); the Director's «Задачи» and «Чат» tabs are one «Поручения» view (`control/assignments.tsx`, `lib/orders.ts`: composer, `/commands`, one timeline) and leads show a «Разбор заявки» block parsed from the builder link (`lib/lead-breakdown.ts`). Details: `docs/pult.md`.
- Site events (pult v3 part C): `trackEvent(name)` (`src/lib/track-event.ts`, pure helpers `src/lib/site-events.ts`) POSTs
  same-origin to `/api/events` (JSON only, origin check, 120 per IP per minute), which forwards to HQ `POST /events` (header
  `x-site-token` = `SITE_EVENTS_TOKEN`, else `HQ_CHAT_TOKEN`; URL `HQ_EVENTS_URL`, else the origin of `HQ_CHAT_URL` + `/events`;
  development without both sends nothing). Once per event per page view, nothing under Do Not Track or GPC, only name, path
  without query, locale and ref slug. Fired at chat open, builder summary, estimate PDF, lead sent, audit sent, `?ref=`
  landing, pay page and blog article (`components/track-view.tsx`); `cabinet_signup` server-side in the auth callback on the
  first HQ sync. Metrika goals stay. Owner replies to web-chat leads come back in HQ's `/chat` answer as `ownerReplies` and show
  in the chat as «Менеджер Fir Tech». Tests: `tests/site-events.test.mjs`. The privacy page has the section `events`.
- Live office on that page («Живой офис»): a pixel-art office on canvas in the
  spirit of Lumio (engine `src/components/pixel-office/`, shared with the public hero; admin wrapper `src/components/admin/office/pixel-office.tsx`; tests `tests/pixel-office.test.mjs`):
  a desk and a little person per agent whose behaviour shows the status, window light from the
  sun in the company's TZ; since пульт v3 it fills the screen as the hub (zones, badges and lamps:
  `setZoneHits`, `setZoneGlow`, `zoneRect` in `scene.ts`; props `zones`, `fill`, `personAction` of the
  admin wrapper). Sprites are palette-indexed strings, no image assets or libraries. The page polls
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

## Fira (2026-11-22)
Brand mascot «Фира» (the lime dot of the logo come alive; cute and soft, not a tree, not a robot), concept stage: three
procedural React Three Fiber variants on one rig (A «Капля», B «Светлячок», C «Пушинка») for the owner to pick. Code:
`src/components/fira/` (`fira.tsx` is the component, lazy `<Canvas>`, SVG fallback without WebGL or under reduced motion),
`src/lib/fira/` (`pose.ts` pure emotion targets and springs, `palette.ts`, `mouth.ts` lip-sync hook), hidden noindex lab
`/[locale]/fira-lab` (not in `localePages` or the sitemap). Props `variant emotion size lookAt mouth theme`; emotions
`idle thinking happy talking point sleep`. Deps pinned exactly: `three`, `@react-three/fiber`, `@react-three/drei` (not yet
imported), `@types/three`. Procedural only, no textures; keep the code under 220 KB (tested). Round two (2026-11-22, after the owner rejected A to C as generic spheres): five new characters D to H on an improved rig, A to C only behind `?all=1` in the lab, references and rules in `docs/fira-references.md`; emotions now also `wave surprised`. Round three (2026-11-22, «взрослая милота», after the owner called D to H childish and identical): five grown-up face systems I to M (`pose3.ts`, `fira-kit3.ts`, `fira-scene3.tsx`, `fira-fallback3.tsx`), the lab default and the `Fira` default `i`, emotions also `listening sorry`, eyes under 12% of the face height (tested), code budget 220 KB. Details, numbers and the glTF and
Remotion plan: `docs/fira.md`. Tests: `tests/fira.test.mjs`.

## Commands
- `npm run dev` (http://localhost:3001), `npm run typecheck`, `npm run lint`, `npm test`,
  `npm run build`.
- `npm run test:e2e` (2026-11-21, Playwright, `tests/e2e/`, config `playwright.config.ts`): runs against `next dev` on port 3417
  (the dev mocks need `NODE_ENV !== 'production'`) with a throwaway `DATA_DIR` (hand-written admin session), a dummy Supabase pair
  and every HQ/Telegram variable empty; Playwright's cached chromium, about 3 minutes. Never part of the deploy workflow; the
  manual `.github/workflows/e2e.yml` (`workflow_dispatch`) runs it. Every button and its status: `docs/button-census.md`
  (keep it current when adding a control).

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
  daily 03:15 `scripts/ops/backup.mjs` (14 dated copies in `shared/backups`, `leads.json` (plus dated copies of `prices.json` and `golive.json`) to the
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
