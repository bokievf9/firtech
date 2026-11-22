import { createLimiter } from '@/lib/chat-hq'
import { createCspCounter, CSP_REPORT_LIMIT, CSP_REPORT_MAX_BYTES, CSP_REPORT_WINDOW_MS, summarizeCspReport } from '@/lib/csp-report'
import { visitorIp } from '@/lib/public-post'

// POST /api/csp-report: violation reports of the Report-Only CSP (lib/csp.ts). Counts only (directive and
// blocked host), never the page URL, sample or IP; 200 reports a minute per IP; body at most 8 KB.
// Always answers 204 (a browser does not read it), 413 for a larger body, 429 over the limit.
export const dynamic = 'force-dynamic'

const limited = createLimiter(CSP_REPORT_LIMIT, CSP_REPORT_WINDOW_MS)
const count = createCspCounter()

async function readLimited(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > max) return null
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

export async function POST(request: Request) {
  if (limited(`csp:${visitorIp(request.headers)}`)) return new Response(null, { status: 429 })
  const text = await readLimited(request, CSP_REPORT_MAX_BYTES).catch(() => null)
  if (text === null) return new Response(null, { status: 413 })
  count(summarizeCspReport(text))
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } })
}
