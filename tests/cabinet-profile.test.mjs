// Profile save (2026-11-22): «профиль не сохраняется» and owner item 10 «галочка "Присылать новости и акции"
// ... сохраняю, и она убирается», then item 11 (sections, notifications, unsubscribe links). The patch parser,
// the verified write against a fake Supabase table that behaves like RLS, timeouts and the old schema,
// the HQ body, the unsubscribe token and the migration.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const profile = await import('../src/lib/cabinet-profile.ts')
const unsub = await import('../src/lib/unsubscribe.ts')
const errors = await import('../src/lib/errors.ts')
const read = (f) => readFileSync(path.resolve(f), 'utf8')

const UID = '00000000-0000-4000-8000-0000000000e2'
const NICHES = ['salon', 'clinic', 'other']

// A `profiles` table: rows by id. `rls: 'hide'` = the update policy is missing and PostgREST changes zero
// rows silently, `rls: 'deny'` = the grant is missing (42501), `fail` = another database error,
// `hang` = Supabase never answers, `legacy` = migration 0003 not run (new columns unknown).
function fakeClient({ rows = {}, rls = 'ok', fail = false, hang = false, legacy = false } = {}) {
  const calls = []
  const answer = (data, error = null) => ({ then: (ok) => (hang ? new Promise(() => {}) : Promise.resolve(ok({ data, error }))) })
  const newCols = profile.NEW_PROFILE_COLUMNS.split(',')
  const unknown = (keys) => legacy && keys.some((k) => newCols.includes(k))
  const pick = (row, cols) => Object.fromEntries(cols.split(',').map((c) => [c, row[c] ?? null]))
  const write = (kind, id, values, cols) => {
    calls.push([kind, id, values, cols])
    if (fail) return answer(null, { code: 'XX000', message: 'boom' })
    if (unknown([...Object.keys(values), ...cols.split(',')])) return answer(null, { code: '42703', message: 'column profiles.phone does not exist' })
    if (rls === 'deny') return answer(null, { code: '42501', message: 'permission denied for table profiles' })
    return null
  }
  return {
    calls,
    rows,
    from(table) {
      assert.equal(table, 'profiles')
      return {
        update(values) {
          return {
            eq(_col, id) {
              return {
                select(cols) {
                  const early = write('update', id, values, cols)
                  if (early) return early
                  if (rls === 'ok' && rows[id]) {
                    rows[id] = { ...rows[id], ...values, updated_at: '2026-11-22T10:00:00Z' }
                    return answer([pick(rows[id], cols)])
                  }
                  return answer([])
                },
              }
            },
          }
        },
        insert(values) {
          return {
            select(cols) {
              const early = write('insert', values.id, values, cols)
              if (early) return early
              if (rls === 'hide') return answer([])
              rows[values.id] = { ...values, updated_at: '2026-11-22T10:00:00Z' }
              return answer([pick(rows[values.id], cols)])
            },
          }
        },
      }
    },
  }
}

const user = { id: UID, email: 'Anna@Example.com' }

