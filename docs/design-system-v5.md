# firtech.pro design system v5 (2026-11-25): glass, orbits, brand lime

Owner picked artboard F («гааззз»): glass capsule nav, Manrope light + black headline, Fira in a glowing
portal with orbit rings and floating product orbs, on our brand colours. `docs/design-system-v4.md` stays
valid except where this file changes it. Mode: redesign, preserve: IA, routes, nav labels, copy, analytics
ids, i18n keys do not change; only the visual language does. Dials: variance 7, motion 6, density 3.

## What changed vs v4

| v4 | v5 |
| --- | --- |
| Onest (text), Geologica (display), Unbounded (wordmark) | Manrope for all three (`--font-sans`, `--font-display`, `--font-brand`); JetBrains Mono stays |
| Header: floating bar, hover pill, 7 text links | Glass capsule `.nav-capsule` with `.nav-tab` pills; the active page has `aria-current="page"` |
| Hero size up to 6.4rem, tracking -0.048em | `text-display` clamp(2.5rem, 5.8vw, 5rem), `.h-display` light + black pattern |
| `text-title` up to 3.5rem | `text-title` clamp(2rem, 3.6vw, 3rem); `text-title-3` 24px; `text-lead` 17-19px |
| Buttons md 48px, lg 56px, plain lime | lg 56px/16px/700, md 44px/15px/700, lime button glows, `glass` variant is white 60% + border |
| Wordmark Unbounded 700, 20px | `fir.tech` Manrope 800, 20px (22px from md), tracking -0.03em |

Brand colours do not change: `accent` (#c6ff3d), `accent-text`, `accent-strong`, `accent-ink`, `pine`, `bg`,
`surface`, `fg`, `muted` and their dark twins are as in v4. Shape rule unchanged: pills for controls, cards
20px, panels 28px.

## Tokens added (`globals.css`, light / dark)

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `material-capsule` | white 55% | `#101411` 88% | nav capsule; carries fg, muted, accent-text (tested) |
| `material-orb` | white 62% | `#101411` 82% | orbs and the glass button; carries fg, accent-text (tested) |
| `capsule-line` | white 95% | fg 12% | 1px edge of capsule, orb, glass button |
| `tab-on`, `tab-hover`, `orb-hover` | #fff, white 85%, #fff | #1e2420, fg 8%, #1e2420 | active tab, hover fills |
| `ring-white` | white 70% | fg 10% | white ring of the portal |
| `bubble`, `bubble-ink`, `bubble-name` | #0e120f, #fff, #c6ff3d | #1e2420, #edf2ea, #b5eb6a | `.bubble-ink` (AA tested) |

Plain variables (`:root` and the dark block): `--glow-a/-b` (lime glow strength 70/25% light, 30/10% dark),
`--glow-green`, `--orbit-a`, `--orbit-dashed-a`, `--shadow-lime`, `--portal-halo`, `--shadow-capsule`,
`--shadow-orb`, `--shadow-tab`.

## Primitives

CSS classes in `globals.css` (`@layer components`), React wrappers in `src/components/ui` (all server-safe,
import from `@/components/ui`):

- `.h-display` (+ `.h-display-section` for h2): weight 300, tracking -0.035em, line-height 1.02; `<strong>`
  or `<b>` inside is weight 800. `<h1 className="h-display">Ваш ИИ.<br /><strong>Для жизни и для дела.</strong></h1>`.
  Hero size follows `text-display` (40px on a phone, 80px max), section h2 `text-title` (32-48px).
- `GlowBlob` (`.glow-blob`, `.glow-blob-green`): absolute radial glow, blur 40px, `aria-hidden`. Props:
  `tone` (`lime` | `green`), `className`, `style` (size and position). Put it in a `relative overflow-hidden`
  section.
- `OrbitRing` (`.orbit-ring`, `.orbit-ring-dashed`): thin circle, `dashed`, `className`, `style`. Never more
  than two per screen.
- `Orb` (`.orb`, `.orb-dot`): `label`, `href`, `delay` (seconds, stagger by about 0.8), `className`. 46px glass
  pill (40px on a phone) with the gradient dot, floats 7s ±12px. Position it from the parent.
- `FiraPortal` (`.fira-portal`): `alt` (required), `pose` (`wave` = `/fira/fira-3d-wave.jpg`, `glasses` =
  `/fira/fira-glasses.jpg`), `size` (`md` 360px desktop / 200px phone, `sm` 140px for inner page heroes),
  `priority` (home hero). White ring, thin green ring, soft halo, floats.
- `.bubble-ink` + `.bubble-name`: dark speech bubble, radius 16 16 16 4, 14px, the name in lime.
- `.nav-capsule` / `.nav-tab` (header only so far), `.btn-glow` / `.btn-glass` (used by `buttonClass`).
- `.v5-rise` (`--i` = stagger index, 60 ms steps): hero entry, fade and rise 24px.
- Buttons: `buttonClass(variant, size)`, `<Button>`, `<ButtonLink>` from `ui/button.tsx`; variants `primary`,
  `secondary`, `ghost`, `glass`; sizes `sm`, `md` 44px, `lg` 56px; `.pressable` kept.

## Rules

- Motion: entry fade+rise on hero children, float on orbs and the portal, nothing else autoplays. All of it
  stops under `prefers-reduced-motion` (CSS media query in `globals.css`, `useReducedMotion` in JS).
- Reduced transparency and more contrast turn capsule, orbs and the glass button solid (`elevated`); the same
  without `backdrop-filter` support.
- No uppercase mono eyebrows except at most one per three sections. At least two cards of any grid carry a
  visual (Fira accessory, lime glow, pine well); sections alternate `bg` and `surface`.
- Fira on inner page heroes: `FiraPortal size="sm" pose="glasses"`.
- Dark twin for every new token; glass alphas are composited over six backdrops in
  `tests/site-theme.test.mjs`.

## Header and footer

Header: logo left, capsule centre (same seven links as before; the first anchor is lit on the home page),
theme and locale switches and the lime CTA right; below `lg` the glass round menu button opens the same
full-screen sheet. A thick-material band fades in behind the bar after 24px of scroll (opacity only).
Footer: surface background, a lime glow and one orbit ring behind the CTA, the same link columns, hairlines,
giant Manrope 800 wordmark.

## Known leftovers

`src/app/[locale]/opengraph-image.tsx` still draws the wordmark with `assets/fonts/Unbounded-Bold.ttf`.
