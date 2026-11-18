# firtech.pro: «Живая компания», stage A (2026-11-19)

The site has to show that Fir Tech really is a company of AI agents working right now, instead of
saying so. Stage A: design system refresh, a new hero with a live layer, an on-page receptionist chat
and public office data. Stage B rebuilds the other sections; stage C is the audit before the first
client.

Design read: a studio landing page for small-business owners in the CIS, dark technical language
with one lime accent, leaning on native CSS, Motion and canvas. Dials: variance 7, motion 6,
density 4.

## Tokens (`src/app/globals.css`, `@theme`)
| Token | Value | Use |
|---|---|---|
| `--color-bg`, `surface`, `surface-2` | `#0a0d0b`, `#111512`, `#171c18` | page, cards, raised |
| `--color-accent` | `#b5eb6a` (fir lime) | the only accent |
| `--color-pine` | `#1d3a2a` | depth, never a second accent |
| `--color-glass`, `-strong`, `-line`, `-highlight` | 62% / 86% bg, 10% line, 7% white | `.glass` |
| `--radius-card` / `--radius-panel` | 20px / 28px | cards / windows, sheets, chat |
| Shape rule | pills for controls, 12px inputs, 20px cards, 28px panels | everywhere |
| `--font-display` | Geologica (variable, `SHRP` axis) | hero, section titles |
| `--font-sans` / `--font-mono` / `--font-brand` | Onest / JetBrains Mono / Unbounded | text / data / wordmark only |
| `text-display` | clamp(2.55rem → 6.4rem), lh 0.96, tracking -0.048em | hero only |
| `text-title` | clamp(2rem → 3.5rem), lh 1.04 | section titles (stage B) |
| `text-lead` | clamp(1.05rem → 1.3rem), lh 1.55 | line under a title |
| `text-micro` | 11px | badges |
| `py-section`, `gap-gutter` | clamp(5rem → 9rem), clamp(1rem → 1.75rem) | section rhythm |
| `--shadow-glass`, `--shadow-float` | inset highlight + deep soft shadow | glass, floating |
| Easing | `ease-out-expo`, `ease-out-quint`, `ease-in-out-soft` | enter, UI, loops |
| Z-index | 10 inside a component, 30 chat button, 40 header and phone bar, 50 chat panel and menu sheet, 60 grain | |

