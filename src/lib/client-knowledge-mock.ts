// Development stand-in for HQ's client knowledge routes (`GET /admin/clients/:id/knowledge`, `POST .../knowledge/import`).
// In memory: an import flips running -> done after a few reads, like a short crawl. Only client 1 (the cabinet client) exists.
type Reply = { ok: true; [k: string]: unknown } | { ok: false; error: string; [k: string]: unknown }
type Rec = Record<string, unknown>
type Page = { url: string; title: string; chars: number; fetchedAt: string }

export const MOCK_KNOWLEDGE_READS_TO_FINISH = 3

export function createClientKnowledgeMock() {
  let state: 'none' | 'running' | 'done' | 'failed' = 'none'
  let reads = 0
  let site = 'https://alice-studio.example'
  let job: Rec | null = null
  let items: Page[] = []
  let lastAt: string | null = null
  let errors = 0
  const sample = (base: string, at: string): Page[] =>
    ['', '/about', '/services', '/prices', '/contacts', '/faq'].map((p, i) => ({
      url: `${base}${p}`,
      title: ['Home', 'About the studio', 'Services', 'Prices', 'Contacts', 'Questions and answers'][i]!,
      chars: 1800 + i * 640,
      fetchedAt: at,
    }))

  return function handle(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', seg: string[], body: Rec, now: number): Reply | null {
    if (seg[0] !== 'clients' || seg[2] !== 'knowledge') return null
    if (seg[1] !== '1') return { ok: false, error: 'not_found' }
    const at = new Date(now).toISOString()
    if (method === 'GET' && seg.length === 3) {
      if (state === 'running' && ++reads >= MOCK_KNOWLEDGE_READS_TO_FINISH) {
        const url = String(job?.url ?? site)
        if (/fail/i.test(url)) {
          state = 'failed'
          errors += 1
          job = { ...job, state: 'failed', error: 'the site did not answer', errors: 1, finishedAt: at }
        } else {
          state = 'done'
          items = sample(url.replace(/\/$/, ''), at)
          lastAt = at
          job = { ...job, state: 'done', pages: items.length, chunks: items.length * 4, chars: items.reduce((n, p) => n + p.chars, 0), finishedAt: at }
        }
      }
      return { ok: true, site, instagram: '@alice.studio', instagramImported: false, state, job, pages: items.length, chunks: items.length * 4, lastAt, errors, items }
    }
    if (method === 'POST' && seg[3] === 'import' && seg.length === 4) {
      const url = typeof body.url === 'string' && body.url ? body.url : site
      if (!/^https?:\/\//i.test(url) || /127\.0\.0\.1|localhost/i.test(url)) return { ok: false, error: 'invalid_url' }
      if (state === 'running') return { ok: true, jobId: String(job?.id ?? 'j_1'), state: 'running', already: true }
      if (!site) site = url
      state = 'running'
      reads = 0
      job = { id: `j_${now}`, url, origin: 'manual', state: 'running', pages: 0, chunks: 0, chars: 0, errors: 0, skipped: 0, truncated: false, error: '', startedAt: at, finishedAt: null }
      return { ok: true, jobId: String(job.id), state: 'running', already: false }
    }
    return null
  }
}
