import { expect, test, type Page } from '@playwright/test'
import { open, setTheme } from './helpers'

// Guard against forms spilling out of their frame (owner review 2026-11-22, item 4). At 390 and 768 px,
// on the key pages: no horizontal page scroll, and no input / select / textarea / button inside a
// <form> wider than the form's content box. Long values are typed in first, because the defects only
// show with a 40-character e-mail or an unbroken company name.

const PAGES = ['/ru', '/en', '/ru/builder', '/ru/products/personal', '/ru/products/company', '/ru/services/websites', '/ru/solutions/salon', '/ru/audit', '/ru/cabinet/login', '/ru/pay-how', '/ru/no-such-page']
const LONG = 'Очень_длинное_название_компании_без_пробелов_ООО_Ромашка_и_партнёры_2026'
const EMAIL = 'very.long.email.address.of.a.client.number.one@subdomain.example-company-name.com'

async function formOverflow(page: Page) {
  return page.evaluate(() => {
    const out: string[] = []
    const vw = window.innerWidth
    if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${vw}`)
    for (const form of document.querySelectorAll('form')) {
      const fr = form.getBoundingClientRect()
      for (const el of form.querySelectorAll('input, select, textarea, button')) {
        if (el.closest('.sr-only, [aria-hidden="true"], [hidden]')) continue
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        if (r.right > fr.right + 1 || r.left < fr.left - 1 || r.right > vw + 1 || r.left < -1) {
          out.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.getAttribute('name') || el.textContent || '').trim().slice(0, 30)}" ${Math.round(r.left)}-${Math.round(r.right)} outside form ${Math.round(fr.left)}-${Math.round(fr.right)}`)
        }
      }
    }
    return out
  })
}

for (const width of [390, 768]) {
  test.describe(`no overflow at ${width}`, () => {
    test.use({ viewport: { width, height: 900 } })
    for (const url of PAGES) {
      for (const theme of ['light', 'dark'] as const) {
        test(`${url} (${theme})`, async ({ page }) => {
          await setTheme(page, theme)
          await open(page, url)
          for (const el of await page.locator('form input:not([type=checkbox]):not([type=radio]):not([type=password]):not([type=hidden]), form textarea').all()) {
            await el.fill((await el.getAttribute('type')) === 'email' ? EMAIL : LONG).catch(() => {})
          }
          expect(await formOverflow(page)).toEqual([])
        })
      }
    }

    test('home: product card titles stay inside their column', async ({ page }) => {
      await open(page, '/ru')
      const bad = await page.locator('#products h3').evaluateAll((els) =>
        els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => `${e.textContent} ${e.scrollWidth}>${e.clientWidth}`),
      )
      expect(bad).toEqual([])
    })

    test('builder details step with long values', async ({ page }) => {
      await open(page, '/ru/builder')
      await page.getByRole('radio').first().click()
      for (let step = 2; step <= 7; step++) {
        await expect(page.locator('[aria-current="step"]')).toHaveAttribute('aria-label', new RegExp(`^${step}\\.`))
        if (step === 7) break
        await page.getByRole('button', { name: /^Дальше/ }).click({ force: true })
      }
      // The entry screen (with its task form) has left the page by now.
      await expect(page.locator('[data-task-start]')).toHaveCount(0)
      for (const el of await page.locator('[data-builder] input[type=text], [data-builder] input:not([type]), [data-builder] textarea').all()) await el.fill(LONG + LONG)
      expect(await formOverflow(page)).toEqual([])
    })

    test('chat widget with a long unbroken message', async ({ page }) => {
      await open(page, '/ru')
      await page.locator('[data-cta=chat_fab]').click()
      await page.locator('[data-cta=fira_ask]').click()
      const dialog = page.getByRole('dialog')
      await dialog.locator('textarea').fill(`${LONG} ${EMAIL}`)
      await page.keyboard.press('Enter')
      await expect(dialog.getByText(LONG, { exact: false }).first()).toBeVisible()
      expect(await formOverflow(page)).toEqual([])
      const bubbles = await dialog.locator('li > span, li > div').evaluateAll((els) => els.map((e) => e.scrollWidth - e.clientWidth))
      expect(Math.max(0, ...bubbles)).toBeLessThanOrEqual(2)
    })
  })
}
