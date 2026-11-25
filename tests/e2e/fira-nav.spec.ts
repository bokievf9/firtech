import { expect, test, type Page } from '@playwright/test'
import { fakeSessionCookie, noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// Fira navigation 2.0 (owner 2026-11-25): the spotlight tour, «Отведи меня» (chat cards, deep links), the site map
// panel, the context chips, the one-time tour offer and the scroll companion. Reduced motion is on where timing matters.
const openChat = (page: Page) =>
  expect(async () => {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('fira', { detail: { type: 'open-chat' } })))
    await expect(page.locator('[role=dialog]')).toBeVisible({ timeout: 1500 })
  }).toPass({ timeout: 30_000 })
const startTourFromMenu = async (page: Page) => {
  await page.locator('[data-cta="chat_fab"]').click()
  await page.locator('[data-cta="fira_tour"]').click()
}
const ask = async (page: Page, text: string) => {
  const dialog = page.locator('[role=dialog]')
  await dialog.locator('textarea').fill(text)
  await dialog.getByLabel('Отправить').click()
  return dialog
}

test('spotlight tour on the home page: dim with a cutout, progress, Next, Back, Esc', async ({ page }) => {
  const errors = watchErrors(page, [/Failed to load resource/])
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize(SIZES.desktop)
  await open(page, '/ru')
  await startTourFromMenu(page)
  const bubble = page.locator('[data-fira-bubble="tour"]')
  await expect(bubble).toHaveAttribute('data-open', 'true')
  await expect(page.locator('[data-fira-spot]')).toBeVisible()
  await expect(bubble.locator('[data-fira-progress]')).toHaveText('1 из 8')
  await expect(bubble.locator('[data-fira-dot]')).toHaveCount(8)
  await expect(bubble.locator('[data-cta="fira_tour_prev"]')).toBeDisabled()
  await expect(bubble.locator('[data-cta="fira_tour_next"]')).toBeFocused()
  await bubble.locator('[data-cta="fira_tour_next"]').click()
  await expect(bubble.locator('[data-fira-progress]')).toHaveText('2 из 8')
  await expect(page.locator('[data-film-scene="pains"]')).toHaveAttribute('data-tour-on', '')
  // the bubble stays inside the screen and does not sit on the lit block's cutout edge
  const box = await bubble.boundingBox()
  expect(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1440 && box.y + box.height <= 900).toBe(true)
  await page.keyboard.press('ArrowRight')
  await expect(bubble.locator('[data-fira-progress]')).toHaveText('3 из 8')
  await page.keyboard.press('ArrowLeft')
  await expect(bubble.locator('[data-fira-progress]')).toHaveText('2 из 8')
  await bubble.locator('[data-cta="fira_tour_prev"]').click()
  await expect(bubble.locator('[data-fira-progress]')).toHaveText('1 из 8')
  // Tab stays inside the bubble
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab')
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[data-fira-bubble="tour"]')))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-fira-bubble="tour"]')).toHaveCount(0)
  await expect(page.locator('[data-fira-spot]')).toHaveCount(0)
  await expect(page.locator('[data-tour-on]')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('spotlight tour at 390: a bottom sheet inside the screen, a swipe moves on, no overflow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize(SIZES.mobile)
  await open(page, '/ru/products/admin')
  await startTourFromMenu(page)
  const bubble = page.locator('[data-fira-bubble="tour"]')
  await expect(bubble).toBeVisible()
  const first = await bubble.locator('[data-fira-progress]').innerText()
  expect(first).toMatch(/^1 из \d$/)
  const box = (await bubble.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  expect(box.y + box.height).toBeLessThanOrEqual(844)
  await bubble.evaluate((el) => {
    const t = (type: string, x: number) => el.dispatchEvent(new TouchEvent(type, { bubbles: true, changedTouches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: 400 })], touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: el, clientX: x, clientY: 400 })] }))
    t('touchstart', 300)
    t('touchend', 120)
  })
  await expect(bubble.locator('[data-fira-progress]')).toHaveText(/^2 из \d$/)
  await noHorizontalOverflow(page, 'product tour 390')
})

test('«цены» in the chat: one line and a card, a click goes to the page and pulses the section', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, '/ru/pay-how')
  await openChat(page)
  const dialog = await ask(page, 'цены')
  const card = dialog.locator('[data-chat-card=go][data-chat-go-key=prices]')
  await expect(card).toBeVisible()
  await expect(dialog).toContainText('Цены')
  await expect(card).toHaveAttribute('href', '/ru?fira=go:prices')
  await card.click()
  await expect(page).toHaveURL(/\/ru$/)
  await expect(page.locator('[data-fira-pulse]')).toBeAttached({ timeout: 8000 })
  const inView = await page.evaluate(() => {
    const r = document.querySelector('#pricing')!.getBoundingClientRect()
    return r.top < window.innerHeight && r.bottom > 0
  })
  expect(inView).toBe(true)
  await expect(page.locator('[data-fira-pulse]')).toHaveCount(0, { timeout: 5000 })
})

