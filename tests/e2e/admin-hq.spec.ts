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
    await open(page, '/admin/finance')
    await expect(page.getByText('Soon').first()).toBeVisible()
    await page.getByRole('link', { name: 'Open the old screen' }).click()
    await expect(page).toHaveURL(/\/admin\/office\?panel=backoffice/)
    await open(page, '/admin/office')
    await expect(page.getByRole('radio', { name: 'На месте', exact: true })).toBeVisible()
  })

  test('Agents: roster by department with English titles, a card, edit instructions, versions and rollback', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/agents')
    await expect(page.getByRole('heading', { name: 'Agents', level: 1 })).toBeVisible()
    for (const title of ['Director', 'Head of Marketing', 'Content Maker', 'Lead Handler', 'Client Assistant']) await expect(page.locator('[data-agent-list]').getByText(title, { exact: true }).first()).toBeVisible()
    await page.locator('[data-agent="marketing-head"]').click()
    await expect(page).toHaveURL(/agent=marketing-head/)
    const card = page.locator('[data-agent-card="marketing-head"]')
    await expect(card.getByRole('heading', { name: 'Head of Marketing' })).toBeVisible()
    for (const block of ['instructions', 'trust', 'budget', 'fira', 'tools', 'history']) await expect(card.locator(`[data-block="${block}"]`)).toBeVisible()
    await card.locator('[data-act="edit-instructions"]').click()
    const dialog = page.getByRole('dialog', { name: 'Edit instructions' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Save as a new version' })).toHaveAttribute('aria-disabled', 'true')
    await dialog.locator('textarea').fill('Ты голова Маркетинга.\nНовое правило проверки.')
    await dialog.locator('input').fill('e2e')
    await dialog.getByRole('button', { name: 'Save as a new version' }).click()
    await expect(dialog).toBeHidden()
    await expect(card.locator('pre').first()).toContainText('Новое правило проверки.')
    await card.locator('[data-act="versions"]').click()
    await expect(card.locator('[data-versions] li')).toHaveCount(2)
    await card.locator('[data-versions] [data-act="show-version"]').last().click()
    await expect(card.locator('[data-diff]')).toBeVisible()
    await card.locator('[data-versions] [data-act="rollback"]').click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restore' }).click()
    await expect(card.locator('pre').first()).toContainText('Ничего не публикуй без одобрения.')
    await expect(card.locator('[data-versions] li')).toHaveCount(3)
    await open(page, '/admin/agents?agent=client-bot')
    await expect(page.locator('[data-block="fira"]')).toContainText('ИИ-менеджер заявок')
    expect(errors).toEqual([])
  })


  test('Settings: autopilot, saving by field with feedback and errors, trust, restart note, session journal', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/settings')
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
    for (const g of ['autopilot', 'schedule', 'notices', 'alerts', 'trust', 'limits', 'calls', 'kp', 'playground', 'service', 'journal']) await expect(page.locator(`[data-group="${g}"]`)).toBeVisible()
    // Autopilot: policy by default, switch to autopilot
    const modes = page.getByRole('radiogroup', { name: 'Lead manager mode' })
    await expect(modes.getByRole('radio', { name: 'Зови меня по политике' })).toHaveAttribute('aria-checked', 'true')
    await modes.getByRole('radio', { name: /^Автопилот/ }).click()
    await expect(modes.getByRole('radio', { name: /^Автопилот/ })).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('[data-group="autopilot"] [data-status="saved"]')).toBeVisible()
    // A time field saves on blur and shows «Saved»
    const summary = page.locator('[data-field="schedule.summaryTime"] input')
    await summary.fill('09:30')
    await summary.blur()
    await expect(page.locator('[data-field="schedule.summaryTime"] [data-status="saved"]')).toBeVisible()
    // A wrong number is refused with a visible reason and nothing is sent
    const duration = page.locator('[data-field="calls.durationMin"] input')
    await duration.fill('1')
    await duration.blur()
    await expect(page.locator('[data-field="calls.durationMin"] [role="alert"]')).toContainText('Outside the allowed range')
    // A switch saves at once
    await page.getByRole('switch', { name: 'New lead' }).click()
    await expect(page.getByRole('switch', { name: 'New lead' })).toHaveAttribute('aria-checked', 'false')
    // A time zone HQ does not know comes back as HQ's own error
    const tz = page.locator('[data-field="schedule.tz"] input')
    await tz.fill('Mars/Olympus')
    await tz.blur()
    await expect(page.locator('[data-field="schedule.tz"] [role="alert"]')).toBeVisible()
    // Spend sits next to the limit
    await expect(page.locator('[data-field="limits.deptBudgetUsd.marketing"] [data-usage]')).toContainText('$4.20')
    // Trust: raising a level asks first
    await page.getByRole('switch', { name: 'content_item: Level' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Level 1' }).click()
    await expect(page.getByRole('switch', { name: 'content_item: Level' })).toHaveAttribute('aria-checked', 'true')
    // A service flag needs a restart and says so
    await page.getByRole('switch', { name: 'Approval cards in Telegram' }).click()
    await expect(page.locator('[data-restart]')).toContainText('service.tgApprovalCards')
    // The session journal lists what changed with old and new values
    const journal = page.locator('[data-journal]')
    await expect(journal).toContainText('autopilot.leadManager: policy -> autopilot')
    await expect(journal).toContainText('schedule.summaryTime: 08:00 -> 09:30')
    await expect(journal).toContainText('trust.levels.content_item: 0 -> 1')
    // It survives a reload (HQ keeps it)
    await page.reload()
    await expect(page.locator('[data-field="schedule.summaryTime"] input')).toHaveValue('09:30')
    expect(errors).toEqual([])
  })

  test('Content: feed, item drawer with the player and Studio buttons, «Промпт» order, orders tab, calendar', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/content')
    await expect(page.getByRole('heading', { name: 'Content', level: 1 })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Feed', selected: true })).toBeVisible()
    const cards = page.locator('[data-feed] li button')
    await expect(cards.first()).toBeVisible()
    // a status filter narrows the feed
    await page.getByLabel('Статус').selectOption('pending')
    await expect(page.locator('[data-feed] li').first()).toBeVisible()
    // a reel opens with the player; «Ещё вариант» takes the order and the toast says so
    await page.getByLabel('Формат').first().selectOption('clip')
    await cards.first().click()
    const drawer = page.getByRole('dialog')
    await expect(drawer.locator('video')).toBeVisible()
    await drawer.getByRole('button', { name: 'Ещё вариант' }).click()
    await expect(page.getByText('Заказ принят: ещё один вариант готовится.')).toBeVisible()
    // «Промпт» from any tab
    await page.getByRole('button', { name: 'Промпт' }).click()
    const prompt = page.getByRole('dialog', { name: 'Новый материал для Content Maker' })
    await prompt.getByLabel('О чём материал').fill('Про ночные заявки в барбершопе')
    await prompt.getByRole('button', { name: 'Отправить Content Maker' }).click()
    await expect(page).toHaveURL(/tab=orders/)
    const orders = page.locator('[data-orders] li')
    await expect(orders).toHaveCount(2)
    await expect(orders.first()).toContainText('Про ночные заявки')
    await expect(orders.first().getByRole('link', { name: 'Открыть в ленте' })).toBeVisible()
    await page.getByRole('tab', { name: 'Calendar' }).click()
    await expect(page).toHaveURL(/tab=calendar/)
    expect(errors).toEqual([])
  })

  for (const [name, size] of Object.entries(SIZES)) {
    test(`no horizontal overflow ${name}`, async ({ page }) => {
      await page.setViewportSize(size)
      for (const url of ['/admin/inbox', '/admin/clients', '/admin/projects', '/admin/documents', '/admin/agents', '/admin/agents?agent=client-bot', '/admin/content', '/admin/content?tab=orders', '/admin/settings', '/admin/tasks']) {
        await open(page, url)
        await noHorizontalOverflow(page, url)
      }
    })
  }
})
