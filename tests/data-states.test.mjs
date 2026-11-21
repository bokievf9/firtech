// Loading and error states (owner review 2026-11-22 point 7): the error map, fetchJson, the JSON
// error answer of the routes and the shared UI (Pending, ErrorNote, Skeleton) rendered to markup.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const src = pathToFileURL(path.resolve('src') + '/').href
const stubs = {
  'server-only': 'export {}',
  'next/navigation': 'export const useParams = () => ({}); export const useRouter = () => ({})',
}
registerHooks({
  resolve(specifier, context, next) {
    if (specifier in stubs) return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true }
    if (specifier === 'next/server') return next('next/server.js', context)
    if (specifier.startsWith('@/')) {
      const base = new URL(specifier.slice(2), src).href
      for (const candidate of [`${base}.ts`, `${base}.tsx`]) {
        try {
          return next(candidate, context)
        } catch {}
      }
    }
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      for (const ext of ['.ts', '.tsx']) {
        try {
          return next(`${specifier}${ext}`, context)
        } catch {}
      }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (!url.endsWith('.tsx')) return next(url, context)
    const out = ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      fileName: fileURLToPath(url),
    })
    return { format: 'module', source: out.outputText, shortCircuit: true }
  },
})

const { renderToStaticMarkup } = await import('react-dom/server')
const { createElement } = await import('react')
const errors = await import('../src/lib/errors.ts')
const { apiError } = await import('../src/lib/api-error.ts')
const { Pending } = await import('../src/components/ui/pending.tsx')
const { ErrorNote } = await import('../src/components/ui/error-note.tsx')
const { SkeletonList, SkeletonCard } = await import('../src/components/ui/skeleton.tsx')
const { PanelLoading } = await import('../src/components/ui/spinner.tsx')

test('describeError: known codes, statuses, aliases in both languages', () => {
  assert.equal(errors.describeError({ code: 'network' }).message, 'Нет связи')
  assert.equal(errors.describeError({ code: 'network', locale: 'en' }).message, 'No connection')
  assert.match(errors.describeError({ code: 'timeout' }).message, /20 секунд/)
  assert.equal(errors.describeError({ code: 'auth_required' }).message, 'Сессия истекла, войдите снова')
  assert.match(errors.describeError({ code: 'invalid_email' }).message, /проверьте адрес/)
  assert.match(errors.describeError({ code: 'hq_unreachable' }).hint, /сохранена и уйдёт позже/)
  assert.equal(errors.describeError({ code: 'rate_limited' }).retryable, true)
  assert.equal(errors.describeError({ code: 'slot_taken' }).retryable, false)
  // Alias and status fallback
  assert.equal(errors.describeError({ code: 'busy' }).code, 'rate_limited')
  assert.equal(errors.describeError({ status: 429 }).code, 'rate_limited')
  assert.equal(errors.describeError({ status: 504 }).code, 'timeout')
  assert.equal(errors.describeError({ status: 502 }).code, 'hq_error')
})

test('describeError: thrown fetch errors are told apart (timeout vs no connection)', () => {
  assert.equal(errors.describeError({ thrown: new TypeError('Failed to fetch') }).code, 'network')
  const timeout = Object.assign(new Error('t'), { name: 'TimeoutError' })
  assert.equal(errors.describeError({ thrown: timeout }).code, 'timeout')
  assert.equal(errors.isTimeout(Object.assign(new Error('a'), { name: 'AbortError' })), true)
})

test('describeError: an unknown failure is still shown, with a short support code and the time', () => {
  const at = new Date(2026, 10, 22, 9, 5)
  const info = errors.describeError({ code: 'weird_thing', locale: 'ru', now: at })
  assert.equal(info.code, 'unknown')
  assert.equal(info.message, 'Что-то пошло не так')
  assert.equal(info.ref, 'E-WEIRDTHI-0905')
  assert.equal(errors.describeError({ locale: 'en', now: at }).ref, 'E-UNKNOWN-0905')
  // An unknown code with a known status keeps the status text and the reference
  const withStatus = errors.describeError({ code: 'strange', status: 500, now: at })
  assert.equal(withStatus.code, 'server_error')
  assert.equal(withStatus.ref, 'E-STRANGE-0905')
  assert.equal(errors.supportRef('a-b c', at), 'E-ABC-0905')
})