test('parseProfilePatch: every field, normalised; unknown keys and wrong types refused', () => {
  const ok = profile.parseProfilePatch(
    { name: '  Анна  ', telegram: 't.me/anna_salon', phone: '+992 900 12-34-56', website: 'lotus.tj', niche: 'salon', marketing: true, notifyChannel: 'both', city: ' Душанбе ' },
    NICHES,
  )
  assert.deepEqual(ok, {
    ok: true,
    patch: { name: 'Анна', telegram: '@anna_salon', phone: '+992 900 12-34-56', website: 'https://lotus.tj', niche: 'salon', marketing: true, notifyChannel: 'both', city: 'Душанбе' },
  })
  assert.deepEqual(profile.parseProfilePatch({ telegram: 'ab' }, NICHES), { ok: false, error: 'telegram_invalid', field: 'telegram' })
  assert.deepEqual(profile.parseProfilePatch({ phone: '12' }, NICHES), { ok: false, error: 'phone_invalid', field: 'phone' })
  assert.deepEqual(profile.parseProfilePatch({ website: 'not a site' }, NICHES), { ok: false, error: 'website_invalid', field: 'website' })
  assert.deepEqual(profile.parseProfilePatch({ niche: 'spaceship' }, NICHES), { ok: false, error: 'niche_invalid', field: 'niche' })
  assert.deepEqual(profile.parseProfilePatch({ marketing: 'on' }, NICHES), { ok: false, error: 'invalid', field: 'marketing' })
  assert.deepEqual(profile.parseProfilePatch({ email: 'x@y.z' }, NICHES), { ok: false, error: 'invalid' })
  assert.deepEqual(profile.parseProfilePatch({}, NICHES), { ok: false, error: 'invalid' })
  assert.deepEqual(profile.parseProfilePatch({ name: 'x'.repeat(81) }, NICHES), { ok: false, error: 'invalid', field: 'name' })
  assert.deepEqual(profile.parseProfilePatch({ notifyChannel: 'sms' }, NICHES), { ok: false, error: 'invalid', field: 'notifyChannel' })
  // Cleared fields are allowed and stored as null.
  assert.deepEqual(profile.parseProfilePatch({ telegram: '', website: '', niche: '' }, NICHES), { ok: true, patch: { telegram: '', website: '', niche: '' } })
  assert.deepEqual(profile.patchToColumns({ telegram: '', marketing: false, notifyChannel: 'email', legalName: 'ИП Анна' }), {
    telegram: null,
    marketing_consent: false,
    notify_channel: 'email',
    legal_name: 'ИП Анна',
  })
})

test('Telegram channel needs a nick; clearing the nick moves the channel back to email', () => {
  assert.deepEqual(profile.reconcileChannel({ notifyChannel: 'telegram' }, { telegram: '', notifyChannel: 'email' }), { ok: false, error: 'telegram_required' })
  assert.deepEqual(profile.reconcileChannel({ notifyChannel: 'both' }, { telegram: '@anna_salon', notifyChannel: 'email' }), { ok: true, patch: { notifyChannel: 'both' } })
  assert.deepEqual(profile.reconcileChannel({ telegram: '' }, { telegram: '@anna_salon', notifyChannel: 'both' }), { ok: true, patch: { telegram: '', notifyChannel: 'email' } })
})

test('item 10: the newsletter switch is saved and the answer is the row READ BACK from the database', async () => {
  const db = fakeClient({ rows: { [UID]: { id: UID, email: 'anna@example.com', name: 'Анна', marketing_consent: false } } })
  const r = await profile.saveProfilePatch(db, user, { marketing: true })
  assert.equal(r.ok, true)
  assert.equal(r.profile.marketing, true)
  assert.equal(r.profile.name, 'Анна')
  assert.equal(r.profile.updatedAt, '2026-11-22T10:00:00Z')
  assert.equal(db.rows[UID].marketing_consent, true)
  // Only the changed column is written; every column is read back.
  assert.deepEqual(db.calls[0][2], { marketing_consent: true })
  assert.equal(db.calls[0][3], profile.PROFILE_COLUMNS)
  const back = await profile.saveProfilePatch(db, user, { recommendations: true, notifyChannel: 'email' })
  assert.equal(back.ok && back.profile.marketing, true, 'a later save does not drop the stored switch')
})

test('missing row: one insert creates it (never an upsert, which needs UPDATE on email); a hidden row (no update policy) is a failure, never «saved»', async () => {
  const created = fakeClient({ rows: {} })
  const r = await profile.saveProfilePatch(created, user, { name: 'Анна' })
  assert.equal(r.ok && r.created, true)
  assert.equal(created.rows[UID].email, 'anna@example.com')
  assert.deepEqual(created.calls.map((c) => c[0]), ['update', 'insert'])
  const hidden = fakeClient({ rows: { [UID]: { id: UID } }, rls: 'hide' })
  assert.deepEqual(await profile.saveProfilePatch(hidden, user, { marketing: true }), { ok: false, reason: 'no_row' })
  assert.deepEqual(hidden.rows[UID], { id: UID })
})

