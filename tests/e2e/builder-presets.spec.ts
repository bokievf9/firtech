import { expect, test, type Page } from '@playwright/test'
import { noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// Niche presets and «начать с задачи» on the builder's entry screen (builder v6 wave 2): preset card -> summary, editable,
// shareable link, sent with `preset` and `task` in the lead brief (HQ mocked); the task field -> match -> apply; no match.
const signedIn = (page: Page) =>
  page.route('**/api/cabinet/me', (route) =>
    route.fulfill({ json: { enabled: true, signedIn: true, email: 'e2e@example.com', name: 'E2E', telegram: '' } }),
  )

for (const [label, size] of Object.entries(SIZES)) {
  test.describe(`builder presets at ${label}`, () => {
    test.use({ viewport: size })

    test('entry: eight preset cards with live prices, the task field, no overflow', async ({ page }) => {
      const errors = watchErrors(page)
      await open(page, '/ru/builder')
      await expect(page.locator('[data-preset]')).toHaveCount(8)
      await expect(page.locator('[data-preset="salon"] [data-preset-price]')).toContainText(/Набор от \$\d+/)
      await expect(page.locator('[data-task-start]')).toBeVisible()
      await expect(page.getByLabel('Опишите задачу своими словами')).toBeVisible()
      await expect(page.locator('[data-preset="salon"]')).toHaveAttribute('data-cta', 'builder_preset_salon')
      await expect(page.getByRole('radiogroup', { name: 'Самые частые' })).toBeVisible()
      await noHorizontalOverflow(page, 'builder entry')
      expect(errors).toEqual([])
    })

    test('a preset opens the summary, stays editable, the link is shareable and the lead carries preset and task', async ({ page }) => {
      const errors = watchErrors(page)
      await signedIn(page)
      let sent: Record<string, unknown> | null = null
      await page.route('**/api/lead', async (route) => {
        sent = route.request().postDataJSON() as Record<string, unknown>
        await route.fulfill({ json: { ok: true, id: 1, queued: true, cabinet: '/ru/cabinet' } })
      })
      await open(page, '/ru/builder')
      await page.locator('[data-preset="salon"]').scrollIntoViewIfNeeded()
      await page.locator('[data-preset="salon"]').click()
      await expect(page.locator('[aria-current="step"]')).toHaveAttribute('aria-label', /^8\./)
      await expect(page.getByRole('heading', { level: 2 })).toBeVisible()
      expect(page.url()).toMatch(/[?&]b=[^&]*r\.salon/)
      expect(page.url()).toContain('k.salon')
      // Editable: the preset's agents are lines the visitor can add to or remove, and Back/Forward walk the steps.
      await expect(page.locator('[data-agent-add]')).toBeVisible()
      expect(await page.locator('[data-agent-row]').count()).toBeGreaterThan(0)
      await page.goBack()
      await expect(page.locator('[aria-current="step"]')).toHaveAttribute('aria-label', /^1\./)
      await page.goForward()
      await expect(page.locator('[aria-current="step"]')).toHaveAttribute('aria-label', /^8\./)
      // A shared link opens the same set on the summary.
      const shared = page.url().replace(/&step=\d+/, '')
      await open(page, shared)
      await expect(page.locator('[aria-current="step"]')).toHaveAttribute('aria-label', /^8\./)
      await expect(page.locator('#contact').getByRole('button', { name: 'Отправить проект в работу' })).toBeVisible()
      await noHorizontalOverflow(page, 'preset summary')
      await page.locator('#contact').getByRole('button', { name: 'Отправить проект в работу' }).click()
      await expect(page.getByRole('status').filter({ hasText: 'Заявка у нас' })).toBeVisible()
      expect((sent as unknown as { brief: Record<string, unknown> }).brief).toMatchObject({ type: 'business', niche: 'salon', preset: 'salon' })
      expect(errors).toEqual([])
    })

    test('the task field proposes a set, «Собрать так» applies it, the task goes to the lead', async ({ page }) => {
      const errors = watchErrors(page)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await signedIn(page)
      let sent: Record<string, unknown> | null = null
      await page.route('**/api/lead', async (route) => {
        sent = route.request().postDataJSON() as Record<string, unknown>
        await route.fulfill({ json: { ok: true, id: 1, queued: true, cabinet: '/ru/cabinet' } })
      })
      await open(page, '/ru/builder')
      const field = page.getByLabel('Опишите задачу своими словами')
      await field.fill('Салон красоты: клиенты звонят за записью, не успеваю отвечать')
      // Fira hides while the page scrolls and is back 1.5 s after the last scroll: wait for her, then ask.
      await page.getByRole('button', { name: 'Подобрать' }).scrollIntoViewIfNeeded()
      await page.waitForTimeout(1800)
      await page.getByRole('button', { name: 'Подобрать' }).click()
      const found = page.locator('[data-task-match="salon"]')
      await expect(found).toContainText('Похоже на')
      await expect(found).toContainText('запись и напоминания')
      // Fira says the reason in her bubble.
      await expect(page.locator('[data-fira-live-text]')).toContainText('Похоже на', { timeout: 10_000 })
      await page.locator('[data-cta="builder_task_match"]').click()
      await expect(page.locator('[aria-current="step"]')).toHaveAttribute('aria-label', /^8\./)
      expect(page.url()).toContain('r.salon')
      await page.locator('#contact').getByRole('button', { name: 'Отправить проект в работу' }).click()
      await expect(page.getByRole('status').filter({ hasText: 'Заявка у нас' })).toBeVisible()
      expect((sent as unknown as { brief: Record<string, unknown> }).brief).toMatchObject({
        preset: 'salon',
        task: 'Салон красоты: клиенты звонят за записью, не успеваю отвечать',
      })
      expect(errors).toEqual([])
    })

    test('no match: Fira apologises and the three paths stay', async ({ page }) => {
      const errors = watchErrors(page)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await open(page, '/ru/builder')
      await page.getByLabel('Опишите задачу своими словами').fill('просто привет')
      await page.getByRole('button', { name: 'Подобрать' }).click()
      await expect(page.locator('[data-task-none]')).toContainText('Не нашла точного совпадения')
      await expect(page.locator('[data-task-match]')).toHaveCount(0)
      await expect(page.locator('[data-fork]').getByRole('button')).toHaveCount(3)
      await expect(page.locator('[data-preset]')).toHaveCount(8)
      expect(errors).toEqual([])
    })
  })
}
