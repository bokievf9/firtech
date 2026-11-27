// Wide screens (2026-11-27): one page container with tiers, rem-sized hero stage, 4-column grids at 3xl.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const css = readFileSync('src/app/globals.css', 'utf8')
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(n) ? [p] : []
  })
const files = walk('src')

test('wide: no component uses max-w-7xl directly, they use .site-container', () => {
  const bad = files.filter((f) => /max-w-7xl/.test(readFileSync(f, 'utf8')))
  assert.deepEqual(bad, [])
  assert.match(css, /@utility site-container/)
})

test('wide: the breakpoints and container tiers exist in globals', () => {
  assert.match(css, /--breakpoint-3xl:\s*120rem/)
  assert.match(css, /--breakpoint-4xl:\s*150rem/)
  for (const px of ['1440px', '1680px', '1840px']) assert.ok(css.includes(`--site-max: ${px}`), px)
  for (const rem of ['3rem', '4rem']) assert.ok(css.includes(`--site-pad: ${rem}`), rem)
})

test('wide: type scale caps', () => {
  assert.match(css, /--text-display: clamp\([^)]*7\.5rem\)/)
  assert.match(css, /--text-title: clamp\([^)]*4rem\)/)
  assert.match(css, /--text-lead: clamp\([^)]*1\.4rem\)/)
})

test('wide: the hero stage is sized in rem through --orbit-size, no px widths', () => {
  assert.match(css, /--orbit-size:\s*48\.5rem/)
  assert.match(css, /--orbit-size:\s*51rem/)
  const block = css.slice(css.indexOf('.orbit-wrap'), css.indexOf('@keyframes orbit-spin'))
  assert.ok(block.includes('var(--orbit-size'))
  assert.doesNotMatch(block, /\n\s+width:[^;]*\d+px/)
  const hero = readFileSync('src/components/hero/hero.tsx', 'utf8')
  assert.ok(hero.includes('var(--orbit-size)'))
  assert.doesNotMatch(hero, /660px/)
})

test('wide: grids go to four columns at 3xl', () => {
  for (const f of ['src/components/products/products-bento.tsx', 'src/components/solutions-home.tsx', 'src/app/[locale]/blog/page.tsx', 'src/components/ai-team/agent-explorer.tsx', 'src/components/builder-catalog-picker.tsx']) {
    assert.match(readFileSync(f, 'utf8'), /3xl:grid-cols-4/, f)
  }
  assert.match(readFileSync('src/app/[locale]/ai-team/agent/[id]/page.tsx', 'utf8'), /3xl:col-span-6/)
})

test('wide: nav links never wrap', () => {
  assert.match(readFileSync('src/components/header.tsx', 'utf8'), /text-callout whitespace-nowrap/)
})
