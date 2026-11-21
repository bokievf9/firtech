import { expect, test } from '@playwright/test'
import { adminContext, noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// Approvals (HQ 2026-11-23): four tabs over the review queue, edit in place, batch decisions, versions.
// Dev mock of HQ, a hand-written admin session (see admin.spec.ts). The mock keeps state between attempts.

const noise = [/WebGL|GPU stall|swiftshader|Failed to load resource/i]

test.describe('with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('tabs show their own queue and counts', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/approvals')
    const nav = page.getByRole('navigation', { name: 'Разделы Approvals' })
    for (const name of ['Documents', 'Replies', 'Content', 'Money']) await expect(nav.getByRole('button', { name })).toBeVisible()
    // Content is the tab no other test decides in (they share one mock), so its queue is stable.
    await nav.getByRole('button', { name: /Content/ }).click()
    const queue = page.getByRole('list', { name: 'Очередь Content' })
    await expect(queue.getByText('Запись ночью')).toBeVisible()
    await expect(queue.getByText('Счёт Sadaf Clinic')).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('edit in place saves a new version and a version can be restored', async ({ page }) => {
    await open(page, '/admin/approvals?tab=replies')
    const row = page.getByRole('list', { name: 'Очередь Replies' }).getByRole('listitem').filter({ hasText: 'Ответ Нигине' })
    await row.getByRole('button', { name: /Ответ Нигине/ }).click()
    const field = row.getByRole('textbox', { name: 'Текст' })
    const stamp = `s${Date.now()}`
    await field.fill(`Здравствуйте, Нигина! Правка ${stamp}.`)
    await row.getByRole('button', { name: 'Сохранить правку' }).click()
    await expect(page.getByText('Правка сохранена, версия добавлена')).toBeVisible()
    await expect(row.getByRole('region', { name: 'Версии' }).getByRole('button', { name: /Вернуть v1/ })).toBeVisible()
    await row.getByRole('button', { name: /Вернуть v1/ }).click()
    await expect(page.getByText(/Версия v1 возвращена как новая/)).toBeVisible()
  })

  test('batch approve with a confirmation', async ({ page }) => {
    await open(page, '/admin/approvals?tab=money')
    await page.getByRole('checkbox', { name: 'Выбрать все' }).check()
    await expect(page.getByText(/Выбрано: [1-9]/)).toBeVisible()
    await page.getByRole('button', { name: 'Одобрить выбранное' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Счета и цены уйдут клиентам')
    await dialog.getByRole('button', { name: 'Одобрить' }).click()
    await expect(page.getByText(/Одобрено: \d/)).toBeVisible()
  })

  test('no horizontal overflow on a phone', async ({ page }) => {
    await page.setViewportSize(SIZES.mobile)
    await open(page, '/admin/approvals')
    await noHorizontalOverflow(page, '/admin/approvals')
  })
})
