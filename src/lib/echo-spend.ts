import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { dataDir } from './store'

// Daily spending ceiling for Echo, so a stuck page or a long chat can't run up the Anthropic bill.
// Every reply's tokens are priced and added to $DATA_DIR/echo-spend.json (one total per UTC day);
// once the day's total reaches the cap, Echo answers "daily_cap" until midnight UTC.

// USD per million tokens, priced at the dearest model a reply can come from: Opus 5.5 is $4 / $20,
// a server-side fallback (Opus 5 or 4.8) is $5 / $25. Cache writes cost 1.25x input.
const PRICE = { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 }

// Owner can change it with ECHO_DAILY_USD in shared/.env.production. About a hundred spoken
// replies fit in the default.
export const DEFAULT_DAILY_USD = 3

export function dailyCapUsd(env = process.env.ECHO_DAILY_USD) {
  const value = Number(env)
  return env && Number.isFinite(value) && value >= 0 ? value : DEFAULT_DAILY_USD
}

type Tokens = {
  input_tokens?: number | null
  output_tokens?: number | null
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
}
export type EchoUsage = Tokens & { iterations?: Tokens[] | null }

const priced = (u: Tokens) =>
  ((u.input_tokens ?? 0) * PRICE.input +
    (u.output_tokens ?? 0) * PRICE.output +
    (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
    (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite) /
  1_000_000

// With a fallback, `iterations` lists every attempt and the top-level usage covers only the last.
export function costUsd(usage: EchoUsage) {
  return usage.iterations?.length
    ? usage.iterations.reduce((sum, u) => sum + priced(u), 0)
    : priced(usage)
}

type Ledger = { day: string; usd: number }
const fileName = () => path.join(dataDir(), 'echo-spend.json')
const today = (now: number) => new Date(now).toISOString().slice(0, 10)

async function load(now: number): Promise<Ledger> {
  try {
    const ledger = JSON.parse(await readFile(fileName(), 'utf8')) as Ledger
    if (ledger.day === today(now) && Number.isFinite(ledger.usd)) return ledger
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  return { day: today(now), usd: 0 }
}

export async function spentToday(now = Date.now()) {
  return (await load(now)).usd
}

let queue: Promise<unknown> = Promise.resolve()

// Adds one reply's cost. One write at a time, written the same safe way as the lead store.
export function addSpend(usd: number, now = Date.now()) {
  const run = queue.then(async () => {
    const ledger = await load(now)
    ledger.usd = Math.round((ledger.usd + usd) * 1e6) / 1e6
    await mkdir(dataDir(), { recursive: true })
    const tmp = `${fileName()}.${process.pid}.tmp`
    await writeFile(tmp, JSON.stringify(ledger), { mode: 0o600 })
    await rename(tmp, fileName())
    return ledger.usd
  })
  queue = run.catch(() => {})
  return run
}
