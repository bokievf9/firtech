import 'server-only'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { dataDir } from './store'

// One JSON document in $DATA_DIR with the same guarantees as the lead store: writes go through an
// in-memory queue (one PM2 process), land via temp file + rename, and a broken file fails loudly
// instead of being replaced by an empty one.
export function jsonFile<T>(name: string, empty: () => T) {
  const fileName = () => path.join(dataDir(), name)
  let queue: Promise<unknown> = Promise.resolve()

  async function load(): Promise<T> {
    try {
      return JSON.parse(await readFile(fileName(), 'utf8')) as T
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return empty()
      throw error
    }
  }

  async function save(db: T) {
    await mkdir(dataDir(), { recursive: true })
    const tmp = `${fileName()}.${process.pid}.tmp`
    await writeFile(tmp, JSON.stringify(db, null, 2), { mode: 0o600 })
    await rename(tmp, fileName())
  }

  function serialize<R>(task: () => Promise<R>): Promise<R> {
    const run = queue.then(task, task)
    queue = run.catch(() => {})
    return run
  }

  return { load, save, serialize }
}
