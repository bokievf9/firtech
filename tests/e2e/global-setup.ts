import { createHash } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ADMIN_TOKEN, LOGOUT_TOKEN, PUBLIC_PAGES } from './helpers'

// A clean throwaway data dir with one hand-written owner session (only the hash is stored, as in
// src/lib/admin-auth.ts); the admin specs send the same token in the `firtech_admin` cookie.
export default async function globalSetup() {
  const dir = process.env.E2E_DATA_DIR!
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const now = Date.now()
  const session = (token: string) => ({ id: createHash('sha256').update(token).digest('hex'), createdAt: now, expiresAt: now + 86_400_000 })
  writeFileSync(path.join(dir, 'admin.json'), JSON.stringify({ codes: [], issued: [], sessions: [session(ADMIN_TOKEN), session(LOGOUT_TOKEN)] }), { mode: 0o600 })

  // `next dev` compiles a route on its first request (seconds each), which would make the first
  // test to hit a page time out. Warm every route the suite uses before the tests start; the
  // browser-side chunks come with the same requests.
  const base = `http://localhost:${process.env.E2E_PORT ?? 3417}`
  const cookie = `firtech_admin=${ADMIN_TOKEN}`
  const urls = [
    ...['ru', 'en'].flatMap((l) => PUBLIC_PAGES.map((p) => `/${l}${p}`)),
    '/ru/no-such-page',
    '/no-such-page',
    '/admin/login',
    '/admin/office',
    '/admin/golive',
    '/admin/review',
    '/admin/chats',
    '/api/health',
    '/api/prices',
    '/api/office/public',
    '/api/status',
    '/api/admin/golive',
    '/api/admin/hq/hub',
    '/api/admin/hq/review',
    '/api/admin/hq/chats',
    '/api/admin/prices',
    '/api/cabinet/me',
    '/robots.txt',
    '/sitemap.xml',
    '/llms.txt',
    '/rss.xml',
  ]
  // One at a time: concurrent first compiles make `next dev` fail with a JSON.parse error on its
  // own manifests (seen with four at once).
  for (const url of urls) {
    await fetch(base + url, { headers: { cookie }, redirect: 'follow' }).catch(() => null)
  }
}
