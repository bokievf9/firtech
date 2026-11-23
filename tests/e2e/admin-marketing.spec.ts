import { expect, test } from '@playwright/test'
import { adminContext, noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// Content Studio «Marketing» panel and the Rules tab (2026-11-24) over the dev mock of HQ (scripted Fira).
const noise = [/WebGL|GPU stall|swiftshader|Failed to load resource/i]

test('Marketing refuses a visitor without a session', async ({ page }) => {
  await open(page, '/admin/content?tab=rules')
  await expect(page).toHaveURL(/\/admin\/login/)
})

test.describe('with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('a chip gets a typed reply with a plan card that leads to the Calendar', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await page.setViewportSize(SIZES.desktop)
    await open(page, '/admin/content?tab=feed')
    const side = page.locator('[data-marketing-side]')
    await expect(side).toBeVisible()
    await side.locator('[data-chip="plan"]').click()
    await expect(side.locator('[data-msg="owner"]').last()).toContainText('План на неделю')
    const reply = side.locator('[data-msg="fira"]').last()
    await expect(reply.locator('[data-fira-typed="typing"]')).toBeVisible()
    // The cards show once the last word is typed.
    const card = reply.locator('[data-card="plan"]')
    await expect(card).toBeVisible({ timeout: 25_000 })
    await expect(reply.locator('[data-fira-typed]')).toHaveCount(0)
    await expect(reply).toContainText('Предлагаю три слота')
    await expect(card).toContainText('План на неделю')
    await card.locator('[data-card-link]').click()
    await expect(page).toHaveURL(/\/admin\/calendar/)
    expect(errors).toEqual([])
  })

  test('a new topic creates an order card; a slow answer is pending and then appears', async ({ page }) => {
    await page.setViewportSize(SIZES.desktop)
    await open(page, '/admin/content?tab=feed')
    const side = page.locator('[data-marketing-side]')
    await side.locator('[data-chip="topic"]').click()
    await side.getByLabel('Topic').fill('кофейни ночью')
    await side.getByRole('button', { name: 'Send the topic' }).click()
    const reply = side.locator('[data-msg="fira"]').last()
    await expect(reply.locator('[data-card="order"]')).toBeVisible({ timeout: 25_000 })
    await reply.locator('[data-card="order"] [data-card-link]').click()
    await expect(page).toHaveURL(/\/admin\/content\?tab=orders/)

    await page.locator('[data-marketing-side]').locator('[data-chip="topic"]').click()
    await page.locator('[data-marketing-side]').getByLabel('Topic').fill('медленно')
    await page.locator('[data-marketing-side]').getByRole('button', { name: 'Send the topic' }).click()
    await expect(page.locator('[data-marketing-pending]')).toBeVisible()
    await expect(page.locator('[data-marketing-pending]')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.locator('[data-marketing-side] [data-card="order"]').last()).toBeVisible({ timeout: 25_000 })
  })

  test('the panel collapses, the choice is remembered, and the phone has a Marketing tab', async ({ page }) => {
    await page.setViewportSize(SIZES.desktop)
    await open(page, '/admin/content?tab=feed')
    await page.locator('[data-marketing-hide]').click()
    await expect(page.locator('[data-marketing-side]')).toHaveCount(0)
    await page.reload()
    await expect(page.locator('[data-marketing-open]')).toBeVisible()
    await expect(page.locator('[data-marketing-side]')).toHaveCount(0)
    await page.locator('[data-marketing-open]').click()
    await expect(page.locator('[data-marketing-side]')).toBeVisible()

    await page.setViewportSize(SIZES.mobile)
    await expect(page.locator('[data-marketing-side]')).toHaveCount(0)
    await page.getByRole('tab', { name: 'Marketing' }).click()
    await expect(page).toHaveURL(/tab=marketing/)
    await page.locator('[data-chip="rules"]').click()
    await expect(page.locator('[data-msg="fira"] [data-card="rule"]').last()).toBeVisible({ timeout: 20_000 })
    await page.locator('[data-card="rule"] [data-card-link]').last().click()
    await expect(page).toHaveURL(/tab=rules/)
  })

  test('rules: save as a version, then roll back with a confirmation', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/content?tab=rules')
    await expect(page.getByRole('tab', { name: 'Rules', selected: true })).toBeVisible()
    await expect(page.locator('[data-rules-text]')).toContainText('Голос')
    const version = async () => Number(((await page.locator('[data-rules-version]').textContent()) ?? '').replace(/\D/g, ''))
    const before = await version()

    await page.locator('[data-rules-edit]').click()
    const save = page.locator('[data-rules-save]')
    await expect(save).toHaveAttribute('aria-disabled', 'true')
    await page.locator('[data-rules-editor] [role="textbox"]').click()
    await page.keyboard.type(` E2E правка ${Date.now()}`)
    await page.locator('[data-rules-note]').fill('e2e')
    await save.click()
    await expect(page.locator('[data-rules-edit]')).toBeVisible()
    expect(await version()).toBe(before + 1)
    await expect(page.locator('[data-rules-version-row]').first()).toContainText('e2e')

    // Roll back to the oldest version: a confirmation first, then a new version.
    const oldest = page.locator('[data-rules-rollback]').last()
    await oldest.click()
    await expect(page.getByRole('alertdialog')).toContainText('Roll back to version')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Roll back' }).click()
    await expect.poll(version).toBe(before + 2)
    await expect(page.locator('[data-rules-text]')).not.toContainText('E2E правка')
    expect(errors).toEqual([])
  })

  test('no horizontal overflow at 390 and 1440 on Marketing, Rules and Feed', async ({ page }) => {
    for (const size of Object.values(SIZES)) {
      await page.setViewportSize(size)
      for (const tab of ['feed', 'rules', 'marketing']) {
        await open(page, `/admin/content?tab=${tab}`)
        await expect(page.locator('[data-content-section]')).toBeVisible()
        await noHorizontalOverflow(page, `/admin/content?tab=${tab} at ${size.width}`)
      }
    }
  })
})
