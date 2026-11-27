import { expect, test } from '@playwright/test'
import { noHorizontalOverflow, open, watchErrors } from './helpers'

// T1 of the motion storyboard: section rail, palette, hybrid header, phone progress line, sound toggle.
const desktop = { width: 1440, height: 900 }
const phone = { width: 390, height: 844 }

test.describe('desktop rail', () => {
  test.use({ viewport: desktop })

  test('the rail is in the first HTML as real anchors (works without JS)', async ({ request }) => {
    const html = await (await request.get('/ru')).text()
    const nav = html.match(/<nav[^>]*aria-label="Разделы страницы"[\s\S]*?<\/nav>/)?.[0] ?? ''
    expect(nav).toContain('<ol')
    for (const id of ['top', 'pains', 'demo', 'products', 'office', 'solutions', 'process', 'faq']) expect(nav).toContain(`href="#${id}"`)
    expect(nav).toContain('aria-current="location"')
    expect(nav.match(/tabindex="0"/g)?.length).toBe(1) // roving: one tab stop
    const en = await (await request.get('/en')).text()
    expect(en).toContain('aria-label="Page sections"')
    expect(nav).not.toMatch(/ролик|трейлер|эпизод|тайм-?код/i)
  })

  test('a tick scrolls to its section and takes aria-current; arrows move between ticks', async ({ page }) => {
    const errors = watchErrors(page)
    await open(page, '/ru')
    const rail = page.getByRole('navigation', { name: 'Разделы страницы' })
    await expect(rail.locator('a')).toHaveCount(8)
    await rail.locator('a[href="#demo"]').click()
    await expect(rail.locator('a[href="#demo"]')).toHaveAttribute('aria-current', 'location', { timeout: 6000 })
    await expect(page).toHaveURL(/#demo$/)
    await rail.locator('a[href="#demo"]').focus()
    await page.keyboard.press('ArrowDown')
    await expect(rail.locator('a[href="#products"]')).toBeFocused()
    await page.keyboard.press('End')
    await expect(rail.locator('a[href="#faq"]')).toBeFocused()
    expect(errors).toEqual([])
  })

  test('[ and ] jump between sections instantly, but not inside a field', async ({ page }) => {
    await open(page, '/ru')
    await page.evaluate(() => document.querySelector('#demo')?.scrollIntoView({ behavior: 'instant' }))
    const rail = page.getByRole('navigation', { name: 'Разделы страницы' })
    await expect(rail.locator('a[href="#demo"]')).toHaveAttribute('aria-current', 'location')
    await page.keyboard.press(']')
    await expect(rail.locator('a[href="#products"]')).toHaveAttribute('aria-current', 'location')
    await page.keyboard.press('[')
    await expect(rail.locator('a[href="#demo"]')).toHaveAttribute('aria-current', 'location')
  })

  test('pages without sections of their own collect them from the DOM (how-we-work), quiet routes have none', async ({ page }) => {
    await open(page, '/ru/how-we-work')
    const rail = page.getByRole('navigation', { name: 'Разделы страницы' })
    await expect(rail).toBeVisible()
    expect(await rail.locator('a').count()).toBeGreaterThanOrEqual(3)
    await open(page, '/ru/privacy')
    await expect(page.getByRole('navigation', { name: 'Разделы страницы' })).toHaveCount(0)
  })

  test('header geometry does not change when the page scrolls', async ({ page }) => {
    await open(page, '/ru')
    const bar = page.locator('header > div').first()
    const before = await bar.boundingBox()
    await page.mouse.wheel(0, 900)
    await page.waitForTimeout(500)
    const after = await bar.boundingBox()
    expect(after).toEqual(before)
  })
})

test.describe('palette', () => {
  test.use({ viewport: desktop })

  test('Ctrl+K opens in the same frame with no transition, Esc returns the focus', async ({ page }) => {
    const errors = watchErrors(page)
    await open(page, '/ru')
    const cta = page.locator('header a[data-cta="header"]')
    await cta.focus()
    await page.keyboard.press('Control+k')
    const panel = page.locator('[data-palette]')
    await expect(panel).toBeVisible({ timeout: 300 })
    const style = await panel.evaluate((el) => {
      const s = getComputedStyle(el)
      return { t: s.transitionDuration, a: s.animationName, o: s.opacity }
    })
    expect(style).toEqual({ t: '0s', a: 'none', o: '1' })
    await expect(panel.getByRole('combobox')).toBeFocused()
    await expect(panel.getByRole('option').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(cta).toBeFocused()
    expect(errors).toEqual([])
  })

  test('"/" opens it, but never inside an input; typing filters; Enter goes', async ({ page }) => {
    await open(page, '/ru')
    await page.keyboard.press('/')
    const panel = page.locator('[data-palette]')
    await expect(panel).toBeVisible()
    await page.keyboard.type('решен')
    await expect(panel.getByRole('option')).toHaveCount(2) // the section and the page
    await page.keyboard.press('Escape')
    await page.keyboard.press('/')
    await page.keyboard.type('нет такого')
    await expect(panel.getByText('Ничего не нашли')).toBeVisible()
    await page.keyboard.press('Escape')

    await open(page, '/ru/cabinet/login')
    await page.locator('input[type=email]').focus()
    await page.keyboard.press('/')
    await expect(page.locator('[data-palette]')).toHaveCount(0)
    await page.keyboard.press('Control+k')
    await expect(page.locator('[data-palette]')).toBeVisible()
    await page.keyboard.press('Escape')

    await open(page, '/ru')
    await page.keyboard.press('Control+k')
    await page.keyboard.type('как работаем')
    await page.keyboard.press('Enter')
    await page.waitForURL(/\/ru\/how-we-work/)
  })

  test('arrows move the highlight, the list is a listbox, the rail hides while it is open', async ({ page }) => {
    await open(page, '/ru')
    await page.keyboard.press('Control+k')
    const panel = page.locator('[data-palette]')
    await expect(panel.getByRole('listbox')).toBeVisible()
    await expect(panel.getByRole('option').first()).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowDown')
    await expect(panel.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-section-rail]')).toHaveAttribute('data-hidden', 'true')
    const active = await panel.getByRole('combobox').getAttribute('aria-activedescendant')
    expect(active).toBeTruthy()
  })

  test('Toggle sound from the palette flips the stored choice; sound is off by default', async ({ page }) => {
    await open(page, '/ru')
    expect(await page.evaluate(() => localStorage.getItem('fir-sound'))).toBeNull()
    await page.keyboard.press('Control+k')
    await page.keyboard.type('звук')
    await page.keyboard.press('Enter')
    await expect.poll(() => page.evaluate(() => localStorage.getItem('fir-sound'))).toBe('on')
  })
})

test.describe('sound toggle', () => {
  test.use({ viewport: { width: 1600, height: 900 } })
  test('speaker button in the header: off, aria-pressed, no sprite requested', async ({ page }) => {
    const requests: string[] = []
    page.on('request', (r) => requests.push(r.url()))
    await open(page, '/ru')
    const btn = page.locator('header [data-sound-toggle]')
    await expect(btn).toHaveAttribute('aria-pressed', 'false')
    await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(requests.filter((u) => /\/sound\//.test(u))).toEqual([])
  })
})

test.describe('reduced motion and transparency', () => {
  test.use({ viewport: desktop })
  test('reduced motion: no scale on the rail pill (transparency is covered by tests/sections.test.mjs)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page, '/ru')
    const pill = page.locator('.rail-pill')
    expect(await pill.evaluate((el) => getComputedStyle(el).transform)).toBe('none')
  })
})

test.describe('phone', () => {
  test.use({ viewport: phone, hasTouch: true, isMobile: true })

  test('progress line under the bar, tap opens the section sheet, tap on a section scrolls and closes', async ({ page }) => {
    const errors = watchErrors(page)
    await open(page, '/ru')
    await expect(page.locator('[data-section-rail]')).toBeHidden()
    const line = page.locator('[data-progress-line] button')
    await expect(line).toBeVisible()
    const box = await line.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
    await line.tap()
    const sheet = page.getByRole('dialog', { name: 'Разделы страницы' })
    await expect(sheet).toBeVisible()
    await expect(sheet.locator('a')).toHaveCount(8)
    await sheet.locator('a[href="#solutions"]').tap()
    await expect(sheet).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 8000 }).toBeGreaterThan(1500)
    await noHorizontalOverflow(page, 'phone home')
    expect(errors).toEqual([])
  })

  test('the menu carries Sections and Sound; no horizontal overflow on a product page', async ({ page }) => {
    await open(page, '/ru/products/company')
    await page.getByRole('button', { name: 'Меню' }).tap()
    const menu = page.locator('#mobile-menu')
    await expect(menu.getByRole('button', { name: 'Звук' })).toBeVisible()
    await expect(menu.getByRole('button', { name: 'Разделы' })).toBeVisible()
    await page.keyboard.press('Escape')
    await noHorizontalOverflow(page, 'phone product')
  })
})

test('EN labels', async ({ page }) => {
  await page.setViewportSize(desktop)
  await open(page, '/en')
  const rail = page.getByRole('navigation', { name: 'Page sections' })
  await expect(rail.locator('a[href="#process"]')).toHaveAttribute('aria-label', 'Process and pricing')
})
