import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=()' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : []),
]

const nextConfig: NextConfig = {
  // Self-contained server bundle, same release model as Vibely (built in CI, run by PM2).
  output: 'standalone',
  poweredByHeader: false,
  // app/global-not-found.tsx: the branded 404 for paths outside /ru and /en.
  experimental: { globalNotFound: true },
  // Moved product pages (owner 2026-11-22: «Персональный ИИ-ассистент» became «Персональный ИИ», id `personal`).
  // Keep in sync with `legacyProductRedirects` in src/lib/product-ids.ts (tested).
  async redirects() {
    return [
      { source: '/:locale(ru|en)/products/agent', destination: '/:locale/products/personal', permanent: true },
      { source: '/products/agent', destination: '/products/personal', permanent: true },
    ]
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Payment pages carry the invoice key in the URL: no referrer, never indexed. A later rule wins
      // for the same header, so Referrer-Policy here overrides the global one.
      {
        source: '/:locale/pay/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        source: '/api/pay/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex' },
        ],
      },
      // Cabinet documents (PDF/HTML) open in an iframe of the cabinet itself (2026-11-22): same-origin
      // framing only, a later rule wins over the global DENY. The session check is in the handler.
      {
        source: '/api/cabinet/documents/:id/file',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
      // Echo listens to the owner's voice: the microphone is allowed on that page only. A later
      // rule wins for the same header.
      {
        source: '/admin/echo',
        headers: [
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
        ],
      },
    ]
  },
}

export default nextConfig
