// TASKS.md -> the panel's task store ($DATA_DIR/tasks.json). Idempotent: lines already in the store
// are matched (by title, or by the last sync for renamed ones) and left as they are; a line checked
// in the file closes the task. Usage, from the repo root:
//   DATA_DIR=./data node scripts/tasks-import.mjs [path/to/TASKS.md]
import './register-ts.mjs'
import os from 'node:os'
import path from 'node:path'

const file = path.resolve(
  process.argv[2] || process.env.TASKS_MD || path.join(os.homedir(), 'fir-tech/TASKS.md'),
)
const { importTasksMd } = await import('../src/lib/tasks-sync.ts')
const r = await importTasksMd(file)
console.log(
  `Импорт из ${file}: строк ${r.lines}, добавлено ${r.added}, закрыто ${r.closed}, без изменений ${r.kept}`,
)
