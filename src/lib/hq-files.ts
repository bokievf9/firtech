import 'server-only'
import { DEFAULT_HQ_ADMIN_URL } from './hq-admin'
import { SAMPLE_MP4_BASE64 } from './hq-files-sample'
import { renderType, safeRenderPath } from './shell'

// Content renders (PNG slides, MP4 clips) for the пульт: the browser asks /api/admin/files/<path>,
// this streams HQ's GET /admin/files/<path> with the admin token. Only paths inside the renders
// folder (safeRenderPath: plain segments, no dot segments, png/jpg/webp/mp4/pdf) are ever requested.
// Range requests pass through, so the <video> element can seek. Without HQ_ADMIN_URL in development a
// labelled SVG stands in for every image and videos answer 404.

type Env = Record<string, string | undefined>
export const FILE_TIMEOUT_MS = 15_000

const headersOut = (type: string) => ({
  'content-type': type,
  'cache-control': 'private, max-age=300',
  'x-content-type-options': 'nosniff',
})

const fail = (status: number, error: string) =>
  new Response(JSON.stringify({ ok: false, error }), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export function placeholderSvg(path: string): string {
  const name = path.split('/').pop()!.replace(/[^\w.-]/g, '')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><rect width="1080" height="1350" fill="#11160f"/><rect x="60" y="60" width="960" height="1230" rx="48" fill="none" stroke="#c6f432" stroke-width="6" stroke-dasharray="24 18"/><text x="540" y="640" fill="#c6f432" font-family="monospace" font-size="56" text-anchor="middle">sample slide</text><text x="540" y="720" fill="#8a9384" font-family="monospace" font-size="36" text-anchor="middle">dev mock, no HQ · ${name}</text></svg>`
}

// The dev clip with Range support (a <video> seeks with 206 answers).
function sampleClip(range: string | null): Response {
  const bytes = Buffer.from(SAMPLE_MP4_BASE64, 'base64')
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null
  if (!m || (!m[1] && !m[2])) return new Response(bytes, { headers: { ...headersOut('video/mp4'), 'accept-ranges': 'bytes', 'content-length': String(bytes.length) } })
  const start = m[1] ? Number(m[1]) : Math.max(0, bytes.length - Number(m[2]))
  const end = m[1] && m[2] ? Math.min(Number(m[2]), bytes.length - 1) : bytes.length - 1
  if (start > end || start >= bytes.length) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${bytes.length}` } })
  const part = bytes.subarray(start, end + 1)
  return new Response(part, { status: 206, headers: { ...headersOut('video/mp4'), 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${bytes.length}`, 'content-length': String(part.length) } })
}

// A one-page PDF for the dev mock (no HQ): enough for the inline viewer to show a page.
const SAMPLE_PDF =
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 58>>stream\nBT /F1 18 Tf 40 200 Td (Sample PDF, dev mock) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R/Size 6>>\n%%EOF\n'

export async function proxyRenderFile(
  segments: string[],
  range: string | null,
  { env = process.env, fetcher = fetch, timeoutMs = FILE_TIMEOUT_MS }: { env?: Env; fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<Response> {
  const path = safeRenderPath(segments)
  const type = path ? renderType(path) : null
  if (!path || !type) return fail(404, 'not_found')

  const configured = env.HQ_ADMIN_URL?.trim()
  if (!configured && env.NODE_ENV !== 'production') {
    if (type.startsWith('image/')) return new Response(placeholderSvg(path), { headers: headersOut('image/svg+xml') })
    if (type === 'application/pdf') return new Response(SAMPLE_PDF, { headers: headersOut(type) })
    return sampleClip(range)
  }
  const base = (configured || DEFAULT_HQ_ADMIN_URL).replace(/\/+$/, '')
  const token = env.HQ_ADMIN_TOKEN?.trim() || env.HQ_OFFICE_TOKEN?.trim()
  const headers: Record<string, string> = {}
  if (token) headers['x-admin-token'] = token
  if (range && /^bytes=\d*-\d*$/.test(range)) headers.range = range

  // The timer covers the wait for HQ's headers only; the body then streams for as long as it takes.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs)
  let res: Response
  try {
    res = await fetcher(`${base}/files/${path.split('/').map(encodeURIComponent).join('/')}`, {
      headers,
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch (error) {
    const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    return fail(502, timeout ? 'hq_timeout' : 'hq_unreachable')
  } finally {
    clearTimeout(timer)
  }
  if (res.status === 401 || res.status === 403) return fail(502, 'hq_unauthorized')
  if (res.status === 404) return fail(404, 'not_found')
  if (res.status === 416) return new Response(null, { status: 416, headers: { 'content-range': res.headers.get('content-range') ?? '' } })
  if (!res.ok || !res.body) return fail(502, 'hq_error')
  const out = new Headers(headersOut(type))
  for (const h of ['content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
    const v = res.headers.get(h)
    if (v) out.set(h, v)
  }
  if (!out.has('accept-ranges')) out.set('accept-ranges', 'bytes')
  return new Response(res.body, { status: res.status === 206 ? 206 : 200, headers: out })
}
