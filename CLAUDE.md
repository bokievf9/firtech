# Project: Fir Tech (firtech.pro)

Lives in `fir-tech/firtech/`; the workspace rules in `../CLAUDE.md` (git identity, language, safety)
apply here too. Marketing site of the Fir Tech studio: websites, Telegram bots, apps and business
automation for clients in the CIS (mainly Tajikistan) and abroad.

## Stack
- Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, Motion (`motion/react`),
  Phosphor icons (`@phosphor-icons/react`, `/ssr` in server components), zod.
- Fonts: Onest (Cyrillic-first) and JetBrains Mono via `next/font` (`src/app/fonts.ts`).
- Brand: wordmark `fir.tech` ("fir" is from the founder's name, not the tree) in Unbounded 700
  with a lime dot (`src/components/logo.tsx`, font in `fonts.ts` and `assets/fonts` for the OG
  image). Avatars and files in `brand/` (`1-fir.png` is the chosen avatar).
- One dark theme, one accent ("fir lime"). Design tokens and shape rules are at the top of
  `src/app/globals.css`; keep to them.

## Structure
- `src/app/[locale]/`: pages for `ru` and `en` (home, `services/[slug]` for websites, bots, apps,
  automation), all statically generated. `src/proxy.ts` sends `/` to the visitor's language.
- `src/content/ru.ts` and `en.ts`: every visible text. `en` is typed against `ru`, so both must keep
  the same shape. No em or en dashes in copy (use a hyphen).
- `src/lib/pricing.ts`: starting prices and calculator prices in USD. **Prices are owner decisions**:
  change them only on the owner's word (current set: low entry, decided 2026-10-16, not yet
  confirmed per format).
- `src/app/api/lead/route.ts`: contact form endpoint, sends the lead to Telegram.
- Home page order: hero, logo marquee, services, extras ("we also do": smaller services from
  `extraSlugs`, no own pages; `extraPrice` reuses a main service's price or holds the owner's
  own price for that extra; owner decisions like the rest), pains (before/after switch), showcase (concepts,
  pinned horizontal pan on lg), compare, trust (the one lime colour block), pricing, process, FAQ,
  contact. Showcase prices come from `estimate()`, so they always match the calculator. Showcase
  items are concepts and must stay labelled as such; never present them as client work, and no
  invented reviews or statistics anywhere (trust numbers are rules from the quote).
- Builder (`/[locale]/builder`, logic in `src/lib/builder.ts`, tested): the visitor combines
  services, options and extras into one quote. Prices come from `pricing.ts`; `bundleDiscount`
  (owner decision: 10% off the one-time total from two parts) and terms are shown per part, never
  summed. The build lives in `?b=` so it can be shared; the lead arrives as service `bundle` with
  the full list and the link.
  Seven full-screen steps (business, goal, parts, features, style, details, summary); the step is in
  `?s=` (1-based) with history entries. The brief (goals, channels, style, details) rides in `?b=`
  as extra chunks (`g.` `c.` `s.` `d.`, base64url `u.`/`w.` for links and the wish); old links
  decode as before. Style only restyles the mockup via CSS variables (`src/lib/builder-style.ts`);
  nothing in the brief changes the price, except website languages: two or more turn on the
  existing `language` option. `leadSummary` (`estimate-doc.ts`) builds the lead text (max 1500).
  The summary also links to `/[locale]/builder/estimate?b=...` (noindex, decoded on the client,
  rows from `estimateDoc` in `src/lib/estimate-doc.ts`): an A4 estimate saved as PDF via the print
  dialog. Site chrome carries `.print-hidden`; print rules are at the end of `globals.css`.
- Service pages (`services/[slug]`): hero with the service's live miniature, included, formats
  (`ServiceVariants`; "Estimate" picks the format in the calculator via `pickInCalculator`), steps
  (`Process` with `serviceDetails.<slug>.steps`), concepts (`ServiceConcepts`, labelled as
  concepts), pricing, FAQ, contact, other services.
- Solutions (`/[locale]/solutions`, `/[locale]/solutions/[kind]`, kinds in `src/lib/solutions.ts` =
  builder `businessKinds` without `other`): niche pages for search built on `presets[kind]`
  (price from `quote()`, CTA opens the builder with that preset, mockup `BuilderPreview` labelled
  as a concept). Changing a preset changes its page.
- Blog (`/[locale]/blog`): articles are typed data in `src/content/blog/` (one file each, ru + en).
  Only `published: true` reaches production and the sitemap; drafts show in `next dev` with a
  "Черновик" badge. Publish = set `published: true` and the date. Article prices come from
  `src/content/blog/prices.ts`; tests fail on hardcoded prices or long dashes.
