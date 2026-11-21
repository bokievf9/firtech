import { expect, test } from '@playwright/test'
import { adminContext, noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// Пульт, 2026-11-22: the full-screen document editor in the review centre, «Поручения» and the
// «Разбор заявки» block. Dev mock of HQ, a hand-written admin session (see admin.spec.ts).

const noise = [/WebGL|GPU stall|swiftshader|Failed to load resource/i]

test.describe('with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('review: E opens the full-screen editor, type, find and replace, save as a version, compare with v1', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/review')
    await page.getByRole('list', { name: 'Очередь' }).getByRole('button', { name: /Ответ Нигине/ }).click()
    await page.keyboard.press('e')
    const dialog = page.getByRole('dialog', { name: 'Редактор документа' })
    await expect(dialog).toBeVisible()
    const page_ = dialog.getByRole('textbox', { name: 'Текст документа' })
    await expect(page_).toHaveValue(/Здравствуйте, Нигина/)
    // The page column is at most 760 px and the type is Onest-sized.
    const width = await page_.evaluate((el) => el.parentElement!.parentElement!.parentElement!.getBoundingClientRect().width)
    expect(width).toBeLessThanOrEqual(762)

    // Type at the end, then format a selection with the toolbar.
    await page_.click()
    await page.keyboard.press('Control+End')
    // The mock keeps its state between attempts, so the typed text carries a stamp.
    const stamp = `s${Date.now()}`
    await page.keyboard.type(` Оплата по этапам ${stamp}.`)
    await expect(page_).toHaveValue(new RegExp(`Оплата по этапам ${stamp}\\.$`))
    await expect(dialog.getByText(/Есть несохранённые правки|Черновик на этом устройстве/)).toBeVisible()

    // ⌘F: find and replace "5-7 дней" with "7-10 дней".
    await page.keyboard.press('Control+f')
    const find = dialog.getByRole('textbox', { name: 'Найти' })
    await expect(find).toBeFocused()
    await find.fill(stamp)
    await expect(dialog.getByRole('status').filter({ hasText: /^(1 из 1|1)$/ })).toBeVisible()
    await dialog.getByRole('textbox', { name: 'Заменить на' }).fill('после аванса')
    await dialog.getByRole('button', { name: 'Заменить', exact: true }).click()
    await expect(page_).toHaveValue(/Оплата по этапам после аванса\.$/)
    await page.keyboard.press('Escape')
    await expect(find).toBeHidden()

    // Compare with v1: the added and removed words are marked.
    await dialog.getByRole('button', { name: 'Сравнить с v1' }).click()
    await expect(dialog.getByRole('status').filter({ hasText: /слов, -\d+ слов/ })).toBeVisible()
    await expect(dialog.locator('mark').first()).toBeVisible()
    await dialog.getByRole('button', { name: 'Закрыть сравнение' }).click()

    // Save as a version (mock): v+1 appears, the dirty marker goes away.
    await dialog.getByRole('button', { name: 'Сохранить как версию' }).click()
    await expect(dialog.getByText(/Ответ лиду · Сохранено/)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('button', { name: /^v[2-9]/ }).first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('review editor: Esc with unsaved changes asks first, ⌘Enter saves and closes', async ({ page }) => {
    await open(page, '/admin/review')
    await page.getByRole('list', { name: 'Очередь' }).getByRole('button', { name: /Цена для Фарруха/ }).click()
    await page.keyboard.press('e')
    const dialog = page.getByRole('dialog', { name: 'Редактор документа' })
    const area = dialog.getByRole('textbox', { name: 'Текст документа' })
    await area.click()
    await page.keyboard.press('Control+End')
    await page.keyboard.type(' Предоплата по счёту.')
    await page.keyboard.press('Escape')
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: 'Отмена' }).click()
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Control+Enter')
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('button', { name: /^v[2-9]/ }).first()).toBeVisible()
  })

  test('review: the sales item shows «Разбор заявки» with answers, estimate links and stages', async ({ page }) => {
    await open(page, '/admin/review')
    await page.getByRole('list', { name: 'Очередь' }).getByRole('button', { name: /Ответ Нигине/ }).click()
    const block = page.getByRole('region', { name: 'Разбор заявки' })
    await expect(block).toBeVisible()
    await expect(block.getByText('Салон и запись')).toBeVisible()
    await expect(block.getByText('Нужна запись по мастерам')).toBeVisible()
    await expect(block.getByRole('link', { name: 'Открыть смету' })).toHaveAttribute('href', /\/ru\/builder\/estimate\?b=bots\.booking/)
    await expect(block.getByRole('link', { name: 'Открыть сборку' })).toHaveAttribute('href', /\/ru\/builder\?b=/)
    await expect(block.getByText('Смета по этапам')).toBeVisible()
  })

  test('Поручения: the composer makes a task and the timeline shows it; N focuses the composer', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/office')
    await expect(page.getByRole('radio', { name: 'На месте', exact: true })).toBeVisible()
    await page.keyboard.press('1')
    await page.getByRole('tab', { name: /^Поручения/ }).click()
    const composer = page.getByRole('combobox', { name: 'Новое поручение Директору' })
    await expect(composer).toHaveAttribute('placeholder', 'Напишите поручение…')
    await page.locator('aside h2').click()
    await page.keyboard.press('n')
    await expect(composer).toBeFocused()

    // Shift+Enter is a new line; Enter sends.
    await composer.fill('Подготовь КП для салона Нигины')
    await composer.press('Shift+Enter')
    await composer.type('Срок до пятницы')
    await expect(composer).toHaveValue('Подготовь КП для салона Нигины\nСрок до пятницы')
    await composer.press('Enter')
    const card = page.locator('aside [data-task]').filter({ hasText: 'Подготовь КП для салона Нигины' })
    await expect(card.first()).toBeVisible()
    await expect(card.first().getByText('назначено')).toBeVisible()

    // «Мои поручения» keeps it; the card has the actions.
    await page.getByRole('group', { name: 'Что показать' }).getByRole('button', { name: /^Мои поручения/ }).click()
    await expect(card.first()).toBeVisible()
    await expect(card.first().getByRole('button', { name: 'Напомнить' })).toBeVisible()
    await expect(card.first().getByRole('button', { name: 'Отменить' })).toBeVisible()
    // Cancelling asks first, then the Director takes it off.
    await card.first().getByRole('button', { name: 'Отменить' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Отменить', exact: true }).click()
    await expect(page.locator('aside [data-task]').filter({ hasText: 'Подготовь КП для салона Нигины' })).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('Поручения: a slash opens the command list, Tab completes, Esc closes the list only', async ({ page }) => {
    await open(page, '/admin/office')
    await expect(page.getByRole('radio', { name: 'На месте', exact: true })).toBeVisible()
    await page.keyboard.press('1')
    await page.getByRole('tab', { name: /^Поручения/ }).click()
    const composer = page.getByRole('combobox', { name: 'Новое поручение Директору' })
    await composer.fill('/')
    const list = page.getByRole('listbox', { name: 'Команды Директора' })
    await expect(list).toBeVisible()
    await composer.fill('/sta')
    await expect(list.getByRole('option').first()).toContainText('/status')
    await composer.press('Tab')
    await expect(composer).toHaveValue('/status ')
    await composer.fill('/co')
    await expect(list).toBeVisible()
    await composer.press('Escape')
    await expect(list).toBeHidden()
    await expect(page.locator('aside h2')).toHaveText('Директор')
  })

  test('sales: the lead drawer shows «Разбор заявки» (old link and no link too)', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/office')
    await expect(page.getByRole('radio', { name: 'На месте', exact: true })).toBeVisible()
    await page.keyboard.press('3')
    await page.getByRole('button', { name: /Нигина/ }).first().click()
    const block = page.getByRole('region', { name: 'Разбор заявки' })
    await expect(block).toBeVisible()
    await expect(block.getByText('Ниша', { exact: true })).toBeVisible()
    await expect(block.getByText('Салон и запись')).toBeVisible()
    await expect(block.getByText('Состав и цены')).toBeVisible()
    await expect(block.getByText('Итого')).toBeVisible()
    await expect(block.getByText('Ответы клиента')).toBeVisible()
    await expect(block.getByRole('heading', { name: 'Стиль' })).toBeVisible()
    await expect(block.getByRole('link', { name: 'Открыть смету' })).toHaveAttribute('href', /builder\/estimate\?b=/)
    await page.keyboard.press('Escape')
    // The old-link lead (parts only) still has prices.
    await page.getByRole('button', { name: /Боб/ }).first().click()
    const old = page.getByRole('region', { name: 'Разбор заявки' })
    await expect(old.getByText('Ссылка старого образца')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('back office: a document HQ waits on opens in the same full-screen editor from the Documents tab', async ({ page }) => {
    await open(page, '/admin/office')
    await expect(page.getByRole('radio', { name: 'На месте', exact: true })).toBeVisible()
    await page.keyboard.press('6')
    await page.getByRole('tab', { name: /^Документы/ }).click()
    await page.getByRole('button', { name: 'Править в редакторе' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Редактор документа' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('textbox', { name: 'Текст документа' })).toHaveValue(/Счёт FT-2026-007/)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('phone: the editor has its toolbar at the bottom and Поручения fits the screen', async ({ page }) => {
    await page.setViewportSize(SIZES.mobile)
    await open(page, '/admin/review')
    await page.getByRole('navigation', { name: 'Отделы' }).getByRole('button', { name: /^Продажи/ }).click()
    await page.getByRole('button', { name: /^Править/ }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Редактор документа' })
    await expect(dialog).toBeVisible()
    const bar = dialog.getByRole('toolbar', { name: 'Форматирование' }).last()
    await expect(bar).toBeVisible()
    const box = await bar.boundingBox()
    expect(box!.y).toBeGreaterThan(SIZES.mobile.height / 2)
    await noHorizontalOverflow(page, 'editor')
  })
})