test('RLS error, other error, timeout and old schema each give their own reason and route code', async () => {
  const rows = () => ({ [UID]: { id: UID, email: 'anna@example.com' } })
  const denied = await profile.saveProfilePatch(fakeClient({ rows: rows(), rls: 'deny' }), user, { marketing: true })
  assert.deepEqual(denied, { ok: false, reason: 'rls' })
  assert.deepEqual(profile.SAVE_ERRORS.rls, { code: 'save_denied', status: 403 })
  assert.deepEqual(await profile.saveProfilePatch(fakeClient({ rows: rows(), fail: true }), user, { marketing: true }), { ok: false, reason: 'error' })
  const started = Date.now()
  const slow = await profile.saveProfilePatch(fakeClient({ rows: rows(), hang: true }), user, { marketing: true }, { timeoutMs: 50 })
  assert.deepEqual(slow, { ok: false, reason: 'timeout' })
  assert.ok(Date.now() - started < 1000)
  assert.deepEqual(profile.SAVE_ERRORS.timeout, { code: 'timeout', status: 504 })
  // Migration 0003 not run: a new field is refused as `schema`, the old ones still save in legacy mode.
  const old = fakeClient({ rows: rows(), legacy: true })
  assert.deepEqual(await profile.saveProfilePatch(old, user, { phone: '+992900123456' }), { ok: false, reason: 'schema' })
  const legacy = await profile.saveProfilePatch(old, user, { marketing: true }, { legacy: true })
  assert.equal(legacy.ok && legacy.profile.marketing, true)
  assert.equal(profile.legacyOnly({ marketing: true, name: 'A' }), true)
  assert.equal(profile.legacyOnly({ recommendations: true }), false)
  // Every route code has a sentence in both languages.
  for (const code of ['save_denied', 'save_failed', 'profile_outdated', 'telegram_invalid', 'telegram_required', 'phone_invalid', 'website_invalid', 'niche_invalid']) {
    for (const locale of ['ru', 'en']) {
      const info = errors.describeError({ code, locale })
      assert.equal(info.code, code)
      assert.ok(!info.ref, `${code} has its own text`)
    }
  }
})

test('rowToView fills defaults; HQ body carries every setting', () => {
  const v = profile.rowToView({ email: 'a@b.co', notify_channel: 'pigeon', locale: 'de' })
  assert.equal(v.notifyChannel, 'email')
  assert.equal(v.locale, 'ru')
  assert.equal(v.marketing, false)
  const body = profile.hqProfileBody({ ...v, name: 'Анна', phone: '+992', company: 'Лотос', marketing: true, recommendations: true, notifyChannel: 'both' })
  assert.deepEqual(Object.keys(body).sort(), [
    'city', 'company', 'legalAddress', 'legalName', 'locale', 'marketingConsent', 'name', 'niche', 'notifyChannel', 'phone',
    'recommendationsConsent', 'refundWallet', 'telegram', 'website',
  ])
  assert.equal(body.marketingConsent, true)
  assert.equal(body.notifyChannel, 'both')
})

test('unsubscribe token: signed per user and field, tamper-proof, needs the secret', () => {
  const secret = 'test-secret-0123456789abcdef'
  const token = unsub.unsubscribeToken(UID, 'marketing', secret)
  assert.deepEqual(unsub.verifyUnsubscribeToken(token, secret), { userId: UID, field: 'marketing' })
  const [id, , sig] = token.split('.')
  assert.equal(unsub.verifyUnsubscribeToken(`${id}.recommendations.${sig}`, secret), null, 'the field is signed')
  assert.equal(unsub.verifyUnsubscribeToken(token, 'another-secret-0123456789'), null)
  assert.equal(unsub.verifyUnsubscribeToken(token, null), null)
  assert.equal(unsub.verifyUnsubscribeToken('x.y', secret), null)
  assert.equal(unsub.verifyUnsubscribeToken(token.slice(0, -2), secret), null)
  assert.equal(unsub.unsubscribeSecret({ UNSUBSCRIBE_SECRET: 'short' }), null)
  assert.equal(unsub.unsubscribeSecret({ UNSUBSCRIBE_SECRET: secret }), secret)
  assert.equal(unsub.unsubscribeLink('https://firtech.pro/', 'ru', 'a.b.c'), 'https://firtech.pro/ru/cabinet/unsubscribe?token=a.b.c')
  assert.equal(profile.deleteWordOk(' удалить ', 'ru'), true)
  assert.equal(profile.deleteWordOk('delete', 'ru'), false)
  assert.equal(profile.deleteWordOk('Delete', 'en'), true)
})

