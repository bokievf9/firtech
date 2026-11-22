import { defineConfig, devices } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { randomBytes, scryptSync } from 'node:crypto'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { E2E_ADMIN_PASSWORD } from './tests/e2e-login/password'

// The owner panel login with a password set (docs/shell.md «Login»): its own `next dev` with a
// throwaway ADMIN_PASSWORD_HASH made here from a throwaway password, and a fresh empty data dir per
// run. Run it on its own (`npm run test:e2e:login`), never at the same time as the main suite: both
// use `.next`. The workers inherit the env set below, so they reuse the same dir and hash.
const port = Number(process.env.E2E_PORT ?? 3417)
process.env.E2E_LOGIN_DATA_DIR ??= mkdtempSync(path.join(tmpdir(), 'firtech-e2e-login-'))

// Same line as scripts/admin-password.mjs prints, at N=16384 to start faster.
function throwawayHash() {
  const salt = randomBytes(16)
  const key = scryptSync(E2E_ADMIN_PASSWORD, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 96 * 1024 * 1024 })
  return `scrypt$16384$${salt.toString('base64url')}$${key.toString('base64url')}`
}
process.env.E2E_ADMIN_PASSWORD_HASH ??= throwawayHash()

export default defineConfig({
  testDir: './tests/e2e-login',
  globalSetup: './tests/e2e-login/setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
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
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATA_DIR: process.env.E2E_LOGIN_DATA_DIR,
      NEXT_TELEMETRY_DISABLED: '1',
      NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`,
      ADMIN_PASSWORD_HASH: process.env.E2E_ADMIN_PASSWORD_HASH,
      HQ_ADMIN_URL: '',
      HQ_OFFICE_URL: '',
      HQ_CHAT_URL: '',
      TELEGRAM_BOT_TOKEN: '',
      TELEGRAM_CHAT_ID: '',
    },
  },
})
