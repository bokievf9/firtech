import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { dataDir } from './store'

// Daily spending ceiling for Echo, so a stuck page or a long chat can't run up the Anthropic bill.
// Every reply's tokens are priced and added to $DATA_DIR/echo-spend.json (one total per UTC day);
// once the day's total reaches the cap, Echo answers "daily_cap" until midnight UTC.

// USD per million tokens. Sonnet 5.5 is $2 / $10 and Opus 5.5 is $4 / $20. A server-side fallback
// (Opus 5 or 4.8, or the dearer model of the two) is priced at $5 / $25, the dearest a reply can
// cost. Cache reads cost 0.1x input, cache writes 1.25x input.
const rates = (input: number, output: number) => ({
  input,
  output,
  cacheRead: input / 10,
  cacheWrite: input * 1.25,
})
export const PRICES = {
  sonnet: rates(2, 10),
  opus: rates(4, 20),
  fallback: rates(5, 25),
}
export type PriceKey = keyof typeof PRICES
export type EchoModelKey = 'sonnet' | 'opus'

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

const priced = (u: Tokens, p: (typeof PRICES)[PriceKey]) =>
  ((u.input_tokens ?? 0) * p.input +
    (u.output_tokens ?? 0) * p.output +
    (u.cache_read_input_tokens ?? 0) * p.cacheRead +
    (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) /
  1_000_000

// One API call. Without a model it is priced at the dearest rate. With a fallback, `iterations`
// lists every attempt and the top-level usage covers only the last; if there was more than one
// attempt another model may have answered, so all of them are priced at the fallback rate.
export function costUsd(usage: EchoUsage, model?: EchoModelKey) {
  const attempts = usage.iterations?.length ? usage.iterations : [usage]
  const rate = PRICES[model && attempts.length <= 1 ? model : 'fallback']
  return attempts.reduce((sum, u) => sum + priced(u, rate), 0)
}

// A tool loop is several API calls; every one of them is paid.
export const loopCostUsd = (usages: EchoUsage[], model?: EchoModelKey) =>
  usages.reduce((sum, u) => sum + costUsd(u, model), 0)

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
