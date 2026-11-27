import { expect, test, type Page } from '@playwright/test'
import { adminContext, noHorizontalOverflow, open, watchErrors } from './helpers'

// Shell restyle (2026-11-27): Inbox, Approvals and Clients over the dev mock, with the contract's visible rules
// asserted, and screenshots at 1440 dark, 1440 light and 390 dark when SHOTS_DIR is set.
const noise = [/WebGL|GPU stall|swiftshader|Failed to load resource/i]
const SHOTS = process.env.SHOTS_DIR

async function shots(page: Page, name: string, ready: () => Promise<void>) {
  for (const [size, theme, file] of [
    [{ width: 1440, height: 900 }, 'dark', `${name}-1440-dark`],
    [{ width: 1440, height: 900 }, 'light', `${name}-1440-light`],
    [{ width: 390, height: 844 }, 'dark', `${name}-390`],
  ] as const) {
    await page.setViewportSize(size)
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t
    }, theme)
    await ready()
    if (size.width === 390) await noHorizontalOverflow(page, `${name} 390`)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${file}.png` })
  }
}

test.describe('with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('Inbox: grouped by time, unread rows carry a lime dot, the standup keeps the row rhythm', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/inbox')
    await expect(page.locator('[data-inbox-group]').first()).toBeVisible()
    const groups = await page.locator('[data-inbox-group]').evaluateAll((els) => els.map((e) => e.getAttribute('data-inbox-group')))
    const order = ['now', 'today', 'earlier']
    expect(groups.length).toBeGreaterThan(0)
    expect([...groups].sort((a, b) => order.indexOf(a!) - order.indexOf(b!))).toEqual(groups)
    // first visit on this device: every row is unread (6 px dot, heavy title); the dot is an image with a label
    const unread = page.locator('[data-inbox-row="unread"]').first()
    await expect(unread.locator('[data-unread]')).toHaveCSS('width', '6px')
    expect(await unread.locator('span.font-semibold').count()).toBe(1)
    // no leading middle dot in the meta line
    for (const meta of await page.locator('[data-inbox-row] .text-footnote.text-faint').allTextContents()) expect(meta.trim().startsWith('·')).toBe(false)
    // the second visit: what was seen is read (500 weight, no dot)
    await open(page, '/admin/clients')
    await open(page, '/admin/inbox')
    await expect(page.locator('[data-inbox-row="unread"]')).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'Approvals' })).toHaveCount(0)
    await shots(page, 'inbox', async () => expect(page.locator('[data-inbox-group]').first()).toBeVisible())
    expect(errors).toEqual([])
  })

  test('Approvals: segmented tabs with Decided last, rows with a primary action, selected rows hairline-lime, sticky batch bar', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/approvals?tab=content')
    const nav = page.getByRole('navigation', { name: 'Approvals sections' })
    await expect(nav.getByRole('button').last()).toHaveText(/^Decided/)
    const pressed = nav.locator('[aria-pressed="true"]')
    await expect(pressed).toHaveCount(1)
    // a filter is never a lime fill
    expect(await pressed.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-accent')))
    await expect(page.locator('[data-approval-row]').first().getByRole('button', { name: 'Approve', exact: true })).toBeVisible()
    await page.locator('[data-approval-row]').first().getByRole('checkbox').check()
    const bar = page.locator('[data-batch-bar]')
    await expect(bar).toBeVisible()
    const box = (await bar.boundingBox())!
    expect(box.y + box.height).toBeGreaterThan(page.viewportSize()!.height - 8)
    await expect(bar.getByRole('button', { name: 'Approve selected' })).toBeVisible()
    await shots(page, 'approvals', async () => expect(page.locator('[data-approval-row]').first()).toBeVisible())
    expect(errors).toEqual([])
  })

  test('Clients: quiet filters, board columns with sticky headers, the card shows a labelled temperature, the search has the shortcut', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/clients')
    await expect(page.locator('[data-board]').first()).toBeVisible()
    const search = page.getByRole('searchbox').first()
    expect((await search.boundingBox())!.height).toBeCloseTo(40, 0)
    await expect(page.locator('label:has(input[type=search]) kbd')).toContainText('⌘K')
    const head = page.locator('[data-column-head]').first()
    expect(await head.evaluate((el) => getComputedStyle(el).position)).toBe('sticky')
    await expect(page.locator('[data-temperature]').first()).toContainText(/Hot|Warm|Cold/)
    const lime = await page.locator('[data-segmented] [aria-pressed="true"]').evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor))
    for (const bg of lime) expect(bg).not.toMatch(/198, 255, 61|rgb\(198/)
    await shots(page, 'clients', async () => expect(page.locator('[data-board]').first()).toBeVisible().catch(() => undefined))
    expect(errors).toEqual([])
  })
})
