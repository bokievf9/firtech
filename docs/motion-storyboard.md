# Motion storyboard (T0, 2026-11-27)

Status: proposal for the owner's approval. No product code is written before it is approved.
Builders T1-T4 implement this document without asking questions; where a value is a choice, it is stated.

Scope: the public site `src/app/[locale]/**` (31 routes). `/admin/**` is out of scope. "Scene" is an
internal word only: the site UI and copy never say «ролик», «трейлер», «эпизод», «тайм-код», «сцена N»
(RU) or trailer, episode, timecode, "scene N" (EN). The site is a premium motion site, not a film.
Proposal reference (sections 03-06): https://claude.ai/artifact/Vvy3sFqUTbg7Y7iKuTzzrV.

Existing pieces this builds on (do not duplicate): `src/lib/motion.ts` (springs, `fade`, `reveal`,
`staggerStep`, `materialize`), easing tokens in `globals.css` (`--ease-out-expo`, `--ease-out-quint`,
`--ease-in-out-soft`, `--ease-drawer`), `src/lib/film.ts` (home scenes, `activeScene`, `ACTIVE_LINE`, `FILM_MIN_WIDTH`,
`companionKind`), `components/film/*` (FilmCue, FilmSceneBlock, FilmOverlay with the WebGL Fira), `header.tsx`,
`scroll-progress.tsx`, `reveal.tsx`, `use-reduced-motion.ts`, `motion-provider.tsx`.

## 1. Principles and motion tokens

Principles (apple-design, emil-design-eng, animate):
1. Motion explains where you are and what changed; if it explains nothing, it is cut (gate in section 5).
2. Only `transform`, `opacity` and (rarely) `filter`/`clip-path` move. Never width, height, top, left.
3. All text is in server HTML from the first paint. Motion reveals it, never creates it. No text in canvas.
4. Entrances ease out, exits are shorter than entrances (about 60%), nothing UI-level exceeds 700 ms except a scrubbed scene.
5. Everything interruptible: springs for gesture/UI, CSS transitions for state, no keyframes that cannot be reversed mid-flight.
6. One pass: reveals play once per visit of a page (`once`), scrubbed things follow the scroll both ways.
7. Hover only behind `@media (hover: hover)`; touch gets pressed states.
8. Scroll is never hijacked: no Lenis, no wheel capture, no snap on the page body. Native scroll, native anchors, find-in-page and Back keep working.
9. Reduced motion: plain stacked sections, no parallax/scrub/pin, transitions become a 150 ms fade, the rail still navigates.
10. Sound is off by default and never the only carrier of information.

Tokens: extend, do not fork. Add to `src/lib/motion.ts` and `globals.css` (T1):

| Token | Value | Use |
|---|---|---|
| `spring.ui` (exists) | bounce 0, 0.4 s | rail marker, palette, header morph |
| `spring.snappy` (exists) | bounce 0, 0.28 s | toggles, pressed states, rail ticks |
| `spring.sheet` (exists) | bounce 0.12, 0.42 s | palette open, mobile sheet |
| `spring.momentum` (exists) | bounce 0.22, 0.45 s | only after a flick/drag (rail drag on phone) |
| NEW `spring.flight` | bounce 0.15, 0.9 s | Fira travelling (value already in `film-overlay.tsx` as `flight`; move it here and import) |
| `reveal` (exists) | 0.6 s, out-expo | section reveals, translate 24 px max |
| `staggerStep` (exists) | 0.05 s | lists, max 6 children staggered, rest appear together |
| NEW `dur.micro / dur.base / dur.scene` | 160 / 320 / 700 ms | CSS transitions (header, rail labels, scene reveals) |
| NEW `dur.page` | out 380 ms, in 480 ms | page transition (section 4) |
| NEW `dur.cold` | 1800 ms total | cold open (section 6) |
| Easings (exist) | `--ease-out-expo`, `--ease-out-quint`, `--ease-in-out-soft`, `--ease-drawer` | entrances, state changes, scrubbed timelines, sheets |

CSS vars to add in `globals.css` `:root`: `--dur-micro: 160ms; --dur-base: 320ms; --dur-scene: 700ms; --dur-page-out: 380ms; --dur-page-in: 480ms;`
and the scroll-driven helper `--scene-range: entry 10% cover 45%`. No new easing curves.

## 2. Hybrid header

Stays: logo, the seven links, theme switch, language segmented control, CTA. Existing CTA text is
«Собрать проект» / "Build a project" (`dict.nav.cta`); the owner's note says «Связаться». Keep the existing
copy unless the owner says otherwise (open question 1). Layout does not change: the bar keeps `h-14`, geometry never jumps.

States (all measured on the existing 24 px scroll threshold, `useMotionValueEvent`, boolean flip only):

