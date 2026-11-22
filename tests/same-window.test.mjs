// Owner rule (2026-11-22): every link on the public site opens in the same window.
// No `_blank` anywhere in src outside the admin areas (src/components/admin, src/app/admin).
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src')
const SOURCE = /\.(tsx?|jsx?|mjs|cjs)$/

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (SOURCE.test(entry.name)) out.push(full)
  }
  return out
}

const isAdmin = (file) => file.split(path.sep).includes('admin')

test('public src has no target="_blank" (same-window links only)', () => {
  const offenders = []
  for (const file of walk(root)) {
    if (isAdmin(file)) continue
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (line.includes('_blank')) offenders.push(`${path.relative(root, file)}:${i + 1}`)
      })
  }
  assert.deepEqual(offenders, [], `public links must open in the same window: ${offenders.join(', ')}`)
})

test('admin areas are excluded from the check', () => {
  const adminFiles = walk(root).filter(isAdmin)
  assert.ok(adminFiles.length > 0)
})
