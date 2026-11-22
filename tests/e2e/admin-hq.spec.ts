import { expect, test } from '@playwright/test'
import { adminContext, noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// HQ phase 1 (2026-11-23): the CRM shell and the four sections over the dev mock of HQ.
const noise = [/WebGL|GPU stall|swiftshader|Failed to load resource/i]

test('HQ refuses a visitor without a session', async ({ page }) => {
  await open(page, '/admin/inbox')
  await expect(page).toHaveURL(/\/admin\/login/)
})

test.describe('with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('/admin opens the Dashboard; the Inbox has the menu, the Office link and tabs', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin')
    await expect(page).toHaveURL(/\/admin\/dashboard/)
    await open(page, '/admin/inbox')
    const menu = page.getByRole('navigation', { name: 'Sections' }).first()
    for (const name of ['Inbox', 'Clients', 'Projects', 'Documents', 'Agents']) await expect(page.getByRole('link', { name: new RegExp(`^${name}`) }).first()).toBeVisible()
    await expect(menu).toBeVisible()
    await expect(page.locator('[data-header-office]')).toHaveAttribute('href', '/admin/office')
    await page.getByRole('tab', { name: 'Approvals' }).click()
    await expect(page).toHaveURL(/tab=approvals/)
    expect(errors).toEqual([])
  })

  test('sections: Clients, Projects, Documents load and keys 1-9 switch', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/clients')
    await expect(page.getByRole('heading', { name: 'Clients', level: 1 })).toBeVisible()
    await page.getByRole('tab', { name: 'Clients' }).click()
    await expect(page).toHaveURL(/tab=clients/)
    await open(page, '/admin/projects?tab=payments')
    await expect(page).toHaveURL(/\/admin\/finance\?tab=invoices/)
    await expect(page.getByRole('heading', { name: 'Finance', level: 1 })).toBeVisible()
    await open(page, '/admin/documents')
    await expect(page.getByRole('heading', { name: 'Documents', level: 1 })).toBeVisible()
    await page.keyboard.press('2')
    await expect(page).toHaveURL(/\/admin\/inbox/)
    await page.keyboard.press('1')
    await expect(page).toHaveURL(/\/admin\/dashboard/)
    expect(errors).toEqual([])
  })

  test('menu: four groups on the desktop; on a phone a Menu button opens a full-width grouped panel', async ({ page }) => {
    await page.setViewportSize(SIZES.desktop)
    await open(page, '/admin/inbox')
    for (const g of ['work', 'clients', 'company', 'control']) await expect(page.locator(`nav [data-menu-group="${g}"]`).first()).toBeVisible()
    await page.setViewportSize(SIZES.mobile)
    await open(page, '/admin/inbox')
    await expect(page.locator('[data-menu-toggle]')).toBeVisible()
    await expect(page.locator('#hq-menu-panel')).toHaveCount(0)
    await page.locator('[data-menu-toggle]').click()
    const panel = page.locator('#hq-menu-panel')
    await expect(panel).toBeVisible()
    for (const label of ['Inbox', 'Approvals', 'Finance', 'Content', 'Knowledge', 'Audit log', 'Analytics']) await expect(panel.getByRole('link', { name: new RegExp(`^${label}`) })).toBeVisible()
    const clipped = await panel.locator('[data-section] span.min-w-0').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length)
    expect(clipped).toBe(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await panel.getByRole('link', { name: /^Finance/ }).click()
    await expect(page).toHaveURL(/\/admin\/finance/)
    await expect(page.locator('#hq-menu-panel')).toHaveCount(0)
  })

  test('the Office is a section of the menu and the presence switch is in the top bar', async ({ page }) => {
    await open(page, '/admin/office')
    await expect(page.getByRole('radio', { name: 'In office', exact: true })).toBeVisible()
    await expect(page.locator('[data-section="office"]').first()).toBeVisible()
  })

  test('Agents: roster by department with English titles, a card, edit instructions, versions and rollback', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/agents')
    await expect(page.getByRole('heading', { name: 'Agents', level: 1 })).toBeVisible()
    for (const title of ['Director', 'Head of Marketing', 'Content Maker', 'Lead Handler', 'Client Assistant']) await expect(page.locator('[data-agent-list]').getByText(title, { exact: true }).first()).toBeVisible()
    await page.locator('[data-agent="marketing-head"]').click()
    await expect(page).toHaveURL(/agent=marketing-head/)
    const card = page.locator('[data-agent-card="marketing-head"]')
    await expect(card.getByRole('heading', { name: 'Head of Marketing' })).toBeVisible()
    for (const block of ['instructions', 'trust', 'budget', 'fira', 'tools', 'history']) await expect(card.locator(`[data-block="${block}"]`)).toBeVisible()
    await card.locator('[data-act="edit-instructions"]').click()
    const dialog = page.getByRole('dialog', { name: 'Edit instructions' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Save as a new version' })).toHaveAttribute('aria-disabled', 'true')
    await dialog.locator('textarea').fill('Ты голова Маркетинга.\nНовое правило проверки.')
    await dialog.locator('input').fill('e2e')
    await dialog.getByRole('button', { name: 'Save as a new version' }).click()
    await expect(dialog).toBeHidden()
    await expect(card.locator('pre').first()).toContainText('Новое правило проверки.')
    await card.locator('[data-act="versions"]').click()
    await expect(card.locator('[data-versions] li')).toHaveCount(2)
    await card.locator('[data-versions] [data-act="show-version"]').last().click()
    await expect(card.locator('[data-diff]')).toBeVisible()
    await card.locator('[data-versions] [data-act="rollback"]').click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restore' }).click()
    await expect(card.locator('pre').first()).toContainText('Ничего не публикуй без одобрения.')
    await expect(card.locator('[data-versions] li')).toHaveCount(3)
    await open(page, '/admin/agents?agent=client-bot')
    await expect(page.locator('[data-block="fira"]')).toContainText('ИИ-менеджер заявок')
    expect(errors).toEqual([])
  })


  test('Settings: sections with a table of contents, anchors, and ⌘K finds a field and marks it', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/settings')
    const sections = ['general', 'notifications', 'autopilot', 'agents', 'prices', 'integrations', 'journal']
    for (const id of sections) await expect(page.locator(`[data-settings-section="${id}"]`)).toBeVisible()
    const rail = page.locator('[data-section-nav="rail"]')
    await expect(rail).toBeVisible()
    await rail.getByRole('link', { name: 'Agents and budgets' }).click()
    await expect(page.locator('#settings-agents')).toBeInViewport()
    await expect(rail.getByRole('link', { name: 'Agents and budgets' })).toHaveAttribute('aria-current', 'location')
    // ⌘K: a field is a result; Enter opens the page and marks the row
    await page.keyboard.press('Control+k')
    await page.getByRole('combobox', { name: 'Search and commands' }).fill('call length')
    await page.getByRole('option', { name: /Call length/ }).click()
    await expect(page).toHaveURL(/focus=calls\.durationMin/)
    await expect(page.locator('[data-field="calls.durationMin"]')).toHaveAttribute('data-focus-row', 'calls.durationMin')
    await expect(page.locator('[data-field="calls.durationMin"]')).toBeInViewport()
    // phone: the section strip replaces the rail
    await page.setViewportSize(SIZES.mobile)
    await expect(page.locator('[data-section-nav="strip"]')).toBeVisible()
    await expect(page.locator('[data-section-nav="rail"]')).toBeHidden()
    await noHorizontalOverflow(page, 'settings 390')
    expect(errors).toEqual([])
  })

  test('Settings: autopilot, saving by field with feedback and errors, trust, restart note, session journal', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/settings')
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
    for (const g of ['autopilot', 'schedule', 'notices', 'alerts', 'trust', 'limits', 'calls', 'kp', 'playground', 'service', 'journal']) await expect(page.locator(`[data-group="${g}"]`)).toBeVisible()
    // Autopilot: policy by default, switch to autopilot
    const modes = page.getByRole('radiogroup', { name: 'Lead manager mode' })
    await expect(modes.getByRole('radio', { name: 'Call me by policy' })).toHaveAttribute('aria-checked', 'true')
    await modes.getByRole('radio', { name: /^Autopilot/ }).click()
    await expect(modes.getByRole('radio', { name: /^Autopilot/ })).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('[data-group="autopilot"] [data-status="saved"]')).toBeVisible()
    // Support has its own row: policy by default, ask_me saves alone and leaves the lead manager as it was
    const support = page.getByRole('radiogroup', { name: 'Support mode' })
    await expect(support.getByRole('radio', { name: 'Call me by policy' })).toHaveAttribute('aria-checked', 'true')
    await support.getByRole('radio', { name: 'Call me at any doubt' }).click()
    await expect(support.getByRole('radio', { name: 'Call me at any doubt' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('[data-autopilot-row="support"] [data-status="saved"]')).toBeVisible()
    await expect(modes.getByRole('radio', { name: /^Autopilot/ })).toHaveAttribute('aria-checked', 'true')
    // A time field saves on blur and shows «Saved»
    const summary = page.locator('[data-field="schedule.summaryTime"] input')
    await summary.fill('09:30')
    await summary.blur()
    await expect(page.locator('[data-field="schedule.summaryTime"] [data-status="saved"]')).toBeVisible()
    // A wrong number is refused with a visible reason and nothing is sent
    const duration = page.locator('[data-field="calls.durationMin"] input')
    await duration.fill('1')
    await duration.blur()
    await expect(page.locator('[data-field="calls.durationMin"] [role="alert"]')).toContainText('Outside the allowed range')
    // A switch saves at once
    await page.getByRole('switch', { name: 'New lead' }).click()
    await expect(page.getByRole('switch', { name: 'New lead' })).toHaveAttribute('aria-checked', 'false')
    // A time zone HQ does not know comes back as HQ's own error
    const tz = page.locator('[data-field="schedule.tz"] input')
    await tz.fill('Mars/Olympus')
    await tz.blur()
    await expect(page.locator('[data-field="schedule.tz"] [role="alert"]')).toBeVisible()
    // Spend sits next to the limit
    await expect(page.locator('[data-field="limits.deptBudgetUsd.marketing"] [data-usage]')).toContainText('$4.20')
    // Trust: raising a level asks first
    await page.getByRole('switch', { name: 'content_item: Level' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Level 1' }).click()
    await expect(page.getByRole('switch', { name: 'content_item: Level' })).toHaveAttribute('aria-checked', 'true')
    // A service flag needs a restart and says so
    await page.getByRole('switch', { name: 'Approval cards in Telegram' }).click()
    await expect(page.locator('[data-restart]')).toContainText('service.tgApprovalCards')
    // The change log (HQ settings_log) lists what changed with old and new values
    const journal = page.locator('[data-journal]')
    await expect(journal).toContainText('autopilot.leadManager: policy -> autopilot')
    await expect(journal).toContainText('schedule.summaryTime: 08:00 -> 09:30')
    await expect(journal).toContainText('trust.levels.content_item: 0 -> 1')
    // It survives a reload (HQ keeps it)
    await page.reload()
    await expect(page.locator('[data-field="schedule.summaryTime"] input')).toHaveValue('09:30')
    await expect(page.locator('[data-journal]')).toContainText('schedule.summaryTime: 08:00 -> 09:30')
    await expect(page.getByRole('radiogroup', { name: 'Lead manager mode' }).getByRole('radio', { name: /^Autopilot/ })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('radiogroup', { name: 'Support mode' }).getByRole('radio', { name: 'Call me at any doubt' })).toHaveAttribute('aria-checked', 'true')
    expect(errors).toEqual([])
  })

  test('Chats: each chat carries the Autopilot chip of its kind and the header chip links to Settings', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/chats')
    const list = page.getByRole('complementary', { name: 'Chats' })
    await expect(list.locator('[data-autopilot-chip]').first()).toContainText(/Mode: (By policy|Autopilot|Ask me)/)
    await list.getByRole('button').first().click()
    const head = page.getByRole('region', { name: 'Conversation' }).locator('a[data-autopilot-chip]')
    await expect(head).toContainText('Mode:')
    await expect(head).toHaveAttribute('href', '/admin/settings')
    await expect(head).toHaveAttribute('title', /mode in Settings/)
    expect(errors).toEqual([])
  })

  // The page's writes to HQ (through the proxy), so a test can say what a click or an open did.
  const watchWrites = (page: import('@playwright/test').Page) => {
    const writes: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/admin/hq/') && r.method() !== 'GET' && !r.url().includes('/api/admin/hq/ping')) writes.push(`${r.method()} ${new URL(r.url()).pathname.replace('/api/admin/hq/', '')}`)
    })
    return writes
  }
  const openMaterial = async (page: import('@playwright/test').Page, status: string, format?: string, last = false) => {
    await open(page, '/admin/content')
    await page.getByLabel('Status').selectOption(status)
    if (format) await page.getByLabel('Format').first().selectOption(format)
    const cards = page.locator('[data-feed] li button')
    await (last ? cards.last() : cards.first()).click()
    await expect(page.locator('[data-studio="screen"]')).toBeVisible()
  }

  test('Content: feed, one screen per material (player, text, Prompt, variant, niche), orders tab, campaigns tab', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await open(page, '/admin/content')
    await expect(page.getByRole('heading', { name: 'Content', level: 1 })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Feed', selected: true })).toBeVisible()
    const cards = page.locator('[data-feed] li button')
    await expect(cards.first()).toBeVisible()
    // a status filter narrows the feed
    await page.getByLabel('Status').selectOption('pending')
    await expect(page.locator('[data-feed] li').first()).toBeVisible()
    // a waiting reel opens as a screen (no dialog): the player, the text, Prompt, variants
    await page.getByLabel('Format').first().selectOption('clip')
    // the seeded waiting reel has an approval card; reels born from earlier orders (newest first) have none in the mock
    await cards.last().click()
    const screen = page.locator('[data-studio="screen"]')
    await expect(screen).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const player = screen.locator('video[data-studio="player"]')
    await expect(player).toBeVisible()
    await expect.poll(() => player.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThan(0)
    await player.evaluate((v: HTMLVideoElement) => {
      v.muted = true
      return v.play()
    })
    await expect.poll(() => player.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0)
    await expect(screen.getByRole('button', { name: 'Approve' })).toBeVisible()
    await expect(screen.getByRole('form', { name: 'Prompt' })).toBeVisible()
    // edit the caption in place and save: a new version, the text stays
    const caption = screen.locator('[data-studio="text"] textarea').first()
    await caption.fill('Новая подпись от владельца про ночные заявки')
    await screen.getByRole('button', { name: 'Save text' }).click()
    await expect(page.getByText('Text saved, a new version is added.')).toBeVisible()
    await expect(caption).toHaveValue('Новая подпись от владельца про ночные заявки')
    await expect(screen.getByRole('button', { name: 'Save text' })).toHaveCount(0)
    // «Another variant» and «For a niche» are inline; each takes its order and the toast says so
    await screen.getByRole('button', { name: 'Another variant' }).click()
    await expect(page.getByText('Order accepted: one more variant is being prepared.')).toBeVisible()
    await expect(page.locator('[data-studio="screen"]')).toHaveCount(0)
    await cards.last().click()
    const nicheButton = page.getByRole('button', { name: 'Rewrite for the niche' })
    await expect(nicheButton).toBeDisabled()
    await page.getByLabel('Niche').fill('барбершоп')
    await nicheButton.click()
    await expect(page.getByText('Order accepted: rewriting for the "барбершоп" niche.')).toBeVisible()
    // «Prompt» without a drawer: the button opens the box above the list
    await page.getByRole('button', { name: 'Prompt', exact: true }).click()
    const prompt = page.locator('form[data-studio="prompt"]')
    await prompt.getByLabel('What the material is about').fill('Про ночные заявки в барбершопе')
    await prompt.getByRole('button', { name: 'Send to Content Maker' }).click()
    await expect(page).toHaveURL(/tab=orders/)
    const orders = page.locator('[data-orders] li')
    await expect(orders.first()).toContainText('Про ночные заявки')
    await expect(orders.first().getByRole('link', { name: 'Open in the feed' })).toBeVisible()
    // the week calendar is its own section (not a tab of Content), nothing was taken away
    await expect(page.getByRole('tab', { name: 'Calendar' })).toHaveCount(0)
    await page.getByRole('tab', { name: 'Campaigns' }).click()
    await expect(page).toHaveURL(/tab=campaigns/)
    expect(errors).toEqual([])
  })

  test('Content: opening a decided material or an older one without a card sends NO write and offers no decision', async ({ page }) => {
    const errors = watchErrors(page, noise)
    const writes = watchWrites(page)
    // every status: open the first material of each, look, go back; the replay of the old failure (409 not_pending on edit)
    for (const status of ['approved', 'published', 'rejected', 'rendering', 'draft', 'ready']) {
      await open(page, '/admin/content')
      await page.getByLabel('Status').selectOption(status)
      const first = page.locator('[data-feed] li button').first()
      if (!(await first.count())) continue
      await first.click()
      const screen = page.locator('[data-studio="screen"]')
      await expect(screen).toBeVisible()
      await page.waitForTimeout(600)
      await expect(screen.getByRole('button', { name: /^(Approve|Reject|Revise|Save text)$/ }), status).toHaveCount(0)
      await expect(page.getByText(/Something went wrong|E-NOTPENDI|not_pending/), status).toHaveCount(0)
      await expect(screen.locator('[data-studio="read-only"]'), status).toBeVisible()
    }
    expect(writes, 'opening wrote to HQ').toEqual([])
    expect(errors).toEqual([])
  })

  test('Content: a material without files says «Render pending» with the render state, never a fake render', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await openMaterial(page, 'rendering')
    const screen = page.locator('[data-studio="screen"]')
    await expect(screen.getByText('Render pending')).toBeVisible()
    await expect(screen.locator('[data-studio="render-state"]')).toContainText('Render: ')
    await expect(screen.locator('video')).toHaveCount(0)
    await expect(page.getByText('demo render')).toHaveCount(0)
    // the text of an old rejected material is read only
    await expect(screen.locator('[data-studio="read-only"]')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('Content: a PDF in the card media opens in an inline viewer', async ({ page }) => {
    const errors = watchErrors(page, noise)
    await openMaterial(page, 'approved')
    const screen = page.locator('[data-studio="screen"]')
    await expect(screen.locator('[data-studio="preview"]')).toHaveAttribute('data-mode', 'pdf')
    const frame = screen.locator('[data-studio="preview"] iframe')
    await expect(frame).toBeVisible()
    await expect(frame).toHaveAttribute('src', /\/api\/admin\/files\/docs\/brief\.pdf$/)
    const res = await page.request.get('/api/admin/files/docs/brief.pdf')
    expect(res.headers()['content-type']).toBe('application/pdf')
    expect(res.headers()['x-frame-options']).toBe('SAMEORIGIN')
    expect(errors).toEqual([])
  })

  test('Content: a failed action names the request and HQ code (never «Something went wrong»)', async ({ page }) => {
    await openMaterial(page, 'pending', 'clip', true)
    // HQ refuses the decision (the card was decided elsewhere): the toast says which request failed and why
    await page.route('**/api/admin/hq/content/*', (route) => route.fulfill({ json: { ok: false, http: 409, error: 'not_pending', status: 'approved' } }))
    await page.getByRole('button', { name: 'Approve', exact: true }).click()
    await expect(page.getByText('Approve failed (409 not_pending, item approved)')).toBeVisible()
    await expect(page.getByText(/Something went wrong|E-NOTPENDI/)).toHaveCount(0)
  })

  for (const [name, size] of Object.entries(SIZES)) {
    test(`Content screen: no horizontal overflow ${name}`, async ({ page }) => {
      await page.setViewportSize(size)
      await open(page, '/admin/content')
      await page.getByLabel('Format').first().selectOption('carousel')
      await page.locator('[data-feed] li button').first().click()
      await expect(page.locator('[data-studio="screen"]')).toBeVisible()
      await noHorizontalOverflow(page)
    })
  }

  for (const [name, size] of Object.entries(SIZES)) {
    test(`no horizontal overflow ${name}`, async ({ page }) => {
      await page.setViewportSize(size)
      for (const url of ['/admin/inbox', '/admin/clients', '/admin/projects', '/admin/documents', '/admin/agents', '/admin/agents?agent=client-bot', '/admin/content', '/admin/content?tab=orders', '/admin/settings', '/admin/tasks']) {
        await open(page, url)
        await noHorizontalOverflow(page, url)
      }
    })
  }
})