| State | Trigger | What moves | Duration / curve |
|---|---|---|---|
| top | scrollY <= 24 | clear bar; rail marker hidden on desktop except Fira at top tick; current-section label hidden | none |
| scrolled | scrollY > 24 | `material-thick` opacity 0->1 (exists, 300 ms out-quint); logo wordmark stays; the nav links shrink via `transform: scale(.96)` on the link group? NO: no shrink (geometry stays). Instead the **current section label** fades in (see below) | label: 320 ms out-quint, translateY 6 px -> 0 |
| scrolling down fast | velocity > 1200 px/s for 150 ms | bar stays; nothing hides (hiding the CTA hurts conversion). Rail marker gets `data-fast` which stretches the tail 0->8 px | 160 ms |
| palette open | ⌘K / Ctrl+K / "/" (not inside input) | header material forced on, links dim to 40% opacity, palette sheet materializes below the bar (`materialize`, `spring.sheet`); focus trapped | open 420 ms spring, close 200 ms `fade` |
| phone | < 1024 px | links live in the existing top Sheet; a 2 px progress line under the bar (see section 3) | sheet unchanged |

Current-section label (morph): a small mono text (`font-mono text-[11px]`) between the nav and the right group on
lg+, e.g. «Команда» / "Team". It sits in the header's free space and is `aria-hidden` (the rail carries the a11y name).
On section change the old label slides up 6 px and fades (160 ms), the new one slides in from below 6 px (320 ms out-quint). Crossfade through a
keyed `motion.span` with `mode="popLayout"`. Hidden below 1280 px (the bar is crowded at 1024, see header comment).
Not shown on routes without sections (rail has < 2 items).

Keyboard: `Tab` order unchanged (logo, links, controls, CTA). `⌘K` / `Ctrl+K` and `/` open the palette; `Esc` closes and returns focus to the opener;
`[` and `]` jump to the previous/next section (only when no input is focused and the palette is closed); each shows a visible focus ring.
A tiny hint "⌘K" chip appears on the rail's header (desktop, hover-capable only) and in the mobile menu as a "Sections" button.

Files: `header.tsx` (label, palette trigger), new `components/nav/section-label.tsx`, `components/nav/palette.tsx`.

## 3. Section rail and palette

### 3.1 Discovery (one source, no per-page lists in components)
A pure module `src/lib/sections.ts`:
- `sectionsFor(pathname, dict)` returns `{ id, label }[]`.
- Home (`/[locale]`): the eight film scenes from `filmScenes`, anchor = first section's `sectionAnchor` (`top`, `pains`, `demo`, `products`, `office`, `solutions`, `process`, `faq`). Labels from a new `dict.rail.home.<sceneId>` (below).
- Other pages: at runtime (client, after hydration) collect `main h2[id], main [data-rail]` in DOM order. The server renders the rail from a static per-route list when it can (product, service, solution pages know their section ids), so the rail is in the first HTML; the runtime query only reconciles. Pages with fewer than 3 sections: no rail, palette still lists the sections plus global routes.
- Authors mark a section with `data-rail="Label RU|Label EN"` or an `h2` with `id`; the label is the `h2` text trimmed to 24 chars unless `data-rail-label` is present. T1 adds ids to the `h2`s that lack them (services price already has `service-price`, how-we-work has `stages`).
- Active section: IntersectionObserver with `rootMargin: '-38% 0px -62% 0px'` (equivalent to `ACTIVE_LINE` 0.62 of film.ts), reusing `activeScene` for home so the WebGL Fira and the rail never disagree.

Home labels (RU / EN; no film words):

| id | RU | EN |
|---|---|---|
| hello | Старт | Start |
| pains | Знакомо? | Sound familiar? |
| demo | Попробуйте | Try it |
| team | Команда | Team |
| office | Офис | Office |
| solutions | Решения | Solutions |
| process | Этапы и цены | Process and pricing |
| final | Вопросы | Questions |

### 3.2 Desktop rail (>= 1024 px, pointer or keyboard)
- Thin vertical rail fixed to the right edge, 24 px from the edge, vertically centred, height min(60vh, 8 x 28 px). One 1 px line (`--line`) with one tick per section (6 px dot, 10 px when active).
- The **Fira marker** (flat Fira, 28 px, `fira-flat`, emotion of the active section from `filmScenes[].emotion` on home, `happy` elsewhere) sits on the active tick and travels between ticks with `spring.ui` (layoutId `rail-fira`). Scroll progress inside the section moves her 0-100% of the way to the next tick (translateY from `scrollYProgress`, CSS `animation-timeline: scroll()` where supported, else `useScroll`).
- Hover/focus on the rail expands it to 160 px wide in 200 ms (transform: scaleX on a pill background; labels fade in at 100 ms delay). Labels only visible in the expanded state; ticks have `aria-label` always.
- Hidden while the palette is open (it is replaced by the palette list), and on routes with no sections.
- It never overlaps content: right gutter is >= 56 px at lg; at 1024-1279 px the rail shows ticks only (no expand label; the label morph is in the header at xl+).
- On home at lg the WebGL Fira keeps her own travel (film overlay); the rail marker is a small flat Fira and stays visible (two Firas is acceptable: the big one is the scene, the small one is the map). If the owner finds this noisy: hide the rail marker while the big Fira is in shot (open question 3).

