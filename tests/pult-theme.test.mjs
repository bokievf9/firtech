import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

// Owner panel colours (docs/pult.md, «Темы и цвета отделов»): department tokens exist in both theme
// blocks of globals.css, text tokens pass AA on every surface, the helper names them, and the admin
// components keep to tokens (no prefers-color-scheme, no raw white/black).
const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) {
      const base = new URL(specifier.slice(2), src).href
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
        try {
          return next(candidate, context)
        } catch {}
      }
    }
    return next(specifier, context)
  },
})

const { deptTheme, deptOf } = await import('../src/lib/pult-theme.ts')
const { PANELS } = await import('../src/lib/pult.ts')

const css = readFileSync('src/app/globals.css', 'utf8')
const lightAt = css.indexOf(":root[data-theme='light'] {")
const dark = css.slice(css.indexOf('@theme'), lightAt)
const light = css.slice(lightAt, css.indexOf('@layer base'))
const vars = (block) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
const DARK = vars(dark)
const LIGHT = { ...DARK, ...vars(light) }

const rgba = (v) => {
  let m = v.match(/^#([0-9a-f]{6})$/i)
  if (m) {
    const n = parseInt(m[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
  }
  m = v.match(/rgb\(([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/)
  assert.ok(m, `unparsable colour ${v}`)
  return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]]
}
const over = (f, b) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3])).concat(1)
const lum = (c) => {
  const [r, g, b] = c.slice(0, 3).map((x) => {
    x /= 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)

test('every department has fill, soft and text tokens in both theme blocks', () => {
  assert.equal(PANELS.length, 7)
  for (const [name, own] of [['dark', vars(dark)], ['light', vars(light)]]) {
    for (const id of PANELS) {
      const t = deptTheme(id)
      for (const v of Object.values(t.vars)) assert.ok(own[v.slice(2)], `${name} block lacks ${v}`)
    }
  }
})

test('department fills are distinct and none is lime-like green', () => {
  const fills = PANELS.map((id) => DARK[`color-dept-${id}`])
  assert.equal(new Set(fills).size, 7)
  const lime = rgba(DARK['color-accent'])
  for (const f of fills) assert.ok(Math.abs(rgba(f)[1] - lime[1]) > 0 && ratio(rgba(f), lime) > 1.3, `${f} too close to lime`)
  // The fill is one value in both themes (the pixel canvas reads it once).
  for (const id of PANELS) assert.equal(LIGHT[`color-dept-${id}`], DARK[`color-dept-${id}`])
})

test('text tokens pass AA (4.5:1) on every surface of both themes, fills 3:1', () => {
  for (const [name, T] of [['dark', DARK], ['light', LIGHT]]) {
    const surfaces = {}
    for (const s of ['bg', 'surface', 'surface-2', 'surface-3', 'elevated', 'field']) surfaces[s] = rgba(T[`color-${s}`])
    surfaces.inset = over(rgba(T['color-inset']), surfaces.surface)
    const texts = ['fg', 'muted', 'faint', 'accent-text', 'danger', 'warn', ...PANELS.map((d) => `dept-${d}-text`)]
    for (const [sn, bg] of Object.entries(surfaces))
      for (const t of texts) assert.ok(ratio(rgba(T[`color-${t}`]), bg) >= 4.5, `${name}: ${t} on ${sn} = ${ratio(rgba(T[`color-${t}`]), bg).toFixed(2)}`)
    for (const id of PANELS) {
      const soft = over(rgba(T[`color-dept-${id}-soft`]), surfaces.surface)
      assert.ok(ratio(rgba(T[`color-dept-${id}-text`]), soft) >= 4.5, `${name}: ${id} text on its soft tint`)
      assert.ok(ratio(rgba(T[`color-dept-${id}`]), surfaces.surface) >= 3, `${name}: ${id} fill on surface`)
    }
    assert.ok(ratio(rgba(T['color-danger-ink']), rgba(T['color-danger'])) >= 4.5, `${name}: danger-ink on danger`)
  }
})

test('light theme layers are visibly different and borders carry controls', () => {
  const L = (k) => rgba(LIGHT[`color-${k}`])
  assert.ok(ratio(L('surface'), L('bg')) >= 1.2, 'panel vs page')
  assert.ok(ratio(over(L('inset'), L('surface')), L('surface')) >= 1.08, 'card vs panel')
  assert.ok(ratio(over(L('line-strong'), L('surface')), L('surface')) >= 3, 'control border on panel')
  assert.ok(ratio(over(L('line-strong'), L('field')), L('field')) >= 3, 'control border on field')
  for (const k of ['scrim', 'shadow-panel', 'shadow-dialog', 'surface-3', 'elevated']) assert.ok(LIGHT[k] || LIGHT[`color-${k}`], k)
  assert.ok(vars(light)['color-scrim'] && vars(dark)['color-scrim'])
  assert.ok(lum(rgba(vars(light)['color-scrim'])) > lum(rgba(vars(dark)['color-scrim'])), 'scrim is light on light')
})

test('deptTheme names classes and variables; deptOf maps HQ names', () => {
  const s = deptTheme('sales')
  assert.deepEqual(s.vars, { fill: '--color-dept-sales', soft: '--color-dept-sales-soft', text: '--color-dept-sales-text' })
  assert.equal(s.css.fill, 'var(--color-dept-sales)')
  assert.equal(s.cls.soft, 'bg-dept-sales-soft')
  assert.equal(s.cls.text, 'text-dept-sales-text')
  for (const id of PANELS) for (const c of Object.values(deptTheme(id).cls)) assert.ok(c.includes(`dept-${id}`))
  assert.equal(deptOf('Sales'), 'sales')
  assert.equal(deptOf('back-office'), 'backoffice')
  assert.equal(deptOf('ceo'), 'director')
  assert.equal(deptOf('weather'), null)
  assert.equal(deptOf(undefined), null)
})

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx|ts)$/.test(f) ? [p] : []
  })
}

test('admin components: no prefers-color-scheme, no raw white or black', () => {
  const files = [...walk('src/components/admin'), ...walk('src/app/admin')].filter((f) => !/hologram|echo-console/.test(f))
  assert.ok(files.length > 30)
  for (const f of files) {
    const text = readFileSync(f, 'utf8')
    assert.ok(!text.includes('prefers-color-scheme'), `${f} uses prefers-color-scheme`)
    assert.ok(!/\b(?:bg|text|border)-(?:white|black)\b|\bbg-(?:white|black)\//.test(text), `${f} has raw white or black`)
    if (f.endsWith('pixel-office.tsx')) assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(text), 'pixel-office.tsx has a hex colour')
  }
  const globalCss = readFileSync('src/app/globals.css', 'utf8')
  assert.ok(!globalCss.includes('prefers-color-scheme'))
})
