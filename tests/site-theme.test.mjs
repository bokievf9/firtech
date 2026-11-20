// Public site themes (owner 2026-11-21): light on white is the default, dark is a switch. Checks the
// token sets in globals.css for WCAG contrast, that the theme never follows prefers-color-scheme,
// and that no raw white/black utilities are left in public components.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const css = readFileSync('src/app/globals.css', 'utf8')

function block(start) {
  const i = css.indexOf(start)
  assert.ok(i >= 0, `${start} block exists`)
  const open = css.indexOf('{', i)
  let depth = 0
  for (let j = open; j < css.length; j++) {
    if (css[j] === '{') depth++
    if (css[j] === '}' && --depth === 0) return css.slice(open + 1, j)
  }
  throw new Error('unclosed block')
}

function tokens(body) {
  const out = {}
  for (const m of body.matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

const light = tokens(block('@theme static'))
const dark = { ...light, ...tokens(block(":root[data-theme='dark']")) }

const lin = (c) => {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
function rgb(hex) {
  assert.match(hex, /^#[0-9a-f]{6}$/i, `${hex} is a 6 digit hex`)
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
}
const lum = (hex) => {
  const [r, g, b] = rgb(hex)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const surfaces = ['bg', 'surface', 'surface-2']
const texts = [
  ['fg', 4.5],
  ['muted', 4.5],
  ['faint', 4.5],
  ['accent-text', 4.5],
]

for (const [name, set] of [
  ['light', light],
  ['dark', dark],
]) {
  test(`${name} theme: text tokens reach AA on every surface`, () => {
    for (const s of surfaces) {
      for (const [t, min] of texts) {
        const c = contrast(set[t], set[s])
        assert.ok(c >= min, `${name}: ${t} on ${s} is ${c.toFixed(2)}, needs ${min}`)
      }
    }
  })

  test(`${name} theme: button ink is readable on the accent fill`, () => {
    assert.ok(contrast(set['accent-ink'], set.accent) >= 7)
    assert.ok(contrast(set['accent-ink'], set['accent-strong']) >= 7)
  })

  test(`${name} theme: green wash (pine) carries accent text`, () => {
    assert.ok(contrast(set['accent-text'], set.pine) >= 4.5)
  })
}

test('light theme is a white page, lime stays a fill', () => {
  assert.equal(light.bg.toLowerCase(), '#ffffff')
  // Lime on white fails for text, so it must never be the text token.
  assert.ok(contrast(light.accent, light.bg) < 3, 'lime on white is a fill, not text')
  assert.notEqual(light['accent-text'].toLowerCase(), light.accent.toLowerCase())
})

test('danger and warn text read on the light and dark pages', () => {
  for (const set of [light, dark]) {
    for (const t of ['danger', 'warn']) assert.ok(contrast(set[t], set.bg) >= 4.5, `${t} on bg`)
  }
})

test('the theme is chosen by data-theme and localStorage, never by prefers-color-scheme', () => {
  const files = []
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(tsx?|css)$/.test(f)) files.push(p)
    }
  }
  walk('src')
  for (const f of files) {
    assert.ok(!/prefers-color-scheme/.test(readFileSync(f, 'utf8')), `${f} uses prefers-color-scheme`)
  }
  const theme = readFileSync('src/lib/site-theme.ts', 'utf8')
  assert.match(theme, /fir-theme/)
  assert.match(theme, /'light'/)
  const layout = readFileSync('src/app/[locale]/layout.tsx', 'utf8')
  assert.match(layout, /ThemeInit/)
  assert.match(layout, /themeColor: '#ffffff'/)
})

test('admin sets its theme explicitly (dark default, light stored)', () => {
  const layout = readFileSync('src/app/admin/layout.tsx', 'utf8')
  assert.match(layout, /data-theme="dark"/)
  assert.match(layout, /'light':'dark'/)
  const toggle = readFileSync('src/components/admin/theme-toggle.tsx', 'utf8')
  assert.doesNotMatch(toggle, /delete document\.documentElement\.dataset\.theme/)
})

test('dictionaries carry the theme switch copy in both languages', async () => {
  const ru = readFileSync('src/content/ru.ts', 'utf8')
  const en = readFileSync('src/content/en.ts', 'utf8')
  for (const src of [ru, en]) assert.match(src, /theme: \{ light: '[^']+', dark: '[^']+', toggle: '[^']+' \}/)
})

test('no raw white or black utilities in public components', () => {
  // The payment QR must stay white to scan; the estimate sheet is a paper page with its own colours.
  const allow = new Set(['src/components/pay/pay-view.tsx', 'src/components/estimate-sheet.tsx'])
  const bad = /(?<![\w-])(?:[a-z-]+:)*(?:text-white|text-black|bg-black|bg-white|border-white|border-black)(?![-\w])/
  const files = []
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f)
      if (statSync(p).isDirectory()) {
        if (p.includes(`${path.sep}admin`)) continue
        walk(p)
      } else if (/\.tsx$/.test(f)) files.push(p)
    }
  }
  walk('src/components')
  walk('src/app')
  for (const f of files) {
    if (allow.has(f.split(path.sep).join('/'))) continue
    const hit = readFileSync(f, 'utf8').split('\n').findIndex((l) => bad.test(l))
    assert.equal(hit, -1, `${f}:${hit + 1} has a raw white/black utility`)
  }
})
