// Shared checks of the public JSON POST routes (/api/lead, /api/chat, /api/audit).

// The visitor IP as the site's own limiters derive it: nginx sets x-real-ip, else the first hop
// of x-forwarded-for. Only what the limiters already trust; 'local' when nothing is there.
export function visitorIp(headers: Pick<Headers, 'get'>): string {
  const ip = headers.get('x-real-ip') ?? headers.get('x-forwarded-for')?.split(',')[0] ?? 'local'
  return ip.trim() || 'local'
}

// Header sent to HQ so its per-IP limits see the visitor, not the docker gateway. 'local' (no
// proxy, development) is not sent.
export function visitorIpHeader(ip: string | undefined): Record<string, string> {
  return ip && ip !== 'local' ? { 'x-visitor-ip': ip } : {}
}

function allowedOrigins(env: Record<string, string | undefined>): string[] {
  const site = (env.NEXT_PUBLIC_SITE_URL || 'https://firtech.pro').replace(/\/$/, '')
  const list = [site]
  try {
    const u = new URL(site)
    if (!u.hostname.startsWith('www.')) list.push(`${u.protocol}//www.${u.host}`)
  } catch {
    // keep the plain value
  }
  return list
}

// null when the request may go on, else the error answer. JSON content type is required, and an
// Origin header, when the browser sends one, must be this site (localhost only outside production).
export function checkPublicPost(
  request: Pick<Request, 'headers'>,
  env: Record<string, string | undefined> = process.env,
): { status: number; error: string } | null {
  const type = request.headers.get('content-type') ?? ''
  if (!/^application\/json\s*(;|$)/i.test(type)) return { status: 415, error: 'unsupported_media_type' }
  const origin = request.headers.get('origin')
  if (origin) {
    if (allowedOrigins(env).includes(origin.replace(/\/$/, ''))) return null
    if (env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return null
    return { status: 403, error: 'bad_origin' }
  }
  return null
}