test('«сколько стоит салон», «как оплатить», «безопасность»: each resolves to a card; a long question still goes to the chat', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, '/ru')
  await openChat(page)
  const dialog = await ask(page, 'сколько стоит салон')
  await expect(dialog.locator('[data-chat-go-key=solution-salon]')).toBeVisible()
  await dialog.locator('textarea').fill('как оплатить')
  await dialog.getByLabel('Отправить').click()
  await expect(dialog.locator('[data-chat-go-key=pay-how]')).toBeVisible()
  await dialog.locator('textarea').fill('безопасность')
  await dialog.getByLabel('Отправить').click()
  await expect(dialog.locator('[data-chat-go-key=security]')).toBeVisible()
  // on the page of the answer the card says «Показать здесь»
  await dialog.locator('textarea').fill('цены')
  await dialog.getByLabel('Отправить').click()
  await expect(dialog.locator('[data-chat-go-key=prices]').last()).toContainText('Показать здесь')
})

test('site map: the menu opens grouped pages, the search uses the matcher, a row leads there and pulses', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize(SIZES.desktop)
  await open(page, '/ru')
  await page.locator('[data-cta="chat_fab"]').click()
  await page.locator('[data-cta="fira_map"]').click()
  const panel = page.locator('[data-fira-map=open]')
  await expect(panel).toBeVisible()
  for (const g of ['self', 'business', 'teams', 'how', 'cabinet']) await expect(panel.locator(`[data-fira-map-group=${g}]`)).toBeAttached()
  await expect(panel.locator('[data-fira-map-group=self] h3')).toHaveText('Для себя')
  await expect(panel.locator('[data-fira-map-entry=security]')).toContainText('Безопасность')
  await expect(panel.locator('[data-fira-map-entry=security]')).toContainText('Где лежат данные')
  await panel.getByRole('searchbox').fill('как оплатить')
  await expect(panel.locator('[data-fira-map-results] [data-fira-map-entry]').first()).toHaveAttribute('data-fira-map-entry', 'pay-how')
  await panel.getByRole('searchbox').fill('qqzzxx')
  await expect(panel.locator('[data-fira-map-none]')).toBeVisible()
  await panel.getByRole('searchbox').fill('цен')
  await panel.locator('[data-fira-map-entry=prices]').click()
  await expect(page.locator('[data-fira-map=closed]')).toBeAttached()
  await expect(page.locator('[data-fira-pulse]')).toBeAttached({ timeout: 8000 })
  // «недавно» remembers the trip
  await page.locator('[data-cta="chat_fab"]').click()
  await page.locator('[data-cta="fira_map"]').click()
  await expect(page.locator('[data-fira-map-recent] [data-fira-map-entry=prices]')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-fira-map=closed]')).toBeAttached()
})

test('site map at 390 is a bottom sheet that fits the screen', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize(SIZES.mobile)
  await open(page, '/ru/how-we-work')
  await page.locator('[data-cta="chat_fab"]').click()
  await page.locator('[data-cta="fira_map"]').click()
  const panel = page.locator('[data-fira-map=open]')
  await expect(panel).toBeVisible()
  const box = (await panel.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(843)
  expect(box.height).toBeLessThan(844 * 0.84)
  await noHorizontalOverflow(page, 'map 390')
})

test('chips: three on the builder, then a trip to the payment stages', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, '/ru/builder')
  await openChat(page)
  const dialog = page.locator('[role=dialog]')
  const chips = dialog.locator('[data-fira-chips=builder] [data-fira-chip]')
  await expect(chips).toHaveText(['Что спросят дальше?', 'Сколько сейчас?', 'Можно позже?'])
  await chips.nth(2).click()
  await expect(page).toHaveURL(/\/ru\/pay-how$/)
  await expect(page.locator('[data-fira-pulse]')).toBeAttached({ timeout: 8000 })
})

test('chips: a prepared question on the builder goes to the chat', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  let asked = ''
  await page.route((u) => u.pathname === '/api/chat', async (route) => {
    const body = route.request().postDataJSON() as { message?: string }
    if (body.message && !body.message.startsWith('__')) asked = body.message
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, reply: 'Хорошо.', state: 'chat' }) })
  })
  await open(page, '/ru/builder')
  await openChat(page)
  const dialog = page.locator('[role=dialog]')
  await dialog.locator('[data-fira-chip]').nth(1).click()
  await expect.poll(() => asked).toContain('Сколько сейчас')
})

