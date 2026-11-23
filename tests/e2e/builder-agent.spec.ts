import { expect, test, type Page } from '@playwright/test'
import { noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// «Один агент» in the builder (v6): the agent page CTA lands on the agent path, three questions tailored to the
// department, the estimate with setup, monthly and stages, the send (HQ mocked), and agents added to a business build.
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

for (const [label, size] of Object.entries(SIZES)) {
  test.describe(`builder agent at ${label}`, () => {
    test.use({ viewport: size })

    test('agent page, CTA, builder on the agent step, three questions, estimate, send', async ({ page }) => {
      const errors = watchErrors(page)
      await signedIn(page)
      let sent: Record<string, unknown> | null = null
      await page.route('**/api/lead', async (route) => {
        sent = route.request().postDataJSON() as Record<string, unknown>
        await route.fulfill({ json: { ok: true, id: 1, queued: true, cabinet: '/ru/cabinet' } })
      })
      await open(page, '/ru/ai-team/agent/lead-handler')
      const cta = page.locator('[data-cta="agent_lead-handler_build"]').first()
      await expect(cta).toContainText('Собрать с этим агентом')
      await expect(page.locator('[data-cta="agent_lead-handler_team_build"]')).toBeVisible()
      await cta.click()
      await page.waitForURL(/\/ru\/builder\?b=a\.lead-handler/)
      // The agent step: the agent is chosen, no niche questions first.
      await expect(page.getByRole('heading', { level: 2, name: 'Какой агент вам нужен?' })).toBeVisible()
      await expect(page.getByRole('radio', { name: /^Менеджер заявок/ })).toHaveAttribute('aria-checked', 'true')
      await expect(page.getByRole('button', { name: /Один агент/ })).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('[data-agent-dept]')).toHaveCount(5)
      // Search narrows the grid.
      await page.getByPlaceholder('Найти агента').fill('поддержк')
      await expect(page.getByRole('radio', { name: /^Менеджер заявок/ })).toHaveCount(0)
      await page.getByPlaceholder('Найти агента').fill('')
      await goNext(page, 2)
      // Question 1 follows the department (sales). Required.
      await expect(page.getByRole('heading', { level: 2, name: 'Где клиенты пишут вам?' })).toBeVisible()
      await next(page).dispatchEvent('click')
      await expect(page.locator('#builder-issue')).toContainText('Выберите хотя бы один канал')
      await expect(page.getByRole('checkbox', { name: /^Telegram/ })).toHaveAttribute('aria-checked', 'false')
      await page.getByRole('checkbox', { name: /^Telegram/ }).click()
      await page.getByRole('checkbox', { name: /^Чат на сайте/ }).click()
      await goNext(page, 3)
      await expect(page.getByRole('heading', { level: 2, name: 'Куда складывать заявки и записи?' })).toBeVisible()
      await page.getByRole('checkbox', { name: 'CRM' }).click()
      await goNext(page, 4)
      await expect(page.getByRole('heading', { level: 2, name: 'Сколько заявок в месяц?' })).toBeVisible()
      await page.getByRole('radio', { name: '50-300' }).click()
      await goNext(page, 5)
      await page.locator('[data-agent-addon="knowledge"]').click()
      await expect(page.locator('[data-agent-addon="training"]')).toContainText('+$')
      await goNext(page, 6)
      // The estimate: setup with the option, monthly, stages 50/50 under the small-project limit, the guarantee.
      const estimate = page.locator('[data-agent-estimate]')
      await expect(estimate.locator('[data-agent-setup]')).toHaveText('$270')
      await expect(estimate.locator('[data-agent-monthly]')).toContainText('$39')
      await expect(estimate.locator('[data-agent-stages] tbody tr')).toHaveCount(2)
      await expect(estimate).toContainText('Менеджер заявок')
      await expect(estimate).toContainText('Импорт знаний')
      expect(page.url()).toMatch(/a\.lead-handler\.telegram-web\.crm\.m\.path-knowledge/)
      await noHorizontalOverflow(page, 'agent estimate')
      await page.locator('#contact').getByRole('button', { name: 'Отправить проект в работу' }).click()
      await expect(page.getByRole('status').filter({ hasText: 'Заявка у нас' })).toBeVisible()
      const body = sent as unknown as { brief: Record<string, unknown>; estimate: string; message?: string }
      expect(body.brief).toMatchObject({ type: 'agent', agent: 'lead-handler', channels: ['telegram', 'web'], connect: ['crm'], volume: 'm', knowledge: true })
      expect(JSON.parse(body.estimate)).toMatchObject({ totalUsd: 270, monthlyUsd: 39 })
      expect(body.message).toContain('Менеджер заявок')
      expect((sent as unknown as { source: string }).source).toBe('agent-lead-handler')
      expect(errors).toEqual([])
    })

    test('the «Один агент» card on the products step and the fork open the agent path', async ({ page }) => {
      await open(page, '/ru/builder')
      await page.getByRole('button', { name: /Один агент/ }).click()
      await expect(page.getByRole('heading', { level: 2, name: 'Какой агент вам нужен?' })).toBeVisible()
      await expect(stepAt(page)).toHaveAttribute('aria-label', /^1\./)
      await expect(next(page)).toBeVisible()
      // Back to business through the fork.
      await page.getByRole('button', { name: /Для бизнеса/ }).click()
      await expect(page.getByRole('heading', { level: 2, name: 'Соберите проект за пять минут' })).toBeVisible()
      await open(page, '/ru/builder?step=2')
      await page.locator('[data-product-card="agent"]').click()
      await expect(page.getByRole('heading', { level: 2, name: 'Какой агент вам нужен?' })).toBeVisible()
      await expect(page.getByRole('radio', { name: /^Менеджер заявок/ })).toHaveAttribute('aria-checked', 'false')
      await next(page).dispatchEvent('click')
      await expect(page.locator('#builder-issue')).toContainText('Выберите агента')
    })

    test('an agent is added as a line to a business build and the total follows', async ({ page }) => {
      await open(page, '/ru/builder?b=websites.landing~k.cafe&step=8')
      const total = page.locator('[data-builder]').getByText(/Итого/).first()
      await expect(total).toBeVisible()
      await page.locator('[data-agent-add]').click()
      await page.getByRole('checkbox', { name: /^Менеджер заявок/ }).click()
      await expect(page.locator('[data-agent-row]')).toHaveCount(1)
      await page.getByRole('checkbox', { name: /^Служба поддержки/ }).click()
      await expect(page.locator('[data-agent-row]')).toHaveCount(3)
      await expect(page.locator('[data-agent-lines] li')).toHaveCount(2)
      expect(page.url()).toMatch(/a\.lead-handler_support/)
      await noHorizontalOverflow(page, 'business summary with agents')
    })
  })
}
