// `next dev` builds a route on its first request: compile the ones the spec uses before it starts.
// The data dir is a fresh empty one per run (playwright.login.config.ts).
export default async function globalSetup() {
  const base = `http://localhost:${process.env.E2E_PORT ?? 3417}`
  for (const url of ['/admin/login', '/admin/inbox']) {
    await fetch(base + url, { redirect: 'follow' }).catch(() => null)
  }
}