test('chips: on the cabinet and the home page too', async ({ page, context, baseURL }) => {
  await context.addCookies([{ ...fakeSessionCookie(), url: baseURL! }])
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, '/ru/cabinet')
  await openChat(page)
  await expect(page.locator('[role=dialog] [data-fira-chips=dashboard] [data-fira-chip]')).toHaveText(['Где моя смета?', 'Что дальше?', 'Написать менеджеру'])
  await page.keyboard.press('Escape')
  await open(page, '/ru')
  await openChat(page)
  await expect(page.locator('[role=dialog] [data-fira-chips=home] [data-fira-chip]')).toHaveText(['Что здесь?', 'Сколько стоит?', 'С чего начать?'])
  await page.locator('[role=dialog] [data-fira-chip]').first().click()
  await expect(page.locator('[data-fira-bubble="tour"]')).toHaveAttribute('data-open', 'true', { timeout: 6000 })
})

test('chips: on a product page «Цена» jumps to the price block of the page', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, '/ru/products/admin')
  await openChat(page)
  await expect(page.locator('[role=dialog] [data-fira-chips=products] [data-fira-chip]')).toHaveText(['Что умеет?', 'Цена', 'Как заказать'])
  await page.locator('[role=dialog] [data-fira-chip]').nth(1).click()
  await expect(page.locator('[data-fira-pulse]')).toBeAttached({ timeout: 8000 })
})

test('deep link ?fira=go:prices scrolls to the prices, pulses once and cleans the address', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, '/ru?fira=go:prices')
  await expect(page.locator('[data-fira-pulse]')).toBeAttached({ timeout: 8000 })
  expect(new URL(page.url()).search).toBe('')
  const inView = await page.evaluate(() => {
    const r = document.querySelector('#pricing')!.getBoundingClientRect()
    return r.top < window.innerHeight && r.bottom > 0
  })
  expect(inView).toBe(true)
})

test('deep link ?fira=go:security on another page navigates and pulses; ?fira=tour starts the tour', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, '/ru/security?fira=go:security')
  await expect(page.locator('[data-fira-pulse]')).toBeAttached({ timeout: 8000 })
  expect(new URL(page.url()).search).toBe('')
  await open(page, '/ru?fira=tour')
  await expect(page.locator('[data-fira-bubble="tour"]')).toHaveAttribute('data-open', 'true', { timeout: 8000 })
  expect(new URL(page.url()).search).toBe('')
  await open(page, '/ru?fira=go:nope')
  await page.waitForTimeout(900)
  await expect(page.locator('[data-fira-pulse]')).toHaveCount(0)
})

test('the tour is offered once per page: a bubble with «Показать», gone after a reload', async ({ page }) => {
  test.setTimeout(150_000)
  await open(page, '/ru/products/admin')
  const offer = page.locator('[data-fira-bubble=offer][data-open=true]')
  await expect(offer).toBeVisible({ timeout: 75_000 }) // her line first (about 10 s), then 7 s of quiet
  await expect(offer.locator('[data-cta=fira_offer_yes]')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('fir-tour-offered'))).toContain('products/admin')
  await offer.locator('[data-cta=fira_offer_no]').click()
  await expect(page.locator('[data-fira-bubble=offer][data-open=true]')).toHaveCount(0)
  await open(page, '/ru/products/admin')
  await page.waitForTimeout(12_000)
  await expect(page.locator('[data-fira-bubble=offer][data-open=true]')).toHaveCount(0)
  // always available from the menu
  await startTourFromMenu(page)
  await expect(page.locator('[data-fira-bubble="tour"]')).toHaveAttribute('data-open', 'true')
})

test('scroll companion: a film scene entering the screen is said once, a dismissed line sticks', async ({ page }) => {
  test.setTimeout(150_000)
  await page.setViewportSize(SIZES.desktop)
  await open(page, '/ru')
  await page.waitForFunction(() => document.documentElement.dataset.film === 'on', null, { timeout: 60_000 })
  await page.evaluate(() => document.querySelector('[data-film-scene="pains"]')!.scrollIntoView({ block: 'center', behavior: 'instant' }))
  const note = page.locator('[data-fira-bubble=note][data-open=true]')
  await expect(note).toBeVisible({ timeout: 30_000 })
  await expect(note).toContainText('Начнём с того, что болит')
  await note.getByRole('button', { name: 'Скрыть подсказку' }).click()
  await page.evaluate(() => document.querySelector('[data-film-scene="demo"]')!.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(1500)
  await expect(page.locator('[data-fira-bubble=note][data-open=true]')).toHaveCount(0)
})

test('scroll companion is off under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, '/ru')
  await page.evaluate(() => document.querySelector('[data-film-scene="pains"]')!.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(1500)
  await expect(page.locator('[data-fira-bubble=note][data-open=true]')).toHaveCount(0)
})
