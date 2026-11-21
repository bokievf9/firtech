import { createHmac } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { FAKE_USER_ID, fakeSessionCookie, noHorizontalOverflow, open, watchErrors } from './helpers'

// Cabinet profile (owner review 2026-11-22, items 10 and 11) against the stand-in Supabase: the newsletter
// switch stays on after saving and after a reload, a text field saves on blur, a database refusal shows its
// reason and rolls the switch back, the Telegram channel needs a nick, the unsubscribe link switches one
// setting off, no horizontal scroll at 390 px.
const fake = `http://127.0.0.1:${process.env.FAKE_SUPABASE_PORT ?? 3418}`
const stored = async () => (await (await fetch(`${fake}/__fake/profile`)).json()) as Record<string, unknown>
const mode = (body: object) => fetch(`${fake}/__fake/mode`, { method: 'POST', body: JSON.stringify(body) })

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ context, baseURL }) => {
  await fetch(`${fake}/__fake/reset`, { method: 'POST' })
  await context.addCookies([{ ...fakeSessionCookie(), url: baseURL! }])
})

async function openProfile(page: Page) {
  await open(page, '/ru/cabinet?tab=profile')
  await expect(page.locator('[data-profile-panel]')).toBeVisible()
}

test('profile: the newsletter switch stays on after saving and after a reload (item 10)', async ({ page }) => {
  const errors = watchErrors(page)
  await openProfile(page)
  const sw = page.locator('[data-pref=marketing] [role=switch]')
  await expect(sw).toHaveAttribute('aria-checked', 'false')
  await sw.click()
  await expect(page.locator('[data-pref=marketing]')).toContainText('Сохранено')
  await expect(sw).toHaveAttribute('aria-checked', 'true')
  expect((await stored()).marketing_consent).toBe(true)
  await page.locator('[data-pref=recommendations] [role=switch]').click()
  await expect(page.locator('[data-pref=recommendations]')).toContainText('Сохранено')
  await page.reload()
  await expect(page.locator('[data-pref=marketing] [role=switch]')).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('[data-pref=recommendations] [role=switch]')).toHaveAttribute('aria-checked', 'true')
  expect(errors).toEqual([])
})

test('profile: a text field saves on blur, a bad value shows its reason and keeps the text', async ({ page }) => {
  await openProfile(page)
  const company = page.locator('input[name=company]')
  await company.fill('Салон Лотос')
  await company.press('Enter')
  await expect.poll(async () => (await stored()).company).toBe('Салон Лотос')
  const site = page.locator('input[name=website]')
  await site.fill('not a site')
  await site.blur()
  await expect(page.getByRole('alert').filter({ hasText: 'Адрес сайта не распознан' })).toBeVisible()
  await expect(site).toHaveValue('not a site')
  expect((await stored()).website).toBeNull()
})

test('profile: a database refusal (RLS) rolls the switch back and says why', async ({ page }) => {
  await openProfile(page)
  await mode({ rls: 'deny' })
  const sw = page.locator('[data-pref=marketing] [role=switch]')
  await sw.click()
  await expect(page.getByRole('alert').filter({ hasText: 'база не дала записать' })).toBeVisible()
  await expect(sw).toHaveAttribute('aria-checked', 'false')
  expect((await stored()).marketing_consent).toBe(false)
})

test('profile: Telegram channel needs a nick; clearing the nick moves the channel back to email', async ({ page }) => {
  await openProfile(page)
  await page.getByRole('radio', { name: 'Почта и Telegram' }).check()
  await expect.poll(async () => (await stored()).notify_channel).toBe('both')
  const tg = page.locator('input[name=telegram]')
  await tg.fill('')
  await tg.blur()
  await expect.poll(async () => (await stored()).notify_channel).toBe('email')
  await expect(page.getByRole('radio', { name: 'Telegram', exact: true })).toBeDisabled()
})

test('profile: no horizontal scroll at 390 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openProfile(page)
  await noHorizontalOverflow(page, 'profile 390')
})

test('unsubscribe link: opening changes nothing, the button switches the one setting off', async ({ page, context }) => {
  await context.clearCookies()
  await fetch(`${fake}/__fake/reset`, { method: 'POST' })
  // Seed «on» through the service role, as an earlier save would have.
  await fetch(`${fake}/rest/v1/profiles?id=eq.${FAKE_USER_ID}`, {
    method: 'PATCH',
    headers: { authorization: 'Bearer e2e-service-key', 'content-type': 'application/json' },
    body: JSON.stringify({ marketing_consent: true }),
  })
  const sig = createHmac('sha256', 'e2e-unsubscribe-secret-0123456789').update(`unsub:v1:${FAKE_USER_ID}:marketing`).digest('base64url')
  const token = `${Buffer.from(FAKE_USER_ID).toString('base64url')}.marketing.${sig}`
  await open(page, `/ru/cabinet/unsubscribe?token=${encodeURIComponent(token)}`)
  await expect(page.locator('[data-unsubscribe=ask]')).toContainText('Новости и акции')
  expect((await stored()).marketing_consent).toBe(true)
  await page.getByRole('button', { name: 'Отписаться' }).click()
  await expect(page.locator('[data-unsubscribe=ok]')).toContainText('больше не придут')
  expect((await stored()).marketing_consent).toBe(false)
  await open(page, `/ru/cabinet/unsubscribe?token=${encodeURIComponent(token.slice(0, -3))}`)
  await expect(page.locator('[data-unsubscribe=error]')).toContainText('Ссылка не подходит')
})
