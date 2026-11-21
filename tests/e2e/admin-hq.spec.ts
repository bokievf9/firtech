import { expect, test } from '@playwright/test'
import { adminContext, noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// HQ phase 1 (2026-11-23): the CRM shell and the four sections over the dev mock of HQ.
const noise = [/WebGL|GPU stall|swiftshader|Failed to load resource/i]

test('HQ refuses a visitor without a session', async ({ page }) => {
  await open(page, '/admin/inbox')
  await expect(page).toHaveURL(/\/admin\/login/)
})

test.describe('with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('/admin opens the Inbox with the menu, Office button and tabs', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin')
    await expect(page).toHaveURL(/\/admin\/inbox/)
    const menu = page.getByRole('navigation', { name: 'Sections' }).first()
    for (const name of ['Inbox', 'Clients', 'Projects', 'Documents', 'Agents']) await expect(page.getByRole('link', { name: new RegExp(`^${name}`) }).first()).toBeVisible()
    await expect(menu).toBeVisible()
    await expect(page.getByRole('link', { name: /Office/ }).first()).toHaveAttribute('target', '_blank')
    await page.getByRole('tab', { name: 'Approvals' }).click()
    await expect(page).toHaveURL(/tab=approvals/)
    expect(errors).toEqual([])
  })

  test('sections: Clients, Projects, Documents load and keys 1-9 switch', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/clients')
    await expect(page.getByRole('heading', { name: 'Clients', level: 1 })).toBeVisible()
    await page.getByRole('tab', { name: 'Clients' }).click()
    await expect(page).toHaveURL(/tab=clients/)
    await open(page, '/admin/projects?tab=payments')
    await expect(page.getByRole('tab', { name: 'Payments', selected: true })).toBeVisible()
    await open(page, '/admin/documents')
    await expect(page.getByRole('heading', { name: 'Documents', level: 1 })).toBeVisible()
    await page.keyboard.press('1')
    await expect(page).toHaveURL(/\/admin\/inbox/)
    expect(errors).toEqual([])
  })

  test('a soon section says so and links to the old screen; the office still opens', async ({ page }) => {
    await open(page, '/admin/agents')
    await expect(page.getByText('Soon').first()).toBeVisible()
    await page.getByRole('link', { name: 'Open the old screen' }).click()
    await expect(page).toHaveURL(/\/admin\/office\?panel=company/)
    await open(page, '/admin/office')
    await expect(page.getByRole('radio', { name: 'На месте', exact: true })).toBeVisible()
  })

  for (const [name, size] of Object.entries(SIZES)) {
    test(`no horizontal overflow ${name}`, async ({ page }) => {
      await page.setViewportSize(size)
      for (const url of ['/admin/inbox', '/admin/clients', '/admin/projects', '/admin/documents', '/admin/tasks']) {
        await open(page, url)
        await noHorizontalOverflow(page, url)
      }
    })
  }
})
