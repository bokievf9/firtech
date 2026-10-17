// Daily backup of the lead store, run by cron on the VPS (see CLAUDE.md, Infrastructure):
//   node --env-file=/var/www/firtech/shared/.env.production scripts/ops/backup.mjs
// Keeps 14 dated copies next to the data and sends leads.json to the owner's Telegram, but only
// when it changed since the last sent copy (no daily noise while nothing happens).
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { configured, sendFile } from './telegram.mjs'

const dataDir = process.env.DATA_DIR || '/var/www/firtech/shared/data'
const backupDir = join(dataDir, '..', 'backups')
const KEEP = 14

export function shouldSend(hash, state) {
  return hash !== state?.lastHash
}

async function main() {
  let bytes
  try {
    bytes = await readFile(join(dataDir, 'leads.json'))
  } catch {
    console.log('no leads.json yet, nothing to back up')
    return
  }
  const day = new Date().toISOString().slice(0, 10)
  await mkdir(backupDir, { recursive: true, mode: 0o700 })
  await writeFile(join(backupDir, `leads-${day}.json`), bytes, { mode: 0o600 })
  const old = (await readdir(backupDir)).filter((f) => f.startsWith('leads-')).sort().slice(0, -KEEP)
  for (const f of old) await rm(join(backupDir, f))

  const hash = createHash('sha256').update(bytes).digest('hex')
  const statePath = join(backupDir, 'state.json')
  const state = await readFile(statePath, 'utf8').then(JSON.parse).catch(() => null)
  if (!shouldSend(hash, state) || !configured()) return console.log('unchanged or no bot, kept locally')
  const count = (JSON.parse(bytes.toString('utf8')).leads ?? []).length
  await sendFile(`firtech-leads-${day}.json`, bytes, `Бэкап заявок fir.tech за ${day}: ${count} шт. Сохраните этот файл.`)
  await writeFile(statePath, JSON.stringify({ lastHash: hash, sentAt: new Date().toISOString() }))
  console.log(`sent backup with ${count} leads`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('backup failed:', error.message)
    process.exitCode = 1
  })
}
