# Shell design audit and redesign (2026-11-22, task D)

Design read: the owner's workplace for one operator, dark by default, dense but calm, one lime accent, on
design system v4 (`docs/design-system-v4.md`). References: clean bento, hairlines, restrained motion (motionsites,
navbar.gallery, footer.design). Dials: variance 3, motion 3, density 6 (a work tool: crisp, fast, nothing decorative).
Rules applied: taste (one accent, shape lock, states, no tells), web guidelines (focus, hit areas, one-line controls,
no `transition: all`, labels), Emil (no animation on keyboard actions, strong ease-out, under 300 ms, `:active`
feedback), Apple (response on press, springs that retarget, materials for floating chrome only, size-specific
type, hairlines instead of dividers).

## What is wrong now

| Where | Problem | Rule |
| --- | --- | --- |
| Top bar | Seven controls in a row, each with its own border: logo + mono "Shell" pill, wide search, Office, presence, theme, sign out, menu. Everything shouts equally. | Hierarchy, restraint |
| Top bar | Opaque `bg-bg/95` with a full border, not a material. | Materials for floating chrome |
| Sidebar | Group labels uppercase, digit hints (`1`..`9`) always visible next to every badge, flat `bg-surface-2` active state that jumps. | Eyebrow restraint, motion on state change |
| Page header | `font-brand` (Unbounded) 20 px title, hint beside it, tab strip with a 2 px underline that does not move; Approvals and Chats have no header at all (each page invents its own). | One header pattern, one type scale |
| Filters | Three different pill systems (`Pills`, `Chips`, per-page buttons) where the selected pill is a full lime fill, so a row of filters competes with the real primary action. | One accent used once; lime is for the primary action |
| Controls | `btn`, `btnPrimary`, `inputClass`: ad hoc 1 px `border-line-strong`, `transition-colors` only, no press feedback, native `<select>` with default chrome. | Primitives (`pressable`, shape rule), tactile feedback |
| Empty / loading | Empty = dashed box with a sentence; loading = three flat grey blocks. | Composed states with the next step |
| Toast | `bg-elevated` + `shadow-dialog` box, no motion, sits at `bottom: 5.5rem`. | v4 toast: thick material pill, spring in and out |
| Inbox | Good bones (icon, title, meta, time); but meta uses a middle dot before every department, rows have no rhythm between unread-ish and read, arrows always visible. | Dots rationed, quiet affordance |
| Approvals | Tab pills as lime fills, list card inset in a column of dead space (row max width, left gap), toolbar with mono counter. | Fill the frame, quiet selection |
| Tasks | Filters as three labelled native selects stacked above a composer with a stray delete icon; composer, tabs, search and list each use a different border weight. | One field style |
| Clients | Pipeline board is 5.5 columns wide; lime pill filters; cards have status dots in two colors with no key. | Quiet filters, hairline cards |
| Chats | Message meta set in mono with commas, lime links and lime fills in the thread, scope pills lime. | Mono is for data only |

## What changes

Frame (`hq-shell.tsx`, `section-view.tsx`, `admin-shell.tsx`, `theme-toggle.tsx`, `presence-switch.tsx`)
- Top bar: 52 px `material-thick` with a hairline underneath; logo and a plain "Shell" footnote; search is a quiet
  `fill` field with the shortcut; Office, theme, sign out and the menu become uniform 36 px ghost icon buttons;
  presence stays the only segmented control (lime only on the active "In office" dot, not a fill).
- Sidebar: 232 px, group labels in `text-caption` (no uppercase, no tracking), active row = a sliding pill on
  `spring.snappy` (retargets, no jump), the digit hint appears on hover or focus only, badges quiet.
- Page header: one pattern (`PageHeader`): `text-title-3` title, one-line hint, tabs through the v4 `TabList` on the
  `material-thick` sticky bar. Approvals and Chats use it.
- Toast on `material-thick`, spring in from below, same API and roles.
- Shared kit: `btn`, `btnPrimary`, `btnDanger`, `inputClass` re-skinned on v4 (`pressable`, fill hover, 12 px fields,
  focus ring, native selects restyled); `Pills` and `Chips` become one quiet segmented style (selected = elevated
  pill with hairline, count in tabular figures, no lime fill); `Empty`, `Loading`, `Offline`, confirm dialog on v4
  (centered quiet empty state with an icon and next step, skeleton rows shaped like list rows, `Dialog`-like confirm
  on `material-chrome`).

Screens: Inbox (grouped by time, quiet arrows, hover reveal), Approvals (tabs as `TabList`-style segmented control,
list fills the width, selected rows hairline), Tasks (filters in one row inside the header, composer as one field
with the send button inside), Clients (quiet filters, pipeline columns on `surface` with hairline cards, status
dot has a text label), Chats (scope pills quiet, thread meta in `text-caption` with sans, mono only for ids and times).

Not changed: behaviour, keyboard map (keys 1-9, ⌘K, Esc), `data-*` and aria names used by e2e, copy, data flow.
