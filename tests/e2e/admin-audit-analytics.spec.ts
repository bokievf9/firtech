import { expect, test } from '@playwright/test'
import { adminContext, noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// HQ «Audit log» and «Analytics» (2026-11-23) over the dev mock of HQ.
const noise = [/WebGL|GPU stall|swiftshader|Failed to load resource/i]

test('Audit log and Analytics refuse a visitor without a session', async ({ page }) => {
  for (const url of ['/admin/audit', '/admin/analytics']) {
    await open(page, url)
    await expect(page).toHaveURL(/\/admin\/login/)
  }
})

test.describe('with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('Audit log: list, filters by kind, actor and date, paging, reset', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/audit')
    await expect(page.getByRole('heading', { name: 'Audit log', level: 1 })).toBeVisible()
    await expect(page.locator('[data-soon]')).toHaveCount(0)
    const rows = page.locator('[data-audit-entry]')
    await expect(rows.first()).toBeVisible()
    await expect(rows).toHaveCount(50)

    // «Показать ещё» adds the next page
    await page.locator('[data-audit-more]').click()
    await expect(rows).toHaveCount(60)
    await expect(page.locator('[data-audit-more]')).toHaveCount(0)

    await page.getByLabel('Kind').selectOption('trust')
    await expect(page.locator('[data-audit-entry]:not([data-kind="trust"])')).toHaveCount(0)
    await expect(rows.first()).toBeVisible()
    await page.getByLabel('Who').selectOption('system')
    await expect(page.locator('[data-audit-list]')).toHaveCount(0)
    await page.getByRole('button', { name: 'Reset filters' }).click()
    await page.getByLabel('Who').selectOption('system')
    await expect(rows.first()).toBeVisible()
    await expect(page.locator('[data-audit-entry]:not([data-kind="decision"])')).toHaveCount(0)

    // a date range in the past has nothing
    await page.getByRole('button', { name: 'Reset filters' }).click()
    await page.getByLabel('From', { exact: true }).fill('2020-01-01')
    await page.getByLabel('To', { exact: true }).fill('2020-01-02')
    await expect(page.getByText('No entries for these filters.')).toBeVisible()
    await page.getByRole('button', { name: 'Reset filters' }).click()
    await expect(rows.first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('Audit log: an instruction change links to the agent card', async ({ page }) => {
    await open(page, '/admin/audit')
    await page.getByLabel('Kind').selectOption('instruction')
    await page.locator('[data-audit-entry][data-kind="instruction"]').first().getByRole('link').click()
    await expect(page).toHaveURL(/\/admin\/agents\?agent=marketing-head/)
  })

  test('Analytics: funnel, first answer, site events against last week, sources, week switcher', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/analytics')
    await expect(page.getByRole('heading', { name: 'Analytics', level: 1 })).toBeVisible()
    await expect(page.locator('[data-soon]')).toHaveCount(0)
    const steps = page.locator('[data-funnel-step]')
    await expect(steps).toHaveCount(5)
    await expect(page.locator('[data-funnel-step="leads"] [data-value]')).toHaveText('14')
    await expect(page.locator('[data-funnel-step="qualified"]')).toContainText('64% of the step above')
    await expect(page.locator('[data-response="avg"]')).toHaveText('19 min')
    await expect(page.locator('[data-site-event="chat_open"]')).toContainText('+15')
    await expect(page.locator('[data-source="site"]')).toBeVisible()

    const week = (await page.locator('[data-analytics-week]').textContent()) ?? ''
    await page.getByRole('button', { name: 'Last week' }).click()
    await expect(page.locator('[data-analytics-week]')).not.toHaveText(week)
    await page.getByRole('button', { name: 'Current' }).click()
    await expect(page.locator('[data-analytics-week]')).toHaveText(week)
    expect(errors).toEqual([])
  })

  test('the menu lists Audit log and Analytics after Settings and there is no horizontal overflow', async ({ page }) => {
    await open(page, '/admin/inbox')
    await page.getByRole('link', { name: /^Audit log/ }).first().click()
    await expect(page).toHaveURL(/\/admin\/audit/)
    await page.getByRole('link', { name: /^Analytics/ }).first().click()
    await expect(page).toHaveURL(/\/admin\/analytics/)
    for (const size of Object.values(SIZES)) {
      await page.setViewportSize(size)
      await noHorizontalOverflow(page, '/admin/audit')
      await noHorizontalOverflow(page, '/admin/analytics')
    }
  })
})
