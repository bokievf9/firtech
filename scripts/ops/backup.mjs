// Daily backup of the lead store, run by cron on the VPS (see CLAUDE.md, Infrastructure):
//   node --env-file=/var/www/firtech/shared/.env.production scripts/ops/backup.mjs
// Keeps 14 dated copies next to the data and sends leads.json to the owner's Telegram, but only
// when it changed since the last sent copy (no daily noise while nothing happens).
// Security 2026-11-23 (P1-6): leads.json holds clients' names and contacts, so it leaves the server
// ONLY encrypted with `age` to BACKUP_AGE_RECIPIENT (an `age1...` public key; the owner keeps the
// private key off the server). Without the variable, or when `age` fails, the plain file is never
// sent: Telegram gets a summary (date, size, count) with a warning and the copies stay local.
// Decrypt on the owner's machine: `age -d -i ~/.config/age/firtech.key firtech-leads-<day>.json.age > leads.json`.
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { configured, sendFile, sendText } from './telegram.mjs'

const dataDir = process.env.DATA_DIR || '/var/www/firtech/shared/data'
const backupDir = join(dataDir, '..', 'backups')
const KEEP = 14
// Small JSON stores that are kept next to leads.json (dated copies, never sent to Telegram): the
// owner's price overrides (Пульт, «Цены») and the go-live plan state.
export const EXTRA_FILES = ['prices.json', 'golive.json']

// Copies each extra file that exists to `<name>-<day>.json` in the backup folder and prunes to KEEP
// copies per file. Returns the names copied.
export async function copyExtras(from, to, day) {
  const copied = []
  for (const file of EXTRA_FILES) {
    const stem = file.replace(/\.json$/, '')
    try {
      await copyFile(join(from, file), join(to, `${stem}-${day}.json`))
    } catch {
      continue
    }
    copied.push(file)
    const old = (await readdir(to)).filter((f) => f.startsWith(`${stem}-`)).sort().slice(0, -KEEP)
    for (const f of old) await rm(join(to, f))
  }
  return copied
}

export function shouldSend(hash, state) {
  return hash !== state?.lastHash
}

// An age X25519 recipient (`age1` + 58 bech32 characters) or an SSH public key age accepts.
export function ageRecipient(env = process.env) {
  const value = (env.BACKUP_AGE_RECIPIENT ?? '').trim()
  if (/^age1[02-9ac-hj-np-z]{58}$/.test(value)) return value
  if (/^(ssh-ed25519|ssh-rsa) [A-Za-z0-9+/=]{40,}( [^\s]*)?$/.test(value)) return value
  return null
}

// `age -r <recipient>` with the bytes on stdin; resolves the ciphertext, rejects on any failure.
export function ageEncrypt(bytes, recipient, { bin = process.env.AGE_BIN || 'age', spawnFn = spawn } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnFn(bin, ['-r', recipient], { stdio: ['pipe', 'pipe', 'pipe'] })
    const out = []
    child.stdout.on('data', (c) => out.push(c))
    child.stderr.on('data', () => {})
    child.on('error', reject)
    child.on('close', (code) => {
      const data = Buffer.concat(out)
      if (code === 0 && data.length > 0 && data.subarray(0, 21).toString('latin1') === 'age-encryption.org/v1') resolve(data)
      else reject(new Error(`age exited with ${code}`))
    })
    child.stdin.end(bytes)
  })
}

// What goes to Telegram: the encrypted file, or (no recipient, age failed) only a summary. Never the plain file.
export async function backupMessage(bytes, day, { env = process.env, encrypt = ageEncrypt } = {}) {
  let count = 0
  try {
    count = (JSON.parse(bytes.toString('utf8')).leads ?? []).length
  } catch {
    count = 0
  }
  const kb = Math.max(1, Math.round(bytes.length / 1024))
  const recipient = ageRecipient(env)
  if (!recipient) {
    return {
      kind: 'summary',
      count,
      text: `⚠️ Бэкап заявок fir.tech за ${day}: ${count} шт., ${kb} КБ. Файл НЕ отправлен: на сервере не задан BACKUP_AGE_RECIPIENT (открытый файл в Telegram не уходит). Копии лежат на сервере в shared/backups.`,
    }
  }
  try {
    const encrypted = await encrypt(bytes, recipient)
    return {
      kind: 'file',
      count,
      name: `firtech-leads-${day}.json.age`,
      bytes: encrypted,
      caption: `Бэкап заявок fir.tech за ${day}: ${count} шт. Зашифрован age, открыть: age -d -i <ваш ключ> firtech-leads-${day}.json.age`,
    }
  } catch {
    return {
      kind: 'summary',
      count,
      text: `⚠️ Бэкап заявок fir.tech за ${day}: ${count} шт., ${kb} КБ. Файл НЕ отправлен: шифрование age не сработало (установлен ли age на сервере?). Копии лежат на сервере в shared/backups.`,
    }
  }
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

  const extras = await copyExtras(dataDir, backupDir, day)
  if (extras.length) console.log(`also backed up: ${extras.join(', ')}`)

  const hash = createHash('sha256').update(bytes).digest('hex')
  const statePath = join(backupDir, 'state.json')
  const state = await readFile(statePath, 'utf8').then(JSON.parse).catch(() => null)
  if (!shouldSend(hash, state) || !configured()) return console.log('unchanged or no bot, kept locally')
  if (!ageRecipient() && state?.warnedHash === hash) return console.log('unchanged, warning already sent, kept locally')
  const message = await backupMessage(bytes, day)
  if (message.kind === 'file') {
    await sendFile(message.name, message.bytes, message.caption)
    await writeFile(statePath, JSON.stringify({ lastHash: hash, sentAt: new Date().toISOString() }))
    console.log(`sent encrypted backup with ${message.count} leads`)
  } else {
    // The hash is not stored: the next run tries again (once the recipient is set the file goes out).
    await sendText(message.text)
    await writeFile(statePath, JSON.stringify({ ...(state ?? {}), warnedHash: hash, warnedAt: new Date().toISOString() }))
    console.log(`backup NOT sent (no age recipient or age failed), summary only: ${message.count} leads`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('backup failed:', error.message)
    process.exitCode = 1
  })
}
