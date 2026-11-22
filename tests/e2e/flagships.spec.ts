import { expect, test } from '@playwright/test'
import { noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// The two flagship pages (owner 2026-11-22): own structure, the interactive day, levels from the live
// pricing, Fira and the call first on the AI company, the old address redirect. `FLAG_SHOTS=<dir>` saves
// full-page screenshots of both pages at 390 and 1440.
const shots = process.env.FLAG_SHOTS

test('flagships: /ru/products/agent moves to /ru/products/personal', async ({ page }) => {
  await page.goto('/ru/products/agent')
  await expect(page).toHaveURL(/\/ru\/products\/personal$/)
})

test('flagships: Personal AI page, twelve skills, persona day, locked demo, three levels, four questions', async ({ page }) => {
  const errors = watchErrors(page, [/WebGL|THREE/])
  await open(page, '/ru/products/personal')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ИИ, который знает именно вас')
  const got = await page.locator('[data-product-section]').evaluateAll((els) => els.map((el) => el.getAttribute('data-product-section')))
  expect(got).toEqual(['hero', 'channels', 'skills', 'myday', 'plans', 'start', 'questions'])
  // the channels are equals: seven tiles, Telegram not first
  await expect(page.locator('[data-channels] > li')).toHaveCount(7)
  expect(await page.locator('[data-channels] > li').first().getAttribute('data-channel')).not.toBe('telegram')
  // twelve skill tiles, a tap shows the example
  await expect(page.locator('[data-skill]')).toHaveCount(12)
  await page.locator('[data-skill="mail"]').click()
  await expect(page.locator('[data-skill="mail"]')).toHaveAttribute('aria-pressed', 'true')
  // personas swap the day and the demo context
  await page.locator('[data-myday-persona="student"]').click()
  await expect(page.locator('[data-myday-day] [data-myday-hour="07:45"]')).toBeVisible()
  await page.locator('[data-myday-persona="doctor"]').click()
  await expect(page.locator('[data-myday-day] [data-myday-hour="07:40"]')).toBeVisible()
  // signed out: the lock plate over a labelled still example, no input
  const demo = page.locator('[data-personal-demo]')
  await expect(demo).toHaveAttribute('data-personal-demo', 'locked')
  await expect(demo.locator('[data-demo-lock]')).toBeVisible()
  await expect(demo.locator('[data-demo-login]')).toBeVisible()
  await expect(demo.locator('[data-personal-example]')).toBeVisible()
  await expect(demo.locator('input')).toHaveCount(0)
  await expect(page.locator('[data-plan-levels] [data-plan]')).toHaveCount(3)
  await expect(page.locator('[data-plan="basic"]')).toContainText('$290')
  await expect(page.locator('[data-start-steps] > li')).toHaveCount(3)
  await expect(page.locator('[data-questions] button')).toHaveCount(4)
  await expect(page.locator('[data-cta="product_page_personal_build"]')).toHaveAttribute('href', /p\.personal/)
  await expect(page.locator('[data-product-page]')).not.toContainText('Dono')
  expect(errors).toEqual([])
})

test('flagships: AI company page, Fira, call first, control room tour, four stages', async ({ page }) => {
  const errors = watchErrors(page, [/WebGL|THREE/])
  await open(page, '/ru/products/company')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Компания, где рутину ведут агенты, а решения принимаете вы')
  await expect(page.locator('[data-fira-hero]')).toBeVisible()
  const got = await page.locator('[data-product-section]').evaluateAll((els) => els.map((el) => el.getAttribute('data-product-section')))
  expect(got).toEqual(['hero', 'structure', 'pult', 'knowledge', 'trust', 'teamgets', 'rollout', 'included', 'price', 'offer', 'pilot', 'objections', 'next'])
  // the call is the first action, the builder the second
  const hero = page.locator('[data-product-section="hero"]')
  await expect(hero.locator('a, button').filter({ hasText: 'Договориться о созвоне' })).toBeVisible()
  await page.locator('[data-pult-tab="review"]').click()
  await expect(page.locator('[data-pult-tour] [role=tabpanel]')).toContainText('КП для клиники')
  await expect(page.locator('[data-stage-table] tbody tr')).toHaveCount(4)
  await expect(page.locator('[data-product-section="price"]')).toContainText('$1,490')
  expect(errors).toEqual([])
})

test('flagships: both pages fit 390 and 1440 without overflow', async ({ page }) => {
  // Reduced motion shows every block at once, so full-page screenshots carry no half-faded sections.
  if (shots) await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const id of ['personal', 'company'])
    for (const [name, size] of Object.entries(SIZES)) {
      await page.setViewportSize(size)
      await open(page, `/ru/products/${id}`)
      await noHorizontalOverflow(page, `${id} ${name}`)
      if (shots) {
        // Scroll through so every Reveal block fades in, then capture the whole page.
        for (let y = 0; y < (await page.evaluate(() => document.body.scrollHeight)); y += 600) {
          await page.evaluate((top) => window.scrollTo(0, top), y)
          await page.waitForTimeout(120)
        }
        await page.waitForTimeout(800)
        await page.screenshot({ path: `${shots}/${id}-${size.width}.png`, fullPage: true })
      }
    }
})
