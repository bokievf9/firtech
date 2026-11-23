import { expect, test, type Page } from '@playwright/test'
import { open, watchErrors } from './helpers'

// Fira chat 2.0: the stream, the three dots, words one by one, link cards, the stage slot and the page context.
// The stream is mocked (page.route): the widget paces the words itself (about 180 ms a word).

const REPLY = 'Оплата идёт по этапам: сначала предоплата за первый этап, потом остальное по принятой работе. Всё понятно описано в статье.'
const sse = (data: unknown) => `data: ${JSON.stringify(data)}\n\n`
const isStream = (u: URL) => u.pathname === '/api/chat' && u.search === '?stream=1'

async function mockStream(page: Page) {
  // The greeting (plain JSON, no buttons): the page suggestions show under it until the visitor writes.
  await page.route((u) => u.pathname === '/api/chat' && u.search === '', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, reply: 'Здравствуйте, я Фира.', state: 'chat' }) })
  })
  await page.route(isStream, async (route) => {
    const words = REPLY.split(' ')
    const body =
      words.map((w, i) => sse({ t: i < words.length - 1 ? `${w} ` : w })).join('') +
      sse({
        done: true,
        cards: [
          { kind: 'article', title: 'Сколько стоит сайт в 2026', href: '/ru/blog/website-cost-2026' },
          { kind: 'page', title: 'Как мы работаем', href: '/ru/how-we-work' },
        ],
        meta: { ok: true, state: 'chat' },
      })
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8', 'x-chat-mode': 'mock' }, body })
  })
}

const openChat = (page: Page) => page.evaluate(() => window.dispatchEvent(new CustomEvent('fira', { detail: { type: 'open-chat' } })))

test('fira chat: dots, then words appear one by one, a card appears and opens its page', async ({ page }) => {
  const errors = watchErrors(page)
  await mockStream(page)
  await open(page, '/ru/pay-how')
  await expect(page.locator('main')).toHaveAttribute('data-fira-page', 'pay-how')
  await openChat(page)
  const dialog = page.locator('[role=dialog]')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('[data-chat-stage] svg').first()).toBeVisible()
  await expect(dialog.locator('[data-chat-build]')).toHaveAttribute('href', '/ru/builder')
  // Suggestions of this page (pricing group), sent with one click.
  await expect(dialog.locator('[data-chat-suggest]')).toBeVisible()
  await dialog.getByRole('button', { name: 'Как проходит оплата по этапам?' }).click()
  await expect(dialog.locator('[data-chat-live="dots"]')).toBeVisible()
  await expect(dialog.locator('[data-chat-live="words"]')).toBeVisible()
  // Incremental: a short prefix first, the whole line later.
  const len = () => dialog.locator('[data-chat-live-text]').evaluate((el) => el.textContent?.length ?? 0).catch(() => REPLY.length)
  const early = await len()
  expect(early).toBeLessThan(REPLY.length)
  await expect(dialog.locator('[data-chat-live]')).toHaveCount(0, { timeout: 15_000 })
  await expect(dialog).toContainText('Всё понятно описано в статье.')
  const card = dialog.locator('[data-chat-card=article]')
  await expect(card).toBeVisible()
  await expect(dialog.locator('[data-chat-card=page]')).toBeVisible()
  await card.click()
  await expect(page).toHaveURL(/\/ru\/blog\/website-cost-2026$/)
  // The history survives the navigation: open again and the exchange is still there.
  await openChat(page)
  await expect(page.locator('[role=dialog]')).toContainText('Как проходит оплата по этапам?')
  await expect(page.locator('main')).toHaveAttribute('data-fira-page', 'blog/website-cost-2026')
  expect(errors).toEqual([])
})

test('fira chat: an error shows sorry and a retry that works', async ({ page }) => {
  let fail = true
  await page.route(isStream, async (route) => {
    if (fail) {
      fail = false
      await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'hq_error' }) })
    } else await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse({ t: 'Готово.' }) + sse({ done: true, cards: [], meta: { ok: true, state: 'chat' } }) })
  })
  await open(page, '/ru/builder')
  await openChat(page)
  const dialog = page.locator('[role=dialog]')
  await dialog.locator('textarea').fill('Привет')
  await dialog.getByLabel('Отправить').click()
  await expect(dialog.locator('[data-chat-stage]')).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Повторить/ })).toBeVisible()
  await expect(dialog.locator('[data-chat-live]')).toHaveCount(0)
  await dialog.getByRole('button', { name: /Повторить/ }).click()
  await expect(dialog).toContainText('Готово.')
})

test('fira chat: the launcher is on the builder, the cabinet, a legal page and the 404', async ({ page }) => {
  for (const path of ['/ru/builder', '/ru/cabinet/login', '/ru/terms', '/ru/no-such-page']) {
    await open(page, path)
    await expect(page.locator('[data-cta=chat_fab]'), path).toBeAttached()
    await expect(page.locator('[data-cta=chat_fab]'), path).toHaveCSS('opacity', '1', { timeout: 10_000 })
  }
})

test('fira chat: reduced motion shows the whole answer at once, without dots', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mockStream(page)
  await open(page, '/ru/pay-how')
  await openChat(page)
  const dialog = page.locator('[role=dialog]')
  await dialog.locator('textarea').fill('Как платить?')
  await dialog.getByLabel('Отправить').click()
  await expect(dialog).toContainText('Всё понятно описано в статье.')
  await expect(dialog.locator('[data-chat-live="dots"]')).toHaveCount(0)
})

test('fira chat: the panel expands on a wide screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page, '/ru/how-we-work')
  await openChat(page)
  const dialog = page.locator('[role=dialog]')
  await expect(dialog).toHaveAttribute('data-chat-size', 'normal')
  await dialog.locator('[data-chat-expand]').click()
  await expect(dialog).toHaveAttribute('data-chat-size', 'wide')
})