test('every entry has both languages and a status; no long dashes in the texts', () => {
  const src = readFileSync('src/lib/errors.ts', 'utf8')
  assert.ok(!/[–—]/.test(src), 'no em or en dashes')
  for (const code of ['network', 'timeout', 'invalid', 'auth_required', 'forbidden', 'not_found', 'slot_taken', 'rate_limited', 'too_large', 'not_configured', 'delivery_failed', 'hq_unreachable', 'hq_timeout', 'hq_error', 'unavailable', 'server_error']) {
    for (const locale of ['ru', 'en']) {
      const info = errors.describeError({ code, locale })
      assert.equal(info.code, code)
      assert.ok(info.message.length > 3 && info.hint.length > 3, `${code} ${locale}`)
    }
    if (code !== 'network') assert.ok(errors.errorStatusFor(code) >= 400)
  }
})

test('codeFromBody reads the new {error:{code}} shape, the old string and {code}', () => {
  assert.equal(errors.codeFromBody({ ok: false, error: { code: 'rate_limited', message: 'x' } }), 'rate_limited')
  assert.equal(errors.codeFromBody({ ok: false, error: 'hq_timeout' }), 'hq_timeout')
  assert.equal(errors.codeFromBody({ code: 'invalid' }), 'invalid')
  assert.equal(errors.codeFromBody(null), undefined)
  assert.equal(errors.codeFromBody('x'), undefined)
})

test('fetchJson: ok, server error codes, bad bodies, thrown errors, timeout', async () => {
  const reply = (status, body) => async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
  const ok = await errors.fetchJson('/x', {}, reply(200, { ok: true, n: 1 }))
  assert.deepEqual(ok, { ok: true, status: 200, data: { ok: true, n: 1 } })
  const limited = await errors.fetchJson('/x', { locale: 'en' }, reply(429, { ok: false, error: { code: 'rate_limited', message: 'm' } }))
  assert.equal(limited.ok, false)
  assert.equal(limited.status, 429)
  assert.equal(limited.error.message, 'Too many requests')
  // 200 with ok:false is a failure too, never a silent success
  const soft = await errors.fetchJson('/x', {}, reply(200, { ok: false, error: 'hq_unreachable' }))
  assert.equal(soft.ok, false)
  assert.equal(soft.error.code, 'hq_unreachable')
  // An HTML error page from a proxy: the status picks the text
  const html = await errors.fetchJson('/x', {}, reply(502, '<html>bad gateway</html>'))
  assert.equal(html.error.code, 'hq_error')
  const down = await errors.fetchJson('/x', {}, async () => {
    throw new TypeError('Failed to fetch')
  })
  assert.equal(down.error.code, 'network')
  // AbortSignal.timeout() timers are unref'd: on Node 22 nothing else keeps the event loop alive while the
  // fake fetch waits, so the runner reported «Promise resolution is still pending». A ref'd timer holds it open.
  const keepAlive = setInterval(() => {}, 1000)
  const slow = await errors
    .fetchJson('/x', { timeoutMs: 20 }, (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))))
    .finally(() => clearInterval(keepAlive))
  assert.equal(slow.error.code, 'timeout')
})

test('apiError: JSON {ok:false, error:{code,message}} with the right status, never 200', async () => {
  const res = apiError('rate_limited')
  assert.equal(res.status, 429)
  assert.equal(res.headers.get('cache-control'), 'no-store')
  const body = await res.json()
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'rate_limited')
  assert.ok(body.error.message)
  assert.equal(apiError('slot_taken', 409).status, 409)
  assert.equal(apiError('whatever_new').status, 500)
  assert.equal(apiError('hq_timeout').status, 504)
})

