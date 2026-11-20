// The stage track as the client sees it (2026-11-21): the real server components rendered to static
// markup with the dev mock data (a 3-stage project: accepted, awaiting acceptance, awaiting payment).
// The cabinet page needs a Supabase session, which the e2e run does not have, so the components
// are rendered here; .tsx is transpiled with TypeScript by a load hook (no new dependency).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const src = pathToFileURL(path.resolve('src') + '/').href
const stubs = {
  'server-only': 'export {}',
  'next/navigation': 'export const useRouter = () => ({ refresh() {}, push() {} }); export const useSearchParams = () => new URLSearchParams()',
}
registerHooks({
  resolve(specifier, context, next) {
    if (specifier in stubs) return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true }
    if (specifier === 'next/link') return next('next/link.js', context)
    // Server actions pull in cookies and Supabase; the cards under test never call them.
    if (specifier.startsWith('@/app/') && specifier.endsWith('/actions')) {
      const stub = 'export const deleteAccountAction = async () => ({}); export const updateProfileAction = async () => ({})'
      return { url: `data:text/javascript,${encodeURIComponent(stub)}`, shortCircuit: true }
    }
    if (specifier.startsWith('@/')) {
      const base = new URL(specifier.slice(2), src).href
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
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
const { default: ru } = await import('../src/content/ru.ts')
const { default: en } = await import('../src/content/en.ts')
const { cabinetMock } = await import('../src/lib/cabinet-hq.ts')
const { ProjectsCard } = await import('../src/components/cabinet/cabinet-cards.tsx')
const { LeadsSection } = await import('../src/components/cabinet/leads-section.tsx')

const render = (data, dict, locale) => renderToStaticMarkup(createElement(ProjectsCard, { data, dict, locale }))
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

test('Проекты: three stages in order with the right label, pay link and accept button', () => {
  const html = render(cabinetMock('a@b.co'), ru, 'ru')
  const rows = [...html.matchAll(/<li[^>]*data-stage="(\d)"[^>]*data-step="(\w+)"/g)].map((m) => `${m[1]}:${m[2]}`)
  assert.deepEqual(rows, ['1:accepted', '2:accept', '3:pay'])
  const flat = text(html)
  assert.match(flat, /Этап 1: принят, принято \d{1,2} \S+ \d{4}/)
  assert.match(flat, /Этап 2: приёмка/)
  assert.match(flat, /Этап 3: оплата/)
  assert.equal((html.match(/data-accept-stage="2"/g) ?? []).length, 1, 'one accept button, on stage 2')
  assert.match(flat, /Принять этап/)
  const pay = /<a[^>]*data-pay-stage="3"[^>]*>/.exec(html)?.[0] ?? ''
  assert.match(pay, /href="https:\/\/firtech\.pro\/ru\/pay\/FT-2026-004/)
  assert.match(pay, /rel="noopener noreferrer"/)
  assert.match(flat, /Оплатить этап/)
  assert.equal(/data-pay-stage="2"/.test(html), false, 'no pay link once the stage is paid')
})

test('Проекты: the same track in English, and a project without stages shows no track', () => {
  const flat = text(render(cabinetMock('a@b.co'), en, 'en'))
  assert.match(flat, /Stage 2: acceptance/)
  assert.match(flat, /Stage 3: payment/)
  assert.match(flat, /Accept the stage/)
  assert.match(flat, /Pay the stage/)
  const bare = cabinetMock('a@b.co')
  bare.projects[0].milestones = []
  const html = render(bare, ru, 'ru')
  assert.equal(html.includes('data-stage-track'), false)
  assert.equal(html.includes('data-accept-stage'), false)
})

test('Проекты: after the last acceptance every stage reads accepted and nothing is clickable', () => {
  const data = cabinetMock('a@b.co')
  data.projects[0].milestones = data.projects[0].milestones.map((m) => ({ ...m, state: 'accepted', payUrl: null, acceptedAt: '2026-11-21T10:00:00Z' }))
  const html = render(data, ru, 'ru')
  assert.equal((html.match(/data-step="accepted"/g) ?? []).length, 3)
  assert.equal(html.includes('data-accept-stage'), false)
  assert.equal(html.includes('data-pay-stage'), false)
})

test('Заявки: a request that is a project shows the current stage line, other requests do not', () => {
  const data = cabinetMock('a@b.co')
  const view = (stageLine) => renderToStaticMarkup(createElement(LeadsSection, { dict: ru, locale: 'ru', initial: data.leads, focus: null, fresh: false, follow: null, stageLine }))
  const html = view('Этап 2: приёмка')
  assert.equal((html.match(/data-stage-line/g) ?? []).length, 1, 'only the lead whose stage is project')
  assert.match(text(html), /Сейчас: Этап 2: приёмка/)
  assert.equal(view(null).includes('data-stage-line'), false)
  assert.equal(data.leads.filter((l) => l.stage === 'project').length, 1)
})