test('nothing in the profile is a React form action any more; the route reads back and syncs HQ after the answer', () => {
  const panel = read('src/components/cabinet/profile-panel.tsx')
  assert.doesNotMatch(panel, /useActionState|<form/)
  assert.match(panel, /fetchJson<[^>]+>\('\/api\/cabinet\/profile'/)
  assert.match(panel, /role="switch"/)
  const route = read('src/app/api/cabinet/profile/route.ts')
  assert.match(route, /saveProfilePatch\(/)
  assert.match(route, /after\(\(\) =>\s*\n?\s*syncProfileToHq/)
  assert.match(route, /checkPublicPost\(request\)/)
  const actions = read('src/app/[locale]/cabinet/actions.ts')
  assert.doesNotMatch(actions, /updateProfileAction/)
  assert.match(actions, /deleteWordOk\(/)
  assert.match(actions, /signOut\(\{ scope: 'global' \}\)/)
  const page = read('src/app/[locale]/cabinet/unsubscribe/page.tsx')
  assert.match(page, /form action=\{unsubscribeAction\}/, 'opening the link changes nothing, the button does')
})

test('migrations: 0002 restores the own-row policies; 0003 adds the columns with defaults and is repeatable', () => {
  const sql2 = read('supabase/migrations/0002_profiles_update.sql')
  assert.match(sql2, /grant select, insert, update on public\.profiles to authenticated/)
  const sql = read('supabase/migrations/0003_profile_prefs.sql')
  for (const col of profile.NEW_PROFILE_COLUMNS.split(',')) assert.match(sql, new RegExp(`add column if not exists ${col} `), col)
  assert.match(sql, /recommendations_consent boolean not null default false/)
  assert.match(sql, /notify_channel text not null default 'email'/)
  assert.match(sql, /if not exists \(select 1 from pg_constraint where conname = 'profiles_notify_channel_check'\)/)
  assert.doesNotMatch(sql, /drop table|drop column|delete from/i)
})

test('security 2026-11-23 (P1-3): migration 0004 grants update only on the profile fields, never email or hq_synced_at', () => {
  const sql = read('supabase/migrations/0004_profiles_column_grants.sql')
  const body = sql.replace(/^--.*$/gm, '')
  assert.match(body, /revoke update on public\.profiles from authenticated, anon;/)
  assert.match(body, /revoke insert on public\.profiles from authenticated, anon;/)
  assert.doesNotMatch(body, /grant [^;]*update on public\.profiles/i, 'no table-wide update grant')
  const editable = /editable text\[\] := array\[([^\]]+)\]/.exec(body)
  assert.ok(editable)
  const cols = editable[1].match(/'([a-z_]+)'/g).map((c) => c.slice(1, -1)).sort()
  assert.deepEqual(cols, Object.values(profile.FIELD_COLUMNS).sort(), 'exactly the columns the profile form writes')
  for (const banned of ['email', 'id', 'hq_synced_at', 'created_at', 'updated_at']) assert.ok(!cols.includes(banned), banned)
  assert.match(body, /grant update \(%I\) on public\.profiles to authenticated/)
  assert.doesNotMatch(body, /grant update \([^%)]*\b(email|hq_synced_at|id)\b/)
  assert.match(body, /email = lower\(coalesce\(auth\.jwt\(\) ->> 'email', ''\)\)/, 'an inserted row carries the account email')
  assert.match(body, /create or replace function public\.mark_hq_synced\(\)[\s\S]*security definer[\s\S]*set hq_synced_at = now\(\) where id = auth\.uid\(\)/)
  assert.match(body, /revoke all on function public\.mark_hq_synced\(\) from public, anon;/)
  assert.doesNotMatch(body, /drop table|drop column|delete from/i)
})

test('security 2026-11-23 (P1-3): the site never writes hq_synced_at or email from the client session', () => {
  assert.doesNotMatch(read('src/app/api/cabinet/profile/route.ts'), /hq_synced_at/, 'the route stamps through markHqSynced')
  assert.match(read('src/lib/cabinet-session.ts'), /supabase\.rpc\('mark_hq_synced'\)/)
  assert.doesNotMatch(read('src/lib/cabinet-profile.ts'), /\.upsert\(/)
  const server = read('src/lib/cabinet-profile-server.ts')
  assert.doesNotMatch(server, /profile\.email/, 'the HQ sync never reads the email of the profile row')
  assert.match(server, /getUserById\(parsed\.userId\)/)
})
