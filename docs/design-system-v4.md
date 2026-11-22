# firtech.pro design system v4 (2026-11-22): Apple rules and glass

Owner review 2026-11-22 (front v4): the whole site moves to Apple's rules (skill `apple-design`) with glass
materials where they help (header, cards, sheets, chat, builder panels), hairlines, optical type sizes,
spring motion, reduced motion respected. This file is the contract every builder follows. It extends
`docs/site-design-notes.md` (stage A/B notes) and wins where they differ.

Design read: a studio landing page for small-business owners and founders in the CIS, light-first with a
dark twin, a calm Apple-like language (materials, hairlines, springs) around one lime accent, built on
Tailwind 4 tokens, native CSS materials and Motion. Dials: variance 6, motion 5, density 4 (was 7/6/4: less
decoration, more hierarchy).

## Audit (before v4)

What worked and stays:
- Token architecture: light values in `@theme static`, dark in `:root[data-theme='dark']`, same names, the
  init script, the contrast test. One accent (lime as a fill, `accent-text` as text). Shape rule.
- Server-first sections, Motion only in leaves, `useReducedMotion` from `lib/use-reduced-motion`.
- The film structure of the home page, Fira's marks, the floating chat.

What was off, by Apple's rules and the taste/guideline audits:
| Before | After | Why |
| --- | --- | --- |
| One `.glass` (74% white / 62% dark) on everything | Four materials: thin, regular, thick, chrome | Material weight encodes hierarchy; one weight flattened it |
| Dark glass 62%: muted text over a lime button under the header was 2.4:1 | Alphas computed per theme, tested over six backdrops | Glass is only as readable as what shows through |
| Header animated `max-width, height, margin, padding` on scroll | Stable bar, the material fades in behind it (opacity) | Animate transform and opacity only; nothing jumps |
| Buttons: `transition 300ms` on transform, `active:scale-[0.98]` | `.pressable`: press 80 ms to 0.97, release 160 ms | Feedback starts on pointer-down and must be instant |
| Mono uppercase eyebrow over every section (9 on the home) | Plain footnote eyebrow, 3 on the home (hero, demo, prices) | Eyebrow on every section is a template tell |
| Fixed `text-sm/text-lg` + ad hoc `tracking-[...]` | Text styles with tracking and leading per size | Tracking is size-specific (optical sizing) |
| 1px borders everywhere | `border-hairline`: 0.5px on retina | Apple hairlines; lighter separation |
| Section headers split (title left, lead floating right) | Stacked `SectionHeader` | One message per section |
| Process as four equal cards | A timeline (hairline through the step icons) | Different layout family, order reads first |
| Niche cards with catalogue emoji | Phosphor glyph on a pine well | One icon family |
| Signed-out demo: scripted chat + a disabled input | Lock plate: «Войдите, чтобы попробовать на своих данных», Войти and Регистрация по коду, lines labelled as a scripted example | The demo is for signed-in clients and must look locked |
| Hand-built tablist, accordion with fixed-duration ease, chat panel with ad hoc spring | Shared springs (`lib/motion.ts`), `TabList`, chat on `spring.sheet` with materialize | One motion vocabulary, interruptible |

## Tokens (`src/app/globals.css`)

Names kept where they existed. New tokens are additions; nothing was renamed.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `bg`, `surface`, `surface-2`, `surface-3`, `elevated` | unchanged | unchanged | page and solid layers |
| `fill`, `fill-strong` (new) | fg at 5% / 9% | fg at 6% / 11% | quiet controls: segmented track, icon buttons, ghost hover |
| `material-thin` (new) | white 60% | `#101411` 60% | chips over imagery, toast-sized plates |
| `material-regular` (new) = `glass` | white 72% | 82% | cards that float, FAB, film lines |
| `material-thick` (new) | white 82% | 88% | scrolled header, demo frame, hero card, office sketch, toasts |
| `material-chrome` (new) = `glass-strong` | white 86% | 90% | sheets, dialogs, chat panel |
| `glass-line`, `glass-highlight` | unchanged | unchanged | material edge and top highlight |
| `radius-tile` (new) | 14px | | media well inside a card (20 - 6 inset = concentric) |
| `radius-card`, `radius-panel` | 20px, 28px | | cards; windows, sheets, chat |
| `spacing-card` (new, `p-card`) | clamp(1.25rem .. 1.75rem) | | card padding |
| `spacing-sheet` (new, `p-sheet`) | clamp(1.25rem .. 2rem) | | sheet and dialog padding |
| `spacing-section`, `spacing-gutter` | unchanged | | section rhythm, grid gaps |
| `ease-drawer` (new) | cubic-bezier(.32,.72,0,1) | | CSS-only sheets and scrims |
| `--shadow-card`, `-card-hover`, `-float`, `-dialog`, `-glass` | unchanged | | elevation 1, lift, 2, 3, material |

