// Public site themes (owner 2026-11-21): light/dark follows the system until the switch is used. Checks the
// token sets in globals.css for WCAG contrast, where prefers-color-scheme may appear,
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

// Design system v4 materials (docs/design-system-v4.md «Стекло»): a translucent layer is only as readable as
// what shows through it. Each material is composited over every backdrop it can float over: the page
// layers, the pine wash, the lime fill (a button or a highlighted card under the header) and «busy»
// content (blurred text: fg over bg at 35% coverage). Which text tokens a material may carry is part of
// the system: thin = fg only, regular = fg, muted, accent-text, thick and chrome = every text token.
function rgba(value) {
  const m = value.match(/^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\s*\)$/)
  assert.ok(m, `${value} is rgb(r g b / a)`)
  return { c: [Number(m[1]), Number(m[2]), Number(m[3])], a: Number(m[4]) }
}
const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
const over = (top, a, bottom) => top.map((v, i) => v * a + bottom[i] * (1 - a))
const materialText = {
  thin: ['fg'],
  regular: ['fg', 'muted', 'accent-text'],
  thick: ['fg', 'muted', 'faint', 'accent-text'],
  chrome: ['fg', 'muted', 'faint', 'accent-text'],
}

for (const [name, set] of [
  ['light', light],
  ['dark', dark],
]) {
  test(`${name} theme: glass materials keep AA text over every backdrop, the lime fill included`, () => {
    const backdrops = {
      bg: rgb(set.bg),
      surface: rgb(set.surface),
      'surface-2': rgb(set['surface-2']),
      pine: rgb(set.pine),
      accent: rgb(set.accent),
      busy: over(rgb(set.fg), 0.35, rgb(set.bg)),
    }
    for (const [material, allowed] of Object.entries(materialText)) {
      const { c, a } = rgba(set[`material-${material}`])
      for (const [where, back] of Object.entries(backdrops)) {
        const surface = hex(over(c, a, back))
        for (const t of allowed) {
          const ratio = contrast(set[t], surface)
          assert.ok(ratio >= 4.5, `${name}: ${t} on ${material} glass over ${where} is ${ratio.toFixed(2)}, needs 4.5`)
        }
      }
    }
  })

  test(`${name} theme: the old glass names are the regular and chrome materials`, () => {
    assert.equal(set.glass, set['material-regular'])
    assert.equal(set['glass-strong'], set['material-chrome'])
  })
}

test('glass falls back to a solid surface without backdrop-filter, with reduced transparency and with more contrast', () => {
  assert.match(css, /@supports not \(\(backdrop-filter: blur\(1px\)\)/)
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\)\s*\{\s*\.glass,/)
  assert.match(css, /@media \(prefers-contrast: more\)\s*\{\s*\.glass,/)
  for (const m of ['thin', 'regular', 'thick', 'chrome']) assert.match(css, new RegExp(`\\.material-${m}`))
})

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

test('prefers-color-scheme is read only by theme-init.tsx, never in CSS', () => {
  const files = []
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(tsx?|css)$/.test(f)) files.push(p.split(path.sep).join('/'))
    }
  }
  walk('src')
  for (const f of files) {
    const has = /prefers-color-scheme/.test(readFileSync(f, 'utf8'))
    assert.equal(has, f === 'src/components/theme-init.tsx', `${f}: prefers-color-scheme usage`)
  }
  const init = readFileSync('src/components/theme-init.tsx', 'utf8')
  assert.ok(init.indexOf('localStorage.getItem') < init.indexOf('matchMedia'), 'stored choice is read before matchMedia')
  assert.match(readFileSync('src/lib/site-theme.ts', 'utf8'), /fir-theme/)
  const layout = readFileSync('src/app/[locale]/layout.tsx', 'utf8')
  assert.match(layout, /ThemeInit/)
  assert.match(layout, /themeColor: '#ffffff'/)
})

test('the public init script is not part of the admin layout', () => {
  const admin = readFileSync('src/app/admin/layout.tsx', 'utf8')
  assert.doesNotMatch(admin, /ThemeInit|theme-init|fir-theme/)
})

test('resolveTheme: stored wins, else the system scheme', async () => {
  const { resolveTheme: fn } = await import('../src/lib/theme.ts')
  assert.equal(fn('light', true), 'light')
  assert.equal(fn('dark', false), 'dark')
  assert.equal(fn(null, true), 'dark')
  assert.equal(fn(undefined, false), 'light')
  assert.equal(fn('junk', true), 'dark')
})

test('the init script agrees with resolveTheme and follows system changes until a choice is stored', () => {
  const src = readFileSync('src/components/theme-init.tsx', 'utf8')
  const lit = src.match(/themeScript = `([^`]*)`/)[1].replace(/\$\{THEME_KEY\}/g, 'fir-theme')
    .replace('${themeColor.dark}', '#0a0d0b').replace('${themeColor.light}', '#ffffff')
  const run = (stored, dark) => {
    let handler
    const meta = { v: '', setAttribute(_, v) { this.v = v } }
    const html = { dataset: {} }
    const store = { fir: stored }
    const mq = { matches: dark, addEventListener: (_, h) => (handler = h) }
    new Function('document', 'window', 'localStorage', lit)(
      { documentElement: html, querySelector: () => meta },
      { matchMedia: () => mq },
      { getItem: () => store.fir },
    )
    return { html, meta, store, mq, fire: () => handler() }
  }
  assert.equal(run(null, true).html.dataset.theme, 'dark')
  assert.equal(run(null, false).html.dataset.theme, 'light')
  assert.equal(run('light', true).html.dataset.theme, 'light')
  assert.equal(run('dark', false).html.dataset.theme, 'dark')
  const r = run(null, false)
  r.mq.matches = true
  r.fire()
  assert.equal(r.html.dataset.theme, 'dark')
  assert.equal(r.meta.v, '#0a0d0b')
  r.store.fir = 'light'
  r.fire()
  assert.equal(r.html.dataset.theme, 'dark', 'a stored choice stops following')
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
