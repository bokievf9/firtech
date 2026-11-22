import { expect, test } from '@playwright/test'
import { noHorizontalOverflow, open, watchErrors } from './helpers'

// Sign-up and password reset by a 6-digit code (owner review 2026-11-22, item 12) against the stand-in Supabase:
// code 123456 verifies, any other code is `otp_expired`, 999999 is the attempt limit.
const fake = `http://127.0.0.1:${process.env.FAKE_SUPABASE_PORT ?? 3418}`
const calls = async () => (await (await fetch(`${fake}/__fake/auth`)).json()) as { path: string; type?: string; token?: string }[]

test.describe.configure({ mode: 'serial' })
test.beforeEach(async () => {
  await fetch(`${fake}/__fake/reset`, { method: 'POST' })
})

async function signUp(page: import('@playwright/test').Page, email = 'new@example.com') {
  await open(page, '/ru/cabinet/login')
  await page.getByRole('tab', { name: 'Создать аккаунт' }).click()
  await page.locator('input[name=email]').fill(email)
  await page.locator('input[name=password]').fill('correct-horse-1')
  await page.locator('form button[type=submit]').filter({ hasText: 'Создать аккаунт' }).click()
  await expect(page.locator('[data-code-form=signup]')).toBeVisible()
}

test('sign-up: the code screen, a wrong code shows the error, a right one opens the cabinet', async ({ page }) => {
  const errors = watchErrors(page, [/Failed to load resource/])
  await signUp(page)
  const code = page.locator('input[name=token]')
  await expect(code).toBeFocused()
  await expect(page.locator('[data-code-form] [data-resend] button')).toBeDisabled()
  await expect(page.locator('[data-code-form]')).toContainText('new@example.com')
  await code.fill('000000')
  await expect(page.locator('[data-code-form] [data-error-code]')).toContainText('неверный или уже устарел')
  await code.fill('123456')
  await page.waitForURL(/\/ru\/cabinet(\?|$)/)
  expect((await calls()).some((c) => c.path === '/verify' && c.type === 'signup' && c.token === '123456')).toBe(true)
  expect(errors).toEqual([])
})

test('sign-up: a pasted code with spaces fills in and submits by itself; too many tries shows the limit', async ({ page }) => {
  await signUp(page)
  const code = page.locator('input[name=token]')
  await code.fill('999 999')
  await expect(page.locator('[data-code-form] [data-error-code]')).toContainText('Слишком много попыток')
  await expect(code).toHaveValue('999999')
  await noHorizontalOverflow(page, 'code screen')
})

test('sign-up on a phone: no horizontal scroll on the code screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signUp(page)
  await noHorizontalOverflow(page, 'code screen 390')
})

test('password reset: the request shows the code form, the code leads to the new-password page', async ({ page }) => {
  await open(page, '/ru/cabinet/login')
  await page.getByRole('button', { name: 'Забыли пароль?' }).click()
  await page.locator('input[name=email]').fill('anna@example.com')
  await page.locator('form button[type=submit]').click()
  await expect(page.locator('[data-code-form=recovery]')).toBeVisible()
  await page.locator('input[name=token]').fill('123456')
  await page.waitForURL(/\/ru\/cabinet\/reset/)
  expect((await calls()).some((c) => c.path === '/verify' && c.type === 'recovery')).toBe(true)
})
