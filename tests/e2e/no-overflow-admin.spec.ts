import { expect, test, type Page } from '@playwright/test'
import { adminContext, open } from './helpers'

// Owner review 2026-11-22, item 4, second pass: nothing in the Pult (side panels, drawers, the review centre,
// the document editor, the command palette) may be wider than its frame at 390 and 768 px. Every screen is
// opened with the dev mock of HQ and, in the «long» variant, with unbroken 60-character names, 80-character
// e-mails, 15 milestones and 40 leads injected into the mock's answers; text fields get 130 unbroken
// characters. `audit` reports: page scroll, any element outside the viewport (except inside a deliberate
// `overflow-x-auto` strip), a panel body that scrolls sideways, text spilling out of its own box, and a
// control wider than its parent. SHOTS_DIR / SHOTS_TAG save screenshots; WIDTHS overrides the widths.
const SHOTS = process.env.SHOTS_DIR
const TAG = process.env.SHOTS_TAG ?? 'x'
const LONG = 'Очень_длинное_название_компании_без_пробелов_ООО_Ромашка_2026'

const grow = (a: unknown[], n: number) =>
  a.length && a.length < n
    ? Array.from({ length: n }, (_, i) => {
        const x = a[i % a.length] as Record<string, unknown>
        return i < a.length ? x : { ...x, id: typeof x.id === 'number' ? 1000 + i : `${String(x.id)}-${i}`, no: typeof x.no === 'number' ? 100 + i : x.no }
      })
    : a

function longify(v: unknown, key = ''): unknown {
  if (Array.isArray(v)) {
    // 15 milestones in a project, 40 leads in a column
    const isLead = v.length > 2 && v.every((x) => x && typeof x === 'object' && 'stage' in x && 'contact' in x)
    const many = key === 'milestones' || key === 'items' && isLead ? grow(v, key === 'milestones' ? 15 : 40) : v
    return many.map((x) => longify(x, key))
  }
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, longify(x, k)]))
  if (typeof v === 'string' && v.length > 0 && v.length < 200) {
    if (/^(name|company|title|clientName|subject|label)$/.test(key)) return `${LONG}${v}`
    if (/^(contact|email)$/.test(key)) return 'very.long.email.address.of.a.client.number.one@subdomain.example-company-name.com'
  }
  return v
}

async function audit(page: Page) {
  return page.evaluate(() => {
    const out: string[] = []
    const vw = window.innerWidth
    if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${vw}`)
    const label = (el: Element) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).slice(0, 3).join('.') : ''} "${(el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30)}"`
    // The nearest ancestor that scrolls sideways on purpose (tab strips, week grid, tables).
    const scroller = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
        if (/overflow-x-(auto|scroll)/.test(p.getAttribute('class') ?? '')) return p
      }
      return null
    }
    for (const el of document.querySelectorAll('main *, aside *, [role=dialog] *, [role=alertdialog] *')) {
      if (el.closest('canvas, svg, .sr-only, [hidden], [aria-hidden="true"]')) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const st = getComputedStyle(el)
      if (st.visibility === 'hidden' || st.display === 'none' || st.position === 'fixed' && el.closest('[data-toast]')) continue
      // a panel / drawer body that has to scroll sideways has content wider than itself
      if (/(auto|scroll)/.test(st.overflowY) && !/overflow-x-(auto|scroll)/.test(el.getAttribute('class') ?? '') && el.scrollWidth > el.clientWidth + 1) {
        out.push(`scroll body wider than itself ${label(el)} ${el.scrollWidth}>${el.clientWidth}`)
      }
      if (scroller(el)) continue
      if (r.right > vw + 1 || r.left < -1) {
        out.push(`outside viewport ${label(el)} ${Math.round(r.left)}-${Math.round(r.right)}`)
        continue
      }
      // text spilling out of its own box
      if (st.overflowX === 'visible' && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1 && st.display !== 'inline' && !/^(svg|path|canvas)$/i.test(el.tagName)) {
        const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent || '').trim())
        if (hasText) out.push(`text spill ${label(el)} ${el.scrollWidth}>${el.clientWidth}`)
      }
      // control wider than its container
      if (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(el.tagName) && el.parentElement) {
        const p = el.parentElement.getBoundingClientRect()
        if (r.right > p.right + 1 || r.left < p.left - 1) out.push(`control ${label(el)} ${Math.round(r.left)}-${Math.round(r.right)} outside parent ${Math.round(p.left)}-${Math.round(p.right)}`)
      }
    }
    return Array.from(new Set(out)).slice(0, 12)
  })
}

