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

## Sign-in (reworked 2026-11-20 after «вход тупо не работает»)
Symptom: Google login ended on «Ссылка устарела», the log said `code exchange failed { code: 'flow_state_not_found',
status: 404, hasVerifier: true }`. OAuth used to start in a server action. Now:
- **Google starts in the browser** (`components/cabinet/oauth-button.tsx`, browser client from `lib/supabase/client.ts`,
  `prompt=select_account`). The PKCE verifier cookie is written by the same browser and cookie code that later comes back.
  auth-js 2.119 keeps one verifier slot per flow (`...-auth-token-flow-<id>-code-verifier`) and adds `sb_flow_id` to the
  redirect URL; the server exchange used to ignore it and read the legacy key, which holds the *latest* flow's verifier
  (a second click, a second tab, a server-action replay all overwrite it).
- **Callback** (`auth/callback/route.ts`) passes `sb_flow_id` as `flowId` to `exchangeCodeForSession`, accepts
  `token_hash` + `type` (`verifyOtp`, no verifier, works on any device), buffers the cookies and writes them only on a
  successful answer (a failed attempt no longer deletes the verifier), and on failure redirects to `/cabinet/auth/confirm`,
  which retries the exchange in the browser and then goes on to `next`. An expired link or a cancelled Google login goes
  straight to the login page with its own sentence. A sign-up confirmation that cannot open a session says «Почта
  подтверждена, войдите с паролем».
- `src/proxy.ts` does not touch cookies on the callback path and marks every cabinet answer `private, no-store`. Cookie
  options are shared (`authCookieOptions`: path `/`, `lax`, `secure` in production) by server, proxy and browser clients.
- Email + password stay server actions (`actions.ts`): sign-up shows «Проверьте почту» with the address and
  «Отправить письмо ещё раз» (`resendAction`) with the note that Supabase's own mail sends at most two letters an hour;
  sign-in with an unconfirmed address offers the same button. `stay=1` (inline forms) answers `signed_in` instead of
  redirecting; `next` (`safeNextPath`: a path of this locale only) is where email links and Google return.
- Every Supabase error code maps to a RU/EN sentence (`authErrorKey`, `cabinet.auth.errors`); the raw code goes to the
  server log only (`[cabinet] auth error {where, code, status}`), browser-side ones through `POST /api/cabinet/auth-log`.
- `/[locale]/cabinet/health` (noindex): yes/no for Supabase URL, anon key, service key, site URL, HQ token, HQ reachable
  (`pingHq`), lead hand-off. Never a value.
- Recommended Supabase email templates (owner, dashboard): confirmation link
  `{{ .SiteURL }}/ru/cabinet/auth/callback?token_hash={{ .TokenHash }}&type=signup&flow=signup`, reset
  `...&type=recovery&flow=reset&next=/ru/cabinet/reset`. Then a link opened in another browser works too. Supabase's built-in
  SMTP sends 2 letters an hour and only to the project team's addresses; set a custom SMTP for real clients.
- The cabinet link in header and footer reads «Начать» / «Get started» while signed out, «Кабинет» / «Cabinet» with a session
  (`CabinetNavLabel`, from the session cookie); the login page title is «Начало работы» / «Get started».

## Leads need an account (owner 2026-11-20)
- `/api/lead` (contact form, builder hand-off, PDF estimate) and `/api/audit` answer 401 `auth_required` without a session
  (`leadGate` in `lib/lead-identity.ts`; open while the cabinet is not configured). They send HQ `clientEmail`, `cabinetId`
  (Supabase user id), `clientName`; the Telegram card shows «Аккаунт». HQ's `leadId` (awaited at most 3 s) becomes the redirect
  `/<locale>/cabinet?lead=<leadId>` (else `lead=new`), plus `follow=<siteLeadId>.<token>` for the Telegram follow link.
- Forms show an inline compact sign-in (`LeadAuthStep`) on submit while signed out; the draft goes to localStorage
  (`lib/lead-draft.ts`, 24 h, sessionStorage fallback; localStorage because the confirmation link opens a new tab) and comes
  back on `draft=1`. Sign-in on the page sends at once; after Google or email confirmation it is one click «Отправить».
- Chat: anyone may chat; a contact typed while signed out is not forwarded (`wouldCreateLead`), the answer has
  `authRequired: true` and the panel shows the sign-in; signed in, one tap «Отправить заявку как <email>». HQ gets the identity
  with every message of a signed-in visitor. `leadCreated` adds «Открыть кабинет».
- `GET /api/cabinet/me` (`{enabled, signedIn, email, name, telegram}`) feeds the forms.

## Cabinet home
Order: Заявки, Проекты, Счета, Документы, Обращения, Рекомендации, Профиль. «Заявки» (`components/cabinet/leads-section.tsx`):
stage track Принято, Уточняем, КП, Договор, Оплата, В работе (`leadTrack`, `lost` = «Закрыто»), service, summary, estimate,
domain and hosting, «Что дальше» (HQ `nextStep`, else `cabinet.leads.defaultNext`), the timeline (`timelineRows`), the
manager's and client's messages and a reply box. Polls `GET /api/cabinet/leads` every 30 s while the tab is visible. No `leads`
from HQ = «Заявка принята, менеджер скоро ответит»; none yet = «Собрать проект в конструкторе» and «Заказать бесплатный аудит».

