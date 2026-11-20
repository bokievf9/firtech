import { defineConfig, devices } from '@playwright/test'
import { tmpdir } from 'node:os'
import path from 'node:path'

// E2E suite (docs/button-census.md). It runs against `next dev`, not `next start`: every dev mock of
// the site (HQ chat, office, pay, cabinet, audit) is gated on NODE_ENV !== 'production', so a
// production server would need a live HQ. The server gets a throwaway DATA_DIR (admin.json with one
// hand-written session, golive.json, leads.json), a dummy Supabase pair so the cabinet counts as
// configured (the lead gate and the sign-in step show), and every HQ / Telegram variable empty.
// Browser: Playwright's own chromium, taken from the cache; PW_CHROMIUM_PATH overrides the binary.
const port = Number(process.env.E2E_PORT ?? 3417)
const dataDir = process.env.E2E_DATA_DIR ?? path.join(tmpdir(), 'firtech-e2e-data')
process.env.E2E_DATA_DIR = dataDir

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx next dev --port ${port}`,
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: Boolean(process.env.E2E_REUSE),
    timeout: 120_000,
    env: {
      DATA_DIR: dataDir,
      NEXT_TELEMETRY_DISABLED: '1',
      NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`,
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: '',
      HQ_CHAT_URL: '',
      HQ_ADMIN_URL: '',
      HQ_OFFICE_URL: '',
      HQ_BLOG_URL: '',
      HQ_PAY_URL: '',
      HQ_STATUS_URL: '',
      HQ_EVENTS_URL: '',
      LEAD_INTAKE_URL: '',
      TELEGRAM_BOT_TOKEN: '',
      TELEGRAM_CHAT_ID: '',
    },
  },
})