async function shot(page: Page, name: string, width: number, theme: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-${width}${theme === 'dark' ? '-dark' : ''}-${TAG}.png` })
}

// The Shell sections with tabs (src/lib/hq-shell.ts HQ_TABS), then the ones without.
const PANELS: Array<[string, string, string[]]> = [
  ['1', 'inbox', ['notifications', 'approvals']],
  ['6', 'clients', ['pipeline', 'clients', 'site', 'calls', 'prospects']],
  ['7', 'projects', ['projects']],
  ['8', 'documents', ['documents', 'referrals', 'reviews']],
  ['9', 'finance', ['invoices', 'payments', 'costs']],
  ['10', 'content', ['feed', 'orders', 'campaigns']],
  ['11', 'settings', ['']],
  ['12', 'tasks', ['']],
  ['13', 'calendar', ['']],
  ['14', 'agents', ['']],
]

for (const width of (process.env.WIDTHS ?? '390,768').split(',').map(Number)) {
  for (const long of [false, true]) {
    test.describe(`admin ${width} ${long ? 'long' : 'plain'}`, () => {
      test.use({ viewport: { width, height: 900 } })
      test.beforeEach(async ({ context, baseURL, page }) => {
        await adminContext(context, baseURL!)
        if (long) {
          await page.route('**/api/admin/hq/**', async (route) => {
            try {
              const res = await route.fetch()
              const ct = res.headers()['content-type'] ?? ''
              if (!ct.includes('json')) return await route.fulfill({ response: res })
              await route.fulfill({ response: res, json: longify(await res.json()) })
            } catch {}
          })
        }
      })
      for (const [, panel, tabs] of PANELS) {
        for (const tab of tabs) {
          test(`${panel}/${tab || 'page'}`, async ({ page }) => {
            await open(page, tab ? `/admin/${panel}?tab=${tab}` : `/admin/${panel}`)
            await page.waitForTimeout(1200)
            const found = await audit(page)
            await shot(page, `${panel}-${tab}${long ? '-long' : ''}`, width, 'light')
            expect(found, 'overflow').toEqual([])
          })
        }
      }

      // Drawers: open the first rows of every list-like tab and audit the drawer on top.
      for (const [, panel, tabs] of PANELS) {
        for (const tab of tabs) {
          if (!long) continue
          test(`drawer ${panel}/${tab || 'page'}`, async ({ page }) => {
            await open(page, tab ? `/admin/${panel}?tab=${tab}` : `/admin/${panel}`)
            await page.waitForTimeout(1200)
            const rows = page.locator('main li > button, main li > div > button:first-child, main [role=button]')
            const n = Math.min(await rows.count(), 3)
            for (let i = 0; i < n; i++) {
              await rows.nth(i).click({ timeout: 3000 }).catch(() => {})
              await page.waitForTimeout(700)
              const found = await audit(page)
              await shot(page, `drawer-${panel}-${tab}-${i}${long ? '-long' : ''}`, width, 'light')
              expect(found, 'overflow').toEqual([])
              await page.keyboard.press('Escape')
              await page.waitForTimeout(300)
            }
          })
        }
      }

      // Inputs: every text field of an open drawer / panel gets an unbroken 130-character value.
      const FILL = `${LONG}${LONG}`
      async function fillAll(page: Page, scope: string) {
        for (const el of await page.locator(`${scope} input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]), ${scope} textarea`).all()) {
          await el.fill(FILL).catch(() => {})
        }
      }
      for (const [, panel, tabs] of PANELS) {
        for (const tab of tabs) {
          if (!long) continue
          test(`inputs ${panel}/${tab || 'page'}`, async ({ page }) => {
            await open(page, tab ? `/admin/${panel}?tab=${tab}` : `/admin/${panel}`)
            await page.waitForTimeout(1200)
            await fillAll(page, 'main')
            const rows = page.locator('main li > button, main li > div > button:first-child')
            if (await rows.count()) {
              await rows.first().click({ timeout: 3000 }).catch(() => {})
              await page.waitForTimeout(700)
              await fillAll(page, 'main')
            }
            const found = await audit(page)
            await shot(page, `inputs-${panel}-${tab}${long ? '-long' : ''}`, width, 'light')
            expect(found, 'overflow').toEqual([])
          })
        }
      }

      test('command palette with a long query', async ({ page }) => {
        await open(page, '/admin/inbox')
        await page.keyboard.press('Control+k')
        await page.getByRole('dialog').getByRole('combobox').or(page.getByRole('dialog').locator('input')).first().fill(FILL)
        await page.waitForTimeout(500)
        const found = await audit(page)
        await shot(page, `palette${long ? '-long' : ''}`, width, 'light')
        expect(found, 'overflow').toEqual([])
      })

      for (const url of ['/admin/office', '/admin/approvals', '/admin/approvals?id=ap_201', '/admin/chats', '/admin/golive']) {
        test(`page ${url}`, async ({ page }) => {
          await open(page, url)
          await page.waitForTimeout(1500)
          let found = await audit(page)
          await shot(page, `page${url.replace(/\//g, '-')}${long ? '-long' : ''}`, width, 'light')
          expect(found, 'overflow').toEqual([])
          const items = page.locator('main li button, [role=list] button, aside li button')
          const n = Math.min(await items.count(), 3)
          for (let i = 0; i < n; i++) {
            await items.nth(i).click({ timeout: 3000 }).catch(() => {})
            await page.waitForTimeout(600)
            await fillAll(page, 'main, [role=dialog]')
            found = await audit(page)
            await shot(page, `page${url.replace(/\//g, '-')}-${i}${long ? '-long' : ''}`, width, 'light')
            expect(found, 'overflow').toEqual([])
          }
        })
      }

      test('review: document editor', async ({ page }) => {
        await open(page, '/admin/approvals?id=ap_204')
        await page.waitForTimeout(1500)
        await page.getByRole('list', { name: 'Очередь' }).getByRole('button').first().click({ timeout: 2000 }).catch(() => {})
        await page.keyboard.press('e')
        const dialog = page.getByRole('dialog', { name: 'Редактор документа' })
        await dialog.waitFor({ timeout: 8000 })
        const area = dialog.getByRole('textbox', { name: 'Текст документа' })
        await area.click()
        await page.keyboard.press('Control+End')
        await page.keyboard.insertText(` ${FILL}${FILL}`)
        await page.keyboard.press('Control+f')
        await dialog.getByRole('textbox', { name: 'Найти' }).fill(FILL)
        await dialog.getByRole('textbox', { name: 'Заменить на' }).fill(FILL)
        await page.waitForTimeout(400)
        const found = await audit(page)
        await shot(page, `editor${long ? '-long' : ''}`, width, 'light')
        expect(found, 'overflow').toEqual([])
        await page.keyboard.press('Escape')
      })
    })
  }
}
