import { expect, test } from '@playwright/test'
import { fakeSessionCookie, open, watchErrors } from './helpers'

// Cabinet documents read as text (2026-11-23, audit P1: a client signed blind when the PDF did not open).
// Dev mock of HQ (the mocks keep their state for the life of the dev server, so each test uses its own document).

const noise = [/WebGL|GPU stall|swiftshader|Failed to load resource/i]

test.describe('cabinet documents as text', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ ...fakeSessionCookie(), url: baseURL! }])
  })

  test('cabinet: the quote is readable as text when the PDF answers 404, the accept button sits below it', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await page.route('**/api/cabinet/documents/*/file*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"ok":false,"error":"not_found"}' }))
    await open(page, '/ru/cabinet?tab=documents&doc=q-14')
    const viewer = page.locator('[data-doc-open="q-14"]')
    const text = viewer.locator('[data-doc-text]')
    await expect(text).toBeVisible()
    await expect(text.getByRole('heading', { name: 'Коммерческое предложение' })).toBeVisible()
    await expect(text.locator('li').first()).toContainText('Подключим директ Instagram')
    await expect(text.locator('strong', { hasText: '450 USD' })).toBeVisible()
    await expect(viewer.locator('[data-doc-read-first]')).toBeVisible()
    // Read first, act after: the button is under the text.
    const [t, a] = await Promise.all([text.boundingBox(), viewer.locator('[data-doc-accept]').boundingBox()])
    expect(a!.y).toBeGreaterThan(t!.y + t!.height - 1)
    // The PDF is a download, not the only way to read.
    await expect(viewer.locator('[data-doc-download]')).toContainText('Скачать PDF')
    expect(errors).toEqual([])
  })

  test('cabinet: a contract is read as text, then signed with the pad (the sign flow still works)', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await page.route('**/api/cabinet/documents/*/file*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"ok":false}' }))
    await open(page, '/ru/cabinet?tab=documents&doc=c-2')
    const viewer = page.locator('[data-doc-open="c-2"]')
    await expect(viewer.locator('[data-doc-text]')).toContainText('Предмет договора')
    await expect(viewer.locator('[data-doc-text]')).not.toContainText('<')
    await viewer.locator('[data-doc-sign]').click()
    const canvas = viewer.locator('[data-signature-canvas]')
    await canvas.scrollIntoViewIfNeeded()
    const box = (await canvas.boundingBox())!
    await page.mouse.move(box.x + 30, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + 90, box.y + box.height / 2 - 20, { steps: 6 })
    await page.mouse.move(box.x + 150, box.y + box.height / 2 + 15, { steps: 6 })
    await page.mouse.up()
    await viewer.getByLabel('Ваше имя и фамилия').fill('Анна Тестова')
    await viewer.getByRole('checkbox').check()
    await viewer.getByRole('button', { name: 'Подписать договор' }).click()
    await expect(viewer.getByText(/Договор подписан/)).toBeVisible()
    expect(errors).toEqual([])
  })

  test('cabinet: no text and no file is said honestly and the request becomes a ticket', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/ru/cabinet?tab=documents&doc=q-7')
    const viewer = page.locator('[data-doc-open="q-7"]')
    await expect(viewer.locator('[data-doc-body="missing"]')).toContainText('Текст и файл пока недоступны')
    await expect(viewer.locator('[data-doc-download]')).toHaveCount(0)
    await viewer.locator('[data-doc-request]').click()
    await expect(viewer.getByText(/Запрос отправлен/)).toBeVisible()
    expect(errors).toEqual([])
  })
})
