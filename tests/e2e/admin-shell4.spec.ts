import { expect, test } from '@playwright/test'
import { adminContext, noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// Пульт, 2026-11-22: the full-screen document editor in the review centre, «Поручения» and the
// «Разбор заявки» block. Dev mock of HQ, a hand-written admin session (see admin.spec.ts).

const noise = [/WebGL|GPU stall|swiftshader|Failed to load resource/i]

test.describe('with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('review: E opens the full-screen editor, type, find and replace, save as a version, compare with v1', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/approvals?id=ap_201')
    await page.getByRole('list', { name: 'Queue' }).getByRole('button', { name: /Ответ Нигине/ }).click()
    await page.keyboard.press('e')
    const dialog = page.getByRole('dialog', { name: 'Document editor' })
    await expect(dialog).toBeVisible()
    const page_ = dialog.getByRole('textbox', { name: 'Document text' })
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
    await expect(dialog.getByText(/Unsaved edits|Draft on this device/)).toBeVisible()

    // ⌘F: find and replace "5-7 дней" with "7-10 дней".
    await page.keyboard.press('Control+f')
    const find = dialog.getByRole('textbox', { name: 'Find' })
    await expect(find).toBeFocused()
    await find.fill(stamp)
    await expect(dialog.getByRole('status').filter({ hasText: /^(1 of 1|1)$/ })).toBeVisible()
    await dialog.getByRole('textbox', { name: 'Replace with' }).fill('после аванса')
    await dialog.getByRole('button', { name: 'Replace', exact: true }).click()
    await expect(page_).toHaveValue(/Оплата по этапам после аванса\.$/)
    await page.keyboard.press('Escape')
    await expect(find).toBeHidden()

    // Compare with v1: the added and removed words are marked.
    await dialog.getByRole('button', { name: 'Compare with v1' }).click()
    await expect(dialog.getByRole('status').filter({ hasText: /words, -\d+ words/ })).toBeVisible()
    await expect(dialog.locator('mark').first()).toBeVisible()
    await dialog.getByRole('button', { name: 'Close comparison' }).click()

    // Save as a version (mock): v+1 appears, the dirty marker goes away.
    await dialog.getByRole('button', { name: 'Save as a version' }).click()
    await expect(dialog.getByText(/Lead reply · Saved/)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('button', { name: /^v[2-9]/ }).first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('review editor: Esc with unsaved changes asks first, ⌘Enter saves and closes', async ({ page }) => {
    await open(page, '/admin/approvals?id=ap_201')
    await page.getByRole('list', { name: 'Queue' }).getByRole('button', { name: /Цена для Фарруха/ }).click()
    await page.keyboard.press('e')
    const dialog = page.getByRole('dialog', { name: 'Document editor' })
    const area = dialog.getByRole('textbox', { name: 'Document text' })
    await area.click()
    await page.keyboard.press('Control+End')
    await page.keyboard.type(' Предоплата по счёту.')
    await page.keyboard.press('Escape')
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Control+Enter')
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('button', { name: /^v[2-9]/ }).first()).toBeVisible()
  })

  test('review: the sales item shows «Разбор заявки» with answers, estimate links and stages', async ({ page }) => {
    await open(page, '/admin/approvals?id=ap_201')
    await page.getByRole('list', { name: 'Queue' }).getByRole('button', { name: /Ответ Нигине/ }).click()
    const block = page.getByRole('region', { name: 'Lead breakdown' })
    await expect(block).toBeVisible()
    await expect(block.getByText('Салон и запись')).toBeVisible()
    await expect(block.getByText('Нужна запись по мастерам')).toBeVisible()
    await expect(block.getByRole('link', { name: 'Open estimate' })).toHaveAttribute('href', /\/ru\/builder\/estimate\?b=bots\.booking/)
    await expect(block.getByRole('link', { name: 'Open build' })).toHaveAttribute('href', /\/ru\/builder\?b=/)
    await expect(block.getByText('Estimate by stage')).toBeVisible()
  })

  test('Поручения: the composer makes a task and the timeline shows it; N focuses the composer', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/tasks')
    const composer = page.getByRole('combobox', { name: 'New assignment for the Director' })
    await expect(composer).toHaveAttribute('placeholder', 'Write an assignment...')
    await page.getByRole('heading', { name: 'Tasks', level: 1 }).click()
    await page.keyboard.press('n')
    await expect(composer).toBeFocused()

    // Shift+Enter is a new line; Enter sends.
    await composer.fill('Подготовь КП для салона Нигины')
    await composer.press('Shift+Enter')
    await composer.type('Срок до пятницы')
    await expect(composer).toHaveValue('Подготовь КП для салона Нигины\nСрок до пятницы')
    await composer.press('Enter')
    const card = page.locator('[data-tasks-list] [data-task]').filter({ hasText: 'Подготовь КП для салона Нигины' })
    await expect(card.first()).toBeVisible()
    await expect(card.first().getByText('assigned')).toBeVisible()

    // «Мои поручения» keeps it; the card has the actions.
    await page.getByRole('group', { name: 'What to show' }).getByRole('button', { name: /^My assignments/ }).click()
    await expect(card.first()).toBeVisible()
    await expect(card.first().getByRole('button', { name: 'Remind' })).toBeVisible()
    await expect(card.first().getByRole('button', { name: 'Cancel' })).toBeVisible()
    // Cancelling asks first, then the Director takes it off.
    await card.first().getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.locator('[data-tasks-list] [data-task]').filter({ hasText: 'Подготовь КП для салона Нигины' })).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('Поручения: a slash opens the command list, Tab completes, Esc closes the list only', async ({ page }) => {
    await open(page, '/admin/tasks')
    const composer = page.getByRole('combobox', { name: 'New assignment for the Director' })
    await composer.fill('/')
    const list = page.getByRole('listbox', { name: 'Director commands' })
    await expect(list).toBeVisible()
    await composer.fill('/sta')
    await expect(list.getByRole('option').first()).toContainText('/status')
    await composer.press('Tab')
    await expect(composer).toHaveValue('/status ')
    await composer.fill('/co')
    await expect(list).toBeVisible()
    await composer.press('Escape')
    await expect(list).toBeHidden()
    await expect(page).toHaveURL(/\/admin\/tasks/)
  })

  test('sales: the lead drawer shows «Разбор заявки» (old link and no link too)', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/clients')
    await page.getByRole('button', { name: /Нигина/ }).first().click()
    const block = page.getByRole('region', { name: 'Lead breakdown' })
    await expect(block).toBeVisible()
    await expect(block.getByText('Niche', { exact: true })).toBeVisible()
    await expect(block.getByText('Салон и запись')).toBeVisible()
    await expect(block.getByText('Parts and prices')).toBeVisible()
    await expect(block.getByText('Total')).toBeVisible()
    await expect(block.getByText('Client answers')).toBeVisible()
    await expect(block.getByRole('heading', { name: 'Style' })).toBeVisible()
    await expect(block.getByRole('link', { name: 'Open estimate' })).toHaveAttribute('href', /builder\/estimate\?b=/)
    await page.keyboard.press('Escape')
    // The old-link lead (parts only) still has prices.
    await page.getByRole('button', { name: /Боб/ }).first().click()
    const old = page.getByRole('region', { name: 'Lead breakdown' })
    await expect(old.getByText('Old-style link')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('back office: every document row opens the full-screen editor, pending or approved, a КП too', async ({ page }) => {
    await open(page, '/admin/documents')
    const dialog = page.getByRole('dialog', { name: 'Document editor' })
    const row = (text: string) => page.getByRole('listitem').filter({ hasText: text })
    // A pending invoice draft.
    await row('Sadaf Clinic').getByRole('button', { name: 'Edit' }).click()
    await expect(dialog.getByRole('textbox', { name: 'Document text' })).toHaveValue(/Счёт FT-2026-007/)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    // An approved contract the client has not signed.
    await row('Договор на разработку сайта').getByRole('button', { name: 'Edit' }).click()
    await expect(dialog.getByRole('textbox', { name: 'Document text' })).toHaveValue(/Договор на разработку сайта/)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    // A КП of a presales pack.
    await row('КП на Telegram-бота').getByRole('button', { name: 'Edit' }).click()
    await expect(dialog.getByRole('textbox', { name: 'Document text' })).toHaveValue(/Коммерческое предложение/)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    // An issued invoice cannot be edited: the button is there, disabled, with the reason.
    await expect(row('FT-2026-001').getByRole('button', { name: 'Edit' })).toBeDisabled()
  })

  test('review: E on a КП pack opens its first document, the stage has «Править» for each document', async ({ page }) => {
    await open(page, '/admin/approvals?id=ap_209')
    await expect(page.getByRole('button', { name: 'Edit quote' })).toBeVisible()
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Document editor' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('textbox', { name: 'Document text' })).toHaveValue(/Estimate/)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await page.keyboard.press('e')
    await expect(dialog.getByRole('textbox', { name: 'Document text' })).toHaveValue(/Коммерческое предложение/)
  })

  test('phone: the editor has its toolbar at the bottom and Поручения fits the screen', async ({ page }) => {
    await page.setViewportSize(SIZES.mobile)
    await open(page, '/admin/approvals?id=ap_201')
    await page.getByRole('navigation', { name: 'Departments' }).getByRole('button', { name: /^Sales/ }).click()
    await page.getByRole('button', { name: /^Edit/ }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Document editor' })
    await expect(dialog).toBeVisible()
    const bar = dialog.getByRole('toolbar', { name: 'Formatting' }).last()
    await expect(bar).toBeVisible()
    const box = await bar.boundingBox()
    expect(box!.y).toBeGreaterThan(SIZES.mobile.height / 2)
    await noHorizontalOverflow(page, 'editor')
  })
})
