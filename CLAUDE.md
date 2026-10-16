# Project: Fir Tech (firtech.pro)

Lives in `fir-tech/firtech/`; the workspace rules in `../CLAUDE.md` (git identity, language, safety)
apply here too. Marketing site of the Fir Tech studio: websites, Telegram bots, apps and business
automation for clients in the CIS (mainly Tajikistan) and abroad.

## Stack
- Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, Motion (`motion/react`),
  Phosphor icons (`@phosphor-icons/react`, `/ssr` in server components), zod.
- Fonts: Onest (Cyrillic-first) and JetBrains Mono via `next/font` (`src/app/fonts.ts`).
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

## Commands
- `npm run dev` (http://localhost:3001), `npm run typecheck`, `npm run lint`, `npm test`,
  `npm run build`.

## Infrastructure (planned, not deployed yet)
- Domain `firtech.pro` is not bought yet.
- Hosting: the Vibely DigitalOcean VPS (see `../vibely/CLAUDE.md`), a separate PM2 process on port
  3001 and its own nginx server block with Certbot; same release model as Vibely
  (`output: 'standalone'`, built in CI, never on the VPS). Can move to its own server later.
- No git remote yet.
