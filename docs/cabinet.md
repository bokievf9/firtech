# Client cabinet (2026-11-19)

Owner decision: all client work goes through the site. A client signs up at `/<locale>/cabinet/login`
(email + password with email confirmation, or Google; Apple sign-in was dropped, owner 2026-11-21) and sees projects, invoices, documents,
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
   secret from Google Cloud, callback = the URL Supabase shows); no Apple provider.
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
- 5xx from Supabase Auth (2026-11-22, the owner saw «нет связи» with working internet when Supabase's SMTP failed with
  `500 Error sending confirmation email`): auth-js raises the same `AuthRetryableFetchError` for a dead fetch (status 0) and
  for a 5xx answer. Now status 0 = `network`, a 5xx about sending mail = `mail_down` («Сервер входа не смог отправить письмо...
  войдите через Google»), any other 5xx = `server_error` (text with the support code `AUTH-5XX`). Each 5xx is logged as
  `[cabinet] auth 5xx <status> <code>[ mail]`, no address or message text (visible in PM2). Tests: `tests/cabinet-auth.test.mjs`.
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
Since 2026-11-21 it is tabs (see the dated section below). Sections: Заявки, Проекты, Счета, Документы, Обращения, Рекомендации, Профиль. «Заявки» (`components/cabinet/leads-section.tsx`):
stage track Принято, Уточняем, КП, Договор, Оплата, В работе (`leadTrack`, `lost` = «Закрыто»), service, summary, estimate,
domain and hosting, «Что дальше» (HQ `nextStep`, else `cabinet.leads.defaultNext`), the timeline (`timelineRows`), the
manager's and client's messages and a reply box. Polls `GET /api/cabinet/leads` every 30 s while the tab is visible. No `leads`
from HQ = «Заявка принята, менеджер скоро ответит»; none yet = «Собрать проект в конструкторе» and «Заказать бесплатный аудит».

## 2026-11-21: tabs, offers, Google mark, label (owner: «удобный интерфейс с табами», «значок гугла», «больше промоушена»)
- **Tabs** (`components/cabinet/cabinet-tabs.tsx`, helpers `lib/cabinet-tabs.ts`): Обзор, Заявки, Проекты, Счета, Документы,
  Поддержка, Рекомендации, Профиль. State is `?tab=` (History API `pushState`, which Next keeps in step with `useSearchParams`,
  so the server page is not refetched); an unknown value falls back to the default. Default = Заявки when the client has
  requests or `?lead=` is present, else Обзор, so `/cabinet?lead=<id>` still opens that request. Badges: open requests (stage
  not `lost` and not `project`), unpaid invoices (`issued`), open tickets. Only the active panel is mounted, so the 30 s refresh of
  Заявки runs only while that tab is open. The bar scrolls sideways on phones with fading edges; `role="tablist"`, arrow keys,
  Home and End, `aria-selected`, `aria-controls`, active tab underlined in lime. Existing sections moved into the panels unchanged.
- **Offers** (`lib/cabinet-offers.ts`, `components/cabinet/offers.tsx`, copy `cabinet.offers`): picked from the state. No requests
  and no projects: three product cards (admin bot, receptionist, automation; price through `ProductPriceTag`, CTA opens the builder
  with the product picked) plus the free audit. A request only: audit, content subscription, automation. A project exists: content
  subscription, AI implementation, automation, and «Вторая часть проекта» while one is in work. `bundleDiscount` (pricing.ts) is 10%
  off ONE estimate from two parts, so a second project gets no discount promise: the card only says to build the second part in
  the builder. Always in Обзор: «Требует внимания» links, the referral link (`cabinetRefLink`, percent through
  `fillReferralPercent`), the guarantee line, the three newest articles (`allArticles()`, only slug, title, date go to the page),
  the status page link. Other tabs end with a slim «Предложения для вас» strip. Clicks: `OfferLink` sends Metrika goal
  `cabinet_offer` `{offer}` and the site event `cabinet_offer_click` (added to `SITE_EVENTS`; HQ's `POST /events` must learn the
  name, until then it ignores or rejects it and the site does not care).
- **Google mark** (`components/cabinet/google-mark.tsx`): inline four-colour «G», 18 px, `aria-hidden`, left of «Продолжить с Google».
- **Label**: `nav.cabinetStart` is «Личный кабинет» (RU) and «Get started» (EN) while signed out. In the header the text shows from
  `xl`; at `lg` only the icon shows (the text stays for screen readers) so the bar never crowds; the mobile menu and footer show it whole.

