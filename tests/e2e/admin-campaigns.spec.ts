import { expect, test } from '@playwright/test'
import { adminContext, noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// HQ «Campaigns» (2026-11-23) over the dev mock of HQ.
const noise = [/WebGL|GPU stall|swiftshader|Failed to load resource/i]

test('Campaigns refuses a visitor without a session', async ({ page }) => {
  await open(page, '/admin/content?tab=campaigns')
  await expect(page).toHaveURL(/\/admin\/login/)
})

test.describe('with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('list with statuses and counters, card with a journal without addresses', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/content?tab=campaigns')
    await expect(page.getByRole('heading', { name: 'Content', level: 1 })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Campaigns', selected: true })).toBeVisible()
    await expect(page.locator('[data-soon]')).toHaveCount(0)
    for (const s of ['pending', 'sent', 'rejected', 'failed']) await expect(page.locator(`[data-campaign][data-status="${s}"]`).first()).toBeVisible()
    await expect(page.locator('[data-campaign="3"]')).toContainText('Письмо ушло')
    await page.locator('[data-campaign-open="3"]').click()
    const card = page.locator('[data-campaign-card="3"]')
    await expect(card).toBeVisible()
    await expect(card.locator('[data-log-client]').first()).toContainText('клиент #')
    await expect(card.locator('[data-campaign-log]')).not.toContainText('@')
    expect(errors).toEqual([])
  })

  test('new mailing: warning, validation, draft in the list, link to Approvals', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/content?tab=campaigns')
    await page.locator('[data-campaign-new]').click()
    await expect(page.locator('[data-campaign-warning]')).toContainText('Ничего не уйдёт без вашего одобрения')
    await page.getByRole('button', { name: 'Создать черновик' }).click()
    await expect(page.locator('[data-campaign-error]')).toBeVisible()

    await page.getByLabel('Тема, русский').fill('E2E: новости')
    await page.getByLabel('Текст, русский').fill('Короткий текст рассылки')
    await page.getByLabel('Город').fill('Nowhere')
    await page.getByRole('button', { name: 'Создать черновик' }).click()
    await expect(page.locator('[data-campaign-error]')).toContainText('Никто из клиентов не подходит')

    await page.getByLabel('Город').fill('')
    await page.getByRole('button', { name: 'Создать черновик' }).click()
    await expect(page.locator('[data-campaign-created]')).toContainText('Письма не отправлены')
    await expect(page.locator('[data-campaign][data-status="pending"]').first()).toContainText('E2E: новости')
    await page.locator('[data-campaign-approve]').click()
    await expect(page).toHaveURL(/\/admin\/approvals\?tab=content/)
    expect(errors).toEqual([])
  })

  test('/admin/campaigns redirects into Content, Campaigns is a tab and there is no horizontal overflow', async ({ page }) => {
    await open(page, '/admin/campaigns')
    await expect(page).toHaveURL(/\/admin\/content\?tab=campaigns/)
    await expect(page.getByRole('link', { name: /^Campaigns/ })).toHaveCount(0)
    for (const size of Object.values(SIZES)) {
      await page.setViewportSize(size)
      await noHorizontalOverflow(page, '/admin/content?tab=campaigns')
    }
  })
})
