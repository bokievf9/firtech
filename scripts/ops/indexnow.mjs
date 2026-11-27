// Tells IndexNow (Bing, Yandex, Seznam, Naver...) about the site's URLs:
//   INDEXNOW_KEY=<32 hex> node scripts/ops/indexnow.mjs [--changed-since=2026-11-27T00:00:00Z] [--dry-run]
// Reads https://firtech.pro/sitemap.xml, posts the URLs in batches of at most 10 000 to
// https://api.indexnow.org/indexnow. Exits 0 on 200/202 (and on a missing key: nothing to do), 1 otherwise.
import { pathToFileURL } from 'node:url'

export const HOST = 'firtech.pro'
export const SITEMAP = `https://${HOST}/sitemap.xml`
export const ENDPOINT = 'https://api.indexnow.org/indexnow'
export const BATCH = 10000

// [{loc, lastmod}] from a sitemap XML text.
export function parseSitemap(xml) {
  const out = []
  for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) ?? []) {
    const loc = /<loc>\s*([^<]+?)\s*<\/loc>/.exec(block)?.[1]
    if (!loc) continue
    const lastmod = /<lastmod>\s*([^<]+?)\s*<\/lastmod>/.exec(block)?.[1]
    out.push({ loc: loc.replaceAll('&amp;', '&'), lastmod })
  }
  return out
}

// Keeps entries changed since `iso`; entries without a lastmod are kept (we cannot tell).
export function filterChanged(entries, iso) {
  if (!iso) return entries
  const since = Date.parse(iso)
  if (Number.isNaN(since)) throw new Error(`Bad --changed-since value: ${iso}`)
  return entries.filter((e) => {
    const t = e.lastmod ? Date.parse(e.lastmod) : NaN
    return Number.isNaN(t) || t >= since
  })
}

export function batches(list, size = BATCH) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

export function payload(key, urlList) {
  return { host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList }
}

export async function run({ key, changedSince, dryRun = false, fetchImpl = fetch, log = console.log } = {}) {
  if (!/^[0-9a-f]{32}$/.test(key ?? '')) {
    log('INDEXNOW_KEY is not set (32 hex characters): nothing to do.')
    return 0
  }
  const res = await fetchImpl(SITEMAP)
  if (!res.ok) {
    log(`Sitemap ${SITEMAP} answered ${res.status}.`)
    return 1
  }
  const all = parseSitemap(await res.text())
  const urls = filterChanged(all, changedSince).map((e) => e.loc)
  log(`Sitemap: ${all.length} URLs, ${urls.length} to send.`)
  if (dryRun || urls.length === 0) return 0
  let failed = 0
  let sent = 0
  for (const chunk of batches(urls)) {
    const r = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload(key, chunk)),
    })
    if (r.status === 200 || r.status === 202) sent += chunk.length
    else {
      failed += 1
      log(`IndexNow answered ${r.status} for a batch of ${chunk.length}.`)
    }
  }
  log(`Submitted ${sent} URLs, ${failed} failed batches.`)
  return failed ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
  run({
    key: process.env.INDEXNOW_KEY?.trim(),
    changedSince: arg('changed-since'),
    dryRun: process.argv.includes('--dry-run'),
  }).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err.message)
      process.exit(1)
    },
  )
}
