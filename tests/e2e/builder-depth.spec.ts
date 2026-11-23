import { expect, test, type Page } from '@playwright/test'
import { noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// Builder depth (2026-11-24): the business «Детали» screen has more chips and a note, the summary shows them in one
// compact line, the lead brief carries the note; the agent path has a depth screen for the agent's department.
const signedIn = (page: Page) =>
  page.route('**/api/cabinet/me', (route) =>
    route.fulfill({ json: { enabled: true, signedIn: true, email: 'e2e@example.com', name: 'E2E', telegram: '' } }),
  )
const stepAt = (page: Page) => page.locator('[aria-current="step"]')
const next = (page: Page) => page.getByRole('button', { name: /^Дальше/ })
async function goNext(page: Page, to: number) {
  await next(page).click()
  await expect(stepAt(page)).toHaveAttribute('aria-label', new RegExp(`^${to}\\.`))
}
const NOTE = 'Мы работаем без выходных, ответы нужны на таджикском'

for (const [label, size] of Object.entries(SIZES)) {
  test.describe(`builder depth at ${label}`, () => {
    test.use({ viewport: size })

    test('business details: chips, other opens the note, summary line, send carries the note', async ({ page }) => {
      const errors = watchErrors(page)
      await signedIn(page)
      let sent: Record<string, unknown> | null = null
      await page.route('**/api/lead', async (route) => {
        sent = route.request().postDataJSON() as Record<string, unknown>
        await route.fulfill({ json: { ok: true, id: 1, queued: true, cabinet: '/ru/cabinet' } })
      })
      await open(page, '/ru/builder?b=websites.landing.telegram~k.cafe&step=7')
      await page.getByRole('button', { name: /Рассказать подробнее/ }).click()
      const form = page.locator('[data-discovery]')
      await expect(form.getByText('Откуда приходят клиенты')).toBeVisible()
      await form.getByRole('checkbox', { name: '6-10 человек' }).click()
      await form.getByRole('checkbox', { name: 'Битрикс24' }).click()
      await form.getByRole('checkbox', { name: 'Таджикский' }).click()
      await form.getByRole('checkbox', { name: 'Рекомендации' }).click()
      await form.getByRole('checkbox', { name: 'Быстрее отвечаем' }).click()
      // «Другое» focuses the note.
      await form.getByRole('checkbox', { name: 'Другое' }).first().click()
      await expect(page.locator('[data-discovery-note]')).toBeFocused()
      await page.locator('[data-discovery-note]').fill(NOTE)
      await expect(form).toContainText(`${NOTE.length}/500`)
      await noHorizontalOverflow(page, 'details')
      expect(page.url()).toMatch(/v\./)
      expect(page.url().length).toBeLessThan(2048)
      // The summary: one compact line, not every chip.
      await page.goto(page.url().replace(/step=\d+/, 'step=8'))
      await expect(page.locator('[data-builder]')).toContainText('Подробности')
      await expect(page.locator('[data-builder]')).toContainText(/\d+ ответ[а-я]*, заметка/)
      await expect(page.locator('[data-builder]')).not.toContainText('Битрикс24')
      await noHorizontalOverflow(page, 'summary')
      await page.locator('#contact').getByRole('button', { name: 'Отправить проект в работу' }).click()
      await expect(page.getByRole('status').filter({ hasText: 'Заявка у нас' })).toBeVisible()
      const body = sent as unknown as { brief: { discovery: Record<string, unknown> } }
      expect(body.brief.discovery).toMatchObject({ size: 's10', tools: ['bitrix'], langs: ['tj'], src: ['friends', 'other'], success: ['speed'], note: NOTE })
      expect(errors).toEqual([])
    })

    test('personal «О вас» has the new chips and a note', async ({ page }) => {
      const errors = watchErrors(page)
      await open(page, '/ru/builder?b=m.eyJ3Ijoic3R1ZGVudCIsImgiOlsibWFpbCJdLCJjIjpbInRlbGVncmFtIl19&step=7')
      const form = page.locator('[data-discovery]')
      await expect(form.getByText('Как устроена ваша работа')).toBeVisible()
      await form.getByRole('checkbox', { name: 'Сова' }).click()
      await form.getByRole('checkbox', { name: 'iPhone' }).click()
      await form.getByRole('checkbox', { name: 'Фриланс' }).click()
      await page.locator('[data-discovery-note]').fill(NOTE)
      expect(page.url()).toMatch(/v\./)
      await noHorizontalOverflow(page, 'personal about')
      expect(errors).toEqual([])
    })

    test('agent path: depth screen for the department, answers in the link and the lead', async ({ page }) => {
      const errors = watchErrors(page)
      await signedIn(page)
      let sent: Record<string, unknown> | null = null
      await page.route('**/api/lead', async (route) => {
        sent = route.request().postDataJSON() as Record<string, unknown>
        await route.fulfill({ json: { ok: true, id: 1, queued: true, cabinet: '/ru/cabinet' } })
      })
      await open(page, '/ru/builder?b=a.lead-handler.telegram._.m.path&step=5')
      await expect(page.getByRole('heading', { level: 2, name: 'Расскажите подробнее' })).toBeVisible()
      const depth = page.locator('[data-agent-depth]')
      await expect(depth.getByText('Желаемое время ответа')).toBeVisible()
      await depth.locator('[data-depth="sl-src"]').getByRole('checkbox', { name: 'Instagram' }).click()
      await depth.locator('[data-depth="sl-crm"]').getByRole('checkbox', { name: 'amoCRM' }).click()
      await depth.locator('[data-depth="sl-resp"]').getByRole('checkbox', { name: 'За 5 минут' }).click()
      await depth.locator('[data-depth="sl-hours"]').getByRole('checkbox', { name: 'Круглосуточно' }).click()
      await depth.locator('[data-depth="sl-src"]').getByRole('checkbox', { name: 'Другое' }).click()
      await expect(page.locator('[data-agent-note]')).toBeFocused()
      await page.locator('[data-agent-note]').fill(NOTE)
      expect(page.url()).toMatch(/~e\./)
      expect(page.url().length).toBeLessThan(2048)
      await noHorizontalOverflow(page, 'agent depth')
      await goNext(page, 6)
      await goNext(page, 7)
      await expect(page.locator('[data-agent-estimate]')).toBeVisible()
      await expect(page.getByText('4 ответа, заметка')).toBeVisible()
      // «Изменить» goes back to the depth screen.
      await page.locator('[data-agent-edit-depth]').click()
      await expect(page.getByRole('heading', { level: 2, name: 'Расскажите подробнее' })).toBeVisible()
      await goNext(page, 6)
      await goNext(page, 7)
      await page.locator('#contact').getByRole('button', { name: 'Отправить проект в работу' }).click()
      await expect(page.getByRole('status').filter({ hasText: 'Заявка у нас' })).toBeVisible()
      const body = sent as unknown as { brief: Record<string, unknown> }
      expect(body.brief).toMatchObject({ type: 'agent', depth: { 'sl-src': ['instagram', 'other'], 'sl-crm': ['amocrm'], 'sl-resp': ['m5'], 'sl-hours': ['h24'] }, note: NOTE })
      expect(errors).toEqual([])
    })
  })
}
