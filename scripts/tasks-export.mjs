// The panel's task store -> TASKS.md. Rewrites only task lines (checkboxes, titles, notes); prose and
// headings stay. Refuses when TASKS.md changed since the last sync; --force overwrites anyway.
// Usage, from the repo root:
//   DATA_DIR=./data node scripts/tasks-export.mjs [path/to/TASKS.md] [--force]
import './register-ts.mjs'
import os from 'node:os'
import path from 'node:path'

const args = process.argv.slice(2)
const force = args.includes('--force')
const given = args.find((a) => !a.startsWith('--'))
const file = path.resolve(
  given || process.env.TASKS_MD || path.join(os.homedir(), 'fir-tech/TASKS.md'),
)
const { exportTasksMd, DriftError } = await import('../src/lib/tasks-sync.ts')
try {
  const r = await exportTasksMd(file, { force })
  console.log(
    `Экспорт в ${file}: изменено ${r.updated}, удалено ${r.removed}, добавлено ${r.added}`,
  )
} catch (error) {
  if (!(error instanceof DriftError)) throw error
  console.error(error.message)
  process.exit(1)
}
