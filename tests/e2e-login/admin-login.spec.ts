import { expect, test } from '@playwright/test'
import { E2E_ADMIN_PASSWORD } from './password'

// The password login of Shell against a server with a throwaway ADMIN_PASSWORD_HASH
// (playwright.login.config.ts). The closed login (no hash) is checked in tests/e2e/admin.spec.ts.

test('wrong password, then the right one lands on /admin/inbox; Sign out ends the session', async ({ page }) => {
  await page.goto('/admin/inbox')
  await expect(page).toHaveURL(/\/admin\/login$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in to Shell' })).toBeVisible()

  const field = page.getByLabel('Password', { exact: true })
  await expect(field).toHaveAttribute('type', 'password')
  await expect(field).toHaveAttribute('autocomplete', 'current-password')
  await field.fill('definitely-not-the-password')
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(field).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Hide password' }).click()
  await expect(field).toHaveAttribute('type', 'password')

  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.locator('form [role=alert]')).toHaveText('Wrong password.')
  await expect(field).toHaveValue('')
  await expect(page).toHaveURL(/\/admin\/login$/)

  await field.fill(E2E_ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/admin\/inbox$/)
  const cookie = (await page.context().cookies()).find((c) => c.name === 'firtech_admin')
  expect(cookie?.httpOnly).toBe(true)
  expect(cookie?.sameSite).toBe('Strict')

  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL(/\/admin\/login$/)
  expect((await page.context().cookies()).find((c) => c.name === 'firtech_admin')).toBeUndefined()
  // The old cookie value no longer opens anything (revoked on the server, not only cleared).
  await page.context().addCookies([{ name: 'firtech_admin', value: cookie!.value, url: page.url() }])
  await page.goto('/admin/inbox')
  await expect(page).toHaveURL(/\/admin\/login$/)
})

test('the login API answers 401 to a wrong password and 403 to a foreign origin', async ({ request, baseURL }) => {
  const wrong = await request.post('/api/admin/login', {
    data: { password: 'another-wrong-password' },
    headers: { origin: baseURL! },
  })
  expect(wrong.status()).toBe(401)
  expect(await wrong.json()).toEqual({ ok: false, error: 'wrong' })
  const foreign = await request.post('/api/admin/login', {
    data: { password: E2E_ADMIN_PASSWORD },
    headers: { origin: 'https://evil.example' },
  })
  expect(foreign.status()).toBe(403)
})
