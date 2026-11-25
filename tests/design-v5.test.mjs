// Design v5 foundation (docs/design-system-v5.md): Manrope everywhere, the primitives exist and render,
// the Fira images are in public/. Components are rendered to static markup; .tsx is transpiled with
// TypeScript by a load hook (same approach as cabinet-stage-render.test.mjs).
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const src = pathToFileURL(path.resolve('src') + '/').href
const react = pathToFileURL(path.resolve('node_modules/react/index.js')).href
const stubs = {
  'next/image': `import { createElement } from "${react}"; export default function Image({ src, alt, fill, priority, ...p }) { return createElement("img", { src, alt, ...p }) }`,
  'next/link': `import { createElement } from "${react}"; export default function Link({ href, ...p }) { return createElement("a", { href, ...p }) }`,
}
registerHooks({
  resolve(specifier, context, next) {
    if (specifier in stubs) return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true }
    if (specifier.startsWith('@/')) {
      const base = new URL(specifier.slice(2), src).href
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
        if (existsSync(fileURLToPath(candidate))) return { url: candidate, shortCircuit: true }
      }
    }
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier) && context.parentURL) {
      const base = new URL(specifier, context.parentURL).href
      for (const candidate of [`${base}.ts`, `${base}.tsx`]) {
        if (existsSync(fileURLToPath(candidate))) return { url: candidate, shortCircuit: true }
      }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.startsWith('file:') && /\.tsx?$/.test(url)) {
      const out = ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      })
      return { format: 'module', source: out.outputText, shortCircuit: true }
    }
    return next(url, context)
  },
})

const { renderToStaticMarkup } = await import('react-dom/server')
const { createElement: h } = await import('react')
const { Orb } = await import('../src/components/ui/orb.tsx')
const { FiraPortal } = await import('../src/components/ui/fira-portal.tsx')
const { GlowBlob, OrbitRing } = await import('../src/components/ui/glow.tsx')

const css = readFileSync('src/app/globals.css', 'utf8')

test('fonts: Manrope maps to sans, display and brand; the three old faces are gone', () => {
  assert.match(css, /--font-sans:\s*var\(--font-manrope\)/)
  assert.match(css, /--font-display:\s*var\(--font-manrope\)/)
  assert.match(css, /--font-brand:\s*var\(--font-manrope\)/)
  assert.match(css, /--font-mono:\s*var\(--font-jetbrains\)/)
  const fonts = readFileSync('src/app/fonts.ts', 'utf8')
  assert.match(fonts, /Manrope/)
  for (const old of ['Onest', 'Geologica', 'Unbounded']) assert.doesNotMatch(fonts, new RegExp(old))
})

test('headline pattern: light weight, black strong, tight tracking', () => {
  assert.match(css, /\.h-display\s*\{[^}]*font-weight:\s*300[^}]*letter-spacing:\s*-0\.035em/s)
  assert.match(css, /\.h-display strong,\s*\.h-display b\s*\{\s*font-weight:\s*800/)
})

test('primitives exist in the stylesheet with dark twins for the new tokens', () => {
  for (const c of ['glow-blob', 'glow-blob-green', 'orbit-ring', 'orbit-ring-dashed', 'nav-capsule', 'nav-tab', 'orb', 'fira-portal', 'bubble-ink']) {
    assert.match(css, new RegExp(`\\.${c}\\s*[{,]`), `.${c}`)
  }
  const dark = css.slice(css.indexOf(":root[data-theme='dark']"))
  for (const t of ['material-capsule', 'material-orb', 'capsule-line', 'tab-on', 'bubble', 'bubble-ink', 'ring-white']) {
    assert.match(dark, new RegExp(`--color-${t}:`), `dark twin of ${t}`)
  }
})

test('Orb renders a link with the gradient dot, the label and a float delay', () => {
  const html = renderToStaticMarkup(h(Orb, { label: 'Личный ИИ · от 290 USD', href: '/ru/builder', delay: 1.6 }))
  assert.match(html, /<a [^>]*href="\/ru\/builder"/)
  assert.match(html, /class="orb"/)
  assert.match(html, /--float-delay:1\.6s/)
  assert.match(html, /class="orb-dot" aria-hidden="true"/)
  assert.match(html, /Личный ИИ · от 290 USD/)
})

test('FiraPortal renders the picture with its alt text; sm is the small portal', () => {
  const wave = renderToStaticMarkup(h(FiraPortal, { alt: 'Фира машет рукой', priority: true }))
  assert.match(wave, /class="fira-portal"/)
  assert.match(wave, /src="\/fira\/fira-3d-wave\.jpg"/)
  assert.match(wave, /alt="Фира машет рукой"/)
  const small = renderToStaticMarkup(h(FiraPortal, { alt: 'Фира', pose: 'glasses', size: 'sm' }))
  assert.match(small, /fira-portal-sm/)
  assert.match(small, /fira-glasses\.jpg/)
  assert.ok(existsSync('public/fira/fira-3d-wave.jpg') && existsSync('public/fira/fira-glasses.jpg'))
})

test('GlowBlob and OrbitRing are decorative: aria-hidden, with their variants', () => {
  assert.match(renderToStaticMarkup(h(GlowBlob, {})), /aria-hidden="true"[^>]*class="glow-blob"|class="glow-blob"[^>]*aria-hidden="true"/)
  assert.match(renderToStaticMarkup(h(GlowBlob, { tone: 'green' })), /glow-blob glow-blob-green/)
  assert.match(renderToStaticMarkup(h(OrbitRing, { dashed: true })), /orbit-ring orbit-ring-dashed/)
})