### 3.3 Phone (< 1024 px)
- A 2 px progress line directly under the header bar (replaces the current top-edge `ScrollProgress` which stays only as the line's fill): full-width track, fill `scaleX` from `scrollYProgress` of the **current section group**? No: whole-page progress, to be predictable.
- Ticks as 1 px gaps cut in the line at section boundaries (a CSS mask; no per-frame JS). Fira marker 18 px rides the leading edge of the fill (translateX = progress). Tap on the line opens the section sheet (the palette in bottom-sheet form, `Sheet side="bottom"`).
- The sheet lists the sections with the active one marked; tapping scrolls smoothly (`scrollIntoView({behavior:'smooth'})`; instant under reduced motion) and closes.
- No horizontal swipe gestures on the page body (conflicts with browser Back swipe).

### 3.4 Palette (⌘K / "/")
- One input + list. Groups: "Sections of this page" (from 3.1), "Pages" (products, services, solutions, ai-team, how-we-work, builder, blog, compare, referral, security), "Actions" (Build a project, Ask an agent, Switch language, Toggle theme, Toggle sound).
- Fuzzy filter by simple `includes` on lowercased label + RU/EN aliases; no library (cmdk adds ~12 KB; hand-roll, under 2 KB). Arrow keys move, Enter goes, `Esc` closes. Results keep to 8 visible rows.
- Pages in the list are real `<a href>` (prefetch on hover); sections use `href="#id"` so no-JS and crawlers see links. The list is rendered client-only on open, but the rail ticks are server HTML links (`<a href="#demo">`), so the sections are reachable without JS.
- Copy: placeholder «Куда перейти?» / "Where to?"; empty state «Ничего не нашли» / "Nothing found"; group titles «Эта страница», «Разделы сайта», «Действия» / "This page", "Pages", "Actions".

### 3.5 A11y
- Rail: `<nav aria-label="Разделы страницы" / "Page sections">` containing an `<ol>` of `<a href="#id">`; active link has `aria-current="location"`; focus ring `outline-2 outline-accent-text offset-2`; the rail is in the tab order after the header, before `main`? No: after `main` content would be unreachable by keyboard quickly, so it goes right after the header and has a skip link «Перейти к разделам» that is not needed (it is 1 stop). The nav is a single tab stop; arrow Up/Down inside it moves between ticks (roving tabindex).
- The Fira marker and the progress line are `aria-hidden`; changes are announced through `aria-current` only (no live region chatter).
- Palette: `role="dialog" aria-modal="true"`, combobox pattern for input + listbox, `aria-activedescendant`, focus trap (reuse `ui/sheet.tsx`), restore focus on close.
- Target size: phone line tap area 44 px tall via padding, visual stays 2 px.
- Colour: ticks and line use `--line`/`accent-text` tokens (contrast already tested in `tests/site-theme.test.mjs`).

Files: new `src/lib/sections.ts`, `components/nav/section-rail.tsx`, `components/nav/progress-line.tsx`, `components/nav/palette.tsx`; mounted once in `src/app/[locale]/layout.tsx` next to `Header`. `scroll-progress.tsx` is folded into `progress-line.tsx`.

## 4. Page transition map

Mechanism (vercel-react-view-transitions, references/nextjs.md): Next 16 App Router supports `<ViewTransition>` with no flag;
do NOT add `experimental.viewTransition` or canary React. Do check `grep -r transitionTypes node_modules/next/dist/` (needs 16.2.0+; `package.json` has `^16.4.6`).
- `Link` gets `transitionTypes={['nav-forward']}` or `['nav-back']` where the direction is known; otherwise the type is chosen in a small client `NavTypes` helper that compares route depth (see below). Browser Back/Forward: `popstate` -> `nav-back` via `addTransitionType` in a `pageswap`-style handler is not available in same-document VT, so Back/Forward use the default type `nav-pop` (short crossfade only).
- Layout: `<ViewTransition default="none">` wrapper around `{children}` in `[locale]/layout.tsx` with `enter/exit` mapped by type: `{ 'nav-forward': 'slide-forward', 'nav-back': 'slide-back', 'nav-pop': 'page-fade', default: 'none' }`. The header, rail, footer, chat launcher live in the layout outside the wrapper and do not animate (they persist).
- CSS in `globals.css`, names `::view-transition-old/new(.slide-forward)` etc.: forward = old page translateX(-24px)+opacity 0 (`dur.page-out`, `--ease-in-out-soft`), new page translateX(32px)->0 +opacity (`dur.page-in`, `--ease-out-expo`). back mirrors the direction. Distance is small on purpose (premium, not a carousel).
- Suspense fallbacks: a bare `<ViewTransition>` around fallback with `exit="page-fade"` so loading states do not pop.
- Fira shared element: the first-viewport Fira (home: `FilmCue` mark of the hello scene; inner pages: the companion mark) carries `<ViewTransition name="fira" share="fira-morph">`; the rail marker is excluded (`view-transition-name: none`) so it does not collide. On lg home the WebGL Fira cannot take part in a DOM transition: the film overlay fades to opacity 0 over 120 ms at navigation start (listen to `onNavigate`/pathname change in `film-overlay.tsx`), the flat Fira of the hero mark is the VT participant, and the new page's mark animates from the old position/size (`::view-transition-group(fira)` 480 ms `--ease-out-expo`). If a page has no Fira mark, Fira simply is absent from the pair (the CSS group fades).
- Locale switch (`/ru/x` -> `/en/x`): `nav-pop` (crossfade), no slide; the `lang` attribute changes in the new tree.
- Reduced motion: every type resolves to `page-fade` at 150 ms linear-out, no slide, no Fira morph (`@media (prefers-reduced-motion: reduce) { ::view-transition-group(*) { animation-duration: 150ms } ... }` plus `transform: none`).
- Unsupported browsers (Firefox without same-document VT where unavailable): React falls back to instant swap; nothing else to do. Never block navigation on a transition (skip if `document.hidden`).
- Direction rule (`src/lib/nav-direction.ts`, pure, tested): rank = depth in the map below; deeper = forward, shallower = back, equal rank = forward.

| Route group | Rank | Forward into it | Back out of it | Fira |
|---|---|---|---|---|
| Home `/[locale]` | 0 | n/a | slide-back | shared element: hero mark |
| Catalog: `/solutions`, `/ai-team`, `/blog`, `/builder`, `/compare`, `/how-we-work`, `/referral`, `/security`, `/status`, `/audit`, `/pay-how`, `/services/[slug]` | 1 | slide-forward | slide-back | shared element: companion mark |
| Detail: `/products/[id]`, `/solutions/[kind]`, `/ai-team/[id]`, `/ai-team/agent/[id]`, `/blog/[slug]`, `/builder/estimate` | 2 | slide-forward | slide-back | shared element |
| Quiet/legal: `/terms`, `/privacy` | 1 | page-fade | page-fade | none |
| Cabinet and account: `/cabinet`, `/cabinet/login`, `/cabinet/reset`, `/cabinet/auth/confirm`, `/cabinet/unsubscribe`, `/cabinet/health` | 1 | page-fade 200 ms | page-fade | none (auth screens stay calm) |
| Pay and demo: `/pay/[number]`, `/demo/[publicId]` | 2 | page-fade | page-fade | none |
| `/fira-lab`, `[...rest]` (404) | 1 | page-fade | page-fade | 404: Fira stays in the 404 art, no shared element |

Same-rank sibling jumps (for example product -> product) use `slide-forward` with half distance (16 px).
Anchor links on the same page are not transitions: smooth scroll (instant under reduced motion).

## 5. Page-by-page storyboard

### 5.1 Scene template catalogue (reusable, 9 templates)
Each template is one component or one CSS class set in `src/components/motion/`, with one trigger and one reduced-motion fallback.
Trigger kinds: `view` = CSS `animation-timeline: view()` inside `@supports (animation-timeline: view())`, else `motion` `whileInView` once; `once` = IntersectionObserver once; `load` = on first paint of the page.

| # | Name | What it does | Trigger | Duration / curve | Reduced motion |
|---|---|---|---|---|---|
| T-A | **title reveal** | h1/h2 words rise 0.6em + fade, stagger 40 ms, max 8 words (text already in HTML; initial state applied by CSS class on the server, so no flash and no layout shift) | load (h1), once (h2) | 700 ms out-expo | text visible, no motion |
| T-B | **section rise** | the existing `Reveal`: block fades up 24 px | once, amount 0.2 | 600 ms out-expo | `initial={false}` |
| T-C | **card stack** | cards of a grid enter staggered 50 ms (max 6), then hover lift on `@media (hover:hover)` | once | 600 ms out-expo | no stagger, visible |
| T-D | **blueprint draw** | SVG/CSS lines draw (stroke-dashoffset) from 0 to 1 as the block crosses the viewport, nodes pop after the line passes them (diagrams: brain, org chart, flow) | view (scrubbed over `entry 10% cover 45%`) | scrubbed, line `--ease-in-out-soft` | drawn state, fully visible |
| T-E | **before/after wipe** | `clip-path: inset()` reveals the "after" over the "before"; handle position bound to scroll within the section (scrub) or driven by a tap on phone | view (scrubbed) | scrubbed | both states stacked, labelled |
| T-F | **phone chat** | a phone mock with messages arriving one by one (existing `chat-in` 320 ms, typing dots), runs once when 60% visible | once, amount 0.6 | 320 ms per bubble, 700 ms gap | all messages visible |
| T-G | **counter** | the existing `count-up.tsx`: numbers count up when visible (only for real numbers, see rejected list) | once | 900 ms out-expo | final value |
| T-H | **parallax drift** | one background layer moves at 0.85x on `translate3d` (max 40 px total), never behind text that must be read | view (scrubbed) | scrubbed | static |
| T-I | **pin and step** | a sticky block (desktop only, `lg+`) swaps 3-4 states as the user scrolls through a 200-300vh track (CSS `position: sticky`; step = `animation-timeline: view()` opacity/translate); the products "seven in a row" track already exists in the hero and is re-cut in section 6 | view | scrubbed, 4 states max | stacked sections, no pin |
| T-J | **tour dot** | a Fira corner reaction: on section entry the flat Fira's emotion changes (blink/nod, `fira-nod` 260 ms), never moves the layout | once | 260 ms | static |

Fixed rules: no template runs on more than 12 elements at once; a scrubbed template is `view()` CSS with a `useScroll` fallback (`motion`, `transform` motion values, no React state per frame); `animation-timeline` is declared AFTER the `animation` shorthand; every scrubbed block is wrapped in `@media (prefers-reduced-motion: no-preference)`; no image sequences and no WebGL on phones.

Rejected as a class (find-animation-opportunities gate: only animate where motion carries meaning, frequency is low, and it survives repeated use):
- Per-section animated backgrounds on legal, blog, pay, cabinet, status, audit forms: used repeatedly or read at length, motion adds nothing.
- Scroll-jacking horizontal galleries (conflict with native scroll, Back swipe and find-in-page).
- Typewriter effects on body copy (slows reading, hurts SEO/screen readers); only the hero/demos already do this.
- Counters on prices (a price must never animate through wrong numbers; prices are editable live, owner rule).
- Scroll-linked blur/scale on big surfaces (jank on low-end Android in CIS).
- Cursor trails and custom cursors (also already has `magnetic.tsx`; no more).
- Lenis or any smooth-scroll lib. Image sequences. Auto-playing video.

### 5.2 Per-route tables
Columns: section | template | trigger | duration | reduced motion. `quiet` = rail + page transition + T-A on h1 only.
Home sections are specified in section 6. Product page blocks (`product-sections/*`) are listed once for all seven products
because the order differs per product (`product-pages.ts`) but the block-to-template mapping is fixed.

**`/[locale]` (home)**: see section 6.

**`/[locale]/products/[id]`** (7 products; blocks map, applies to every id):

| Block | Template | Trigger | Duration | Reduced |
|---|---|---|---|---|
| hero (result h1, price card, CTAs) | T-A on h1; price card T-B | load | 700 ms | static |
| demo (chat / booking / assistant) | none, the demo is the motion (rejected: extra reveal, double motion) | n/a | n/a | n/a |
| day, flow | T-I pin and step on lg+ (hours or steps swap), T-B on phone | view | scrubbed | stacked |
| capabilities, skills, scenarios | T-C card stack | once | 600 ms | static |
| week | T-F phone chat (feed posts arrive) | once | 320 ms each | all visible |
| roles, structure, brain, cday, rollout | T-D blueprint draw | view | scrubbed | drawn |
| beforeAfter, routines | T-E wipe | view | scrubbed | stacked |
| phones | T-F | once | 320 ms each | all visible |
| facts, knows, scope, included, offer, objections, questions | T-B | once | 600 ms | static |
| price, plans, cplan | T-B only; numbers never animate (rejected: counter) | once | 600 ms | static |
| channels | T-C | once | 600 ms | static |
| pilot, trust, teamgets | T-B + T-J | once | 600 ms | static |
| pult, myday, cdemo, knowledge, start, first, readiness | T-B | once | 600 ms | static |
Rail labels come from each block's `h2` ids (T1 adds `id` to every block `h2` = block id). Fira marker emotion: `happy`.

**`/[locale]/services/[slug]`** (websites, bots, apps, automation):

| Section | Template | Trigger | Duration | Reduced |
|---|---|---|---|---|
| hero | T-A, T-B | load | 700 ms | static |
| concepts / variants / visuals (`service-concepts`, `service-variants`, `service-visuals`) | T-C | once | 600 ms | static |
| process (`<Process>`) | T-D along the stage line | view | scrubbed | drawn |
| `#service-price` | T-B, no counters | once | 600 ms | static |
| `#pricing` block | T-B | once | 600 ms | static |

**`/[locale]/solutions`**: hero T-A; niche cards T-C; "your business is not listed" T-B.
**`/[locale]/solutions/[kind]`** (cafe, salon, shop, delivery, services + extra kinds): hero (promise headline) T-A; parts (`solution-parts`) T-C; `#solution-stages` stage table T-D (line draws between stages); data note quiet; others list T-C.
**`/[locale]/ai-team`**: hero T-A + T-J; `#levels` (ladder) T-D (the three-level ladder draws up, agent -> autopilot -> department); `#teams` departments T-C; `#agents` T-C; channels row T-B; `#proof` T-G for live office counts only (real numbers), T-B for the rest.
**`/[locale]/ai-team/[id]`** (department): hero T-A; `#agents` T-C; together block T-D (agents connected by lines); channels, integrations, languages T-B; final CTA T-B.
**`/[locale]/ai-team/agent/[id]`**: hero T-A; what/trust two columns T-B; handoff (`AgentHandoff`) T-D; channels/needs/works-with T-B; integrations T-B.
**`/[locale]/how-we-work`**: hero T-A; `#stages` T-D (stage line + payment dots: the main storyline of this page, scrubbed on lg, once on phone); acceptance, payment, guarantee, dislike, tools, approvals T-B; CTA T-B. Rail has 7 ticks.
**`/[locale]/builder`**: quiet, plus step transitions inside the builder stay as they are (`builder-motion.tsx`); do not add scroll motion to a form (rejected). Rail hidden (the builder has its own step nav, `builder-nav.tsx`); palette remains.
**`/[locale]/builder/estimate`**: quiet.
**`/[locale]/compare`**: hero T-A; `#contrast` table T-E (row-by-row "usual way" vs "agent" wipe); rest T-B.
**`/[locale]/audit`**: hero T-A; points list T-C; form quiet (rejected: motion on form fields beyond focus states).
**`/[locale]/referral`**: hero T-A; steps T-D (3 steps linked by a line); rules T-B; link box quiet.
**`/[locale]/security`**: hero T-A; sections T-B; quiet otherwise (trust copy, nothing flashy).
**`/[locale]/status`**: quiet (live data; only the existing status dot blink).
**`/[locale]/pay-how`**: hero T-A; step sections T-B.
**`/[locale]/blog`**: hero T-A; article cards T-C (first 6 only). **`/[locale]/blog/[slug]`**: quiet (reading page): reading-progress comes from the new progress line; h1 T-A only.
**`/[locale]/demo/[publicId]`**: quiet.
**`/[locale]/fira-lab`**: no change (lab page, excluded from the rail).
**`/[locale]/terms`, `/privacy`**: quiet (legal). Rail built from `h2`s so long documents are navigable.
**`/[locale]/pay/[number]`**: quiet, no rail (a payment page must stay calm).
**`/[locale]/cabinet`, `/cabinet/login`, `/cabinet/reset`, `/cabinet/auth/confirm`, `/cabinet/unsubscribe`, `/cabinet/health`**: quiet; cabinet keeps its own tabs and tour (`CabinetTour`), no rail there; login/reset/confirm/unsubscribe/health are single-card screens with page-fade only.
**`/[locale]/[...rest]`** (not found): keeps its existing art; T-A on the h1; no rail.

Rejected candidates (global list, all with reason): hero parallax on inner pages (heavy for no gain); animated gradient meshes behind product pages (battery); count-up on prices and plans (prices are live-editable, wrong intermediate numbers); WebGL on any inner page (phones, SEO); text-scramble effects on headings (reading, a11y); pinned scroll on the builder and cabinet (forms, repeated use); confetti or sound on form submit (nothing celebrates a lead before it is checked).

## 6. Home: re-cut of the eight scenes, and the cold open

Current: eight film scenes (`filmScenes`), `FILM_MIN_WIDTH` 1024 for the travelling WebGL Fira, `ACTIVE_LINE` 0.62, a `camera` glow table. The re-cut keeps ids, order and Fira emotions
(tests in `tests/film.test.mjs` stay valid) and tightens the motion. "Beat" is internal.

| Scene (rail label) | Section(s) | Motion sequence | Template | Trigger / duration | Notes |
|---|---|---|---|---|---|
| hello (Старт / Start) | hero | cold open on first visit (below); then headline T-A, orbit of the seven products as today; on lg the 250vh track still brings products forward one by one (T-I, 7 steps) | T-A, T-I | load; scrubbed | text in HTML from first paint, LCP element is the h1 (never the WebGL canvas) |
| pains (Знакомо? / Sound familiar?) | pains | three situations enter as T-C; each one flips to "what the agent does" via T-E wipe inside the card on tap/focus (not scroll) | T-C, T-E | once; 320 ms | Fira `listening` |
| demo (Попробуйте / Try it) | demo | section T-B; the demo itself is the motion; tabs keep their sliding pill (`spring.snappy`) | T-B | once | Fira `point`, headphones |
| team (Команда / Team) | products, agents | bento cards T-C (seven, first six staggered); the ladder `#levels` T-D (agent -> autopilot -> department line draws up); agents row T-C | T-C, T-D | once; scrubbed | Fira `happy` |
| office (Офис / Office) | office | the pixel office plays when 60% visible; live counts T-G | existing + T-G | once | no new motion |
| solutions (Решения / Solutions) | solutions | six niche cards T-C; "All solutions" button T-B | T-C | once | Fira `thinking` |
| process (Этапы и цены / Process and pricing) | process, pricing | work timeline T-D (stage line scrubbed, dots light as passed); pricing teaser T-B, no counters | T-D, T-B | scrubbed | Fira `talking` |
| final (Вопросы / Questions) | faq + finale | FAQ items T-B; finale CTA «Собрать проект» / «Спросить агента» enters T-B, then Fira `wave` T-J | T-B, T-J | once | the page ends on the two actions |

Transitions between scenes: none are cinematic. The "camera" glow (`camera` table in `film-overlay.tsx`) keeps drifting but moves to CSS custom properties updated once per scene change
(not per frame) with `transition: transform 900ms var(--ease-in-out-soft)`; WebGL Fira flights use `spring.flight`. Gap between scenes: the existing section spacing, no extra dead scroll (remove any `min-h-screen` filler that is only there for the film; each scene is as tall as its content).

Cold open (home, first visit only):
- Gate: `localStorage['fir-open-seen']`, read/write inside try/catch; if storage throws, skip the cold open (no repeat flashes). Only on `/ru` and `/en` home, only when `scrollY === 0` and no hash in the URL, never when `prefers-reduced-motion`, `Save-Data` or the tab is hidden.
- Duration <= 1.8 s total (`dur.cold`), hard cap 2 s: 0-400 ms the wordmark `fir.tech` draws in centre on the page background; 400-1100 ms the lime dot pulses once and Fira's flat mark rises to her hero position (shared element with the hero mark, so the open ends exactly in place); 1100-1800 ms the overlay (`clip-path` circle from the dot) opens to reveal the page. Overlay is `position: fixed; inset: 0; z-index` above the page, `pointer-events: none` after 300 ms so it never blocks clicks.
- Skippable: click, tap, any key, or scroll cancels it at once (overlay fades 120 ms). A visible "Skip" is unnecessary (every input skips), but the overlay has `aria-hidden="true"`.
- LCP/CLS: the hero h1 and the page are in the HTML and painted from the first frame beneath an overlay that is CSS-only (class on `<html>` set by the existing `ThemeInit`-style inline script before paint, only when the key is missing). The overlay is `opacity`/`clip-path` only, adds no layout. Because the overlay covers the LCP element, LCP is still measured on the h1 paint (Chrome counts content under an opaque overlay as painted); budget check in section 8, and if T1 measures LCP regression > 100 ms, shorten to a 900 ms version without the wordmark draw.
- Sound: the cold open cue plays only if the visitor already turned sound on in this browser (it cannot be on at first visit, so it is silent for first-time users; see section 7).

## 7. Sound

One toggle, off by default, persisted in `localStorage['fir-sound']` (try/catch). Toggle: a speaker icon button in the header's right group on lg+ (`aria-pressed`, label «Звук» / "Sound") and as an item in the palette ("Actions") and the mobile menu. Turning it on plays the "on" cue once (this is the user gesture that unlocks audio). No autoplay anywhere; on iOS the context resumes on first tap.
Format: one small sprite (`public/sound/ui.m4a` + `ui.webm`, under 60 KB total) loaded only after the toggle is first turned on (lazy, so zero cost for everyone else). Master gain -18 LUFS-ish, low (target peak -12 dBFS), no music, no ambience.

| Cue | Trigger | Character | Length |
|---|---|---|---|
| on | sound toggled on | soft two-note rise | 250 ms |
| rail tick | active section changes (rail/progress line) | very quiet wooden tick, pitch rises 1 semitone per section, rate-limited to 1 per 120 ms and never while a transition plays | 40 ms |
| page transition | forward / back navigation start | low airy swish, direction by pitch (forward up, back down) | 280 ms |
| palette | palette opens / closes | glassy pop / reverse pop | 120 ms |
| CTA | primary CTA press (`data-cta`) | warm click with a short tail | 150 ms |
| cold open | cold open reaches the dot pulse (only if sound already on) | single resonant tone, lime-dot pulse | 600 ms |

No sound for: hover, form fields, errors, scroll, the demo chat (it has its own life), payment pages (`/pay/**`, `/cabinet/**`: sound disabled by route).
Reduced motion does not change sound; `prefers-reduced-data` / `Save-Data` blocks loading the sprite.
Cue sources and licences follow the `real-sound` skill (real licensed recordings, credits file `public/sound/CREDITS.md`); T4 sources them, T1-T3 call a stub `playCue(name)` that is a no-op until the sprite exists.

## 8. Performance budget

Global: mobile LCP <= 2.5 s (4G, mid-range Android), CLS 0, INP <= 200 ms. Verified per wave on production-like build (`next build && next start`) with Lighthouse mobile
and `web-vitals` on 3 pages: `/ru`, `/ru/products/company`, `/ru/how-we-work`; plus a Playwright check at 390x844 that no horizontal scroll appears.

| Rule | Value |
|---|---|
| JS added per wave (gzip, first-load of any page) | T1 <= 12 KB (rail, palette, progress line, header label); T2 <= 6 KB (view transitions CSS+types, tiny helper); T3 <= 10 KB (templates; scrubbed ones are CSS); T4 <= 8 KB (cold open + sound, sprite lazy) |
| Total new first-load JS across T1-T4 | <= 36 KB gz; anything larger lazy-loads after `requestIdleCallback` |
| Long tasks | no task > 50 ms introduced by motion code on a Moto G-class profile (CPU 4x throttle) |
| Scrubbed motion | CSS `animation-timeline` first; `useScroll` fallback writes motion values only (no React state per frame) |
| Layers | at most 6 elements with `will-change` at once; it is set only while animating |
| Phones | no WebGL, no pinned tracks (T-I off), no image sequences, no parallax (T-H off); reveals and rail only |
| Images/video | no new media in motion; Fira marker is SVG |
| CLS | initial states set by server classes; every revealed block keeps its box (transform/opacity only) |
| INP | rail/palette handlers < 16 ms; palette list rendered on open, max 40 rows |

Fallbacks: `@supports not (animation-timeline: view())` -> `motion` `whileInView` once; Firefox gets that path, the rail still scrubs through `useScroll`. No `Lenis`.

## 9. Waves, files, tests, acceptance

### T1: rail, palette, hybrid header (largest user-visible change, safest to ship first)
- Add: `src/lib/sections.ts`, `components/nav/{section-rail,progress-line,palette,section-label}.tsx`, `dict.rail`, `dict.palette` in `ru.ts` and `en.ts`, tokens in `motion.ts` and `globals.css` (section 1).
- Touch: `header.tsx`, `[locale]/layout.tsx`, `scroll-progress.tsx` (merged), `film-overlay.tsx` (import `spring.flight`), ids on `h2`s in the pages of section 5.2 that lack them.
- Tests: `tests/sections.test.mjs` (home rail = `filmScenes`; every route in 5.2 resolves to a list or none; labels exist in RU and EN; no forbidden film words in any new string), `tests/rail-a11y.test.mjs` (nav landmark, `aria-current`, roving tabindex rendered), palette keyboard test (Playwright: ⌘K, "/", Esc, focus return), reduced-motion test.
- Acceptance: header geometry unchanged (no CLS); rail works with JS disabled as anchors; `/` does not open the palette inside inputs; Lighthouse mobile LCP not worse than baseline +50 ms; JS <= 12 KB gz; tsc, lint, tests, build pass.

### T2: page transitions
- Add: `src/lib/nav-direction.ts`, `components/nav-types.tsx`, `<ViewTransition>` wrapper in `[locale]/layout.tsx`, view-transition CSS in `globals.css`, `Link` types on header, footer, cards that are primary navigation, Fira `name="fira"` on the hero/companion marks.
- Touch: `film-overlay.tsx` (fade on navigation start), `film-cue.tsx`, companion mark component, `header.tsx` Link props.
- Tests: `tests/nav-direction.test.mjs` (rank table of section 4), Playwright: forward and Back each produce no console error and the page content is present after 600 ms; reduced-motion: no `slide-*` class in effect; locale switch uses fade.
- Acceptance: header/rail/footer do not flash on navigation; Back restores scroll; Fira morphs hero -> next page mark on Chrome; Firefox navigates instantly without errors; INP unchanged; JS <= 6 KB.

### T3: scene templates across the site
- Add: `components/motion/{title-reveal,section-rise,card-stack,blueprint,wipe,phone-chat,pin-step,parallax}.tsx` (+ `counter` reuses `count-up.tsx`, `section-rise` reuses `reveal.tsx`), `.scene-*` CSS classes, `tests/motion-catalogue.test.mjs`.
- Touch in order of traffic: home sections (section 6), product blocks (`product-sections/*`), services, solutions, ai-team, how-we-work, compare, referral. Quiet routes untouched.
- Tests: catalogue test asserts each template has `@media (prefers-reduced-motion: reduce)` handling and a `@supports` fallback; no template animates a layout property (grep for `width|height|top|left` in `.scene-*` keyframes); Playwright screenshots at 390 px and 1440 px of each template with motion disabled prove the text is visible.
- Acceptance: all text present in server HTML (curl check of 5 routes); no phone pinning; CLS 0 on all five checked pages; reduced motion shows plain sections; JS <= 10 KB.

### T4: cold open and sound
- Add: `components/home/cold-open.tsx` + the pre-paint class script in the existing theme-init pattern, `src/lib/sound.ts` (`playCue`, toggle state), `components/sound-toggle.tsx`, `public/sound/*` sprite and `CREDITS.md`, `dict.sound`.
- Touch: `header.tsx` (toggle), palette actions, rail/progress-line (tick cue), `nav-types.tsx` (page cue), CTA components (`data-cta` hook, one delegated listener).
- Tests: `tests/cold-open.test.mjs` (gate logic pure: first visit, key set, storage throws, hash present, reduced motion), Playwright: first visit shows the overlay and it is gone by 2 s, second visit does not, click skips; sound defaults to off, sprite not requested until toggled; `/pay/**` and `/cabinet/**` never play.
- Acceptance: LCP delta <= +100 ms mobile vs baseline (else the 900 ms variant); no audio before a gesture; JS <= 8 KB, sprite <= 60 KB loaded lazily; all four checks (tsc, lint, tests, build) pass.

## Open questions for the owner
1. Header CTA text: keep «Собрать проект» / "Build a project" (current), or change to «Связаться» / "Contact"? The builder is the real conversion path, so the recommendation is to keep it.
2. Sound toggle in the header on desktop (visible, recommended) or only in the palette and menu (calmer)?
3. On the home at lg there are two Firas (the big WebGL one in the scenes and the small rail marker). Keep both (recommended: big = the scene, small = the map), or hide the small one while the big one is in shot?