Components: `.glass` (in `@layer components`, so utilities override it; solid fill without
`backdrop-filter` and under `prefers-reduced-transparency`), `.hairline`, `.kinetic-*`, `.live-dot`
(real state only: lime breathing = HQ answering, amber still = demo), `.hero-aurora` (CSS fallback
background), `.office-pan`, `.skeleton`, `.chat-in`, `.typing-dot`. Focus: 2px lime outline, 3px
offset, on every focusable. Grain: the existing fixed `.grain::after` layer (5%), never on a
scrolling element. Themes: the public site is dark only (owner's choice); the light theme stays for
/admin, untouched. Every animation added here moves only transform and opacity and stops under
`prefers-reduced-motion` (a block at the end of `globals.css`); Motion components use
`useReducedMotion` from `@/lib/use-reduced-motion`.

## Big screens (owner, 2026-11-19)
- `html.site` (public layout only): the root font grows from 16px at 1440 to about 19.5px at 2560
  (`clamp(100%, 0.55rem + 0.42vw, 125%)`), so all rem-based type and spacing scale with the screen.
- The page container: every `max-w-7xl` on the public site resolves to
  `clamp(80rem, 736px + 40vw, 1760px)`: 1312px at 1440, about 1500 at 1920, 1760 at 2560.
- The hero is full bleed: the WebGL field covers the section, the live window spans the viewport
  with gutters (`px-12` from 1920), the copy stays in the container.
- The pixel office scales by integer steps by window width (`officeScale`): 2x, 3x from 1500px,
  4x from 1800px (a 1920 screen), and the building is laid out to fill the width at that scale.
- Bento grids add columns from 1920: directions go from two per row to three (12-column spans 5/4/3,
  shifting per row, no empty cells), extras from 6-column mixed spans to 4 equal columns.
- Checked at 1024, 1280, 1440, 1920, 2560: no horizontal overflow (Playwright,
  `scrollWidth - innerWidth = 0`).

## Patterns borrowed (structure and motion only)
The galleries are client-rendered, so WebFetch only got their category lists (motionsites.ai:
hero, landing, 3D; navbar.gallery: sticky, dropdown, full screen; 60fps.design: counters, pulse,
sheets, typewriter; unsection.com: AI-assistant heroes, feature, pricing; bentogrids.com: title
only). The patterns taken from them:
1. Product as hero (motionsites, unsection AI-assistant heroes): the hero's visual is the real
   product (the live office reading HQ) in a framed window, not an illustration.
2. Kinetic type (motionsites): the headline rises word by word from under a mask, the accent line
   gets one light sweep after the words land. CSS only, so it is the LCP and needs no JS.
3. Sticky bar that condenses (navbar.gallery sticky): a full-width transparent bar becomes a
   floating glass pill after 24px of scroll; a hover highlight slides between links (`layoutId`).
4. Full-screen menu (navbar.gallery full screen): large display-size links with a stagger and an
   arrow per row, the CTA and the chat at the thumb's reach, locale switch at the bottom.
5. Live counters (60fps.design counters): status numbers glide from the old value to the new one on
   each poll instead of jumping; the «обновлено N с назад» age ticks every second.
6. Pulse as state (60fps.design pulse): one breathing dot only where something is live (HQ online,
   the window title); demo mode is still and amber.
7. Sheet and chat transitions (60fps.design bottom sheet, typewriter): the chat panel springs out of
   its corner, messages slide in, three dots hop while the receptionist «types».
8. Bento rhythm on wide screens (bentogrids): more columns with shifting widths rather than
   stretching two columns.

## Hero architecture
- `src/components/hero.tsx` (server): `KineticHeadline` (CSS, LCP), sub and two buttons
  (`HeroIntro`), primary to `/<locale>/builder` (unchanged, `data-cta="hero_builder"`), secondary
  `ChatOpenButton` (opens the chat; without JS a link to `#demo`).
- `live/hero-field.tsx`: CSS gradient from the first paint; WebGL field (`live/field-gl.ts`, one
  fragment shader, half resolution, 30 fps cap, about 1.6 KB gzip) imported on idle only when allowed:
  not under reduced motion, not on `hardwareConcurrency <= 4`, not with Save-Data. Pauses off screen
  (IntersectionObserver) and on hidden tabs. Reacts to the mouse with an eased light.
- `live/hero-live.tsx`: one poll (`use-office-feed.ts`: `/api/office/public` every 15 s, 60 s on a
  hidden tab, keeps the last data on errors) feeds the window and the status line.
- `live/live-office.tsx` (lazy chunk): the shared canvas engine (`src/components/pixel-office/`,
  moved out of `admin/office`), fed through `publicToScene` (reduced data filled back with zeros and
  no tasks). Scene API gained `setMinWidth` (lay the building out for a box) and `setPaused`. Hover
  bubbles: agent name and status, nothing else. Phones: the scene is 560 logical px wide at 2x and
  pans end to end over 38 s (`.office-pan`); reduced motion makes it still and scrollable.
- `live/status-line.tsx` + `src/lib/status-line.ts`: plural forms by `Intl.PluralRules`, copy in
  `hero.live` of both dictionaries.
- Public data: `src/lib/office-public.ts` (pure: reducer, demo company, adapter),
  `src/lib/office-public-hq.ts` (15 s cache, shared in-flight request, demo fallback), route
  `src/app/api/office/public/route.ts`. Production without `HQ_OFFICE_URL` tries the loopback default
  like the admin proxy.

Measured (production build, `/ru`): first-load JS 286.5 KB gzip (17 scripts) against 293.7 KB before
stage A (the hero picker left the first screen). Lazy chunks: office canvas 11.3 KB, WebGL field
1.6 KB, chat panel 3.4 KB gzip. LCP element: the headline line «которые работают 24/7» (a `span` in
the h1), 0.36-0.51 s on the local dev server.

## Чат (contract with HQ)
firtech → HQ: `POST ${HQ_CHAT_URL}` (default `http://127.0.0.1:8787/chat`), header
`x-chat-token: ${HQ_CHAT_TOKEN}` (or `LEAD_INTAKE_TOKEN` when unset), JSON
`{ sessionId: uuid, locale: 'ru'|'en', message: string (1..1000, HTML stripped), page: '/ru' }`.
- The first call of a session is `message: '/start'`: HQ answers with the greeting.
- A button press is `message: '/btn <id>'`.
HQ → firtech: `{ ok: true, reply: string, buttons?: {id, label}[], state: 'chat'|'intake'|'contact'|'done', leadCreated?: boolean }`
or `{ ok: false, error }`. firtech strips HTML from `reply` (max 2000) and labels (max 40), keeps
at most 8 buttons with ids `[A-Za-z0-9_.:-]{1,40}`, maps an unknown state to `chat`. HTTP from
`/api/chat`: 200 answer, 400 invalid body, 429 over 30 messages per IP per hour (or HQ said 429),
502 HQ unavailable (`hq_timeout`, `hq_unreachable`, `hq_error`, `hq_bad_response`,
`hq_unauthorized`); the widget then offers Telegram and the contact form. 20 s timeout.

Widget (`src/components/chat/`): launcher bottom right (above the phone CTA bar), panel loaded on
first open or hover, `role="dialog"` with focus trap, Esc closes and focus returns to the opener,
`role="log"` for messages, typing indicator, chips under the last bot message, Enter sends, client
pace 1 message per 2 s, conversation in `sessionStorage` (`firtech-chat-v1`), goals `chat_open`
and `chat_state` (never the text). Mock (`createMockReceptionist`, copy `chat.mock`): what,
deadline, budget, contact, «Спасибо, вернёмся в течение рабочего дня»; development only, never
creates a lead.

## For stage B
- Rebuild the sections below the hero into 8, each in a different layout family, using
  `font-display` + `text-title` for titles, `text-lead`, `py-section`, `.glass` only where it sits
  over something. Keep ids (`services`, `examples`, `pricing`, `process`, `faq`, `contact`, `demo`).
- Sections are visually one notch behind the hero now: old titles still use `RiseText` with fixed
  sizes; the hero picker (`hero-picker.tsx`) is unused and can move into the pricing or builder block.
- The demo section is minimal; it could show the live intake reaching the Sales head in the office.
- Add a light theme only if the owner asks; the tokens are ready for it.
- Lighthouse on the deployed site (stage C), and a real check of HQ's `/chat` against this contract.

## Каталог конструктора
- Всё содержимое каталога в `src/content/builder-catalog.ts` (RU + EN, типизировано): 56 ниш в 10 категориях, 10 продуктов, названия стилей. Новая ниша = одна строка в `kindCatalog` + id в `kindIds`; страница `/solutions/<id>` появляется сама из пресета и текстов (3 боли, 3 «что получите»).
- Продукты без цены в `pricing.ts` (`content`, `agent`, `aiteam`) показываются «по смете» и никогда не суммируются. Цену задаёт владелец.
- Стиль: оси палитра (16, светлые и тёмные), шрифтовая пара (7), форма, плотность, настроение, плюс 19 готовых образов. Только макет, цену не меняет. Старые поля `s.` по-прежнему читаются.
- Ссылка `?b=`: чанки `k.` (ниша), `p.` (продукты), `y.` (оси стиля).

## Stage B1: products lead the site (2026-11-19)
Owner after stage A: the pixel-office hero looked weak, the rest had not changed, and the products
(the admin bot first) were missing almost everywhere. B1 rebuilds the home page around the seven
products of COMPANY.md and replaces the hero with a motion-heavy one in the spirit of motionsites.

### Hero architecture
- `components/hero/hero.tsx` (server): eyebrow, `KineticHeadline` (CSS word rise, LCP), sub,
  buttons and the three rules as server children of `HeroSequence`, so the text reads without JS.
  `.hero-display`: the headline is as large as the container allows (`min(clamp(..), container *
  0.084)`), three lines.
- `components/hero/hero-sequence.tsx` (client): the section is `lg:h-[250vh]`, its content sticks
  for 150vh. `useScroll` on the section, smoothed with a spring, maps 0.08..0.9 of the track to
  `p` = 0..6. Seven `StageCard`s sit in one 3D stage (perspective 1500px, `preserve-3d`): card i
  takes its place from `o = i - p` (waiting cards behind, higher, smaller, blurred; shown cards fly
  toward the viewer and fade). React re-renders only when the front card changes. The first 0.14
  of the track shrinks the headline to 0.56 (lines drift apart via `--hp`), lifts the stage from
  peeking at the bottom (38vh) to the centre and swaps the sub for the caption (`Продукт 04 из 07`,
  name, benefit, link to the card). Pointer parallax (springs) tilts the stage and moves a light;
  each card gets one light sweep (`.hero-card::after`) when it comes to the front. Seven dots are
  buttons (scroll to that product). WebGL field from stage A stays the backdrop (lazy, same
  fallbacks).
- Phones and tablets (< 1024): no sticky track; headline, sub, buttons, the stage and the caption
  in one column; the front card changes every 3.4 s while visible. Reduced motion: no track (CSS),
  no timer, no tilt; the dots switch products.
- Removed from the hero: the live office window and the status line (`components/live/*` stay; the
  pixel office is admin only).

### Product system
- `src/lib/product-ids.ts` (client-safe ids and anchors), `src/lib/products.ts` (prices and builder
  links). Each home product maps to a builder catalogue product (`builderProduct`: admin→adminbot,
  receptionist→intake, automation, content, miniapp, agent, implementation→aiteam). The builder link
  is `toggleProduct(emptyBuild, id)` encoded, so it carries `p.<id>` and the product's parts.
- Prices: priced catalogue products cost what their parts cost in the calculator (`quote()` over
  pricing.ts): admin $380, receptionist $350, automation $360, Mini App $920. Personal agent:
  `agentPlans` in pricing.ts (Dono $150 + $15/мес, Polly $100 + $10/мес, owner-approved).
  Content and AI implementation say «по смете» until the owner sets prices.
- `components/products/product-demo.tsx`: seven small interfaces in plain markup; `.pd` CSS shows the
  final state at rest and replays the steps (`--d` delays) on `.pd-play`, card hover or focus.
  Shared by the hero stage, the bento and the proof section. Zero JS.

### Section map (what moved where)
| # | Section | Component | Took in |
|---|---|---|---|
| 1 | Hero `#top` | `hero/hero.tsx` | hero trust line |
| 2 | Products `#products` | `products/products-bento.tsx` | directions, services, before/after of pains |
| 3 | Demo `#demo` | `demo-section.tsx` | (restyled) |
| 4 | Proof `#proof` | `proof/proof.tsx` | Dono case, live office counts |
| 5 | Process `#process` | `work-timeline.tsx` | process, trust rules |
| 6 | Prices `#pricing` | `pricing-section.tsx` (`teaser`) | builder teaser, regions payment line |
| 7 | FAQ + contact `#faq` `#contact` | `faq-contact.tsx` | FAQ, contact |
| 8 | Footer | `footer.tsx` | product list, Instagram |
Removed components: compare, pains, region, trust, showcase (concepts stay on service pages),
directions, dono-case, stack-marquee, services, extras, hero-picker, hero-lines. Dictionary
sections `pains`, `stack`, `compare`, `trust`, `dono` are gone; `directions` stays (lead source,
llms.txt), `region` stays (llms.txt, payment line).

### Wide screens and checks
- Bento: 12 columns from lg (7+5, 4+4+4, 6+6), from 1920 four across (6+3+3, 3+3+3+3).
- Process: sticky horizontal track on lg, the section is as tall as the track is wide.
- Playwright (production build): no horizontal overflow at 390, 1024, 1280, 1440, 1920, 2560;
  LCP at 1440 is the headline line «которые работают 24/7».
- First-load JS for `/ru`: 284.6 KB gzip (15 scripts) against 286.4 KB before B1: the hero sequence
  and demos cost less than the removed office window, marquee and showcase.

### 404
`components/not-found/not-found-view.tsx`: a floating «404» with a turning ring for the zero, the
receptionist «lost» in a chat bubble, a search over `notFoundText.pages` and quick links
(`notFoundLinks`), a button to the chat. `[locale]/not-found.tsx` inside the locale layout;
`app/global-not-found.tsx` for paths outside /ru and /en (own html, no chat). Known gap: a
two-segment path with an unknown locale (`/xx/yy`) still gets Next's plain 404 because
`[locale]` has `dynamicParams = false`.
