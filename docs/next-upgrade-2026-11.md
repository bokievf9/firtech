# Next.js security upgrade (2026-11-18)

Branch `next-upgrade-2026-11`.

## Versions
| package | before | after |
|---|---|---|
| next | 16.4.0 | 16.4.6 |
| eslint-config-next (and @next/eslint-plugin-next) | 16.4.0 | 16.4.6 |
| react, react-dom | 19.3.0 | 19.3.0 (unchanged, next 16.4.6 accepts ^19) |

## Why
`npm audit` flagged next 16.0.0 - 16.4.4 as critical: RCE in the Image Optimization API (SVG),
RCE in `use cache` with typed arrays, Server Actions DoS (all <= 16.4.0), plus two `use cache`
leaks (<= 16.4.4). First fixed version is 16.4.5; 16.4.6 is `latest`, taken as the minimal
step that is also the current stable.

## Audit
- Before: 16 vulnerabilities (1 critical, 9 high, 6 moderate).
- After: `npm audit --omit=dev` = 0 vulnerabilities. Full `npm audit` = 15 (9 high, 6 moderate),
  all dev-only lint tooling (picomatch, fast-glob, micromatch, tinyglobby, typescript-eslint,
  minimatch). npm's suggested fix is a downgrade to eslint-config-next 14.2.35, so it was not applied.
  They never reach the production bundle; recheck when upstream releases patched versions.

## What broke
Nothing in the code. Note: `npm run typecheck` on a clean checkout fails (`PageProps`,
`LayoutProps` not found) until `next build` or `next dev` has generated `.next/types`; this is
not caused by the upgrade.

## Checks
typecheck, lint, tests (140/140), production build: pass. `next dev` on :3001: /ru and /en return 200.