Shape rule (unchanged, now enforced by the primitives): controls are pills, inputs 12px, media wells 14px,
cards 20px, windows and sheets 28px.

## Type (text styles with optical sizes)

Onest (text) and Geologica (display) have no `opsz` axis, so the optical size is the table itself: each
step carries its own leading and tracking, tight and negative at size, open and slightly positive when
small. `font-optical-sizing: auto` is on for any face that gains the axis later. Never add a fixed
`tracking-*` on top of a step.

| Utility | Size | Leading | Tracking | Use |
| --- | --- | --- | --- | --- |
| `text-display` | clamp 2.55 .. 6.4rem | 0.96 | -0.048em | hero headline only |
| `text-title` | clamp 2 .. 3.5rem | 1.04 | -0.035em | section titles (h2) |
| `text-title-2` (new) | clamp 1.5 .. 2.125rem | 1.12 | -0.026em | big card titles, menu links |
| `text-title-3` (new) | clamp 1.25 .. 1.5rem | 1.2 | -0.02em | card titles (h3) |
| `text-lead` | clamp 1.05 .. 1.3rem | 1.55 | 0 | line under a section title |
| `text-headline` (new) | 17px | 1.35 | -0.012em | emphasized body, list titles |
| `text-body` (new) | 17px | 1.55 | -0.006em | body copy |
| `text-callout` (new) | 15px | 1.45 | -0.003em | secondary copy, nav links, chips |
| `text-footnote` (new) | 13px | 1.4 | +0.002em | captions, eyebrows, footer |
| `text-caption` (new) | 12px | 1.35 | +0.01em | badges, labels |

Hierarchy comes from weight + size + leading together. Mono (`font-mono`) stays for data only (times,
prices, codes), not for labels. h1/h3 balance, paragraphs `text-wrap: pretty`.

## Стекло (materials)

A web approximation of Apple's materials (not Apple's Liquid Glass, which is Apple-platform only): a
tinted translucent fill, a real backdrop blur with saturation, a hairline edge and a top highlight.

| Class | Blur | Saturation | Fill light / dark | Text it may carry | Where |
| --- | --- | --- | --- | --- | --- |
| `material-thin` | 12px | 180% | 60% / 60% | `fg` only | small plates over imagery |
| `material-regular` (`.glass`) | 20px | 180% | 72% / 82% | `fg`, `muted`, `accent-text` | floating cards, FAB, Fira's lines, glass buttons |
| `material-thick` | 28px | 180% | 82% / 88% | all text tokens | scrolled header, demo frames, hero card, toasts, mobile CTA bar |
| `material-chrome` | 32px | 180% | 86% / 90% | all text tokens | sheets, dialogs, chat panel (adds the dialog shadow) |

When a surface is glass: only when it floats over moving or varied content (header over the page, the
chat over a section, a hero card over the field, a builder panel over the preview). A card that sits in
the flow on the plain page is solid (`Card`), not glass. Never stack a light material on another; put
colour (lime, department hues) on a solid layer inside the glass, never as the glass tint. Bigger
surfaces read thicker. Glass surfaces arrive as a material (blur and scale together, `materialize` in
`lib/motion.ts`), not as a plain fade.

Fallbacks (all in `globals.css`, tested):
- no `backdrop-filter`: the fill becomes `glass-strong` (chrome strength), so text stays AA;
- `prefers-reduced-transparency: reduce`: solid `elevated`, no blur;
- `prefers-contrast: more`: solid `elevated`, `line-strong` edge, no blur.

Contrast tests (`tests/site-theme.test.mjs`): every material, in both themes, is composited over `bg`,
`surface`, `surface-2`, `pine`, the lime `accent` fill and «busy» content (fg over bg at 35% coverage, a
blurred block of text); the text tokens it may carry must reach 4.5:1 on each. The old names must equal
`material-regular` and `material-chrome`. Changing an alpha means running this test.

## Hairlines, elevation, scroll edges

