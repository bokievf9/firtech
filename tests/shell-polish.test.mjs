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

test('useConfirm: exit animation, and `dialog` is null until the first ask (SSR on /admin/golive)', () => {
  const src = fs.readFileSync('src/components/admin/hub/ui.tsx', 'utf8')
  assert.match(src, /closing: true/)
  assert.match(src, /onAnimationComplete/)
  assert.match(src, /const dialog = state \? \(/)
  assert.match(src, /\) : null\n  return \{ ask, dialog \}/)
})
