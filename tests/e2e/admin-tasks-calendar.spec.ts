import { expect, test } from '@playwright/test'
import { adminContext, noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// HQ «Tasks» and «Calendar» (2026-11-23) over the dev mock of HQ.
const noise = [/WebGL|GPU stall|swiftshader|Failed to load resource/i]

test('Tasks and Calendar refuse a visitor without a session', async ({ page }) => {
  for (const url of ['/admin/tasks', '/admin/calendar']) {
    await open(page, url)
    await expect(page).toHaveURL(/\/admin\/login/)
  }
})

test.describe('with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('Tasks: all tasks in one list, filters by department, agent and status, the task card', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/tasks')
    await expect(page.getByRole('heading', { name: 'Tasks', level: 1 })).toBeVisible()
    await expect(page.locator('[data-soon]')).toHaveCount(0)
    const tasks = page.locator('[data-tasks-list] [data-task]')
    await expect(tasks.first()).toBeVisible()
    const all = await tasks.count()
    expect(all).toBeGreaterThan(8)

    await page.getByLabel('Отдел').selectOption('sales')
    await expect(page.locator('[data-task="23"]')).toBeVisible()
    await expect(page.locator('[data-task="12"]')).toHaveCount(0)
    // the agent list follows the department
    await expect(page.getByLabel('Агент').locator('option', { hasText: 'Content Maker' })).toHaveCount(0)

    await page.getByLabel('Статус').selectOption('approval')
    await expect(page.locator('[data-task="23"]')).toBeVisible()
    await expect(page.locator('[data-task="21"]')).toHaveCount(0)

    await page.getByRole('button', { name: 'Сбросить фильтры' }).click()
    await expect(tasks).toHaveCount(all)

    await page.getByLabel('Агент').selectOption('content-maker')
    await expect(page.locator('[data-task="13"]')).toBeVisible()
    await expect(page.locator('[data-task="21"]')).toHaveCount(0)

    await page.locator('[data-task="13"] button').first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog')).toContainText('Клип: ИИ-менеджер заявок')
    expect(errors).toEqual([])
  })

  test('Tasks: the composer of the orders is there and a blocked task offers «В работу»', async ({ page }) => {
    await open(page, '/admin/tasks')
    await expect(page.getByLabel('Новое поручение Директору')).toBeVisible()
    await page.getByLabel('Статус').selectOption('blocked')
    await expect(page.locator('[data-task="15"]')).toBeVisible()
    await expect(page.locator('[data-task="15"]').getByRole('button', { name: /В работу/ })).toBeVisible()
  })

  test('Calendar: week grid with all four kinds, month view, filters, a click opens the section', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/calendar')
    await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible()
    await expect(page.locator('[data-soon]')).toHaveCount(0)
    const week = page.locator('[data-cal-grid="week"]')
    await expect(week).toBeVisible()
    await expect(week.locator('[data-cal-day]')).toHaveCount(7)
    for (const kind of ['call', 'milestone', 'routine', 'content']) await expect(page.locator(`[data-cal-event][data-kind="${kind}"]`).first()).toBeAttached()

    // the kind filter hides one kind
    await page.locator('[data-kind-filter="routine"]').click()
    await expect(page.locator('[data-cal-event][data-kind="routine"]')).toHaveCount(0)
    await page.locator('[data-kind-filter="routine"]').click()
    await expect(page.locator('[data-cal-event][data-kind="routine"]').first()).toBeAttached()

    // next week, then back to today
    const title = (await page.locator('[data-cal-title]').textContent()) ?? ''
    await page.getByRole('button', { name: 'Вперёд' }).click()
    await expect(page.locator('[data-cal-title]')).not.toHaveText(title)
    await page.getByRole('button', { name: 'Сегодня' }).click()
    await expect(page.locator('[data-cal-title]')).toHaveText(title)

    // month view: whole weeks, today marked
    await page.getByRole('button', { name: 'Месяц', exact: true }).click()
    const month = page.locator('[data-cal-grid="month"]')
    await expect(month).toBeVisible()
    expect(await month.locator('[data-cal-day]').count() % 7).toBe(0)
    await expect(month.locator('[data-today="true"]')).toHaveCount(1)
    await page.getByRole('button', { name: 'Неделя', exact: true }).click()

    // a click on a call goes to the calls tab of Clients, a stage to Projects, content to Content
    const call = page.locator('[data-cal-event][data-kind="call"]').first()
    await call.scrollIntoViewIfNeeded()
    await call.click()
    await expect(page).toHaveURL(/\/admin\/clients\?tab=calls&focus=\d+/)
    await page.goBack()
    await page.locator('[data-cal-event][data-kind="milestone"]').first().click()
    await expect(page).toHaveURL(/\/admin\/projects\?tab=projects&focus=2/)
    await page.goBack()
    await page.locator('[data-cal-event][data-kind="content"]').first().click()
    await expect(page).toHaveURL(/\/admin\/content\?tab=feed&focus=\d+/)
    expect(errors).toEqual([])
  })

  test('the menu opens Tasks and Calendar (no placeholder) and there is no horizontal overflow', async ({ page }) => {
    await open(page, '/admin/inbox')
    await page.getByRole('link', { name: /^Calendar/ }).first().click()
    await expect(page).toHaveURL(/\/admin\/calendar/)
    await expect(page.locator('[data-soon]')).toHaveCount(0)
    for (const size of Object.values(SIZES)) {
      await page.setViewportSize(size)
      await noHorizontalOverflow(page, '/admin/calendar')
      await noHorizontalOverflow(page, '/admin/tasks')
    }
  })
})
