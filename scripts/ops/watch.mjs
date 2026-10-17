// Uptime watch, run by cron every 5 minutes on the VPS:
//   node --env-file=/var/www/firtech/shared/.env.production scripts/ops/watch.mjs
// Checks the public site (nginx + SSL + app) and the app port, and the certificate's expiry.
// Telegram only on changes: down after 2 failed runs in a row, back up again, and a certificate
// warning at most once a day when fewer than 14 days are left. It cannot report a dead server
// (it runs on it); an external monitor covers that.
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import tls from 'node:tls'
import { configured, sendText } from './telegram.mjs'

const dataDir = process.env.DATA_DIR || '/var/www/firtech/shared/data'
const statePath = join(dataDir, '..', 'watch-state.json')
const SITE = 'https://firtech.pro/api/health'
const LOCAL = 'http://127.0.0.1:3001/api/health'

async function ok(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    return res.ok ? null : `HTTP ${res.status}`
  } catch (error) {
    return error.name === 'TimeoutError' ? 'нет ответа 10 секунд' : error.message
  }
}

function certDaysLeft(host) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port: 443, servername: host, timeout: 10_000 }, () => {
      const left = (new Date(socket.getPeerCertificate().valid_to) - Date.now()) / 86_400_000
      socket.end()
      resolve(Math.floor(left))
    })
    socket.on('error', () => resolve(null))
    socket.on('timeout', () => (socket.destroy(), resolve(null)))
  })
}

// Pure decision: given the previous state and this run's result, what to say and what to keep.
export function decide(state, problem, now) {
  const fails = problem ? (state.fails ?? 0) + 1 : 0
  if (problem && fails === 2 && !state.down) {
    return { state: { fails, down: true, since: now }, say: `firtech.pro не работает: ${problem}. Проверяю каждые 5 минут.` }
  }
  if (!problem && state.down) {
    const minutes = Math.max(1, Math.round((now - (state.since ?? now)) / 60_000))
    return { state: { fails: 0, down: false }, say: `firtech.pro снова работает. Не отвечал около ${minutes} мин.` }
  }
  return { state: { ...state, fails }, say: null }
}

async function main() {
  const state = await readFile(statePath, 'utf8').then(JSON.parse).catch(() => ({}))
  const site = await ok(SITE)
  const local = site ? await ok(LOCAL) : null
  const problem = site ? (local ? `сайт и приложение (${site})` : `снаружи (${site}), приложение отвечает: смотрите nginx или SSL`) : null
  const now = Date.now()
  const result = decide(state, problem, now)

  const day = new Date(now).toISOString().slice(0, 10)
  const left = await certDaysLeft('firtech.pro')
  let say = result.say
  if (left !== null && left < 14 && state.certWarned !== day) {
    say = [say, `SSL-сертификат firtech.pro истекает через ${left} дн. Проверьте certbot renew.`].filter(Boolean).join('\n')
    result.state.certWarned = day
  } else if (state.certWarned) {
    result.state.certWarned = state.certWarned
  }

  if (say && configured()) await sendText(say)
  await writeFile(statePath, JSON.stringify(result.state))
  if (problem) console.log(new Date(now).toISOString(), problem)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('watch failed:', error.message)
    process.exitCode = 1
  })
}
