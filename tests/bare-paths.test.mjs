// Bare paths (2026-11-21): contracts and offers link https://firtech.pro/terms and /privacy; the proxy
// sends every known page without a language to the visitor's language, like "/".
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true }
    if (specifier === 'next/server') return next('next/server.js', context)
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

const { isBareLocalePath, bareLocalePages } = await import('../src/lib/i18n.ts')
const { proxy, config } = await import('../src/proxy.ts')
const { NextRequest } = await import('next/server.js')

const go = async (url, lang) => {
  const res = await proxy(new NextRequest(`https://firtech.pro${url}`, { headers: lang ? { 'accept-language': lang } : {} }))
  return { status: res.status, to: res.headers.get('location') }
}

test('every bare known page is redirected to the visitor language, path and query kept', async () => {
  for (const page of ['terms', 'privacy', 'pay-how', 'compare', 'referral', 'audit', 'status', 'builder', 'blog', 'ai-team', 'cabinet', 'solutions', 'security']) {
    assert.deepEqual(await go(`/${page}`, 'ru-RU,ru;q=0.9'), { status: 307, to: `https://firtech.pro/ru/${page}` }, page)
    assert.deepEqual(await go(`/${page}`, 'en-US,en;q=0.9'), { status: 307, to: `https://firtech.pro/en/${page}` }, page)
  }
  assert.equal((await go('/services/websites', 'en')).to, 'https://firtech.pro/en/services/websites')
  assert.equal((await go('/terms?x=1', 'ru')).to, 'https://firtech.pro/ru/terms?x=1')
  assert.equal((await go('/blog/some-article', 'ru')).to, 'https://firtech.pro/ru/blog/some-article')
  assert.equal((await go('/privacy')).to, 'https://firtech.pro/ru/privacy', 'no header = Russian')
  assert.equal((await go('/')).to, 'https://firtech.pro/ru')
})

test('the matcher covers the bare pages and the list stays in step with it', () => {
  const bare = config.matcher.find((m) => m.startsWith('/(terms'))
  assert.ok(bare)
  for (const page of bareLocalePages) assert.ok(bare.includes(page), page)
  assert.equal(isBareLocalePath('/terms'), true)
  assert.equal(isBareLocalePath('/services/bots'), true)
  assert.equal(isBareLocalePath('/ru/terms'), false)
  assert.equal(isBareLocalePath('/api/status'), false)
  assert.equal(isBareLocalePath('/admin/office'), false)
  assert.equal(isBareLocalePath('/termsx'), false)
  assert.match(readFileSync('src/proxy.ts', 'utf8'), /isBareLocalePath\(pathname\)/)
})
