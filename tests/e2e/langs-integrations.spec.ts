import { expect, test, type Page } from '@playwright/test'
import { noHorizontalOverflow, open, watchErrors } from './helpers'

// «Языки» and «Подключаем» (owner audit 2026-11-24): the two honest blocks on the agent page, the AI-team page,
// the builder agent step (compact) and the home agents section.
const signedIn = (page: Page) =>
  page.route('**/api/cabinet/me', (route) =>
    route.fulfill({ json: { enabled: true, signedIn: true, email: 'e2e@example.com', name: 'E2E', telegram: '' } }),
  )
const next = (page: Page) => page.getByRole('button', { name: /^Дальше/ })

test('agent page shows the integrations list, the languages note and the Uzbek example', async ({ page }) => {
  const errors = watchErrors(page)
  await open(page, '/ru/ai-team/agent/lead-handler')
  const list = page.locator('[data-integrations-list]:not([data-compact])')
  await expect(list).toContainText('Подключаем')
  for (const name of ['Bitrix24', 'amoCRM', 'Google Sheets', 'Telegram Mini App', 'Другая CRM по API']) await expect(list).toContainText(name)
  await expect(list).toContainText('Подключение входит в этап запуска')
  await expect(page.locator('[data-languages-note]')).toContainText('Узбекский, казахский и таджикский')
  const example = page.locator('[data-languages-example]')
  await expect(example).toContainText('Пример на узбекском')
  await example.locator('summary').click()
  await expect(example.locator('li')).toHaveCount(3)
  await expect(example).toContainText('Salom')
  await noHorizontalOverflow(page, 'agent page')
  expect(errors).toEqual([])
})

test('agent page in English', async ({ page }) => {
  await open(page, '/en/ai-team/agent/lead-handler')
  await expect(page.locator('[data-integrations-list]')).toContainText('We connect')
  await expect(page.locator('[data-languages-note]')).toContainText('Uzbek, Kazakh and Tajik')
  await expect(page.locator('[data-languages-example]')).toContainText('Example in Uzbek')
})

test('AI-team page shows both blocks without the example', async ({ page }) => {
  await open(page, '/ru/ai-team/sales')
  await expect(page.locator('[data-integrations-list]')).toContainText('Bitrix24')
  await expect(page.locator('[data-languages-note]')).toBeVisible()
  await expect(page.locator('[data-languages-example]')).toHaveCount(0)
})

test('builder agent step shows the languages note and the compact list', async ({ page }) => {
  await signedIn(page)
  await open(page, '/ru/ai-team/agent/lead-handler')
  await page.locator('[data-cta="agent_lead-handler_build"]').first().click()
  await page.waitForURL(/\/ru\/builder\?b=a\.lead-handler/)
  await expect(page.getByRole('radio', { name: /^Менеджер заявок/ })).toHaveAttribute('aria-checked', 'true')
  await next(page).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Где клиенты пишут вам?' })).toBeVisible()
  await expect(page.locator('[data-languages-note]')).toBeVisible()
  await page.getByRole('checkbox', { name: /^Telegram/ }).click()
  await next(page).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Куда складывать заявки и записи?' })).toBeVisible()
  const compact = page.locator('[data-integrations-list][data-compact="true"]')
  await expect(compact).toContainText('Google Sheets')
  await expect(compact).toContainText('Telegram Mini App')
})

test('home agents section carries the one-line list', async ({ page }) => {
  await open(page, '/ru')
  await expect(page.locator('[data-home-agents] [data-integrations-list][data-compact="true"]')).toContainText('amoCRM')
})
