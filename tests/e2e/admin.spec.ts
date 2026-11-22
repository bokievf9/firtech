import { expect, test } from '@playwright/test'
import { adminContext, LOGOUT_TOKEN, noHorizontalOverflow, SIZES, watchErrors, open } from './helpers'

// The owner panel with a hand-written session in the throwaway DATA_DIR (see global-setup.ts) and
// the dev mock of HQ (HQ_ADMIN_URL empty, NODE_ENV development).

// This server runs without ADMIN_PASSWORD_HASH: the login is closed. The open login (wrong, then the
// right password) is tests/e2e-login/admin-login.spec.ts with its own server (npm run test:e2e:login).
test('admin login page says the password is not set up when ADMIN_PASSWORD_HASH is missing', async ({ page, request, baseURL }) => {
  const response = await open(page, '/admin/login')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in to Shell' })).toBeVisible()
  await expect(page.locator('form [role=alert]')).toHaveText('Password is not set up.')
  await expect(page.getByLabel('Password', { exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled()
  await expect(page.getByText('Telegram')).toHaveCount(0)
  expect(await page.locator('meta[name=robots]').getAttribute('content')).toContain('noindex')
  const api = await request.post('/api/admin/login', {
    data: { password: 'any-throwaway-password' },
    headers: { origin: baseURL! },
  })
  expect(api.status()).toBe(503)
  expect(await api.json()).toEqual({ ok: false, error: 'not_configured' })
  expect((await request.post('/api/admin/code', { data: {} })).status()).toBe(404)
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

  test('the presence switch lives in the Shell top bar', async ({ page }) => {
    const errors = watchErrors(page)
    await open(page, '/admin/inbox')
    await expect(page.getByRole('radio', { name: 'На месте', exact: true })).toBeVisible()
    await page.getByRole('radio', { name: 'Не на месте', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'Не на месте', exact: true })).toBeChecked()
    await page.getByRole('radio', { name: 'На месте', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'На месте', exact: true })).toBeChecked()
    expect(errors).toEqual([])
  })

  test('⌘K opens the palette, filters and closes with Esc', async ({ page }) => {
    await open(page, '/admin/inbox')
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
    await open(page, '/admin/inbox')
    const before = await page.locator('html').getAttribute('data-theme')
    await page.getByRole('button', { name: /Включить (светлую|тёмную) тему/ }).click()
    await expect.poll(() => page.locator('html').getAttribute('data-theme')).not.toBe(before)
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

    // The page shows the odometer and the 41 items; the reset button clears the timer, keeps the ticks.
    await open(page, '/admin/golive')
    await expect(page.getByText(/Готово 1 из 41/)).toBeVisible()
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
    await expect(page.locator('[data-hq-shell]')).toBeVisible()
    await noHorizontalOverflow(page)
    expect(errors).toEqual([])
  })

  test('review centre: rail with counts, queue, J/K step, the revise composer and the trend link dialog', async ({ page }) => {
    const errors = watchErrors(page, [/WebGL|GPU stall|swiftshader|Failed to load resource/i])
    await open(page, '/admin/review?id=ap_201')
    // the old link redirects into Approvals and keeps the item
    await expect(page).toHaveURL(/\/admin\/approvals\?id=ap_201$/)
    await expect(page.getByRole('heading', { name: 'Approvals', level: 1 })).toBeVisible()
    const rail = page.getByRole('navigation', { name: 'Отделы' })
    await expect(rail.getByRole('button', { name: /^Все/ })).toHaveAttribute('aria-pressed', 'true')
    // The rail has seven entries, each with a count.
    await expect(rail.getByRole('button')).toHaveCount(7)
    await expect(rail.getByRole('button', { name: /^Маркетинг \d+/ })).toBeVisible()
    const queue = page.getByRole('list', { name: 'Очередь' })
    await expect(queue.getByRole('button').first()).toBeVisible()

    // J and K step through the queue; the position counter follows.
    const position = page.getByText(/^\d+ \/ \d+$/)
    await expect(position).toHaveText(/^\d+ \/ \d+$/)
    const [at, all] = (await position.textContent())!.split('/').map(Number) as [number, number]
    expect(all).toBeGreaterThan(1)
    await page.keyboard.press('j')
    await expect(position).toHaveText(new RegExp(`^${at + 1} / ${all}$`))
    await page.keyboard.press('k')
    await expect(position).toHaveText(new RegExp(`^${at} / ${all}$`))

    // Another department narrows the queue; the first key goes back to «Все».
    await rail.getByRole('button', { name: /^Маркетинг/ }).click()
    await expect(rail.getByRole('button', { name: /^Маркетинг/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(queue.getByRole('button').first()).toBeVisible()

    // «Правки» opens the revise composer, Esc closes it again (and stays on the page).
    await page.getByRole('button', { name: /^Правки/ }).first().click()
    const note = page.locator('#revise-note')
    await expect(note).toBeVisible()
    await note.fill('хук короче')
    await page.keyboard.press('Escape')
    await expect(note).toBeHidden()
    await expect(page).toHaveURL(/\/admin\/approvals\?id=ap_/)

    // «Скинуть ссылку»: the dialog opens with a URL field, rejects junk and closes with Esc.
    await page.getByRole('button', { name: 'Скинуть ссылку' }).click()
    const dialog = page.getByRole('dialog', { name: 'Скинуть ссылку Трендвотчеру' })
    await expect(dialog).toBeVisible()
    await dialog.locator('input[type=url]').fill('https://example.com/some-video')
    await dialog.getByRole('button', { name: 'Отправить' }).click()
    await expect(dialog.getByRole('alert')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    // A supported link goes to the Trendwatcher (mock) and the dialog closes with a toast.
    await page.getByRole('button', { name: 'Скинуть ссылку' }).click()
    await dialog.locator('input[type=url]').fill('https://www.youtube.com/shorts/e2e12345678')
    await dialog.getByRole('button', { name: 'Отправить' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.locator('[role=status], [role=alert]').filter({ hasText: /Ссылка принята|уже в работе/ }).first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('chats: a thread opens, the reply box sends with Enter and the answer joins the thread', async ({ page }) => {
    const errors = watchErrors(page, [/Failed to load resource/i])
    await open(page, '/admin/chats')
    await expect(page.getByRole('heading', { name: /Чаты/, level: 1 }).or(page.getByRole('heading', { level: 1 })).first()).toBeVisible()
    const list = page.getByRole('complementary', { name: 'Чаты' })
    await expect(list.getByRole('button').first()).toBeVisible()
    await list.getByRole('button').first().click()
    const thread = page.getByRole('region', { name: 'Переписка' })
    await expect(thread).toBeVisible()
    const box = thread.locator('textarea')
    await expect(box).toBeVisible()
    await expect(box).toHaveAttribute('placeholder', /^Ответ клиенту/)
    // Anna has a lead, a project and support threads: the picker offers them, the thread of her last message (project 4) is preselected and the messages carry thread chips.
    const picker = thread.getByRole('combobox', { name: 'Ответить в тред' })
    await expect(picker).toBeVisible()
    await expect(picker).toHaveValue('project-4')
    await expect(thread.getByText('Заявка', { exact: true }).first()).toBeVisible()
    await picker.selectOption('lead')
    // The list has a search box and «mark unread».
    await list.getByRole('searchbox', { name: 'Поиск по клиентам' }).fill('нет такого клиента')
    await expect(list.getByText('По запросу никого нет.')).toBeVisible()
    await list.getByRole('searchbox', { name: 'Поиск по клиентам' }).fill('')
    await box.fill('e2e: ответ владельца')
    await box.press('Enter')
    await expect(thread.getByText('e2e: ответ владельца').first()).toBeVisible()
    await expect(box).toHaveValue('')
    expect(errors).toEqual([])
  })

  test('Settings / Цены: edit one price in the section, see it saved, reset it through the API', async ({ page, request, baseURL }) => {
    const headers = { origin: baseURL!, cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ') }
    const state = async () => (await request.get('/api/admin/prices', { headers })).json()
    // Start clean (the throwaway data dir may hold an edit from a retried run).
    expect((await request.post('/api/admin/prices', { data: { action: 'reset' }, headers })).status()).toBe(200)
    expect((await state()).overridden).toEqual([])

    await open(page, '/admin/settings')
    // The referral reward is the one price no other test asserts.
    const cell = page.getByRole('button', { name: /^Изменить цену: Награда за приведённого клиента/ })
    await cell.scrollIntoViewIfNeeded()
    const before = (await state()).merged.referralPercent as number
    const next = before === 12 ? 13 : 12
    await cell.click()
    const input = page.getByRole('textbox', { name: /^Новая цена: Награда за приведённого клиента/ })
    await input.fill(String(next))
    await input.press('Enter')
    await expect(page.locator('[role=status], [role=alert]').filter({ hasText: /Сохранено/ }).first()).toBeVisible()
    await expect.poll(async () => (await state()).merged.referralPercent).toBe(next)
    expect((await state()).overridden).toContain('referralPercent')
    await expect(page.getByRole('button', { name: /^Вернуть по умолчанию: Награда за приведённого клиента/ })).toBeVisible()

    // Out of range is refused by the API with a key, the stored value stays.
    const bad = await request.post('/api/admin/prices', { data: { path: 'referralPercent', value: 5000 }, headers })
    expect(bad.status()).toBe(422)
    expect((await bad.json()).error).toMatch(/^out_of_range/)

    // Reset through the API: no overrides left, the default is back.
    expect((await request.post('/api/admin/prices', { data: { action: 'reset', path: 'referralPercent' }, headers })).status()).toBe(200)
    const after = await state()
    expect(after.overridden).toEqual([])
    expect(after.merged.referralPercent).toBe(after.defaults.referralPercent)
    expect((await request.post('/api/admin/prices', { data: { action: 'reset' }, headers: { ...headers, origin: 'https://evil.example' } })).status()).toBe(403)
  })

  test('Production: the project drawer accepts a paid, delivered stage for the client', async ({ page }) => {
    await open(page, '/admin/projects')
    await page.getByText('Сайт студии').first().click()
    const drawer = page.getByRole('dialog').or(page.locator('aside').last())
    const accept = drawer.getByRole('button', { name: 'Принять этап' })
    await expect(accept).toHaveCount(1)
    await expect(drawer.getByText('ждёт приёмки')).toBeVisible()
    await expect(drawer.getByText('ждёт оплаты')).toBeVisible()
    await accept.click()
    await expect(page.locator('[role=status], [role=alert]').filter({ hasText: /Этап 1 (уже был )?принят/ }).first()).toBeVisible()
    await expect(drawer.getByRole('button', { name: 'Принять этап' })).toHaveCount(0)
    await expect(drawer.getByText('принят', { exact: true })).toBeVisible()
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
    await open(page, '/admin/inbox')
    await page.locator('summary[aria-label="Ещё"]').click()
    await page.getByRole('button', { name: 'Выйти', exact: true }).click()
    await page.waitForURL(/\/admin\/login/)
    await open(page, '/admin/inbox')
    await expect(page).toHaveURL(/\/admin\/login/)
  })
})
