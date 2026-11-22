import { expect, test, type Page } from '@playwright/test'
import { adminContext, noHorizontalOverflow, open, SIZES, watchErrors } from './helpers'

// The Office (/admin/office) is a visual inside the Shell frame: the living pixel office and
// information only (docs/shell.md «Office»). No panels, no actions; a click on a department zone
// goes to the matching Shell section.

const ZONES: [room: string, section: RegExp][] = [
  ['director', /\/admin\/inbox/],
  ['marketing', /\/admin\/content/],
  ['sales', /\/admin\/clients/],
  ['support', /\/admin\/chats/],
  ['production', /\/admin\/projects/],
  ['back-office', /\/admin\/finance/],
  ['servers', /\/admin\/agents/],
]

// A point (in the canvas box) where the engine's own hit test answers with this room, so the click
// does not land on a desk or a person.
async function roomPoint(page: Page, room: string) {
  await page.waitForFunction(() => Boolean((window as unknown as { __office?: unknown }).__office))
  return page.evaluate((id) => {
    type Rect = { x: number; y: number; w: number; h: number }
    const s = (
      window as unknown as {
        __office: {
          zoneRect(id: string): Rect | null
          toView(r: Rect): Rect
          toWorld(x: number, y: number): { x: number; y: number }
          hitTest(x: number, y: number): { kind: string; id?: string } | null
        }
      }
    ).__office
    const r = s.zoneRect(id)
    if (!r) return null
    const v = s.toView(r)
    for (let y = Math.max(8, v.y + 4); y < v.y + v.h - 4; y += 4) {
      for (let x = Math.max(8, v.x + 4); x < v.x + v.w - 4; x += 4) {
        const w = s.toWorld(x, y)
        const hit = s.hitTest(w.x, w.y)
        if (hit && hit.kind === 'room' && hit.id === id) return { x, y }
      }
    }
    return null
  }, room)
}

test.describe('Office, with a session', () => {
  test.beforeEach(async ({ context, baseURL }) => adminContext(context, baseURL!))

  test('opens inside the Shell frame: menu, info strip, the office canvas, no side panel', async ({ page }) => {
    const errors = watchErrors(page, [/Failed to load resource/])
    await open(page, '/admin/office')
    await expect(page.locator('[data-hq-shell]')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Sections' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /^Office/ }).first()).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('[data-office-strip]')).toBeVisible()
    await expect(page.locator('canvas').first()).toBeVisible()
    // The presence switch lives in the Shell top bar and still switches.
    await page.getByRole('radio', { name: 'Away', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'Away', exact: true })).toBeChecked()
    await page.getByRole('radio', { name: 'In office', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'In office', exact: true })).toBeChecked()
    // Nothing slides in: no side panel, no tabs, no dialog.
    await expect(page.locator('aside')).toHaveCount(0)
    await expect(page.getByRole('tab')).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/admin\/office$/)
    expect(errors).toEqual([])
  })

  test('the header Office link opens the page in the same tab', async ({ page }) => {
    await open(page, '/admin/inbox')
    const link = page.locator('[data-header-office]')
    await expect(link).not.toHaveAttribute('target', /./)
    await link.click()
    await expect(page).toHaveURL(/\/admin\/office$/)
    await expect(page.locator('canvas').first()).toBeVisible()
  })

  test('old ?panel= links go to the Shell section of that panel', async ({ page }) => {
    await open(page, '/admin/office?panel=sales&tab=leads&focus=12')
    await expect(page).toHaveURL(/\/admin\/clients\?tab=pipeline&focus=12/)
  })

  for (const [room, section] of ZONES) {
    test(`a click on the ${room} zone goes to ${section.source}`, async ({ page }) => {
      await open(page, '/admin/office')
      await expect(page.locator('canvas').first()).toBeVisible()
      await expect.poll(() => roomPoint(page, room), { timeout: 20_000 }).not.toBeNull()
      const pt = (await roomPoint(page, room))!
      const box = (await page.locator('canvas').first().boundingBox())!
      await page.mouse.click(box.x + pt.x, box.y + pt.y)
      // The first visit of a section compiles it in `next dev`, so the wait is long.
      await expect(page).toHaveURL(section, { timeout: 60_000 })
    })
  }

  for (const [name, size] of Object.entries(SIZES)) {
    test(`no horizontal overflow at ${name}`, async ({ page }) => {
      await page.setViewportSize(size)
      await open(page, '/admin/office')
      await expect(page.locator('canvas').first()).toBeVisible()
      await noHorizontalOverflow(page, `office ${name}`)
      const wrap = await page.locator('[data-office-page]').boundingBox()
      expect(wrap!.height).toBeGreaterThan(size.height * 0.5)
    })
  }
})