## Routes
- `/[locale]/cabinet` home, `/cabinet/login` (tabs, Google, forgot password; `?next=`, `?error=<key>`),
  `/cabinet/reset` (new password), `/cabinet/auth/callback`, `/cabinet/auth/confirm` (browser retry), `/cabinet/health`.
  Logout is a server action (`logoutAction`). All are `noindex` and not in the sitemap.
- `POST /api/cabinet/tickets` `{ text }`, `GET /api/cabinet/leads`, `POST /api/cabinet/leads/<id>/messages` `{ text }`,
  `GET /api/cabinet/me`, `POST /api/cabinet/auth-log` (session required where it matters, JSON, same origin).
- `src/proxy.ts` refreshes the Supabase session on `/(ru|en)/cabinet/*` except the callback; the `/` language redirect is unchanged.

## HQ contract (header `x-admin-token: HQ_ADMIN_TOKEN`, base `HQ_ADMIN_URL`, default `http://127.0.0.1:8787/admin`)
- `POST /clients` body `{ email, name, telegram, locale, supabaseId, marketingConsent }` -> `{ ok: true }`.
  Sent once per client: after the first callback or cabinet load while `profiles.hq_synced_at` is null;
  a failure is only logged and retried on the next load. HQ should upsert by email.
- `GET /clients/by-email?email=<urlencoded>` -> `{ ok: true, client: { id, name, email, telegram, createdAt },
  projects, invoices, documents, tickets, referrals, referralSlug }` or 404 `{ ok: false, error: 'not_found' }`.
  Item shapes: `agents/docs/admin-crm-api.md`. Invoices are documents with `source: 'billing'`.
- `POST /clients/<id>/tickets` body `{ text }` -> `{ ok: true, item }`.
- `by-email` also returns `leads: [{ id, createdAt, service, summary, estimateUsd, hasDomain, hasHosting, stage, nextStep,
  timeline: [{ at, kind, title }], replies: [{ at, text, from: 'manager'|'client' }] }]` (agents b313a11); the site tolerates
  its absence.
- `POST /clients/<id>/leads/<leadId>/messages` body `{ text }` -> `{ ok: true, item: { at, text, from } }` (404 foreign lead,
  429 over 10 an hour).
- Lead Intake `POST /lead` reads `clientEmail`, `cabinetId`, `clientName` and answers `{ ok, id, leadId }`.
- Timeout 4 s. Error codes the pages translate: `hq_unreachable`, `hq_timeout`, `hq_error`, `not_found`.
  Without `HQ_ADMIN_URL` and token, development shows a mock client; production without a token shows a calm note.

## Code map
`src/lib/supabase/{config,server,client,middleware}.ts`, `src/lib/cabinet-hq.ts` (server only),
`cabinet-data.ts` (shapes, parsers, helpers), `cabinet-auth.ts` (zod, error keys, redirect origin),
`cabinet-session.ts` (user, profile, HQ sync), `src/app/[locale]/cabinet/*`, `src/components/cabinet/*`,
copy in `cabinet` (and `privacy` section `accounts`, `nav.cabinet`) of the dictionaries.
Plus `lead-identity.ts`, `lead-session.ts`, `lead-draft.ts`, `cabinet-client.ts`, `cabinet-health.ts`.
Tests: `tests/cabinet.test.mjs`, `cabinet-auth.test.mjs`, `cabinet-leads.test.mjs`, `cabinet-process.test.mjs` (no real
Supabase or HQ). Browser smoke (not in `npm test`): `node scripts/smoke-cabinet.mjs` (see the script head).

## 2026-11-21: Google sign-in 502 on the callback
- Cause (from production logs): nginx answered 502 «upstream sent too big header» on `/cabinet/auth/callback`. The request
  already carried 7 stale `*-code-verifier` cookies (one per sign-in attempt, `appendPkceFlowIdToRedirects`; nothing removed
  them), and the successful exchange added the chunked session cookies (several KB for Google), over nginx's 4k
  `proxy_buffer_size`. The exchange itself worked.
- Cookie cleanup: the callback expires every `*-code-verifier` cookie the exchange did not just write (success, and terminal
  failures; not the redirect to `/cabinet/auth/confirm`, which needs the current one). The browser removes old verifiers
  before `signInWithOAuth` and before sign-up, resend and reset-request forms (`src/lib/auth-cookies.ts`). The callback log
  has `cookieBytes` (size of the Cookie header, never values).
- nginx (`infra/nginx`, must be copied to the server, see its README): `proxy_buffer_size 32k; proxy_buffers 8 32k;
  proxy_busy_buffers_size 64k;` in the snippet, `large_client_header_buffers 4 32k;` in the site. Also `/api/admin/` got its
  own zone `firtech_admin` (600r/m, burst 100) because the owner panel polling hit the 10r/m limit with 503 bursts.

## Not done yet
- Apple and Google credentials, the Supabase project and the HQ endpoints are the owner's and the HQ builder's.
- The privacy policy says account data sits in Singapore: confirm the project region when creating it.
