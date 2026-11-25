import { expect, test } from '@playwright/test'
import { noHorizontalOverflow, SIZES } from './helpers'

// Design v5 hero (artboard F): the split headline, two buttons, Fira in the portal, four orbs, one ink bubble.
test('home hero v5: headline, both buttons, four priced orbs; the glass button opens the chat', async ({ page }) => {
  await page.setViewportSize(SIZES.desktop)
  await page.goto('/ru')
  const top = page.locator('#top')
  await expect(top.locator('h1')).toContainText('Ваш ИИ.')
  await expect(top.locator('h1 strong')).toHaveText('Для жизни и для дела.')
  await expect(top.locator('[data-cta=hero_builder]')).toHaveAttribute('href', '/ru/builder')
  await expect(top.getByRole('link', { name: 'Собрать проект' })).toBeVisible()
  await expect(top.locator('.fira-portal img')).toBeVisible()
  const orbs = top.locator('[data-orb]')
  await expect(orbs).toHaveCount(4)
  await expect(orbs.nth(0)).toContainText(/Личный ИИ · от \d/)
  await expect(orbs.nth(2)).toContainText('смета за минуту')
  await expect(top.locator('.bubble-ink')).toContainText('Фира:')
  await expect(top.locator('.orbit-ring')).toHaveCount(2)
  await top.getByRole('link', { name: 'Спросить Фиру' }).click()
  await expect(page.locator('[role=dialog]')).toBeVisible()
})

for (const size of [SIZES.desktop, { width: 1280, height: 800 }, SIZES.mobile]) {
  test(`home hero v5: the orbs do not cover the buttons and nothing overflows ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size)
    await page.goto('/ru')
    await page.waitForTimeout(1200)
    const boxes = await page.evaluate(() => {
      const r = (el: Element) => {
        const b = el.getBoundingClientRect()
        return { l: b.left, r: b.right, t: b.top, b: b.bottom }
      }
      return {
        buttons: [...document.querySelectorAll('#top [data-cta=hero_builder], #top [data-cta=chat_hero]')].map(r),
        orbs: [...document.querySelectorAll('#top [data-orb]')].map(r),
        vw: document.documentElement.clientWidth,
      }
    })
    expect(boxes.buttons).toHaveLength(2)
    for (const b of boxes.buttons)
      for (const o of boxes.orbs) {
        const hit = o.l < b.r && o.r > b.l && o.t < b.b && o.b > b.t
        expect(hit, JSON.stringify({ b, o })).toBe(false)
      }
    await noHorizontalOverflow(page, `hero ${size.width}`)
  })
}
