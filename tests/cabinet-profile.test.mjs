// Profile save (2026-11-22, «профиль не сохраняется, ни имя, ни телеграм»): the form parser and the
// verified write, against a fake Supabase table that behaves like Row Level Security does.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const { parseProfileForm, saveProfileRow } = await import('../src/lib/cabinet-profile.ts')
const read = (f) => readFileSync(path.resolve(f), 'utf8')

const form = (entries) => new Map(Object.entries(entries))

// A `profiles` table: rows by id; `rls: 'hide'` = the update policy is missing (zero rows, no error),
// `rls: 'ok'` = own row visible, `fail` = a database error.
function fakeClient({ rows = {}, rls = 'ok', fail = false } = {}) {
  const calls = []
  const result = (data) => ({ then: (ok) => ok({ data, error: fail ? { code: '42501' } : null }) })
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
                select() {
                  calls.push(['update', id, values])
                  if (fail) return result(null)
                  if (rls === 'ok' && rows[id]) {
                    rows[id] = { ...rows[id], ...values }
                    return result([{ id }])
                  }
                  return result([])
                },
              }
            },
          }
        },
        upsert(values) {
          return {
            select() {
              calls.push(['upsert', values.id, values])
              if (fail) return result(null)
              if (rls === 'hide') return result([])
              rows[values.id] = values
              return result([{ id: values.id }])
            },
          }
        },
      }
    },
  }
}

const input = { name: 'Алиса', telegram: '@alice_1', locale: 'en', marketing: true }

test('parseProfileForm reads the form field names and normalises Telegram', () => {
  const ok = parseProfileForm(form({ name: '  Алиса ', telegram: 't.me/alice_1', profileLocale: 'en', marketing: 'on' }), 'ru')
  assert.deepEqual(ok, { ok: true, input: { name: 'Алиса', telegram: '@alice_1', locale: 'en', marketing: true } })
  const empty = parseProfileForm(form({ name: '', telegram: '' }), 'ru')
  assert.deepEqual(empty, { ok: true, input: { name: '', telegram: '', locale: 'ru', marketing: false } })
  assert.deepEqual(parseProfileForm(form({ name: 'A', telegram: 'ab' }), 'ru'), { ok: false, error: 'telegram' })
  assert.deepEqual(parseProfileForm(form({ name: 'x'.repeat(81), telegram: '' }), 'ru'), { ok: false, error: 'profile' })
  assert.deepEqual(parseProfileForm(form({ name: 'A', telegram: '', profileLocale: 'de' }), 'ru'), { ok: false, error: 'profile' })
})

test('the row is updated and the new name and Telegram are what is stored', async () => {
  const db = fakeClient({ rows: { u1: { id: 'u1', name: 'Старое', telegram: null } } })
  const r = await saveProfileRow(db, { id: 'u1', email: 'A@B.co' }, input)
  assert.deepEqual(r, { ok: true, created: false })
  assert.equal(db.rows.u1.name, 'Алиса')
  assert.equal(db.rows.u1.telegram, '@alice_1')
  assert.equal(db.rows.u1.marketing_consent, true)
  assert.deepEqual(db.calls.map((c) => c[0]), ['update'])
})

test('the regression: a zero-row update (missing row) is NOT a success, the row is created by upsert', async () => {
  const db = fakeClient({ rows: {} })
  const r = await saveProfileRow(db, { id: 'u2', email: 'New@B.co' }, input)
  assert.deepEqual(r, { ok: true, created: true })
  assert.deepEqual(db.calls.map((c) => c[0]), ['update', 'upsert'])
  assert.equal(db.rows.u2.email, 'new@b.co')
  assert.equal(db.rows.u2.name, 'Алиса')
})

test('the regression: no update policy (zero rows both times) is reported as a failure, never as saved', async () => {
  const db = fakeClient({ rows: { u1: { id: 'u1' } }, rls: 'hide' })
  const r = await saveProfileRow(db, { id: 'u1', email: 'a@b.co' }, input)
  assert.deepEqual(r, { ok: false, reason: 'no_row' })
  assert.deepEqual(db.rows.u1, { id: 'u1' })
  assert.deepEqual(await saveProfileRow(fakeClient({ rls: 'hide' }), { id: 'u1', email: null }, input), { ok: false, reason: 'no_row' })
})

test('a database error is a failure', async () => {
  const db = fakeClient({ rows: { u1: { id: 'u1' } }, fail: true })
  assert.deepEqual(await saveProfileRow(db, { id: 'u1', email: 'a@b.co' }, input), { ok: false, reason: 'error' })
})

test('empty name and Telegram are stored as null (cleared fields persist)', async () => {
  const db = fakeClient({ rows: { u1: { id: 'u1', name: 'A', telegram: '@old_name' } } })
  await saveProfileRow(db, { id: 'u1', email: 'a@b.co' }, { name: '', telegram: '', locale: 'ru', marketing: false })
  assert.equal(db.rows.u1.name, null)
  assert.equal(db.rows.u1.telegram, null)
})

test('the action revalidates, syncs HQ and returns the saved values; the form is controlled', () => {
  const action = read('src/app/[locale]/cabinet/actions.ts')
  const body = action.slice(action.indexOf('export async function updateProfileAction'), action.indexOf('export async function deleteAccountAction'))
  assert.match(body, /saveProfileRow\(/)
  assert.match(body, /patchClientProfile\(/)
  assert.match(body, /syncClientToHq\(/)
  assert.match(body, /known\.ok\s*\n?\s*\? await patchClientProfile/)
  assert.match(body, /revalidatePath\(`\/\$\{locale\}\/cabinet`\)/)
  assert.match(body, /saved: input/)
  const form = read('src/components/cabinet/cabinet-forms.tsx')
  const profile = form.slice(form.indexOf('export function ProfileForm'), form.indexOf('export function DeleteAccount'))
  assert.doesNotMatch(profile, /defaultValue|defaultChecked/)
  assert.match(profile, /state\.saved/)
})

test('migration 0002 restores the own-row policies and is repeatable', () => {
  const sql = read('supabase/migrations/0002_profiles_update.sql')
  assert.match(sql, /create policy "profiles update own" on public\.profiles\s+for update to authenticated using \(auth\.uid\(\) = id\) with check \(auth\.uid\(\) = id\)/)
  assert.match(sql, /grant select, insert, update on public\.profiles to authenticated/)
  assert.equal((sql.match(/drop policy if exists/g) ?? []).length, 3)
})