test('Pending: busy button has aria-busy, spinner and the waiting label; idle one does not', () => {
  const busy = renderToStaticMarkup(createElement(Pending, { pending: true, pendingLabel: 'Отправляем…' }, 'Отправить'))
  assert.match(busy, /aria-busy="true"/)
  assert.match(busy, /aria-disabled="true"/)
  assert.match(busy, /class="[^"]*spinner/)
  assert.match(busy, /Отправляем…/)
  assert.ok(!busy.includes('>Отправить<'))
  const idle = renderToStaticMarkup(createElement(Pending, { pending: false, pendingLabel: 'Отправляем…' }, 'Отправить'))
  assert.match(idle, /aria-busy="false"/)
  assert.ok(!idle.includes('aria-disabled'))
  assert.ok(!idle.includes('spinner'))
  assert.match(idle, /Отправить/)
})

test('ErrorNote: role alert, message, hint, retry only when it can help, code for unknown failures', () => {
  const info = errors.describeError({ code: 'timeout' })
  const html = renderToStaticMarkup(createElement(ErrorNote, { error: info, onRetry: () => {} }))
  assert.match(html, /role="alert"/)
  assert.match(html, /Сервер не ответил за 20 секунд/)
  assert.match(html, /Повторить/)
  const noRetry = renderToStaticMarkup(createElement(ErrorNote, { error: errors.describeError({ code: 'slot_taken' }), onRetry: () => {} }))
  assert.ok(!noRetry.includes('Повторить'))
  const unknown = renderToStaticMarkup(createElement(ErrorNote, { error: errors.describeError({ code: 'zzz' }), locale: 'en' }))
  assert.match(unknown, /Support code: E-ZZZ-\d{4}/)
  assert.match(renderToStaticMarkup(createElement(ErrorNote, { error: info, locale: 'en', onRetry: () => {} })), /Try again/)
})

test('Skeleton and loading blocks announce themselves politely', () => {
  const list = renderToStaticMarkup(createElement(SkeletonList, { rows: 3, label: 'Загружаем список' }))
  assert.match(list, /role="status"/)
  assert.match(list, /aria-busy="true"/)
  assert.match(list, /Загружаем список/)
  assert.equal((list.match(/class="skeleton /g) ?? []).length >= 3, true)
  assert.match(renderToStaticMarkup(createElement(SkeletonCard, { label: 'Загружаем' })), /role="status"/)
  assert.match(renderToStaticMarkup(createElement(PanelLoading, { label: 'Загружаем...' })), /spinner-lg/)
})

test('reduced motion: the spinner and skeleton are slowed or still in the stylesheet', () => {
  const css = readFileSync('src/app/globals.css', 'utf8')
  const media = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)', css.indexOf('.spinner {') + 600))
  assert.match(media, /\.spinner/)
  assert.match(css, /\.skeleton,?\s*\n?\s*\.chat-in|\.skeleton,/)
})

test('no empty catch blocks in src, and route files exist for the data segments', () => {
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(ts|tsx)$/.test(name)) files.push(full)
    }
  }
  walk('src')
  // admin/layout.tsx holds an inline theme script (a string for the browser, written before hydration).
  const empty = files.filter((f) => !f.endsWith('admin/layout.tsx') && /catch\s*(\([^)]*\))?\s*\{\s*\}/.test(readFileSync(f, 'utf8')))
  assert.deepEqual(empty, [])
  for (const f of ['src/app/global-error.tsx', 'src/app/[locale]/error.tsx', 'src/app/[locale]/cabinet/loading.tsx', 'src/app/[locale]/cabinet/error.tsx', 'src/app/admin/loading.tsx', 'src/app/admin/error.tsx', 'src/app/[locale]/solutions/loading.tsx', 'src/app/[locale]/products/loading.tsx'])
    assert.ok(statSync(f).isFile(), f)
})
