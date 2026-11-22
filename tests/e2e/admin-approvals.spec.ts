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
    const nav = page.getByRole('navigation', { name: 'Approvals sections' })
    for (const name of ['Documents', 'Replies', 'Content', 'Money']) await expect(nav.getByRole('button', { name })).toBeVisible()
    // Content is the tab no other test decides in (they share one mock), so its queue is stable.
    await nav.getByRole('button', { name: /Content/ }).click()
    const queue = page.getByRole('list', { name: 'Queue Content' })
    await expect(queue.getByText('Запись ночью')).toBeVisible()
    await expect(queue.getByText('Счёт Sadaf Clinic')).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('edit in place saves a new version and a version can be restored', async ({ page }) => {
    await open(page, '/admin/approvals?tab=replies')
    const row = page.getByRole('list', { name: 'Queue Replies' }).getByRole('listitem').filter({ hasText: 'Ответ Нигине' })
    await row.getByRole('button', { name: /Ответ Нигине/ }).click()
    const field = row.getByRole('textbox', { name: 'Text' })
    const stamp = `s${Date.now()}`
    await field.fill(`Здравствуйте, Нигина! Правка ${stamp}.`)
    await row.getByRole('button', { name: 'Save edit' }).click()
    await expect(page.getByText('Edit saved, version added')).toBeVisible()
    await expect(row.getByRole('region', { name: 'Versions' }).getByRole('button', { name: /Restore v1/ })).toBeVisible()
    await row.getByRole('button', { name: /Restore v1/ }).click()
    await expect(page.getByText(/Version v1 restored as new/)).toBeVisible()
  })

  test('a reply card can be rated, and the rating can be changed', async ({ page }) => {
    await open(page, '/admin/approvals?tab=replies')
    const row = page.getByRole('list', { name: 'Queue Replies' }).getByRole('listitem').first()
    await row.getByRole('button').first().click()
    const rate = row.locator('[data-rate]')
    await expect(rate).toBeVisible()
    await rate.getByRole('button', { name: 'Good answer' }).click()
    await expect(rate.locator('[data-rate-state]')).toHaveAttribute('data-rate-state', 'up')
    await rate.getByRole('button', { name: 'Bad answer' }).click()
    await rate.locator('[data-rate-send]').click()
    await expect(rate.locator('[data-rate-state]')).toHaveAttribute('data-rate-state', 'down')
  })

  test('batch approve with a confirmation', async ({ page }) => {
    await open(page, '/admin/approvals?tab=money')
    await page.getByRole('checkbox', { name: 'Select all' }).check()
    await expect(page.getByText(/Selected: [1-9]/)).toBeVisible()
    await page.getByRole('button', { name: 'Approve selected' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Invoices and prices go to clients')
    await dialog.getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByText(/Approved: \d/)).toBeVisible()
  })

  test('no horizontal overflow on a phone', async ({ page }) => {
    await page.setViewportSize(SIZES.mobile)
    await open(page, '/admin/approvals')
    await noHorizontalOverflow(page, '/admin/approvals')
  })

  test('one section: the reader opens inside the Shell frame, the old review link redirects, the counts agree', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/review?id=ap_203')
    await expect(page).toHaveURL(/\/admin\/approvals\?id=ap_203$/)
    const shell = page.locator('[data-hq-shell]')
    await expect(shell.getByRole('navigation', { name: 'Sections' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to the office' })).toHaveCount(0)
    await expect(page.locator('[data-approvals-reader]')).toBeVisible()
    // digits belong to the Shell: a department is clicked, not keyed
    await page.keyboard.press('j')
    await expect(page).toHaveURL(/\/admin\/approvals\?id=ap_/)
    // «К списку» returns to the tabs of the item
    await page.getByRole('button', { name: 'Back to the Approvals list' }).click()
    await expect(page.getByRole('navigation', { name: 'Approvals sections' })).toBeVisible()
    // the menu badge, the Approvals tabs and the Inbox tab show one number
    const sum = async () => {
      const nav = page.getByRole('navigation', { name: 'Approvals sections' })
      let n = 0
      for (const name of ['Documents', 'Replies', 'Content', 'Money']) n += Number((await nav.getByRole('button', { name }).locator('span').textContent()) ?? 0)
      return n
    }
    const badge = Number(await page.locator('[data-badge=approvals]').first().textContent())
    expect(badge).toBe(await sum())
    await open(page, '/admin/inbox?tab=approvals')
    await expect(page.locator('[data-inbox-total]')).toHaveText(String(badge))
    expect(errors).toEqual([])
  })

  test('reader: no horizontal overflow at 390 and 1440', async ({ page }) => {
    for (const size of [SIZES.mobile, { width: 1440, height: 900 }]) {
      await page.setViewportSize(size)
      await open(page, '/admin/approvals?id=ap_201')
      await noHorizontalOverflow(page, `reader ${size.width}`)
    }
  })
})