## 2026-11-21: payment stages in the cabinet
Owner decision: payment by stages (each stage before it starts, the last before handover; referral 10% of each paid stage).
Copy for the project stage track is `cabinet.cards.stageTrack` (`pay` «Этап {n}: оплата», `work` «Этап {n}: в работе», `accept`
«Этап {n}: приёмка»; `stageTrackLabel()` in `lib/payment-stages.ts` fills `{n}`); `cabinet.leads.defaultNext.contract` now says the
invoice is for the first stage. The track is drawn (2026-11-21) on the «Проекты» tab from `projects[].milestones[]` (`parseMilestone` in `cabinet-data.ts`: `stageNo`,
`title`, `amountUsd`, `invoiceNumber`, `payUrl` only while `awaiting_payment` and https, `paidAt`, `acceptedAt`, `state`): per stage
«оплата» with the «Оплатить этап» link, «в работе», «приёмка» with the button «Принять этап» (`accept-stage.tsx`), «принят» with the
date (`cabinet.cards.milestones`). A request in the stage `project` shows «Сейчас: Этап N: ...» when the client has exactly one running
project (`stageLineFor`; HQ does not link a project to a request, so with several projects the line is left out).
`POST /api/cabinet/projects/<pid>/milestones/<no>/accept` (session, JSON, same origin) finds the client by the session email and calls
HQ `POST /clients/<id>/projects/<pid>/milestones/<no>/accept`; 404 `not_found`, 409 `not_ready` / `not_paid` become sentences,
`already: true` is a success. The dev mock has a 3-stage project (accepted, awaiting acceptance, awaiting payment).

## Routes
- `/[locale]/cabinet` home, `/cabinet/login` (tabs, Google, forgot password; `?next=`, `?error=<key>`),
  `/cabinet/reset` (new password), `/cabinet/auth/callback`, `/cabinet/auth/confirm` (browser retry), `/cabinet/health`.
  Logout is a server action (`logoutAction`). All are `noindex` and not in the sitemap.
- `POST /api/cabinet/tickets` `{ text }`, `GET /api/cabinet/leads`, `POST /api/cabinet/leads/<id>/messages` `{ text }`,
  `POST /api/cabinet/projects/<pid>/milestones/<no>/accept`, `GET /api/cabinet/me`, `POST /api/cabinet/auth-log` (session required where it matters, JSON, same origin).
- `src/proxy.ts` refreshes the Supabase session on `/(ru|en)/cabinet/*` except the callback; the `/` language redirect is unchanged.

## HQ contract (header `x-admin-token: HQ_ADMIN_TOKEN`, base `HQ_ADMIN_URL`, default `http://127.0.0.1:8787/admin`)
- `POST /clients` body `{ email, name, telegram, locale, supabaseId, marketingConsent }` -> `{ ok: true }`.
  Sent once per client: after the first callback or cabinet load while `profiles.hq_synced_at` is null;
  a failure is only logged and retried on the next load. HQ should upsert by email.
- `GET /clients/by-email?email=<urlencoded>` -> `{ ok: true, client: { id, name, email, telegram, createdAt },
  projects, invoices, documents, tickets, referrals, referralSlug }` or 404 `{ ok: false, error: 'not_found' }`.
  Item shapes: `agents/docs/admin-crm-api.md`. Invoices are documents with `source: 'billing'`.
- `POST /clients/<id>/tickets` body `{ text }` -> `{ ok: true, item }`.
- `POST /clients/<id>/projects/<pid>/milestones/<no>/accept` -> `{ ok, already, milestone }` or 404 / 409 `not_ready` / 409 `not_paid`.
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
- Google credentials, the Supabase project and the HQ endpoints are the owner's and the HQ builder's.
- The privacy policy says account data sits in Singapore: confirm the project region when creating it.

## Кабинет v3 (2026-11-22)
Owner's words 2026-11-22: «профиль не сохраняется, ни имя, ни телеграм; зачем у них наш статус работ, лучше статус его проекта; в кабинет можно добавить больше; клиент не видит КП, договор, счёт; он ничего не подписывал; электронная подпись мышкой; чат очень неудобный: темы по каждому проекту и заявке или чат с ИИ; проект должен появляться раньше оплаты; площадка агента для тех, кому не нужен сайт».
HQ side (final contract): `agents/docs/admin-crm-api.md`, section «Кабинет v3 (2026-11-22)». The site was built against the draft first and reconciled with the final text the same day.

