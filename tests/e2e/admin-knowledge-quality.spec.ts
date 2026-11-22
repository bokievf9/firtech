import { expect, test } from '@playwright/test'
import { adminContext, noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// HQ «Knowledge» and «Quality» (2026-11-23) over the dev mock of HQ.
const noise = [/WebGL|GPU stall|swiftshader|Failed to load resource/i]

test('Knowledge and Quality refuse a visitor without a session', async ({ page }) => {
  for (const url of ['/admin/knowledge', '/admin/quality']) {
    await open(page, url)
    await expect(page).toHaveURL(/\/admin\/login/)
  }
})

test.describe('with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('Knowledge: list, filters, search, a read-only document, owner note create, edit, delete, rebuild', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/knowledge')
    await expect(page.getByRole('heading', { name: 'Knowledge', level: 1 })).toBeVisible()
    await expect(page.locator('[data-soon]')).toHaveCount(0)
    const rows = page.locator('[data-knowledge-item]')
    await expect(rows.first()).toBeVisible()
    const all = await rows.count()
    expect(all).toBeGreaterThan(7)

    await page.getByLabel('Уровень').first().selectOption('public')
    await expect(page.locator('[data-knowledge-item] [data-tier="internal"]')).toHaveCount(0)
    await page.getByRole('button', { name: 'Сбросить фильтры' }).click()
    await expect(rows).toHaveCount(all)
    await page.getByLabel('Источник').selectOption('owner')
    await expect(page.locator('[data-knowledge-item]:not([data-source="owner"])')).toHaveCount(0)
    await page.getByRole('button', { name: 'Сбросить фильтры' }).click()

    await page.getByRole('searchbox').fill('гарантия')
    await page.getByRole('button', { name: 'Найти', exact: true }).click()
    await expect(rows).toHaveCount(1)
    await page.getByRole('button', { name: 'Сбросить фильтры' }).click()

    // a document of the package cannot be edited
    await page.getByRole('button', { name: /Открыть документ Цены и этапы оплаты/ }).click()
    await expect(page.locator('[data-knowledge-doc]')).toContainText('Оплата по этапам')
    await expect(page.locator('[data-edit-note]')).toHaveCount(0)
    await expect(page.locator('[data-knowledge-doc]')).toContainText('править его здесь нельзя')

    // a new note: the empty form is refused with words
    await page.locator('[data-new-note]').click()
    await page.locator('[data-knowledge-new]').getByRole('button', { name: 'Добавить заметку' }).click()
    await expect(page.locator('[data-note-problem]')).toContainText('название')
    await page.getByLabel('Название').fill('Заметка e2e')
    await page.getByLabel('Текст заметки').fill('Не обещаем сроки меньше недели.')
    await page.locator('[data-knowledge-new]').getByLabel('Уровень').selectOption('public')
    await page.locator('[data-knowledge-new]').getByRole('button', { name: 'Добавить заметку' }).click()
    await expect(page.locator('[data-knowledge-item]', { hasText: 'Заметка e2e' })).toBeVisible()
    await expect(page.locator('[data-knowledge-doc]')).toContainText('Не обещаем сроки')

    // edit
    await page.locator('[data-edit-note]').click()
    await page.getByLabel('Текст заметки').fill('Сроки только из сметы.')
    await page.locator('[data-note-form="edit"]').getByRole('button', { name: 'Сохранить' }).click()
    await expect(page.locator('[data-doc-text]')).toContainText('Сроки только из сметы.')

    // delete needs a second click
    await page.locator('[data-delete="note"]').click()
    await expect(page.locator('[data-knowledge-item]', { hasText: 'Заметка e2e' })).toBeVisible()
    await page.locator('[data-delete-yes="note"]').click()
    await expect(page.locator('[data-knowledge-item]', { hasText: 'Заметка e2e' })).toHaveCount(0)

    // rebuild answers at once
    await page.locator('[data-rebuild]').click()
    await expect(page.locator('[data-rebuild-queued]')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('Quality: lessons with delete, ratings form, eval report with the red series', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/quality')
    await expect(page.getByRole('heading', { name: 'Quality', level: 1 })).toBeVisible()
    const lessons = page.locator('[data-lesson]')
    await expect(lessons.first()).toBeVisible()
    const n = await lessons.count()
    expect(n).toBeGreaterThan(2)
    await expect(lessons.first()).toContainText('Плохой ответ')
    await expect(lessons.first()).toContainText('Хороший ответ')
    const first = await lessons.first().getAttribute('data-lesson')
    await page.locator(`[data-delete="lesson-${first}"]`).click()
    await expect(lessons).toHaveCount(n)
    await page.locator(`[data-delete-yes="lesson-${first}"]`).click()
    await expect(lessons).toHaveCount(n - 1)

    await page.getByRole('tab', { name: 'Оценки' }).click()
    await page.getByRole('button', { name: 'Отправить оценку' }).click()
    await expect(page.locator('[data-rate-problem]')).toBeVisible()
    await page.getByLabel('Id сообщения').fill('m-100')
    await page.getByLabel('Тред', { exact: true }).fill('lead')
    await page.locator('[data-rate-down]').click()
    await page.getByLabel(/Комментарий/).fill('Не называть цену без сметы')
    await page.getByRole('button', { name: 'Отправить оценку' }).click()
    await expect(page.locator('[data-rate-done]')).toContainText('урок создан')
    await expect(page.locator('[data-rating-history] li')).toHaveCount(1)
    await page.getByRole('tab', { name: 'Уроки' }).click()
    await expect(page.locator('[data-lesson]', { hasText: 'Не называть цену без сметы' })).toBeVisible()

    await page.getByRole('tab', { name: 'Eval' }).click()
    await expect(page.locator('[data-eval-report]')).toBeVisible()
    await expect(page.locator('[data-eval-stat="lead"]')).toContainText('90%')
    await expect(page.locator('[data-eval-stat="red"]')).toHaveAttribute('data-red-status', 'red')
    await expect(page.locator('[data-eval-stat="red"]')).toContainText('Провалены сценарии: 1')
    expect(errors).toEqual([])
  })

  for (const [name, size] of Object.entries(SIZES)) {
    test(`both pages fit the ${name} screen`, async ({ page }) => {
      await page.setViewportSize(size)
      for (const url of ['/admin/knowledge', '/admin/quality']) {
        await open(page, url)
        await expect(page.locator('h1')).toBeVisible()
        await noHorizontalOverflow(page, url)
      }
    })
  }
})
