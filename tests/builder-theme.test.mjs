import assert from 'node:assert/strict'
import { test } from 'node:test'
import { currentAxes, resolveLook, styleVars } from '../src/lib/builder-style.ts'
import { decodeBuild, encodeBuild } from '../src/lib/builder.ts'

test('default mockup palette follows the site theme', () => {
  assert.equal(resolveLook(undefined).colors.mode, 'dark')
  assert.equal(resolveLook(undefined, 'dark').colors.mode, 'dark')
  assert.equal(resolveLook(undefined, 'light').colors.mode, 'light')
  assert.equal(resolveLook({}, 'light').colors.bg, '#ffffff')
  assert.notDeepEqual(styleVars(undefined, 'light'), styleVars(undefined, 'dark'))
  assert.equal(currentAxes(undefined, 'light').palette, 'paper')
  assert.equal(currentAxes(undefined, 'dark').palette, 'fir')
})

test('a picked palette, kit or theme is never overridden by the site theme', () => {
  assert.equal(resolveLook({ palette: 'fir' }, 'light').colors.mode, 'dark')
  assert.equal(resolveLook({ kit: 'fir' }, 'light').colors.mode, 'dark')
  assert.equal(resolveLook({ palette: 'paper' }, 'dark').colors.mode, 'light')
  assert.equal(resolveLook({ theme: 'dark' }, 'light').colors.mode, 'dark')
})

test('the site theme never reaches the encoded build', () => {
  const build = decodeBuild('websites.landing.telegram~k.cafe')
  const before = encodeBuild(build)
  resolveLook(build.style, 'light')
  assert.equal(encodeBuild(build), before)
})
