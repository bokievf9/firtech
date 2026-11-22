// Shell polish (2026-11-23): one Select, one confirm dialog, focus on ⌘K targets, toasts on actions.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const files = []
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.tsx$/.test(e.name)) files.push(p)
  }
}
walk('src/components/admin')

test('no raw <select> in the Shell: everything goes through components/admin/select.tsx', () => {
  const bad = files.filter((f) => !f.endsWith('admin/select.tsx') && /<select[\s>]/.test(fs.readFileSync(f, 'utf8')))
  assert.deepEqual(bad, [])
})