- Privacy (`/[locale]/privacy`, texts in `privacy`): a template pending a lawyer's review, linked
  from the form consent (`[brackets]` mark the link) and the footer. Update it with a new date
  whenever form fields, storage or analytics change.
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
- Env (in `.env.local`, see `.env.example`): `TELEGRAM_BOT_TOKEN` (bot from @BotFather),
  `TELEGRAM_CHAT_ID` (the owner's user id or a group id: send the bot a message, then read
  `chat.id` from `https://api.telegram.org/bot<token>/getUpdates`), `NEXT_PUBLIC_TELEGRAM_USERNAME`
  (public username for the "write in Telegram" link; empty hides it), `NEXT_PUBLIC_SITE_URL`.
- Without the bot env, dev mode logs the lead to the console and production returns 503.
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
  site. Bot `/admin` sends the link. Overview, leads with drawer, calendar, CSV export.
- Echo (`/admin/echo`, nav "Echo"): the owner's control room. Projects, tasks, goals and
  milestones are typed data in `src/content/control.ts` (edit there on the owner's word; progress
  numbers are the owner's estimates). Live: project health (`src/lib/project-health.ts`, each
  `healthUrl` checked from the server, cached 30 s) and lead counts. Hologram on canvas
  (`components/admin/hologram.tsx`, reacts to idle/listening/thinking/speaking and the voice level),
  voice in by the browser's speech recognition (Chrome), voice out by speech synthesis.
  `/api/admin/echo` streams Claude's reply (`@anthropic-ai/sdk`, `claude-opus-5-5`, low effort,
  `fallbacks: "default"`), 40 replies per 10 min per session. The briefing (`src/lib/echo.ts`)
  sends lead counts only, never names, contacts or texts (tested). Needs `ANTHROPIC_API_KEY` in
  `shared/.env.production`; without it the page works and the chat explains how to turn it on.
- Call booking: rules are owner settings in `src/lib/booking.ts` (Asia/Dushanbe, Mon-Fri
  10:00-18:00, 30 min), free slots at `/api/slots`, picked in the form, double booking blocked.

## Commands
- `npm run dev` (http://localhost:3001), `npm run typecheck`, `npm run lint`, `npm test`,
  `npm run build`.

## Infrastructure
- Domain `firtech.pro`: bought 2026-10-16 at Cloudflare (registrar and DNS). Records: `A @` and
  `A www` -> `68.183.177.183`, DNS only (grey cloud), so Certbot can issue the certificate.
- Hosting: the Vibely DigitalOcean VPS (`68.183.177.183`, see `../vibely/CLAUDE.md`), a separate
  PM2 process `firtech` (one fork process, `ecosystem.config.cjs`) on 127.0.0.1:3001 and its own
  nginx site (`infra/nginx/firtech.conf` + snippet, Certbot SSL). Never edit Vibely's nginx files.
- Release model as Vibely: push to `main` -> GitHub Actions (`.github/workflows/deploy.yml`):
  checks, build in CI (`output: 'standalone'`), `scripts/deploy/assemble.sh`, upload to
  `/var/www/firtech/releases/<id>`, `activate.sh` boots it on 3098 first, switches `current`,
  restarts PM2, health-checks `/api/health` and rolls back on failure. The VPS never builds.
- Server layout (user `deploy`): `/var/www/firtech/{current,releases,incoming,shared}`;
  `shared/.env.production` (server secrets, chmod 600) and `shared/data` (lead store, survives
  deploys). One-time setup as root: `scripts/deploy/server-setup.sh`, then Certbot.
- Live since 2026-10-16 (first release deployed by hand from a clean checkout, same scripts). Until
  the GitHub repo exists, deploy with `scripts/deploy/manual.sh` (clean `git archive` build with the public vars,
  `assemble.sh`, upload to `incoming/`, `activate.sh` as `deploy`) (key `~/.ssh/id_ed25519_firtech`,
  deploy user only; root access was removed after setup). Telegram webhook is set.
- Cron (user `deploy`, UTC): `*/5` `scripts/ops/watch.mjs` (public + local health, SSL expiry;
  Telegram on down/up changes only; cannot report a dead server, an external monitor would) and
  daily 03:15 `scripts/ops/backup.mjs` (14 dated copies in `shared/backups`, `leads.json` to the
  owner's Telegram when it changed). Log: `shared/ops.log`.
- GitHub: environment `production` secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`,
  `VPS_KNOWN_HOSTS`; repository variables `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_TELEGRAM_USERNAME`,
  `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, optional `NEXT_PUBLIC_YM_ID`.
