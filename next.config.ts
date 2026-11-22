import type { NextConfig } from 'next'
import { cspHeader } from './src/lib/csp'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=()' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : []),
  // Security 2026-11-23 (P1-8): stage 1 is Report-Only (lib/csp.ts, reports counted by /api/csp-report).
  { key: 'Content-Security-Policy-Report-Only', value: cspHeader() },
]

// The two routes that open in an iframe of the site itself: same-origin framing in the CSP too.
const frameSelfCsp = { key: 'Content-Security-Policy-Report-Only', value: cspHeader(process.env, { frameAncestors: "'self'" }) }

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
      // «ИИ-отдел под ключ» was removed (2026-11-22): its page leads to the AI teams.
      { source: '/:locale(ru|en)/products/implementation', destination: '/:locale/ai-team', permanent: true },
      { source: '/products/implementation', destination: '/ai-team', permanent: true },
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
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }, frameSelfCsp],
      },
      // Content renders (PDF previews) open in an iframe of the Content screen: same-origin framing only. The session check is in the handler.
      {
        source: '/api/admin/files/:path*',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }, frameSelfCsp],
      },
    ]
  },
}

export default nextConfig
