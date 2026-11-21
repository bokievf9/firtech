import 'server-only'
import { isMockMode, resolveMediaUrl } from './cabinet-hq'
import { mockPdf } from './cabinet-hq-mock'

// Files of the cabinet (document PDF and HTML, message attachments) streamed from HQ through the
// site, so the browser never sees HQ's address or its signed links. The caller has already checked
// the session (and, for documents, that the file belongs to the client).
type Env = Record<string, string | undefined>

const types: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  zip: 'application/zip',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
}
const inlineTypes = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp'])

const extOf = (path: string) => /\.([A-Za-z0-9]{1,5})$/.exec(path.split('?')[0] ?? '')?.[1]?.toLowerCase() ?? ''
const safeName = (name: string, fallback: string) => name.replace(/[^\p{L}\p{N}._ -]/gu, '').trim().slice(0, 100) || fallback

const fail = (status: number, error: string) =>
  new Response(JSON.stringify({ ok: false, error }), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export function fileHeaders(ext: string, opts: { download?: boolean; name?: string }): Headers {
  const h = new Headers()
  h.set('content-type', types[ext] ?? 'application/octet-stream')
  h.set('cache-control', 'private, no-store')
  h.set('x-content-type-options', 'nosniff')
  const download = opts.download || !inlineTypes.has(ext)
  const name = safeName(opts.name ?? '', `file.${ext || 'bin'}`)
  h.set('content-disposition', `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(name)}`)
  // The viewer is an iframe of this site: allow only that.
  h.set('x-frame-options', 'SAMEORIGIN')
  h.set('content-security-policy', "frame-ancestors 'self'")
  return h
}

export async function streamClientFile(
  url: string,
  opts: { download?: boolean; name?: string } = {},
  { env = process.env, fetcher = fetch }: { env?: Env; fetcher?: typeof fetch } = {},
): Promise<Response> {
  const path = url.split('?')[0] ?? ''
  const ext = extOf(path)
  if (isMockMode(env)) {
    const m = /^\/media\/mock\/([A-Za-z0-9_-]+)\.(pdf)$/.exec(path)
    if (!m) {
      // Uploaded files of the demo have no content: a short text stands in.
      if (!/^\/media\/mock\/upload\//.test(path)) return fail(404, 'not_found')
      const headers = fileHeaders('docx', { download: true, name: opts.name })
      headers.set('content-type', 'text/plain; charset=utf-8')
      return new Response('Demo upload: the real file is stored by HQ.', { headers })
    }
    return new Response(mockPdf(`Document ${m[1]}`) as BodyInit, { headers: fileHeaders('pdf', opts) })
  }
  const target = resolveMediaUrl(url, env)
  if (!target || !types[ext]) return fail(404, 'not_found')
  const token = env.HQ_ADMIN_TOKEN?.trim()
  let res: Response
  try {
    res = await fetcher(target, {
      headers: token ? { 'x-admin-token': token } : {},
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    })
  } catch (error) {
    return fail(502, error instanceof Error && error.name === 'TimeoutError' ? 'hq_timeout' : 'hq_unreachable')
  }
  if (res.status === 404 || res.status === 410) return fail(404, 'not_found')
  if (!res.ok || !res.body) return fail(502, 'hq_error')
  const headers = fileHeaders(ext, opts)
  const length = res.headers.get('content-length')
  if (length) headers.set('content-length', length)
  return new Response(res.body, { status: 200, headers })
}
