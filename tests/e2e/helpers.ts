import { expect, type BrowserContext, type Page } from '@playwright/test'

export const ADMIN_TOKEN = 'e2e-admin-session-token-0123456789'
// A second session only the logout test uses, so ending it cannot break the parallel admin tests.
export const LOGOUT_TOKEN = 'e2e-admin-logout-token-9876543210'

export async function adminContext(context: BrowserContext, baseURL: string, token = ADMIN_TOKEN) {
  await context.addCookies([{ name: 'firtech_admin', value: token, url: baseURL }])
}

// Collects console errors and uncaught exceptions of a page; `expected` filters known noise.
export function watchErrors(page: Page, expected: RegExp[] = []) {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !expected.some((r) => r.test(m.text()))) errors.push(`console: ${m.text()}`)
  })
  page.on('pageerror', (e) => {
    if (!expected.some((r) => r.test(e.message))) errors.push(`pageerror: ${e.message}`)
  })
  return errors
}

export async function noHorizontalOverflow(page: Page, where = '') {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(over, `horizontal overflow in px ${where}`).toBeLessThanOrEqual(1)
}

export async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('fir-theme', t)
    } catch {}
  }, theme)
}

export const SIZES = { mobile: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } } as const

// Public pages (without the locale prefix) the suite renders; the warm-up in global-setup compiles them first.
export const PUBLIC_PAGES = [
  '',
  '/builder',
  '/builder/estimate?b=websites.landing.telegram~bots.booking.payments~k.cafe',
  '/services/websites',
  '/services/bots',
  '/services/apps',
  '/services/automation',
  '/solutions',
  '/solutions/cafe',
  '/solutions/salon',
  '/how-we-work',
  '/products/admin',
  '/products/receptionist',
  '/products/automation',
  '/products/content',
  '/products/miniapp',
  '/products/agent',
  '/products/implementation',
  '/blog',
  '/blog/website-cost-2026',
  '/blog/website-or-telegram-bot',
  '/blog/stop-losing-leads',
  '/audit',
  '/status',
  '/compare',
  '/referral',
  '/pay-how',
  '/ai-team',
  '/ai-team/marketing',
  '/ai-team/sales',
  '/ai-team/support',
  '/ai-team/production',
  '/ai-team/backoffice',
  '/ai-team/company',
  '/ai-team/agent/trend-scout',
  '/ai-team/agent/lead-handler',
  '/ai-team/agent/billing',
  '/terms',
  '/privacy',
  '/pay/FT-2026-001?k=demo',
  '/pay/FT-2026-999?k=demo',
  '/cabinet',
  '/cabinet/login',
  '/cabinet/reset',
]

// goto + wait until the network is quiet, so React has hydrated before the test clicks (in `next dev`
// a click right after `load` can land on a button that has no handler yet). Pages that poll (pay,
// status, admin) never go idle, so that wait is capped.
export async function open(page: Page, url: string) {
  const response = await page.goto(url, { waitUntil: 'load' })
  await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {})
  return response
}

// The home film (wide screens, motion allowed, WebGL) replaces the floating chat button with its own
// travelling Fira once it is drawn, a moment after the load. Chat tests are not about the film, so they
// open the home page with reduced motion: the plain sections and the ordinary launcher.
export async function openHomeForChat(page: Page, url = '/ru') {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  return open(page, url)
}