- `border border-hairline` (all sides), `border-t border-t-hairline`, `border-b border-b-hairline`: 0.5px on 2x screens, 1px elsewhere; unlayered so they win over the width utilities; pair with a colour (`border-line`, `border-glass-line`).
- Elevation: flat (hairline only) < `shadow-card` (raised card, selected pill) < `shadow-float` < `shadow-dialog`.
  Light shadows are green-tinted, never black; dark theme cards have no shadow (contrast does the work).
- `.scroll-edge` (+ `data-edge="on"`): a soft fade under a full-width floating bar instead of a divider.

## Движение (motion)

Springs (`src/lib/motion.ts`), Apple's damping/response mapped to Motion's `bounce`/`duration`:
| Token | bounce / duration | Use |
| --- | --- | --- |
| `spring.ui` | 0 / 0.4 | default: layout, sliding tab and nav pill, accordions, dialogs |
| `spring.snappy` | 0 / 0.28 | small things: toasts, nav hover, toggles |
| `spring.sheet` | 0.12 / 0.42 | sheets, chat panel, mobile CTA bar |
| `spring.momentum` | 0.22 / 0.45 | only after a gesture with velocity (flick, drag release) |
| `fade` | 0.2 s ease-out | reduced motion and big-surface exits |
| `reveal`, `staggerStep` | 0.6 s expo-out, 0.05 s | once-only scroll reveals |

Rules: springs start from the on-screen value and keep velocity on retarget (interruptible; never lock
input during a transition). Enter and exit along the same path; popovers originate from their trigger,
modals stay centred. Press feedback on pointer-down (`.pressable`), hover lifts only with
`(hover: hover) and (pointer: fine)` (`.lift`). Animate `transform`, `opacity` (and `filter` for
materialize) only; never `transition: all`. Keyboard-triggered actions do not animate. Under reduced
motion: cross-fades, no slides, no overshoot (`useReducedMotion` from `@/lib/use-reduced-motion`,
`MotionProvider` makes the rest instant).

## Primitives (`src/components/ui/`, barrel `@/components/ui`)

| Component | File | Notes |
| --- | --- | --- |
| `Button`, `ButtonLink`, `IconButton` | `button.tsx` | variants `primary secondary ghost glass`, sizes `sm md lg`; `buttonClass(v, s)` and `buttonStyles.*` in `@/lib/cn` for links and old call sites |
| `Card`, `GlassCard`, `CardMedia` | `card.tsx` | tones `plain raised accent`, `interactive` = press + lift; `GlassCard thickness` |
| `Sheet`, `Dialog` | `sheet.tsx` | portal, chrome material over a scrim, focus trap, Esc, scroll lock, focus return; sides `right bottom top` |
| `TabList`, `tabId`, `tabPanelId` | `tabs.tsx` | segmented track, sliding pill (`spring.ui`), arrows/Home/End, `itemProps` for data attributes |
| `Input`, `Textarea`, `fieldClass` | `input.tsx` | label above, hint, error below with `aria-invalid`/`aria-describedby` |
| `Badge` | `badge.tsx` | tones `neutral accent solid danger warn glass` |
| `toast()`, `Toaster` | `toast.tsx` | Toaster is mounted in the locale layout; short status only, errors that need a decision stay inline (`ErrorNote`) |
| `Skeleton*`, `Spinner`, `Pending`, `ErrorNote` | existing | unchanged API |
| `Section`, `SectionHeader` | `section.tsx` | container + rhythm + anchor offset; stacked header, optional eyebrow (ration: one per three sections) |

Chrome built on them: `header.tsx` (stable bar, thick material on scroll, mobile menu = `Sheet side="top"`),
`footer.tsx`, `mobile-cta.tsx`, `chat/chat-panel.tsx` (chrome material), `theme-switch.tsx`. The home page is the
showcase: hero, pains (before/after cards), demo (TabList, thick frames, lock plate), products bento, office
sketch (thick), solutions (glyph cards), process (timeline), prices, FAQ.

## For other builders

- Import from `@/components/ui` (or the file); use `buttonClass()` / `buttonStyles` for links; never re-create
  a button, tab bar, sheet or field by hand.
- Section headers through `SectionHeader`; text through the text styles; borders `border-hairline`.
- A new glass surface picks one of the four materials and only the text tokens its row allows; run
  `node --import ./tests/ts-resolve.mjs --test tests/site-theme.test.mjs`.
- Motion values from `@/lib/motion`; no new ad hoc springs or 300 ms+ UI transitions.
- No raw `text-white`/`bg-black` (tested), prices only from pricing helpers, no em dashes.