### Profile bug (root cause)
`updateProfileAction` ran `update(...).eq('id', ...)` WITHOUT `.select()`. Supabase answers a write that Row Level Security hides, or on a row that does not exist (the sign-up trigger missed it), with success and ZERO rows changed, so the action said «Сохранено.» and nothing was stored. Second cause: the form was uncontrolled (`defaultValue` from the server props) and the action neither revalidated the page nor returned the saved values, so React 19's automatic form reset after a form action put the OLD name and Telegram back into the fields at once (not reproduced in a browser here, it is React's documented behaviour; the zero-row write is covered by tests with a fake table). Third: HQ got the client once (`hq_synced_at`), so a changed name or Telegram never reached the CRM.
Fix: `lib/cabinet-profile.ts` (`saveProfileRow`: update, check the row count, else one upsert by id, else an error), the action revalidates `/<locale>/cabinet`, returns `saved` values, the form is controlled and takes them. CRM: a known client is updated with `POST /admin/clients/:id` (only name, telegram, locale; never the registration upsert `POST /admin/clients`, which overwrites them from sign-up data), an unknown one is registered with the saved data. Tests: `tests/cabinet-profile.test.mjs`.
**Owner, Supabase SQL editor (repairs a project where the policies are missing, safe to run again):** `supabase/migrations/0002_profiles_update.sql`:
```sql
alter table public.profiles enable row level security;
grant select, insert, update on public.profiles to authenticated;
drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own" on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
insert into public.profiles (id, email)
select u.id, lower(u.email) from auth.users u
where u.email is not null and not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;
```
Without it a missing update policy now shows the error «Не удалось сохранить профиль» instead of a false «Сохранено».

