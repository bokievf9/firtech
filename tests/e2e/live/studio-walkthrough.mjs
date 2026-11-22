// Content screen against a LIVE local HQ (not the mock): opens EVERY material of HQ's feed, one by one, and records
// that opening sends no write (neither the browser to /api/admin/hq nor the site to HQ) and shows no «Something went wrong» / E-NOTPENDI.
// Phase 2 presses the buttons that exist and checks that decided materials have no decision buttons and that errors name the request.
// Usage: HQ_URL=http://127.0.0.1:8791/admin HQ_TOKEN=... HQ_REQLOG=<jsonl of HQ requests> SITE=http://localhost:3519 SITE_TOKEN=<session> OUT=<dir> node studio-walkthrough.mjs
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const { HQ_URL, HQ_TOKEN, HQ_REQLOG, SITE, SITE_TOKEN, OUT } = process.env
mkdirSync(OUT, { recursive: true })
const LOG = `${OUT}/walkthrough.log`
writeFileSync(LOG, '')
const say = (line) => {
  console.log(line)
  appendFileSync(LOG, `${line}\n`)
}
const hqLines = () => readFileSync(HQ_REQLOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
const feed = (await (await fetch(`${HQ_URL}/content/feed?limit=200`, { headers: { 'x-admin-token': HQ_TOKEN } })).json()).items
say(`feed: ${feed.length} materials`)
const BAD = /Something went wrong|E-NOTPENDI|E-[A-Z]{3,}-\d{4}|Failed:|not_pending/
let failures = 0
const check = (ok, what) => {
  if (!ok) failures++
  say(`  ${ok ? 'PASS' : 'FAIL'} ${what}`)
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await context.addCookies([{ name: 'firtech_admin', value: SITE_TOKEN, url: SITE }])
const page = await context.newPage()
const browserWrites = []
page.on('request', (r) => {
  if (r.url().includes('/api/admin/hq/') && r.method() !== 'GET' && !r.url().endsWith('/api/admin/hq/ping')) browserWrites.push(`${r.method()} ${r.url().replace(SITE, '')}`)
})

// ---- phase 1: open every material, read only -------------------------------------------------------------
say('\nPHASE 1: open every material (no clicks)')
const facts = []
for (const [n, item] of feed.entries()) {
  const before = hqLines().length
  browserWrites.length = 0
  await page.goto(`${SITE}/admin/content?tab=feed&focus=${item.id}`)
  const screen = page.locator('[data-studio="screen"]')
  await screen.waitFor({ timeout: 45_000 })
  await page.waitForTimeout(2200)
  const mode = await page.locator('[data-studio="preview"]').getAttribute('data-mode')
  const access = await screen.getAttribute('data-access')
  const buttons = (await screen.getByRole('button').allInnerTexts()).map((t) => t.trim()).filter(Boolean)
  const note = (await page.locator('[data-studio="read-only"]').allInnerTexts()).join(' | ')
  const renderState = (await screen.locator('p.font-mono').first().innerText()).trim()
  const text = await page.locator('body').innerText()
  const hq = hqLines().slice(before)
  // `POST /admin/ping` is the Shell's presence heartbeat (every page of the panel sends it), not a content call.
  const hqWrites = hq.filter((l) => l.kind === 'api' && l.method !== 'GET' && l.path !== '/admin/ping')
  say(`#${n + 1} id=${item.id} ${item.kind}/${item.status} reviewId=${item.reviewId} files=${item.files.length}`)
  say(`  mode=${mode} access=${access} render="${renderState}" buttons=[${buttons.join(', ')}]${note ? ` note="${note}"` : ''}`)
  say(`  HQ saw: ${hq.map((l) => `${l.method} ${l.path}${l.query ? `?${l.query}` : ''}`).join(' ; ') || '(nothing)'}`)
  check(hqWrites.length === 0 && browserWrites.length === 0, 'opening wrote nothing to HQ (HQ log and browser requests)')
  check(!BAD.test(text), 'no error text (Something went wrong / E-NOTPENDI / Failed:) on the screen')
  if (mode === 'pending') check(/Render pending/.test(text), 'honest «Render pending» for a material without a render')
  if (access === 'view') check(!buttons.some((b) => /^(Approve|Reject|Revise|Save text)$/.test(b)), 'view-only: no Approve / Reject / Revise / Save text')
  facts.push({ id: item.id, kind: item.kind, status: item.status, reviewId: item.reviewId, mode, access, buttons, note, renderState })
  if (n < 12 || item.status !== 'pending') await page.screenshot({ path: `${OUT}/shot-1440-${String(item.id).padStart(3, '0')}-${item.kind}-${item.status}.png` })
}
writeFileSync(`${OUT}/phase1-facts.json`, JSON.stringify(facts, null, 2))

// ---- 390 px shots for four representative materials -------------------------------------------------------
await page.setViewportSize({ width: 390, height: 844 })
for (const id of ['2', '5', '23', '4']) {
  await page.goto(`${SITE}/admin/content?tab=feed&focus=${id}`)
  await page.locator('[data-studio="screen"]').waitFor({ timeout: 30_000 })
  await page.waitForTimeout(1500)
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(over <= 1, `no horizontal overflow at 390 px (id ${id}, ${over}px)`)
  await page.screenshot({ path: `${OUT}/shot-390-${id}.png`, fullPage: true })
}
await page.setViewportSize({ width: 1440, height: 900 })

// ---- phase 2: buttons that exist -------------------------------------------------------------------------
say('\nPHASE 2: the buttons that exist')
const open = async (id) => {
  await page.goto(`${SITE}/admin/content?tab=feed&focus=${id}`)
  await page.locator('[data-studio="screen"]').waitFor({ timeout: 30_000 })
  await page.waitForTimeout(1200)
}
const toast = async () => (await page.locator('[role="status"], [role="alert"]').allInnerTexts()).join(' | ')

// a pending reel with a card: edit and save text, then approve
await open('17')
const ta = page.locator('[data-studio="text"] textarea').first()
check(await ta.isVisible(), 'pending material with a card: the text is editable')
await ta.fill('Живая правка владельца: проверка сохранения текста')
await page.getByRole('button', { name: 'Save text' }).click()
await page.waitForTimeout(1500)
say(`  after Save text: ${await toast()}`)
check(/Text saved/.test(await page.locator('body').innerText()), 'Save text succeeded on a pending material')
await page.getByRole('button', { name: 'Approve', exact: true }).click()
await page.waitForTimeout(2000)
say(`  after Approve: ${await toast()}`)

// a decided material with a card (approved post, id 2): edit is not offered; Another variant and Re-render may be
await open('2')
check((await page.getByRole('button', { name: 'Save text' }).count()) === 0, 'approved post: no Save text')
check((await page.getByRole('button', { name: 'Approve', exact: true }).count()) === 0, 'approved post: no Approve')
await page.getByRole('button', { name: 'Another variant' }).click()
await page.waitForTimeout(1500)
say(`  Another variant on a decided post: ${await toast()}`)
check(!BAD.test(await toast()), 'Another variant on a decided material works (no error)')
await open('2')
if (await page.getByRole('button', { name: 'Re-render' }).count()) {
  await page.getByRole('button', { name: 'Re-render' }).click()
  await page.waitForTimeout(2500)
  const t = await toast()
  say(`  Re-render on the approved post: ${t || '(no toast)'}`)
  check(!/Something went wrong|E-[A-Z]{3,}-\d{4}/.test(t), 'Re-render: no generic error (a named failure is acceptable)')
}

// For a niche on a rejected material
await open('3')
await page.getByLabel('Niche').fill('барбершоп')
await page.getByRole('button', { name: 'Rewrite for the niche' }).click()
await page.waitForTimeout(1500)
say(`  For a niche on a rejected story: ${await toast()}`)

// Prompt box inline
await open('3')
await page.locator('form[data-studio="prompt"] textarea').fill('Про живые проверки в барбершопе')
await page.locator('form[data-studio="prompt"]').getByRole('button', { name: 'Send to Content Maker' }).click()
await page.waitForTimeout(1500)
say(`  Prompt: ${await toast()}`)

// A forced stale action: a feed row that says «pending» with NO card (id 21, legacy proposed carousel) offers no Approve
await open('21')
check((await page.getByRole('button', { name: 'Approve', exact: true }).count()) === 0, 'legacy «pending» without a card: no Approve (it would be 409 not_pending)')

// Error naming: call the proxy the way the screen would for a decided card and show the error text it builds
const stale = await page.evaluate(async () => {
  const r = await fetch('/api/admin/hq/review/ap_3', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'edit', text: { caption: 'x' } }) })
  return r.json()
})
say(`  raw 409 body through the proxy: ${JSON.stringify(stale)}`)
check(stale.error === 'not_pending' && stale.http === 409, 'the proxy carries HQ HTTP status + code (409 not_pending) for the error message')

await browser.close()
say(`\nRESULT: ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`)
process.exit(failures ? 1 : 0)
