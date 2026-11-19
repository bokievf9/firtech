# Client cabinet (2026-11-19)

Owner decision: all client work goes through the site. A client signs up at `/<locale>/cabinet/login`
(email + password with email confirmation, or Google / Apple) and sees projects, invoices, documents,
support tickets and the referral link. Accounts live in Supabase (`public.profiles`); projects, invoices,
documents, tickets and referrals live in HQ and are read by the account's email.

## Switching it on
Without `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` every cabinet page shows
«Кабинет скоро откроется» and the header and footer links are hidden. The two are public values and
`NEXT_PUBLIC_*` is baked in at build time: set them as CI variables (like `NEXT_PUBLIC_YM_ID`) or in
`.env.local` before `npm run build`. The pages read them again on each request; the layout that shows
the header link is prerendered, so changing them needs a rebuild to show or hide the link.

1. Create a Supabase project in region Singapore (ap-southeast-1).
2. Apply `supabase/migrations/0001_profiles.sql`: dashboard -> SQL editor -> paste -> Run, or with the
   CLI `supabase link --project-ref <ref>` then `supabase db push`. It creates `public.profiles`
   (RLS: a user reads, inserts and updates only their own row), the trigger on `auth.users` that fills
   the profile from the sign-up metadata, and the `hq_synced_at` column.
3. Authentication -> URL configuration: Site URL `https://firtech.pro`; Redirect URLs `https://firtech.pro/**`
   (add `http://localhost:3001/**` for development).
4. Authentication -> Providers: Email on with "Confirm email" (default). Enable Google (client id and
   secret from Google Cloud, callback = the URL Supabase shows) and Apple (Services ID, team id, key).
5. Authentication -> Email templates: translate "Confirm signup" and "Reset password" if wanted; keep
   `{{ .ConfirmationURL }}`.
6. Put the project URL and anon key into the env above. `SUPABASE_SERVICE_ROLE_KEY` is optional (server
   only): with it the cabinet button «Удалить аккаунт» deletes the auth user (the profile goes by cascade);
   without it the button creates a support ticket "Удалить аккаунт".

## Routes
- `/[locale]/cabinet` home (cards), `/cabinet/login` (tabs, Google, Apple, forgot password),
  `/cabinet/reset` (new password), `/cabinet/auth/callback` (code -> session, HQ sync, redirect).
  Logout is a server action (`logoutAction`). All are `noindex` and not in the sitemap.
- `POST /api/cabinet/tickets` `{ text }` (session required, JSON, same origin) -> `{ ok, item }`.
- `src/proxy.ts` refreshes the Supabase session on `/(ru|en)/cabinet/*`; the `/` language redirect is unchanged.

## HQ contract (header `x-admin-token: HQ_ADMIN_TOKEN`, base `HQ_ADMIN_URL`, default `http://127.0.0.1:8787/admin`)
- `POST /clients` body `{ email, name, telegram, locale, supabaseId, marketingConsent }` -> `{ ok: true }`.
  Sent once per client: after the first callback or cabinet load while `profiles.hq_synced_at` is null;
  a failure is only logged and retried on the next load. HQ should upsert by email.
- `GET /clients/by-email?email=<urlencoded>` -> `{ ok: true, client: { id, name, email, telegram, createdAt },
  projects, invoices, documents, tickets, referrals, referralSlug }` or 404 `{ ok: false, error: 'not_found' }`.
  Item shapes: `agents/docs/admin-crm-api.md`. Invoices are documents with `source: 'billing'`.
- `POST /clients/<id>/tickets` body `{ text }` -> `{ ok: true, item }`.
- Timeout 4 s. Error codes the pages translate: `hq_unreachable`, `hq_timeout`, `hq_error`, `not_found`.
  Without `HQ_ADMIN_URL` and token, development shows a mock client; production without a token shows a calm note.

## Code map
`src/lib/supabase/{config,server,client,middleware}.ts`, `src/lib/cabinet-hq.ts` (server only),
`cabinet-data.ts` (shapes, parsers, helpers), `cabinet-auth.ts` (zod, error keys, redirect origin),
`cabinet-session.ts` (user, profile, HQ sync), `src/app/[locale]/cabinet/*`, `src/components/cabinet/*`,
copy in `cabinet` (and `privacy` section `accounts`, `nav.cabinet`) of the dictionaries.
Tests: `tests/cabinet.test.mjs` (no real Supabase or HQ).

## Not done yet
- Apple and Google credentials, the Supabase project and the HQ endpoints are the owner's and the HQ builder's.
- The privacy policy says account data sits in Singapore: confirm the project region when creating it.
