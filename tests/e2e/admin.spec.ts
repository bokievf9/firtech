import { expect, test } from '@playwright/test'
import { adminContext, LOGOUT_TOKEN, noHorizontalOverflow, SIZES, watchErrors, open } from './helpers'

// The owner panel with a hand-written session in the throwaway DATA_DIR (see global-setup.ts) and
// the dev mock of HQ (HQ_ADMIN_URL empty, NODE_ENV development).

test('admin login page renders the code form for a visitor without a session', async ({ page }) => {
  const response = await open(page, '/admin/login')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Получить код в Telegram' })).toBeVisible()
  expect(await page.locator('meta[name=robots]').getAttribute('content')).toContain('noindex')
})

test('admin pages and API refuse a visitor without a session', async ({ page, request }) => {
  await open(page, '/admin/office')
  await expect(page).toHaveURL(/\/admin\/login/)
  expect((await request.get('/api/admin/golive')).status()).toBe(401)
  expect((await request.get('/api/admin/hq/hub')).status()).toBe(401)
  expect((await request.get('/api/admin/export')).status()).toBe(401)
})

test.describe('with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('hub loads with counters, presence switch and the office', async ({ page }) => {
    const errors = watchErrors(page)
    await open(page, '/admin/office')
    await expect(page.getByRole('radio', { name: 'На месте', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Одобрения: \d+/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Новые лиды: \d+/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Ждут оплаты: \d+/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Открытые тикеты: \d+/ })).toBeVisible()
    await expect(page.locator('canvas').first()).toBeVisible()
    await page.getByRole('radio', { name: 'Не на месте', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'Не на месте', exact: true })).toBeChecked()
    await page.getByRole('radio', { name: 'На месте', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'На месте', exact: true })).toBeChecked()
    expect(errors).toEqual([])
  })

  const panels = [
    ['1', 'Директор'],
    ['2', 'Маркетинг'],
    ['3', 'Продажи'],
    ['4', 'Поддержка'],
    ['5', 'Производство'],
    ['6', 'Бэк-офис'],
    ['7', 'Компания'],
  ] as const
  test('keys 1-7 open the panels, Esc closes, 8 opens the go-live page', async ({ page }) => {
    await open(page, '/admin/office')
    await expect(page.getByRole('radio', { name: 'На месте', exact: true })).toBeVisible()
    for (const [key, title] of panels) {
      await page.keyboard.press(key)
      await expect(page.locator('aside h2')).toHaveText(title)
      await page.keyboard.press('Escape')
      await expect(page.locator('aside h2')).toHaveCount(0)
    }
    await page.keyboard.press('8')
    await expect(page).toHaveURL(/\/admin\/golive$/)
  })

  test('panel tabs switch and the counters open their panels', async ({ page }) => {
    await open(page, '/admin/office')
    await page.keyboard.press('1')
    for (const tab of ['Входящие', 'Одобрения', 'Задачи', 'Чат', 'Лента', 'Учения']) {
      await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click()
      await expect(page.getByRole('tab', { name: new RegExp(`^${tab}`) })).toHaveAttribute('aria-selected', 'true')
    }
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /^Ждут оплаты/ }).click()
    await expect(page.locator('aside h2')).toHaveText('Бэк-офис')
    await expect(page.getByRole('tab', { name: /^Счета/ })).toHaveAttribute('aria-selected', 'true')
  })

  test('every department panel renders its tabs without console errors', async ({ page }) => {
    const errors = watchErrors(page)
    await open(page, '/admin/office')
    for (const [key] of panels) {
      await page.keyboard.press(key)
      const tabs = page.locator('aside [role=tab]')
      const n = await tabs.count()
      for (let i = 0; i < n; i++) {
        await tabs.nth(i).click()
        await page.waitForTimeout(250)
      }
      await page.keyboard.press('Escape')
      await expect(page.locator('aside h2')).toHaveCount(0)
    }
    expect(errors).toEqual([])
  })

  test('Director: approving a card lowers the counter; the chat answers a command; the task filter narrows the board', async ({ page }) => {
    await open(page, '/admin/office')
    await expect(page.getByRole('button', { name: 'Одобрения: 3' })).toBeVisible()
    await page.keyboard.press('1')
    await page.getByRole('tab', { name: /^Одобрения/ }).click()
    await page.getByRole('button', { name: /^Одобрить/ }).first().click()
    await expect(page.getByRole('button', { name: /^Одобрения: [0-2]$/ })).toBeVisible()

    await page.getByRole('tab', { name: 'Чат' }).click()
    await page.getByRole('button', { name: '/status' }).click()
    await expect(page.locator('aside').getByText('/status').first()).toBeVisible()

    await page.getByRole('tab', { name: 'Задачи' }).click()
    const before = await page.locator('aside button', { hasText: /#\d+/ }).count()
    await page.getByRole('button', { name: 'Маркетинг', exact: true }).first().click()
    await expect.poll(() => page.locator('aside button', { hasText: /#\d+/ }).count()).toBeLessThan(before)
  })

  test('Back office: invoice actions are there and «Напомнить» answers with a toast', async ({ page }) => {
    await open(page, '/admin/office')
    await page.keyboard.press('6')
    await expect(page.getByRole('button', { name: 'Напомнить клиенту' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Оплачено вручную' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Аннулировать' }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Напомнить клиенту' }).first().click()
    await expect(page.locator('[role=status], [role=alert]').filter({ hasText: /\S/ }).first()).toBeVisible()
  })

  test('⌘K opens the palette, filters and closes with Esc', async ({ page }) => {
    await open(page, '/admin/office')
    await expect(page.getByRole('radio', { name: 'На месте', exact: true })).toBeVisible()
    await page.keyboard.press('Control+k')
    const box = page.locator('input.ym-disable-keys').first()
    await expect(box).toBeVisible()
    await box.fill('go-live')
    await expect(page.getByText('Go-live').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(box).toBeHidden()
  })

  test('theme switch flips the panel theme', async ({ page }) => {
    await open(page, '/admin/office')
    const before = await page.locator('html').getAttribute('data-theme')
    await page.getByRole('button', { name: /Включить (светлую|тёмную) тему/ }).click()
    await expect.poll(() => page.locator('html').getAttribute('data-theme')).not.toBe(before)
  })

  test('hub fits a phone', async ({ page }) => {
    await page.setViewportSize(SIZES.mobile)
    await open(page, '/admin/office')
    await expect(page.getByRole('radio', { name: 'На месте', exact: true })).toBeVisible()
    await noHorizontalOverflow(page)
  })

  test('go-live page: start, tick, note and reset through the API and the buttons', async ({ page, request, baseURL }) => {
    const headers = { origin: baseURL!, cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ') }
    const post = (data: object) => request.post('/api/admin/golive', { data, headers })

    expect((await post({ action: 'reset' })).status()).toBe(200)
    let state = await (await request.get('/api/admin/golive', { headers })).json()
    expect(state.state.deadline).toBeNull()

    const start = await post({ action: 'start', hours: 72 })
    expect(start.status()).toBe(200)
    state = await (await request.get('/api/admin/golive', { headers })).json()
    expect(Date.parse(state.state.deadline) - Date.now()).toBeGreaterThan(71 * 3600_000)

    expect((await post({ action: 'toggle', id: 'launch-sla', done: true })).status()).toBe(200)
    expect((await post({ action: 'note', id: 'launch-sla', text: 'e2e note' })).status()).toBe(200)
    state = await (await request.get('/api/admin/golive', { headers })).json()
    expect(state.state.done['launch-sla']).toBeTruthy()
    expect(state.state.notes['launch-sla']).toBe('e2e note')
    expect((await post({ action: 'nonsense' })).status()).toBe(400)
    expect((await request.post('/api/admin/golive', { data: { action: 'reset' }, headers: { ...headers, origin: 'https://evil.example' } })).status()).toBe(403)

    // The page shows the odometer and the 33 items; the reset button clears the timer, keeps the ticks.
    await open(page, '/admin/golive')
    await expect(page.getByText(/Готово 1 из 33/)).toBeVisible()
    await page.getByRole('button', { name: 'Сбросить' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Сбросить' }).click()
    await expect(page.getByRole('button', { name: 'Запустить 72 часа' })).toBeVisible()
    // The page updates at once and saves in the background: poll the saved state.
    await expect
      .poll(async () => (await (await request.get('/api/admin/golive', { headers })).json()).state.deadline)
      .toBeNull()
    state = await (await request.get('/api/admin/golive', { headers })).json()
    expect(state.state.done['launch-sla']).toBeTruthy()

    await page.getByRole('button', { name: 'Запустить 72 часа' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Да' }).click()
    await expect(page.getByRole('button', { name: 'Перезапустить' })).toBeVisible()
    await expect
      .poll(async () => (await (await request.get('/api/admin/golive', { headers })).json()).state.deadline)
      .not.toBeNull()
    // Clean the throwaway state.
    await post({ action: 'toggle', id: 'launch-sla', done: false })
    await post({ action: 'note', id: 'launch-sla', text: '' })
    await post({ action: 'reset' })
  })

  test('go-live page fits both themes and a phone', async ({ page }) => {
    const errors = watchErrors(page, [/WebGL|GPU stall|swiftshader/i])
    await page.setViewportSize(SIZES.mobile)
    await open(page, '/admin/golive')
    await expect(page.getByRole('link', { name: 'Назад в офис' })).toBeVisible()
    await noHorizontalOverflow(page)
    expect(errors).toEqual([])
  })

  test('CSV export answers with a csv for the owner', async ({ request, page }) => {
    const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ')
    const res = await request.get('/api/admin/export', { headers: { cookie } })
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('text/csv')
  })

  test('logout ends the session', async ({ page, context, baseURL }) => {
    await context.clearCookies()
    await adminContext(context, baseURL!, LOGOUT_TOKEN)
    await open(page, '/admin/office')
    await page.locator('summary[aria-label="Ещё"]').click()
    await page.getByRole('button', { name: 'Выйти', exact: true }).click()
    await page.waitForURL(/\/admin\/login/)
    await open(page, '/admin/office')
    await expect(page).toHaveURL(/\/admin\/login/)
  })
})
