# Pre-first-client checklist (stage C, 2026-11-19)

Audit pass on top of the rebuilt site (stages A, B1, B2). Branch `feat/site-c`. Checks run: typecheck,
lint, 232 tests, production build, a local crawl of 147 URLs (both locales, products, services, all 55
solutions, blog, builder, estimate, terms, privacy, 404), Playwright measurements.

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Copy audit RU + EN | done | No long dashes, no "not X but Y", no "no X, no Y, no Z", no invented numbers or reviews; removed dead dictionary block `directions` (old showcase, with proposed prices). Rewrote the two "concept, not client work" lines. Locked by `tests/site-c.test.mjs` (dashes, tells, dollar amounts, removed sections). `en` is still typed against `ru`. |
| 2 | Prices from one source | done | Service-page titles/descriptions carry `{price}` filled from `startingPrice` (`src/lib/seo.ts`); OG card and JSON-LD `priceRange` come from pricing.ts; `llms.txt` is built from `productPrice` and `startingPrice`. **Disagreement found and removed:** `llms.txt` published the old proposed `directionPrices` ($250 admin, $300 receptionist, $150 automation, $60 content, ...) while the site showed $380, $350, $360 and "по смете"; those numbers are deleted. Unpriced products (content, implementation) say "по смете" / "Custom quote" in home, builder, estimate, lead and llms.txt. Left: `src/content/ig-schedule.json` post 5 title says "сайт от $150" (Instagram plan, owner's text, equals `startingPrice.websites` today) and the FAQ "несколько долларов в месяц за сервер" (third-party cost, no number). |
| 3 | Telegram buttons | done | `telegramUrl` falls back to `@firtech_bot` when `NEXT_PUBLIC_TELEGRAM_USERNAME` is unset or empty (CI var may be empty); the client bot link falls back the same way; every t.me link in the code is tested to be the bot; the form success text names @firtech_bot; follow-the-lead button has `data-place="lead-success"`. `scripts/deploy/manual.sh` also defaulted to the destroyed droplet IP: now the new server. |
| 4 | SEO and sharing | done | All meta descriptions are 120-160 chars (home RU 206 and EN 220 were the HQ SEO agent's finding; also fixed privacy, builder, solutions, services, 2 posts, derived solution descriptions), tested for home, builder, solutions, blog, privacy, terms, 4 services, 55 solutions, posts. Titles <= 70. Sitemap listed only 5 of 55 solutions: fixed, plus `/terms`, tested. OG card now says "AI agents, Telegram bots and websites" with the lowest price from pricing.ts and the new wordmark font. Canonical + hreflang (ru, en) present on all 143 indexable pages; `/builder/estimate` and 404 are noindex (checked in the built HTML). JSON-LD: ProfessionalService with OfferCatalog of the 7 products and FAQPage on home; Service + Offers + FAQPage on service pages; Service on solutions (parses as valid JSON). `robots.txt` disallows /api/ and /admin. |
| 5 | Legal | done, needs owner | Privacy updated (19 Nov 2026): chat (texts to HQ, session id only in tab sessionStorage), client bot, cookies section, AI model providers in "who we share with", Metrika. New `/[locale]/terms` skeleton with `[заполнит владелец]` / `[to be filled in by the owner]` placeholders, linked from the footer legal row. Both pages carry "Черновик до проверки юристом". |
| 6 | Forms and flows | done | Contact form to /api/lead to Telegram + HQ `/lead` covered by existing tests; honeypot and 5 per 10 min limit pinned by a test; booking slots endpoint answers; chat error and rate-limit states exist in the panel; estimate PDF tests pass. Not testable here: real Telegram/HQ delivery (needs production env). |
| 7 | Performance and a11y | done | Local production build, headless Chromium, no throttling. `/ru` desktop 1440: LCP 164 ms, CLS 0.017; mobile 390: LCP 76 ms, CLS 0.001; reduced motion: LCP 112 / 68 ms, CLS 0.012 / 0.001. Fonts use `next/font` with `display: swap` (Next adds size-adjusted fallbacks). One h1, no heading level jumps on home and sample pages, no images without dimensions, no unlabeled icon buttons. Contrast (WCAG): lime text on bg 14.0, muted 7.8, faint 5.1 (all AA); ink on lime 13.4. Added a skip link ("К содержимому"). Keyboard reaches the chat button (about 99 tab stops, it is last in the DOM), Enter opens, input is focused, Esc closes and focus returns to the button. Reduced motion is honoured by the hero (no scroll track, static stage). Real-device and throttled-network LCP is later. |
| 8 | Manifest and icons | done | Added `manifest.webmanifest` (name, theme/background `#0a0d0b`, icons); icon 512, apple-icon 180, favicon.ico exist (new `fir.` mark); `themeColor` in the layout viewport. Missing and later: a 192 px and maskable icon for installable-PWA polish. |
| 9 | Analytics | needs owner | Goals exist in code (list below). Create them in Metrika. |
| 10 | Broken links | done | Crawl of 147 URLs: no 404s, no redirect loops; `/` redirects 307 to the visitor's locale. RU and EN routes are symmetric (sitemap alternates for each page). |

## Metrika goals to create (type "JavaScript event", identifier = name)
`lead_sent`, `telegram_click` (param `place`), `cta_click` (param `place`: header, menu, footer,
mobile_bar, hero_builder, pricing_builder, article_builder, chat_fab, `product_<id>`, `chat_<source>`),
`estimate_handoff`, `builder_step` (param `step`), `builder_sent`, `estimate_pdf`,
`builder_link_copied`, `audit_sent` (free audit ordered), `extra_discuss`, `direction_discuss` (card "Обсудить"), `chat_open`
(param `source`: fab, hero, demo, hash), `chat_state` (param `state`: intake, contact, done).
Minimum for the first client: `lead_sent`, `telegram_click`, `chat_open`, `chat_state`, `builder_sent`.

## Owner's to-do
1. Metrika: create the goals above in counter 113665084.
2. Terms page (rewritten 2026-11-19 on the owner's word: no legal entity, crypto or online wallet, 50% prepayment, two rounds of revisions, 7-day acceptance, liability capped at the paid amount): filled the same day: contractor «Fir Tech», contact `hello@firtech.pro` (the mailbox must exist: Cloudflare Email Routing to the owner's Gmail), governing law of Tajikistan. No placeholders left; payment wallets are not public and go into each estimate.
3. Lawyer: review privacy and terms (both say "черновик до проверки юристом"); confirm the AI model providers wording and the 1-year retention.
4. Prices (owner 2026-11-19: below the RU/CIS freelance market, extras about half): done in pricing.ts. Content on autopilot = `contentPlans` ($90 setup + $60 a month), AI in your company = `automation.assistant.training`. Products now: admin bot $290, intake $220, automation $230, Mini App $660, AI implementation $550, site $150, bot $100, app $800.
5. Search Console and Yandex Webmaster: add firtech.pro, submit `https://firtech.pro/sitemap.xml`, check hreflang report.
6. GitHub variable `NEXT_PUBLIC_TELEGRAM_USERNAME`: set to `firtech_bot` on 2026-11-19 (was the owner's personal username).
7. Ask HQ's SEO agent to re-check the meta descriptions on /ru and /en after deploy.
8. Optional: a 192 px maskable app icon; real-device Lighthouse after deploy.
