// T1 a11y contract of the rail, the palette and the progress line (docs/motion-storyboard.md §3.5), read from
// the component source (the rendered HTML is checked in tests/e2e/nav-rail.spec.ts).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (p) => readFileSync(p, 'utf8')
const rail = read('src/components/nav/section-rail.tsx')
const palette = read('src/components/nav/palette.tsx')
const line = read('src/components/nav/progress-line.tsx')
const header = read('src/components/header.tsx')
const layout = read('src/app/[locale]/layout.tsx')

test('rail: a nav landmark with a label, an ordered list of real anchors, aria-current, roving tabindex', () => {
  assert.match(rail, /<nav\s[\s\S]*aria-label=\{rail\.label\}/)
  assert.match(rail, /<ol\b/)
  assert.match(rail, /href=\{`#\$\{item\.id\}`\}/)
  assert.match(rail, /aria-current=\{i === active \? 'location' : undefined\}/)
  assert.match(rail, /tabIndex=\{i === active \? 0 : -1\}/)
  assert.match(rail, /aria-label=\{item\.label\}/)
  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) assert.ok(rail.includes(`'${key}'`), key)
  assert.match(rail, /aria-hidden="true"[\s\S]{0,120}data-rail-fira/)
})

test('rail: keyboard jumps are instant, pointer jumps use the browser scroll', () => {
  const store = read('src/components/nav/nav-store.ts')
  assert.match(store, /behavior: smooth && !reduce \? 'smooth' : 'instant'/)
  assert.match(rail, /jumpTo\(id, e\.detail !== 0\)/)
  assert.match(palette, /jumpTo\(id, false\)/, '[ and ] are instant')
})

test('palette: dialog, combobox + listbox, activedescendant, no open animation, focus returns', () => {
  assert.match(palette, /role="dialog"/)
  assert.match(palette, /aria-modal="true"/)
  assert.match(palette, /role="combobox"/)
  assert.match(palette, /aria-activedescendant/)
  assert.match(palette, /role="listbox"/)
  assert.match(palette, /text-\[16px\]/, 'iOS must not zoom the input')
  assert.match(palette, /opener\?\.focus\?\.\(\)/)
  // The panel itself has no transition or animation class; only the dim does.
  const panel = palette.slice(palette.indexOf('data-palette\n'), palette.indexOf('<input'))
  assert.doesNotMatch(panel, /transition|animate|duration/)
  assert.match(palette, /palette-dim/)
})

test('progress line: 44 px tap strip, aria-hidden visuals, replaces ScrollProgress', () => {
  assert.match(line, /h-11/)
  assert.match(line, /aria-haspopup="dialog"/)
  assert.doesNotMatch(header, /ScrollProgress/)
  assert.match(layout, /<NavLayer\b/)
})

test('sound: toggle is off by default, aria-pressed, in the header (2xl+) and the phone menu', () => {
  const sound = read('src/lib/sound.ts')
  assert.match(sound, /localStorage\.getItem\(SOUND_KEY\) === 'on'/)
  assert.match(sound, /\(\) => false\)/, 'server snapshot is off')
  assert.match(read('src/components/sound-toggle.tsx'), /aria-pressed=\{on\}/)
  assert.match(header, /<SoundToggle copy=\{dict\.sound\} className="hidden 2xl:inline-flex"/)
  assert.match(header, /<SoundToggle copy=\{dict\.sound\} \/>/)
  assert.match(sound, /export function playCue/)
})