### What the cabinet is now
Tabs (`lib/cabinet-tabs.ts`, `?tab=`; old `overview|leads|invoices|support` map to `projects|projects|documents|messages`): **Проекты** (home), **Документы**, **Сообщения** (badge = unread), **Ваш агент** (only when HQ returns an agent), **Материалы**, **Рекомендации**, **Профиль**. Our office status, the «Обзор» and the offers cards of it are gone; the offers strip stays under every tab, smaller (two compact cards).
- **Home** (`components/cabinet/projects-home.tsx`, `leads-section.tsx`, view model `lib/cabinet-view.ts`): each project with its state in words (`projectStatusKey` -> `cabinet.v3.status`), the ONE big button (`next-action.tsx`, `actionControl` in `lib/cabinet-docs.ts`): accept the proposal / sign the contract open the document viewer on that document (`?tab=documents&doc=<id>`, the client reads first), pay a stage opens the pay page, accept a stage is done in place, `wait` is a calm line (HQ `nextAction.text`, e.g. «Ждём вас на созвоне»). Then the stage track (`stageRows`) or, before payment, the road to the start (`prepSteps`: КП, договор, подпись, оплата этапа 1, в работе). Requests that are not projects follow (a request whose documents link it to a project is hidden). Then recent documents and the last messages of the three latest threads. The page re-reads the server every minute while visible (`RefreshWhileVisible`).
- **Документы** (`documents-panel.tsx`, `signature-pad.tsx`): list (waiting for the client first) and viewer; the PDF is an iframe of `GET /api/cabinet/documents/<id>/file` (session check, the document must be in THIS client's list, HQ's signed link never reaches the browser, `X-Frame-Options: SAMEORIGIN` for that route in `next.config.ts`), download, «Принять КП» (`POST .../accept`), «Подписать» opens the pad, «Оплатить» opens the pay link. States: ждёт вас, принято, ждёт подписи, подписано, выставлен, оплачен (an `other` estimate or `act` with `issued` reads «Получен»). Signature pad: canvas with Pointer Events (mouse, finger, pen; `touch-action: none`), clear, name prefilled from the profile, consent checkbox with the sentence, strokes kept relative to the width and exported as a transparent PNG 800 px wide (smaller if it would pass 200 KB); `buildSignaturePayload` and the route re-check PNG, size, name, consent; the route adds IP (`visitorIp`) and user agent for HQ.
- **Сообщения** (`messages-panel.tsx`, `thread-pane.tsx`): thread list (request, project, support, agent) with unread badges, the conversation, composer (Enter sends, Shift+Enter breaks the line, no send while an input method composes), attachments, optimistic sending with retry, «Доставлено» / «Прочитано» on the last own message, the open thread refreshes every 15 s while the page is visible (`?after=`), the list too, the tab badge every 30 s. `?ref=lead-12|project-4` opens that thread. The old reply box of the request card is a link to its thread. No support thread from HQ: a button opens the old ticket form.
- **Ваш агент** (`agent-panel.tsx`): chat with the agent in its own thread (`agent-<id>`, HQ answers in the same POST as `reply`), settings (name, tone, languages), channels (web chat always on, Telegram, site widget read-only), «Подключить Telegram» with a masked token field (`/api/cabinet/agent/telegram`, the token goes to HQ only and is never logged, echoed or returned), usage today and the latest conversations.
- **Материалы** (`materials-panel.tsx`): label (logo, texts, access, photos, other) + file, uploaded into the project thread (else the request's), list of the client's own uploads.

### Assumptions and reconciliation with the HQ contract
Final contract, all applied: lists are `{ ok, items }` (parsers also accept a bare array); thread ids are strings (`lead-12`, `project-4`, `support`, `agent-5`); message ids are whole numbers (`?after=` is dropped otherwise); no `htmlUrl` (the HTML viewer is removed, PDF only); signature refusals 409 `not_awaiting` and 422 `bad_signature` with `reason` (`blank` -> «нарисуйте подпись», `too_large`, `not_png`/`bad_size` -> «подпись не принята»); `nextAction` on projects and leads (the object form of `nextStep` is read too); the project exists from the owner's КП approval (`preparing`, «Готовим договор») and the `other` «Смета» arrives next to the quote; uploads are JSON `{ name, dataBase64 }` to `POST /clients/:id/uploads`, then the id goes into `POST .../threads/:tid/messages { text, attachments: [id] }` (no multipart, the site reads the file and forwards it, 10 MB, png jpg jpeg webp pdf docx zip txt md csv, gif removed from the draft list); agent PATCH accepts only `name`, `tone`, `languages`, `channels.telegram` (`{botToken}` or `null`), `channels.siteWidget` (`null`), NOT `channels.web` (HQ answers 400, so the site never sends it); the agent row has `usageToday.messages` only (no monthly count), conversations have `channel` `cabinet|widget` and `leadsCaptured`, no preview text; HQ cannot start the Telegram channel yet (token only stored), so the copy says we start the bot after a check.
Assumptions that are the site's own (check them against HQ when it is live):
- The file label has no HQ field: the site writes `[logo]` (or `[texts]`, `[access]`, `[photos]`, `[other]`) as the message text and reads it back (`LABEL_TAG`); HQ shows «(вложение)» for a file-only message, hidden by the site.
- `pdfUrl` and attachment links are signed `https://<public host>/media/<sig>/<path>?e=<unix>` links. The proxy (`resolveMediaUrl`, `lib/cabinet-media.ts`) uses ONLY the path and query of a `/media/` link and requests them on the origin of `HQ_ADMIN_URL` (so `/media/` must be served by HQ's own port, as nginx does for the public host), never the host written in a link. A link with `url: null` is listed without a link.
- Client id: the by-email lookup is cached per email for 5 minutes (`cabinet-api.ts`); only the id.
- The messenger's support fallback uses the old `POST /api/cabinet/tickets`.
- Old HQ without v3: documents and threads fail softly; the «Документы» tab then lists the legacy invoices and documents (no viewer), «Ваш агент» is hidden.
Env: nothing new. nginx: `/api/cabinet/uploads` has `client_max_body_size 12m` in `infra/nginx/firtech.conf` (copy it to the server, the rest stays 1m); HQ's body limit for uploads is 14 MB, for `sign` 330 KB.
Not in the site (HQ decisions): emails to the client (HQ sends them, link `<SITE_URL>/<ru|en>/cabinet`), the clarifying questions before the quote, Telegram channel of the agent, bookings in the agent (stub in HQ).

### Dev mock
Without `HQ_ADMIN_URL` and `HQ_ADMIN_TOKEN` (development) `cabinet-hq.ts` answers from `cabinet-hq-mock.ts`, kept on `globalThis`: a client with a running project (3 stages), a project waiting for a signature, a request with a quote to accept, seven documents (accept creates the contract, signing creates the invoice), five threads, a demo agent «Мила» that answers from a few canned rules, uploads (no file content), a generated one-page PDF for the viewer. Both layers are covered by `tests/cabinet-v3.test.mjs`; the components are rendered in `tests/cabinet-stage-render.test.mjs`; the signed-out gate is in `tests/e2e/flows.spec.ts`.

## Профиль и уведомления (2026-11-22, пункты 10 и 11 ревью владельца)
Владелец: «галочка „Присылать новости и акции“ ... нажимаю, сохраняю, и она убирается. После этого нужно добавить кнопку „не получать рекомендации“ и т.д., и чтобы они переключались»; «профиль какой-то неудобный, сделай его более удобным».

### Настоящая причина бага с галочкой
Значение СОХРАНЯЛОСЬ (воспроизведено на фейковом Supabase: после «Сохранить» в базе `marketing_consent = true`, а галочка на экране снята). Форма профиля была React form action. После action React 19 вызывает `form.reset()`, и каждое поле возвращается к своему значению ПО УМОЛЧАНИЮ. У управляемого текстового поля React держит умолчание в такт значению (атрибут `value`), поэтому имя и Telegram после прошлого фикса остались на месте; у управляемого чекбокса `defaultChecked` React не обновляет никогда (`updateInput` в react-dom трогает его только без `checked`), он остаётся тем, что было при первом рендере (выкл). Итог: сразу после «Сохранить» галочка гасла, а следующее сохранение отправляло «выкл» уже по-настоящему. Плюс HQ не узнавал об изменении: обновление CRM несло только имя, Telegram и язык.
Исправление: в профиле больше нет form action. Каждое поле сохраняется само через `POST /api/cabinet/profile` (патч), ответ это строка, прочитанная обратно из базы (`update().eq().select(все колонки)`), и экран показывает её. Ошибка видна рядом с полем (`ErrorNote`, причина и «Повторить»), переключатель откатывается. Последний сохранённый профиль держится в модуле `profile-panel.tsx`, поэтому после смены вкладки видно свежее состояние.
Коды ошибок (`lib/errors.ts`): `save_denied` 403 (RLS: нет прав или политики, 42501, или строка невидима), `profile_outdated` 503 (миграция 0003 не применена: 42703 / PGRST204), `timeout` 504 (Supabase не ответил за 8 с), `save_failed` 500, `telegram_invalid`, `phone_invalid`, `website_invalid`, `niche_invalid` 400, `telegram_required` 409.

### Что теперь на вкладке «Профиль»
Слева разделы (на телефоне строка чипов), справа карточки (`components/cabinet/profile-panel.tsx`, `profile-security.tsx`, логика `lib/cabinet-profile.ts`):
- **Вы**: имя, почта (только чтение, «меняется через письмо» ведёт в «Безопасность»), Telegram, телефон, язык писем и документов.
- **Компания**: название, ниша из списка сборки (`kindCatalog` по категориям), сайт (нормализуется в `https://`), город.
- **Для документов** (плашка «Используется в договоре и счёте»): имя или юрлицо для договора, адрес, кошелёк для возврата по гарантии. Имя для договора подставляется в подпись документа, если заполнено.
- **Уведомления**: «Письма о проекте» всегда включены (замок), переключатели «Новости и акции» (`marketing_consent`) и «Рекомендации по вашему бизнесу» (`recommendations_consent`, по умолчанию ВЫКЛ, как и новости: согласие, а не отписка; поменять умолчание = решение владельца), канал Почта / Telegram / оба (`notify_channel`, Telegram доступен только с ником; если ник стереть, канал сам возвращается на почту).
- **Безопасность**: смена пароля (с текущим паролем; аккаунт только с Google задаёт первый пароль без него), смена почты письмом Supabase (`updateUser({email})`, ссылка возвращается через обычный callback), «Выйти на всех устройствах» (`signOut({scope:'global'})`), удаление аккаунта после ввода слова УДАЛИТЬ / DELETE (проверяется и на сервере).
Текстовое поле сохраняется при выходе из него или по Enter, выбор и переключатели сразу. Пока миграции 0003 нет, страница пишет «Часть полей заработает после обновления базы», а имя, Telegram, язык и новости сохраняются как раньше (чтение профиля откатывается на старые колонки).

### Отписка по ссылке из письма
`/<locale>/cabinet/unsubscribe?token=<token>`, без входа. Токен (`lib/unsubscribe.ts`): `<base64url(id пользователя Supabase)>.<поле>.<подпись>`, поле `marketing` или `recommendations`, подпись = base64url(HMAC-SHA256(`UNSUBSCRIBE_SECRET`, `"unsub:v1:<id>:<поле>"`)), без срока (старое письмо тоже работает). Открытие страницы ничего не меняет (почтовые сканеры ходят по ссылкам), выключает кнопка «Отписаться» (POST). Для почтовых клиентов есть one-click `POST /api/cabinet/unsubscribe?token=` (RFC 8058). Пишет через service role (`SUPABASE_SERVICE_ROLE_KEY`), затем шлёт профиль в HQ. Без `UNSUBSCRIBE_SECRET` (16+ знаков) или service key страница отправляет в настройки кабинета.

### Владельцу: SQL в Supabase (SQL editor, безопасно повторять)
`supabase/migrations/0003_profile_prefs.sql`: десять колонок с умолчаниями (`recommendations_consent`, `notify_channel`, `phone`, `company`, `niche`, `website`, `city`, `legal_name`, `legal_address`, `refund_wallet`), проверка канала и длин, те же права и политика обновления своей строки, что в 0002. Если 0002 ещё не применяли, сначала 0002. И в `shared/.env.production` на сервере добавить `UNSUBSCRIBE_SECRET` (тот же у HQ).

### Синхронизация с HQ
После каждого сохранения (в `after`, ответ клиенту не ждёт) `syncProfileToHq` (`lib/cabinet-profile-server.ts`): известный клиент получает `POST /admin/clients/:id` с телом `hqProfileBody` (все поля профиля), неизвестный регистрируется `POST /admin/clients` (`clientSyncBody` теперь несёт ещё `recommendationsConsent`, `notifyChannel`, `phone`, `company`). HQ сегодня читает `name`, `telegram`, `phone`, `company`, `locale` и молча отбрасывает остальное (zod без strict), ничего не ломается.

### Нужно от HQ (агенты, `apps/hq/src/admin-crm.ts`)
1. **`POST /admin/clients/:id` принимает новые поля** (сейчас `profilePatch` их отбрасывает, в том числе согласие на новости, то есть отписка в кабинете до CRM не доходит): `marketingConsent: boolean`, `recommendationsConsent: boolean`, `notifyChannel: 'email'|'telegram'|'both'`, `niche: string` (id ниши сборки, до 40), `website: string` (до 200, `https://...`), `city` (до 80), `legalName` (до 160), `legalAddress` (до 300), `refundWallet` (до 120). Пустая строка очищает, как у остальных. В ответ `client` с этими полями.
2. **`POST /admin/clients` (регистрация)** принимает `recommendationsConsent`, `notifyChannel`, `phone`, `company` (сайт уже шлёт).
3. **Рассылки уважают настройки**: новости и акции только при `marketingConsent`, рекомендации только при `recommendationsConsent`; письма о проекте всегда, по каналу `notifyChannel` (Telegram только если клиент связан с ботом, иначе почта).
4. **Ссылка «Отписаться» в каждом письме новостей и рекомендаций**: `https://firtech.pro/<locale>/cabinet/unsubscribe?token=<token>` по формуле выше с общим секретом `UNSUBSCRIBE_SECRET` (`supabaseId` клиента уже есть в `cab_clients`), плюс заголовки `List-Unsubscribe: <https://firtech.pro/api/cabinet/unsubscribe?token=<token>>` и `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
5. **Данные для документов**: подставлять `legalName` и `legalAddress` в договор, счёт и акт (если пусто, имя клиента), `refundWallet` показывать владельцу при возврате по гарантии.
6. **Смена почты**: когда клиент меняет почту в Supabase, сайт продолжает искать его в HQ по старой почте из `profiles.email`. Нужен `email` в `POST /admin/clients/:id` (или поиск по `supabaseId`: `GET /admin/clients/by-supabase/:id`), тогда сайт будет обновлять почту в CRM после подтверждения.

### Тесты
`tests/cabinet-profile.test.mjs` (патч, запись с чтением обратно на фейковой таблице: успех, нет строки, скрытая строка, RLS 42501, таймаут, старая схема; тело HQ; токен отписки; миграция), `tests/cabinet-stage-render.test.mjs` (панель профиля в разметке), e2e `tests/e2e/profile.spec.ts` против фейкового Supabase `tests/e2e/fake-supabase.mjs` (поднимается вторым webServer в `playwright.config.ts`; куки сессии `fakeSessionCookie()` в `helpers.ts`): переключатель держится после сохранения и перезагрузки, поле сохраняется при выходе, отказ базы откатывает и объясняет, канал Telegram, 390 px без горизонтального скролла, отписка по ссылке. Фейк годится и для ручной проверки: `FAKE_SUPABASE_PORT=3106 node tests/e2e/fake-supabase.mjs`, сайт с `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3106`, куки из `sessionCookie()`.

## 2026-11-23: the site under HQ's new contracts (agents «Деньги и документы», «Клиент заметит»)
Контракты HQ: `agents/docs/admin-crm-api.md`, разделы «Деньги и документы: разрывы процессов» и «Клиент заметит» (ветка сайта `site-hq-contracts`).
- **Письмо «новое сообщение»**: ссылка `/<locale>/cabinet?thread=<тред>` открывает вкладку «Сообщения» и этот тред (`threadByParam` в `lib/cabinet-chat.ts`: сначала точный id, потом форма `?ref=lead-12`); без `?tab=` вкладка «Сообщения» выбирается сама (`CabinetTabs`). Без параметра ничего не меняется.
- **Отзыв** (`?review=<projectId>`, ссылка письма «Как вам работа с Fir Tech?»): карточка в начале вкладки «Проекты» (`components/cabinet/review-card.tsx`, правила `lib/cabinet-review.ts`): оценка 1-5 звёздами, текст до 2000 знаков, `POST /api/cabinet/reviews {projectId, rating, text}` (сессия, Origin) -> HQ `POST /admin/clients/:id/reviews`. После отправки благодарность и реферальная ссылка клиента (`cabinetRefLink`, процент из живого прайса). 409 `exists` читается так: «Отзыв по этому проекту уже отправлен»; 404 (чужой проект) и 400 тоже словами.
- **КП: отклонить или обсудить**. Состояния `declined` («Отклонено») и `expired` («Срок истёк») знают парсер, список, метки и подсказка «что дальше» (`docs.hint.declined|expired`: ответ у менеджера, он напишет в сообщениях; срок истёк: напишите, обновим), кнопок у них нет. У КП `awaiting_client` рядом с «Принять КП» кнопка «Отклонить или обсудить»: форма (режим `discuss` по умолчанию или `decline`, причина 1..1000) -> `POST /api/cabinet/documents/:id/reject` -> HQ `POST /admin/clients/:id/documents/:docId/reject {reason, mode}`; 409 `not_awaiting` = «документ уже обработан». `deliveredAt: null` показывается строкой «Документ уже здесь, письмо о нём готовим» (только у настоящих документов v3).
- **Демо на ваших данных**: `/<locale>/demo/<publicId>?k=<ключ>` (noindex, без входа). Страница `app/[locale]/demo/[publicId]`, чат `components/demo-chat.tsx`, разбор ответов `lib/demo-chat.ts`. Браузер шлёт `POST /agent/<publicId>/chat {demoKey, text, conversationId}` на тот же хост: nginx проксирует `/agent/` на HQ (`infra/nginx/firtech.conf`, блок `location ^~ /agent/`, **владелец копирует файл на сервер и перезагружает nginx**, как с `/media/`). Лимит демо показывается по ответу HQ (читаются `limit` и `remaining` или `usage: {limit, used}`: HQ пока не назвал полей, TODO(agents) уточнить), 429 `limit_reached` закрывает поле и говорит про лимит на сегодня, 401 = «ссылка демо не подошла». Без `?k=` страница объясняет, что ключа нет. Для разработки без HQ `app/agent/[publicId]/chat/route.ts` отвечает как демо (ключ `demo-key-0001`, пять сообщений), в production он отвечает 404, настоящий маршрут туда ставит nginx.
- Тесты: `tests/hq-contracts.test.mjs` (юнит), `tests/e2e/hq-contracts.spec.ts` (cabinet и demo, кабинет под входом через `fakeSessionCookie`).

