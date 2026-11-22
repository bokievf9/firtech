import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// «Сборка проекта» v2 (owner review 2026-11-22): the new flow end to end for three scenarios, at 1440
// and 390. Set SBORKA_SHOTS to a folder to save a screenshot of every step (docs/builder-v2.md).
const shotsDir = process.env.SBORKA_SHOTS

async function shot(page: Page, name: string) {
  if (!shotsDir) return
  mkdirSync(shotsDir, { recursive: true })
  await page.waitForTimeout(700)
  // A full-page capture grows the viewport, and the screen's dvh-based minimum height with it.
  await page.addStyleTag({ content: '[data-builder] > div { min-height: 0 !important }' })
  // The fixed bottom bar and the sticky step bar are hidden so they do not cover the content in a tall capture.
  await page.addStyleTag({ content: '[data-builder] .fixed, [data-builder] .sticky { position: static !important }' })
  await page.locator('[data-builder]').screenshot({ path: path.join(shotsDir, `${name}.png`) })
}

const stepAt = (page: Page) => page.locator('[aria-current="step"]')
const next = (page: Page) => page.getByRole('button', { name: /^Дальше/ })

async function goNext(page: Page, to: number) {
  await next(page).click()
  await expect(stepAt(page)).toHaveAttribute('aria-label', new RegExp(`^${to}\\.`))
}

async function fillDetails(page: Page, company: string, after: boolean) {
  await page.getByLabel('Название вашего бизнеса').fill(company)
  await page.getByRole('checkbox', { name: 'Частные лица' }).click()
  await page.getByLabel('Кто отвечает за проект с вашей стороны').fill('Азиза, управляющая')
  await page.getByRole('radio', { name: 'За две недели' }).click()
  if (after) await page.getByRole('checkbox', { name: 'Сообщить мне сразу' }).click()
}

