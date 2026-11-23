import { expect, test, type Page } from '@playwright/test'
import { adminContext, noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// Team (2026-11-24, contract «Команда»): the grid of 23 employees, one card with Chat / Work / Profile, assigning (the Assign field and
// «@agent» in the chat), the morning standup in the Inbox and on /admin/team?tab=standup, and the Office (hover shows `now`, a click
// opens the card). Over the dev mock of HQ (scripted agents).
const noise = [/WebGL|GPU stall|swiftshader|Failed to load resource/i]

test('Team refuses a visitor without a session', async ({ page }) => {
  await open(page, '/admin/team')
  await expect(page).toHaveURL(/\/admin\/login/)
})

// A point (in the canvas box) where the engine's own hit test answers with one of these people.
async function personPoint(page: Page, ids: string[]) {
  await page.waitForFunction(() => Boolean((window as unknown as { __office?: unknown }).__office))
  return page.evaluate((want) => {
    type Hit = { kind: string; id?: string } | null
    const s = (window as unknown as { __office: { size(): { width: number; height: number }; toWorld(x: number, y: number): { x: number; y: number }; hitTest(x: number, y: number): Hit } }).__office
    const canvas = document.querySelector('canvas')!
    for (let y = 8; y < canvas.clientHeight - 8; y += 3) {
      for (let x = 8; x < canvas.clientWidth - 8; x += 3) {
        const w = s.toWorld(x, y)
        const hit = s.hitTest(w.x, w.y)
        if (hit && hit.kind === 'agent' && hit.id && want.includes(hit.id)) return { x, y, id: hit.id }
      }
    }
    return null
  }, ids)
}

test.describe('with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('grid of 23 employees, a card, a chip, a typed answer, a card link into the Shell', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await page.setViewportSize(SIZES.desktop)
    await open(page, '/admin/team')
    await expect(page.getByRole('link', { name: /^Team/ }).first()).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('[data-member]')).toHaveCount(23)
    await expect(page.locator('[data-team-dept]')).toHaveCount(6)
    const tile = page.locator('[data-member="presales"]')
    await expect(tile).toContainText('Presales')
    await expect(tile.locator('[data-presence="waiting"]')).toContainText('Waiting for you')
    await expect(tile.locator('[data-now]')).toContainText('пишу КП #12')
    await expect(tile.locator('[data-queue]')).toContainText('Queue 2')
    await tile.click()
    await expect(page).toHaveURL(/\/admin\/team\/presales$/)
    await expect(page.getByRole('link', { name: /^Team/ }).first()).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('heading', { level: 1, name: 'Presales' })).toBeVisible()
    await expect(page.locator('[data-chip]')).toHaveCount(3)
    await page.locator('[data-chip="leads"]').click()
    await expect(page.locator('[data-msg="owner"]').last()).toContainText('Что с лидами')
    const reply = page.locator('[data-msg="agent"]').last()
    await expect(reply.locator('[data-fira-typed="typing"]')).toBeVisible()
    const card = reply.locator('[data-card="lead"]')
    await expect(card).toBeVisible({ timeout: 25_000 })
    await expect(reply.locator('[data-fira-typed]')).toHaveCount(0)
    await expect(reply).toContainText('в воронке 3 новых лида')
    await card.locator('[data-card-link]').click()
    await expect(page).toHaveURL(/\/admin\/clients\?tab=pipeline&focus=6/)
    expect(errors).toEqual([])
  })

  test('chips by role and the marketing head keeps the marketing chat', async ({ page }) => {
    await open(page, '/admin/team/finance')
    await expect(page.locator('[data-chip="unpaid"]')).toBeVisible()
    await open(page, '/admin/team/customer-support')
    await expect(page.locator('[data-chip="tickets"]')).toBeVisible()
    await open(page, '/admin/team/project-manager')
    await expect(page.locator('[data-chip="projects"]')).toBeVisible()
    // «Prepare a quote for…» only fills the field.
    await open(page, '/admin/team/sales-head')
    await page.locator('[data-chip="kp"]').click()
    await expect(page.locator('[data-team-input]')).toHaveValue('Подготовь КП по ')
    await open(page, '/admin/team/marketing-head')
    await expect(page.locator('[data-marketing-panel]')).toBeVisible()
    await expect(page.locator('[data-team-chat]')).toHaveCount(0)
  })

  test('Assign creates a task that shows on the Tasks page; the Work and Profile tabs', async ({ page }) => {
    await open(page, '/admin/team/finance?tab=work')
    await expect(page.getByRole('tab', { name: 'Work', selected: true })).toBeVisible()
    await expect(page.locator('[data-work-queue]')).toHaveText('1')
    await page.locator('[data-assign-text]').fill('Сверить счета за декабрь')
    await page.locator('[data-assign-send]').click()
    await expect(page.locator('[data-assign-done]')).toContainText('created')
    await expect(page.locator('[data-work-queue]')).toHaveText('2', { timeout: 20_000 })
    await page.locator('[data-assign-link]').click()
    // The first visit of a page compiles it in `next dev`.
    await expect(page).toHaveURL(/\/admin\/tasks\?task=\d+/, { timeout: 60_000 })
    await expect(page.getByText('Сверить счета за декабрь').first()).toBeVisible({ timeout: 20_000 })

    await open(page, '/admin/team/finance?tab=profile')
    await expect(page.locator('[data-profile-version]')).toContainText('Version 2')
    await expect(page.locator('[data-profile] [data-link-agents]')).toHaveAttribute('href', '/admin/agents?agent=finance')
  })

  test('@ in the chat completes an employee and the message becomes a task for them', async ({ page }) => {
    await open(page, '/admin/team/presales')
    const input = page.locator('[data-team-input]')
    await input.click()
    await input.pressSequentially('@fin')
    await expect(page.locator('[data-mention-option="finance"]')).toBeVisible()
    await expect(page.locator('[data-mention-option="presales"]')).toHaveCount(0)
    await input.press('Enter')
    await expect(input).toHaveValue('@finance ')
    await input.pressSequentially('напомни клиенту про счёт')
    await page.locator('[data-team-send]').click()
    const reply = page.locator('[data-msg="agent"]').last()
    await expect(reply).toContainText('Task for Finance created', { timeout: 20_000 })
    await reply.locator('[data-card="task"] [data-card-link]').click()
    await expect(page).toHaveURL(/\/admin\/tasks\?task=\d+/)
  })

  test('a slow answer is pending and then appears', async ({ page }) => {
    await open(page, '/admin/team/knowledge')
    await page.locator('[data-team-input]').fill('медленно')
    await page.locator('[data-team-send]').click()
    await expect(page.locator('[data-team-pending]')).toBeVisible()
    await expect(page.locator('[data-team-pending]')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.locator('[data-msg="agent"]').last()).toContainText('Понял', { timeout: 25_000 })
  })

  test('Morning standup in the Inbox: Reply opens the agent chat; the standup page has history and a reply', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await page.setViewportSize(SIZES.desktop)
    await open(page, '/admin/inbox')
    const block = page.locator('[data-standup-inbox]')
    await expect(block).toBeVisible()
    await expect(block).toContainText('Morning standup')
    await expect(block.locator('[data-standup-entry]')).toHaveCount(4)
    await block.locator('[data-standup-reply]').first().click()
    await expect(page).toHaveURL(/\/admin\/team\/[a-z-]+\?tab=chat/)
    await open(page, '/admin/inbox')
    await page.locator('[data-standup-all]').click()
    await expect(page).toHaveURL(/\/admin\/team\?tab=standup/)
    const first = await page.locator('[data-standup-page] h2').first().textContent()
    await page.locator('[data-standup-prev]').click()
    await expect(page.locator('[data-standup-page] h2').first()).not.toHaveText(first ?? '')
    await page.locator('[data-standup-today]').click()
    await expect(page.locator('[data-standup-page] h2').first()).toHaveText(first ?? '')
    const row = page.locator('[data-standup-page] [data-standup-entry="presales"]')
    await row.locator('[data-standup-reply]').click()
    await row.locator('[data-standup-text]').fill('КП утверждаю, отправляй')
    await row.locator('[data-standup-send]').click()
    await expect(page).toHaveURL(/\/admin\/team\/presales\?tab=chat/)
    await expect(page.locator('[data-msg="owner"]').last()).toContainText('КП утверждаю, отправляй')
    await expect(page.locator('[data-msg="agent"]').last()).toContainText('Принял твой ответ')
    expect(errors).toEqual([])
  })

  test('Office: hovering a person shows what they are on, a click opens their card', async ({ page }) => {
    await page.setViewportSize(SIZES.desktop)
    await open(page, '/admin/office')
    await expect(page.locator('canvas').first()).toBeVisible()
    await expect.poll(() => personPoint(page, ['content-maker', 'director', 'marketing-head', 'publisher']), { timeout: 30_000 }).not.toBeNull()
    const pt = (await personPoint(page, ['content-maker', 'director', 'marketing-head', 'publisher']))!
    const box = (await page.locator('canvas').first().boundingBox())!
    await page.mouse.move(box.x + pt.x - 2, box.y + pt.y - 2)
    await page.mouse.move(box.x + pt.x, box.y + pt.y)
    const now = { 'content-maker': 'монтирую клип', director: 'собираю сводку', 'marketing-head': 'собираю пачку', publisher: 'жду одобрения' }[pt.id as 'director']
    await expect(page.locator('[data-office-bubble]')).toContainText(now)
    await page.mouse.click(box.x + pt.x, box.y + pt.y)
    await expect(page).toHaveURL(new RegExp(`/admin/team/${pt.id}`), { timeout: 60_000 })
  })

  for (const [name, size] of Object.entries(SIZES)) {
    test(`no horizontal overflow at ${name}`, async ({ page }) => {
      await page.setViewportSize(size)
      for (const url of ['/admin/team', '/admin/team?tab=standup', '/admin/team/presales', '/admin/team/presales?tab=work', '/admin/team/presales?tab=profile', '/admin/inbox']) {
        await open(page, url)
        await expect(page.locator('[data-section-view]').first()).toBeVisible()
        await noHorizontalOverflow(page, `${url} ${name}`)
      }
    })
  }
})
