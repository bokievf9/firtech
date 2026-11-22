// The Shell admin UI is English (owner decision): no Cyrillic in admin copy or admin components,
// except lines marked `i18n-ok` (they parse or send Russian data) and comments.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { deptLabel, statusLabel } from '../src/lib/admin-labels.ts'

const CYR = /[А-Яа-яЁё]/
const files = []
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p)
  }
}
walk('src/components/admin')
walk('src/app/admin')
files.push('src/content/admin.ts')

const stripBlock = (src) => src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))

test('admin UI code and copy have no Cyrillic outside comments and i18n-ok lines', () => {
  const bad = []
  for (const f of files) {
    const lines = stripBlock(fs.readFileSync(f, 'utf8')).split('\n')
    lines.forEach((line, i) => {
      if (line.includes('i18n-ok')) return
      const code = line.replace(/(^|\s)\/\/.*$/, '$1')
      if (CYR.test(code)) bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`)
    })
  }
  assert.deepEqual(bad, [], bad.join('\n'))
})

test('deptLabel and statusLabel map ids and known Russian data, unknown values stay', () => {
  assert.equal(deptLabel('back-office'), 'Back office')
  assert.equal(deptLabel('backoffice'), 'Back office')
  assert.equal(deptLabel('Маркетинг'), 'Marketing')
  assert.equal(deptLabel('Бэк-офис'), 'Back office')
  assert.equal(deptLabel('Сопровождение'), 'Support')
  assert.equal(deptLabel('Skunkworks'), 'Skunkworks')
  assert.equal(statusLabel('в работе'), 'running')
  assert.equal(statusLabel('Ждёт'), 'waiting')
  assert.equal(statusLabel('whatever'), 'whatever')
})

test('go-live UI text and block titles are English (the checklist items are owner-edited content)', () => {
  const src = fs.readFileSync('src/content/golive.ts', 'utf8')
  const ui = src.slice(0, src.indexOf('export const goliveItems')) + src.slice(src.indexOf('export const goliveText'))
  assert.doesNotMatch(ui.replace(/\/\/.*$/gm, ''), CYR)
})