for (const [label, size] of Object.entries(SIZES)) {
  const prefix = `${label === 'desktop' ? '1440' : '390'}`

  test.describe(`builder v2 at ${prefix}`, () => {
    test.use({ viewport: size })

    test('salon agent without a site: never proposes a site, offers the Fir Tech playground', async ({ page }) => {
      const errors = watchErrors(page, [/agent-demo/, /Failed to load resource/])
      await open(page, '/ru/builder')
      // 1. The explainer first, then three niches in a row.
      await expect(page.getByRole('heading', { level: 2, name: 'Соберите проект за пять минут' })).toBeVisible()
      await expect(page.getByText('не больше трёх уточняющих вопросов')).toBeVisible()
      await expect(page.getByRole('radio')).toHaveCount(3)
      await shot(page, `salon-${prefix}-01-niche`)
      await page.getByRole('button', { name: 'Ещё ниши' }).click()
      await expect(page.getByRole('button', { name: /^ещё \d+$/ }).first()).toBeVisible()
      await shot(page, `salon-${prefix}-01b-niche-all`)
      await page.getByRole('button', { name: 'Свернуть' }).click()
      await page.getByRole('radio', { name: /Салон и запись/ }).click()
      await expect(stepAt(page)).toHaveAttribute('aria-label', /^2\./)

      // 2. Products: the agent asks the one question about a site; «не нужен» removes it for good.
      await expect(page.getByRole('radio', { name: /Сайт не нужен/ })).toBeVisible()
      await page.getByRole('radio', { name: /Сайт не нужен/ }).click()
      await expect(page.getByRole('checkbox', { name: /^Сайт Лендинг/ })).toHaveCount(0)
      await shot(page, `salon-${prefix}-02-products`)
      await goNext(page, 3)

      // 3. Goals depend on the product and the niche; twelve channels with hints.
      await expect(page.getByRole('checkbox', { name: /Меньше неявок/ })).toBeVisible()
      expect(await page.getByRole('checkbox', { name: /Меньше неявок|Запись без звонков|Снять повторяющиеся|Получать отзывы/ }).count()).toBeGreaterThanOrEqual(4)
      await page.getByRole('checkbox', { name: /Меньше неявок/ }).click()
      await page.getByRole('checkbox', { name: /Запись без звонков/ }).click()
      await page.getByRole('checkbox', { name: /^Instagram/ }).click()
      await expect(page.getByText('Пишут в директ и смотрят ленту')).toBeVisible()
      await shot(page, `salon-${prefix}-03-goals`)
      await goNext(page, 4)

      // 4. The set: what the product includes, where the agent lives, no website anywhere.
      await expect(page.getByText('Уже входит', { exact: true })).toBeVisible()
      await expect(page.getByRole('checkbox', { name: /Площадка Fir Tech/ })).toBeVisible()
      // Telegram is the default; this client wants the playground only.
      await page.getByRole('checkbox', { name: /^Telegram/ }).click()
      await page.getByRole('checkbox', { name: /Площадка Fir Tech/ }).click()
      await expect(page.getByText('Площадка Fir Tech: агент отвечает в окне')).toBeVisible()
      await expect(page.getByText('Виджет на сайте')).toHaveCount(0)
      await page.getByRole('button', { name: 'Показать отдельные части' }).click()
      await expect(page.getByRole('checkbox', { name: /^Сайты/ })).toHaveCount(0)
      await shot(page, `salon-${prefix}-04-set`)
      await goNext(page, 5)

      // 5. Features: the receptionist family never sees a site lead channel.
      await expect(page.getByText('Каждая заявка с сайта сразу приходит вам в Telegram')).toHaveCount(0)
      await expect(page.getByText('Вторая языковая версия')).toHaveCount(0)
      await shot(page, `salon-${prefix}-05-features`)
      await goNext(page, 6)

      // 6. Themes: a theme, a mood.
      await page.getByRole('radio', { name: /^Салон Мягко/ }).click()
      await page.getByRole('radio', { name: /^Премиум/ }).click()
      await expect(page).toHaveURL(/t\.salon\.premium/)
      await shot(page, `salon-${prefix}-06-theme`)
      await goNext(page, 7)

      // 7. Details: required ones block «Дальше» with a hint, then it goes on.
      // aria-disabled: Playwright treats it as not enabled, a real press still explains what is missing.
      await next(page).click({ force: true })
      await expect(page.locator('#builder-issue')).toContainText('Укажите название бизнеса')
      await expect(stepAt(page)).toHaveAttribute('aria-label', /^7\./)
      await shot(page, `salon-${prefix}-07-details-blocked`)
      await fillDetails(page, 'Лола', true)
      await shot(page, `salon-${prefix}-07-details`)
      await goNext(page, 8)

      // 8. Preview: the playground window with the company name; the demo persona answers.
      const preview = page.locator('[data-live-preview]')
      await expect(preview).toHaveAttribute('data-live-preview', 'playground')
      await expect(preview.getByText('Лола').first()).toBeVisible()
      await expect(page.getByRole('tab', { name: 'Сайт' })).toHaveCount(0)
      await preview.getByRole('button', { name: 'Есть окно на субботу?' }).click()
      await expect(preview.getByText('Саббота').or(preview.getByText(/В субботу свободно|Хороший вопрос|суббот/i)).first()).toBeVisible({ timeout: 20_000 })
      await expect(page.getByRole('button', { name: 'Отправить проект' }).first()).toBeVisible()
      await expect(page.url()).toContain('z.no')
      await expect(page.url()).toContain('l.')
      await shot(page, `salon-${prefix}-08-preview`)
      await noHorizontalOverflow(page, 'salon preview')
      expect(errors).toEqual([])
    })

    test('shop site with two languages: language stays a note, the site preview carries the theme', async ({ page }) => {
      const errors = watchErrors(page)
      await open(page, '/ru/builder')
      await page.getByRole('radio', { name: /^Магазин/ }).click()
      await expect(stepAt(page)).toHaveAttribute('aria-label', /^2\./)
      // No agent picked, so no question about a site.
      await expect(page.getByRole('radio', { name: /Сайт не нужен/ })).toHaveCount(0)
      await shot(page, `shop-${prefix}-02-products`)
      await goNext(page, 3)
      await page.getByRole('checkbox', { name: /Принимать заказы и оплату/ }).click()
      await shot(page, `shop-${prefix}-03-goals`)
      await goNext(page, 4)
      await shot(page, `shop-${prefix}-04-set`)
      await goNext(page, 5)
      // The price rule (language costs more than a lead channel) hides the paid option.
      await expect(page.getByText('Вторая языковая версия всех страниц')).toHaveCount(0)
      await expect(page.getByText('Администрирование').or(page.getByText('Меняете тексты, цены и фото сами')).first()).toBeVisible()
      await shot(page, `shop-${prefix}-05-features`)
      await goNext(page, 6)
      await page.getByRole('radio', { name: /^Магазин Карточки/ }).click()
      await page.getByRole('radio', { name: /^Яркий/ }).click()
      await shot(page, `shop-${prefix}-06-theme`)
      await goNext(page, 7)
      await fillDetails(page, 'Дукон', false)
      await page.getByRole('checkbox', { name: /Русский/ }).click()
      await page.getByRole('checkbox', { name: /English/ }).click()
      await expect(page.getByText('оценим в смете отдельной строкой')).toBeVisible()
      await shot(page, `shop-${prefix}-07-details`)
      await goNext(page, 8)
      const preview = page.locator('[data-live-preview]')
      await expect(preview).toHaveAttribute('data-live-preview', 'site')
      await expect(preview.getByText('Дукон').first()).toBeVisible()
      await expect(page.url()).toContain('t.shop.vivid')
      await expect(page.url()).toContain('ru-en')
      await shot(page, `shop-${prefix}-08-preview`)
      await noHorizontalOverflow(page, 'shop preview')
      expect(errors).toEqual([])
    })

    test('content product: no site extras, a content preview', async ({ page }) => {
      const errors = watchErrors(page)
      await open(page, '/ru/builder')
      await page.getByRole('button', { name: 'Ещё ниши' }).click()
      await page.getByRole('radio', { name: /^Кофейня/ }).first().click()
      await expect(stepAt(page)).toHaveAttribute('aria-label', /^2\./)
      // Keep only «Контент на автопилоте»: drop the Mini App that the niche suggests.
      await page.getByRole('checkbox', { name: /^Telegram Mini App/ }).click()
      await shot(page, `content-${prefix}-02-products`)
      await goNext(page, 3)
      await expect(page.getByRole('checkbox', { name: /Публиковать регулярно/ })).toBeVisible()
      await page.getByRole('checkbox', { name: /Публиковать регулярно/ }).click()
      await shot(page, `content-${prefix}-03-goals`)
      await goNext(page, 4)
      await expect(page.getByText('План постов на месяц по вашей нише')).toBeVisible()
      // The niche's starter set brought a landing page; this client wants content only.
      await page.getByRole('button', { name: 'Убрать часть' }).click()
      await expect(page.getByRole('button', { name: 'Убрать часть' })).toHaveCount(0)
      await shot(page, `content-${prefix}-04-set`)
      await goNext(page, 5)
      await expect(page.getByText('Вторая языковая версия')).toHaveCount(0)
      await shot(page, `content-${prefix}-05-features`)
      await goNext(page, 6)
      await page.getByRole('radio', { name: /^Кофейня Тепло/ }).click()
      await shot(page, `content-${prefix}-06-theme`)
      await goNext(page, 7)
      await fillDetails(page, 'Зерно', false)
      await shot(page, `content-${prefix}-07-details`)
      await goNext(page, 8)
      const preview = page.locator('[data-live-preview]')
      await expect(preview).toHaveAttribute('data-live-preview', 'content')
      await expect(preview.getByText('План публикаций на неделю')).toBeVisible()
      await expect(page.getByRole('tab', { name: 'Сайт' })).toHaveCount(0)
      await shot(page, `content-${prefix}-08-preview`)
      await noHorizontalOverflow(page, 'content preview')
      expect(errors).toEqual([])
    })

    test('catalogue v5: search inside a question, «показать ещё», picked items pinned, the pick travels in the link', async ({ page }) => {
      const errors = watchErrors(page, [/agent-demo/, /Failed to load resource/])
      await open(page, '/ru/builder')
      await page.getByRole('radio', { name: /Салон и запись/ }).click()
      await goNext(page, 3)
      // Goals: the niche in detail (sub-niches) and the results picker.
      await page.getByRole('checkbox', { name: 'Студия окрашивания' }).click()
      const results = page.locator('[data-picker="results"]')
      await expect(results.locator('[data-picker-count]')).toContainText('0')
      await results.getByRole('searchbox').fill('отзыв')
      const reviews = results.getByRole('checkbox', { name: /Больше хороших отзывов/ })
      await expect(reviews).toBeVisible()
      await reviews.click()
      await results.getByRole('searchbox').fill('')
      await expect(results.locator('[data-picker-pinned] [role=checkbox]').first()).toContainText('Больше хороших отзывов')
      await expect(results.locator('[data-picker-count]')).toContainText('1')
      const before = await results.getByRole('checkbox').count()
      await results.locator('[data-picker-more]').click()
      expect(await results.getByRole('checkbox').count()).toBeGreaterThan(before)
      await shot(page, `catalog-${prefix}-03-goals`)
      await goNext(page, 4)
      await goNext(page, 5)
      // Features: more than a hundred abilities by groups; a capability the products provide says so.
      const caps = page.locator('[data-picker="capabilities"]')
      await expect(caps).toBeVisible()
      await caps.getByRole('button', { name: 'Напоминания' }).click()
      await caps.getByRole('checkbox', { name: /Напоминание о записи за день/ }).click()
      await expect(caps.getByText('входит в состав')).toBeVisible()
      await caps.getByRole('button', { name: 'Документы' }).click()
      await caps.getByRole('checkbox', { name: /Договор по шаблону/ }).click()
      await expect(caps.getByText('по смете')).toBeVisible()
      await expect(caps.locator('[data-picker-count]')).toContainText('2')
      await page.locator('[data-picker="integrations"]').getByRole('searchbox').fill('kaspi')
      await page.locator('[data-picker="integrations"]').getByRole('checkbox', { name: /^Kaspi/ }).click()
      await shot(page, `catalog-${prefix}-05-features`)
      expect(page.url()).toMatch(/x\.ey/)
      // The link restores the picks.
      await page.reload()
      await expect(page.locator('[data-picker="capabilities"] [data-picker-count]')).toContainText('2')
      await noHorizontalOverflow(page, 'catalogue features')
      expect(errors).toEqual([])
    })

    test('catalogue v5 personal: fifteen roles behind «Ещё роли», skills by life area', async ({ page }) => {
      const errors = watchErrors(page)
      await open(page, '/ru/builder')
      await page.getByRole('button', { name: /Для себя/ }).click()
      await expect(page.getByRole('radio')).toHaveCount(9)
      await page.getByRole('button', { name: /Ещё роли/ }).click()
      await expect(page.getByRole('radio')).toHaveCount(15)
      await page.getByRole('radio', { name: /^Спортсмен/ }).click()
      await goNext(page, 2)
      await page.getByRole('checkbox', { name: /^Почта/ }).click()
      const skills = page.locator('[data-picker="skills"]')
      await skills.getByRole('searchbox').fill('сон')
      await skills.getByRole('checkbox', { name: /Сон и режим/ }).click()
      await expect(skills.locator('[data-picker-count]')).toContainText('1')
      await shot(page, `catalog-${prefix}-p2-skills`)
      await goNext(page, 3)
      await page.getByRole('checkbox', { name: /^Telegram/ }).click()
      await goNext(page, 4)
      const conn = page.locator('[data-picker="connections"]')
      await conn.getByRole('button', { name: 'Здоровье и спорт' }).click()
      await conn.getByRole('checkbox', { name: 'Strava' }).click()
      await goNext(page, 5)
      await expect(page.locator('input[type=range]')).toHaveCount(5)
      expect(page.url()).toMatch(/x\.ey/)
      expect(errors).toEqual([])
    })

    test('personal path: fork, eight screens, day timeline, tier price, brief in the link', async ({ page }) => {
      const errors = watchErrors(page)
      await open(page, '/ru/builder')
      // The fork sits on the first screen; «Для бизнеса» is the default and the niche cards stay.
      await expect(page.getByRole('button', { name: /Для бизнеса/ })).toHaveAttribute('aria-pressed', 'true')
      await shot(page, `personal-${prefix}-00-fork`)
      await page.getByRole('button', { name: /Для себя/ }).click()
      await expect(page.getByRole('heading', { level: 2, name: 'Кто вы?' })).toBeVisible()
      await expect(next(page)).toBeVisible()
      // Required: who you are.
      await next(page).dispatchEvent('click')
      await expect(page.locator('#builder-issue')).toContainText('Выберите, кто вы')
      await page.getByRole('radio', { name: /^Студент/ }).click()
      await shot(page, `personal-${prefix}-01-who`)
      await goNext(page, 2)
      await page.getByRole('checkbox', { name: /^Почта/ }).click()
      await page.getByRole('checkbox', { name: /^Календарь/ }).click()
      await page.getByRole('checkbox', { name: /^Учёба/ }).click()
      await shot(page, `personal-${prefix}-02-hand`)
      await goNext(page, 3)
      // Channels are equals: Telegram is one of seven, nothing is preselected.
      await expect(page.getByRole('checkbox', { name: /^Telegram/ })).toHaveAttribute('aria-checked', 'false')
      await expect(page.getByRole('checkbox', { name: /^Личный веб-кабинет/ })).toBeVisible()
      await page.getByRole('checkbox', { name: /^Веб-чат на сайте/ }).click()
      await page.getByRole('checkbox', { name: /^Голос/ }).click()
      await shot(page, `personal-${prefix}-03-where`)
      await goNext(page, 4)
      await page.getByRole('checkbox', { name: 'Google' }).click()
      await page.getByRole('checkbox', { name: 'Moodle' }).click()
      await shot(page, `personal-${prefix}-04-connect`)
      await goNext(page, 5)
      await page.locator('#tone-formality').fill('2')
      await expect(page.getByText('На «вы», строго').first()).toBeVisible()
      await shot(page, `personal-${prefix}-05-character`)
      await goNext(page, 6)
      await expect(page.getByRole('radio', { name: /^Спутник/ })).toBeVisible()
      await page.getByRole('radio', { name: /Второй пилот/ }).click()
      // BYOK toggle: the card number changes to the own-key monthly and the choice reaches the day card.
      const pilotMonthly = page.locator('[data-tier="plus"] [data-tier-monthly]')
      const oursText = await pilotMonthly.innerText()
      await page.locator('[data-tier="plus"]').getByText('Свой API-ключ').click()
      await expect(pilotMonthly).not.toHaveText(oursText)
      await shot(page, `personal-${prefix}-06-tier`)
      await goNext(page, 7)
      await page.getByRole('checkbox', { name: 'Не хватает времени' }).click()
      await page.getByRole('checkbox', { name: 'Посоветовали' }).click()
      await shot(page, `personal-${prefix}-07-about`)
      await goNext(page, 8)
      await expect(page.locator('[data-day] li')).toHaveCount(5)
      await expect(page.locator('[data-tier-card]')).toContainText('Второй пилот')
      await expect(page.locator('[data-day-monthly]')).not.toHaveText(oursText.split(' ')[0]!)
      await expect(page.getByRole('button', { name: 'Отправить проект' }).first()).toBeVisible()
      expect(page.url()).toMatch(/m\./)
      expect(page.url()).toMatch(/v\./)
      await shot(page, `personal-${prefix}-08-day`)
      await noHorizontalOverflow(page, 'personal day')
      // Back to the business path: the niche list returns.
      await page.goBack()
      expect(errors).toEqual([])
    })
  })
}

test('old links: a legacy style chunk opens the builder and keeps the link decodable', async ({ page }) => {
  const errors = watchErrors(page)
  await open(page, '/ru/builder?b=websites.landing.telegram~k.cafe~s.premium.amber.dark.soft~d.5.ru-en.logo.month&step=8')
  await expect(page.locator('[data-live-preview]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Отправить проект' }).first()).toBeVisible()
  expect(errors).toEqual([])
})
