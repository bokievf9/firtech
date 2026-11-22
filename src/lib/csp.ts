// Content-Security-Policy, stage 1 (security review 2026-11-23, P1-8): sent as
// `Content-Security-Policy-Report-Only` from next.config.ts, so nothing breaks while the reports
// (POST /api/csp-report, counted only) show what the policy would block. Stage 2 (enforce with a nonce
// and strict-dynamic on /cabinet, /pay, /admin) comes after the reports are clean. Pure, no imports.

type Env = Record<string, string | undefined>

const DEFAULT_SUPABASE = 'https://lxuigwowgxzjadtenpyk.supabase.co'

function supabaseOrigin(env: Env): string {
  try {
    const u = new URL(env.NEXT_PUBLIC_SUPABASE_URL?.trim() || DEFAULT_SUPABASE)
    return u.protocol === 'https:' ? u.origin : DEFAULT_SUPABASE
  } catch {
    return DEFAULT_SUPABASE
  }
}

export function cspDirectives(env: Env = process.env, opts: { frameAncestors?: string } = {}): [string, string[]][] {
  const supabase = supabaseOrigin(env)
  const dev = env.NODE_ENV !== 'production'
  return [
    ['default-src', ["'self'"]],
    // 'unsafe-eval' only in development (React refresh); 'wasm-unsafe-eval' for the 3D decoders.
    ['script-src', ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", ...(dev ? ["'unsafe-eval'"] : []), 'https://mc.yandex.ru', 'https://yastatic.net']],
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', ["'self'", 'data:', 'blob:', 'https://mc.yandex.ru', 'https://lh3.googleusercontent.com']],
    ['font-src', ["'self'"]],
    ['connect-src', ["'self'", supabase, supabase.replace(/^https:/, 'wss:'), 'https://mc.yandex.ru', 'https://mc.yandex.com', 'wss://mc.yandex.ru', ...(dev ? ['ws:'] : [])]],
    ['frame-src', ["'self'"]],
    ['frame-ancestors', [opts.frameAncestors ?? "'none'"]],
    ['form-action', ["'self'"]],
    ['base-uri', ["'none'"]],
    ['object-src', ["'none'"]],
    ['worker-src', ["'self'", 'blob:']],
    ['manifest-src', ["'self'"]],
    ['upgrade-insecure-requests', []],
    ['report-uri', ['/api/csp-report']],
  ]
}

export function cspHeader(env: Env = process.env, opts: { frameAncestors?: string } = {}): string {
  return cspDirectives(env, opts)
    .map(([name, values]) => (values.length ? `${name} ${values.join(' ')}` : name))
    .join('; ')
}

// A header value back into { directive: [sources] } (tests, and the report route's directive names).
export function parseCsp(value: string): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const part of value.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/).filter(Boolean)
    if (name) out[name.toLowerCase()] = sources
  }
  return out
}
