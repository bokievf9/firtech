import { normalizeTelegram } from './cabinet-data'

// The client's profile in the cabinet («Профиль»): sections Вы, Компания, Для документов, Уведомления,
// Безопасность. Every field saves on its own (`POST /api/cabinet/profile` with a patch). Pure helpers, so
// the bugs below stay covered by tests without Supabase.
//
// Bug 1 (2026-11-22, «профиль не сохраняется»): `update().eq()` without `.select()` reported success on a
// zero-row write (RLS hid the row or it did not exist). Fixed by checking the returned rows.
// Bug 2 (2026-11-22, owner item 10: «галочка "Присылать новости и акции" ... сохраняю, и она убирается»):
// the value WAS stored. The form was a React form action; after an action React 19 calls `form.reset()`,
// which puts every field back to its DEFAULT. React keeps the default of a controlled text input in step
// with its value (the `value` attribute), but never the default of a controlled checkbox: `defaultChecked`
// stays what it was at the first render (off). So right after «Сохранить» the box showed off while the
// database said on, and the next save sent off for real. HQ never heard of the change either (the CRM
// update carried only name, Telegram and language). Now nothing is a form action: each field saves by
// itself through fetch, the answer is the row read back from the database, and the UI shows that row.

export const NOTIFY_CHANNELS = ['email', 'telegram', 'both'] as const
export type NotifyChannel = (typeof NOTIFY_CHANNELS)[number]

export type ProfileView = {
  name: string
  email: string
  telegram: string
  phone: string
  locale: 'ru' | 'en'
  company: string
  niche: string
  website: string
  city: string
  legalName: string
  legalAddress: string
  refundWallet: string
  marketing: boolean
  recommendations: boolean
  notifyChannel: NotifyChannel
  updatedAt: string | null
}

export type ProfileField = Exclude<keyof ProfileView, 'email' | 'updatedAt'>
export type ProfilePatch = Partial<Pick<ProfileView, ProfileField>>

// View field -> column of public.profiles.
export const FIELD_COLUMNS: Record<ProfileField, string> = {
  name: 'name',
  telegram: 'telegram',
  phone: 'phone',
  locale: 'locale',
  company: 'company',
  niche: 'niche',
  website: 'website',
  city: 'city',
  legalName: 'legal_name',
  legalAddress: 'legal_address',
  refundWallet: 'refund_wallet',
  marketing: 'marketing_consent',
  recommendations: 'recommendations_consent',
  notifyChannel: 'notify_channel',
}

// Columns of 0001 (always there) and the ones migration 0003 adds.
export const BASE_PROFILE_COLUMNS = 'id,email,name,telegram,locale,marketing_consent,hq_synced_at,updated_at'
export const NEW_PROFILE_COLUMNS = 'phone,company,niche,website,city,legal_name,legal_address,refund_wallet,recommendations_consent,notify_channel'
export const PROFILE_COLUMNS = `${BASE_PROFILE_COLUMNS},${NEW_PROFILE_COLUMNS}`
const LEGACY_FIELDS: readonly ProfileField[] = ['name', 'telegram', 'locale', 'marketing']

export type ProfileRow = Record<string, unknown>

const str = (v: unknown) => (typeof v === 'string' ? v : '')

export function rowToView(row: ProfileRow, fallbackEmail = ''): ProfileView {
  const channel = str(row.notify_channel)
  return {
    name: str(row.name),
    email: str(row.email) || fallbackEmail,
    telegram: str(row.telegram),
    phone: str(row.phone),
    locale: row.locale === 'en' ? 'en' : 'ru',
    company: str(row.company),
    niche: str(row.niche),
    website: str(row.website),
    city: str(row.city),
    legalName: str(row.legal_name),
    legalAddress: str(row.legal_address),
    refundWallet: str(row.refund_wallet),
    marketing: row.marketing_consent === true,
    recommendations: row.recommendations_consent === true,
    notifyChannel: (NOTIFY_CHANNELS as readonly string[]).includes(channel) ? (channel as NotifyChannel) : 'email',
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

export type PatchError = 'invalid' | 'telegram_invalid' | 'phone_invalid' | 'website_invalid' | 'niche_invalid' | 'telegram_required'

const TEXT_LIMITS: Partial<Record<ProfileField, number>> = {
  name: 80,
  company: 120,
  city: 80,
  legalName: 160,
  legalAddress: 300,
  refundWallet: 120,
}

// `+992 900 12-34-56`, `(495) 123 45 67`: digits with the usual separators, 6 to 15 digits.
export function normalizePhone(input: string): string | null {
  const v = input.trim().replace(/\s+/g, ' ')
  if (!v) return ''
  if (!/^\+?[\d\s()-]{6,40}$/.test(v)) return null
  const digits = v.replace(/\D/g, '').length
  return digits >= 6 && digits <= 15 ? v : null
}

// `example.com`, `https://example.com/page` -> an https/http URL with a dotted host, or null.
export function normalizeWebsite(input: string): string | null {
  const v = input.trim()
  if (!v) return ''
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`
  try {
    const url = new URL(withScheme)
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.') || /\s/.test(v)) return null
    const out = url.toString().replace(/\/$/, '')
    return out.length <= 200 ? out : null
  } catch {
    return null
  }
}

// A request body `{ field: value, ... }` -> a clean patch. Unknown keys are refused (`invalid`), so a typo
// never looks like a save. `niches` = the builder's kind ids the «Ниша» list offers.
export function parseProfilePatch(
  body: unknown,
  niches: readonly string[],
): { ok: true; patch: ProfilePatch } | { ok: false; error: PatchError; field?: ProfileField } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'invalid' }
  const entries = Object.entries(body as Record<string, unknown>)
  if (entries.length === 0 || entries.length > 14) return { ok: false, error: 'invalid' }
  const patch: ProfilePatch = {}
  for (const [key, value] of entries) {
    if (!Object.hasOwn(FIELD_COLUMNS, key)) return { ok: false, error: 'invalid' }
    const field = key as ProfileField
    if (field === 'marketing' || field === 'recommendations') {
      if (typeof value !== 'boolean') return { ok: false, error: 'invalid', field }
      patch[field] = value
      continue
    }
    if (typeof value !== 'string') return { ok: false, error: 'invalid', field }
    if (field === 'locale') {
      if (value !== 'ru' && value !== 'en') return { ok: false, error: 'invalid', field }
      patch.locale = value
    } else if (field === 'notifyChannel') {
      if (!(NOTIFY_CHANNELS as readonly string[]).includes(value)) return { ok: false, error: 'invalid', field }
      patch.notifyChannel = value as NotifyChannel
    } else if (field === 'telegram') {
      const tg = normalizeTelegram(value)
      if (tg === null) return { ok: false, error: 'telegram_invalid', field }
      patch.telegram = tg
    } else if (field === 'phone') {
      const phone = normalizePhone(value)
      if (phone === null) return { ok: false, error: 'phone_invalid', field }
      patch.phone = phone
    } else if (field === 'website') {
      const site = normalizeWebsite(value)
      if (site === null) return { ok: false, error: 'website_invalid', field }
      patch.website = site
    } else if (field === 'niche') {
      if (value && !niches.includes(value)) return { ok: false, error: 'niche_invalid', field }
      patch.niche = value
    } else {
      const text = value.trim().replace(/\s+/g, ' ')
      if (text.length > (TEXT_LIMITS[field] ?? 120)) return { ok: false, error: 'invalid', field }
      patch[field] = text
    }
  }
  return { ok: true, patch }
}

// Telegram as a channel needs a nick. Picking it without one is refused; clearing the nick while the
// channel uses Telegram moves the channel back to email in the same write.
export function reconcileChannel(
  patch: ProfilePatch,
  current: Pick<ProfileView, 'telegram' | 'notifyChannel'>,
): { ok: true; patch: ProfilePatch } | { ok: false; error: 'telegram_required' } {
  const telegram = patch.telegram ?? current.telegram
  const channel = patch.notifyChannel ?? current.notifyChannel
  if (channel === 'email' || telegram) return { ok: true, patch }
  if (patch.notifyChannel && patch.notifyChannel !== 'email') return { ok: false, error: 'telegram_required' }
  return { ok: true, patch: { ...patch, notifyChannel: 'email' } }
}

// Patch -> column values (empty text is stored as null, so a cleared field stays cleared).
export function patchToColumns(patch: ProfilePatch): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(patch) as [ProfileField, unknown][]) {
    out[FIELD_COLUMNS[field]] = typeof value === 'string' && field !== 'locale' && field !== 'notifyChannel' ? value || null : value
  }
  return out
}

// True when the patch only touches columns that exist before migration 0003.
export const legacyOnly = (patch: ProfilePatch) => (Object.keys(patch) as ProfileField[]).every((f) => LEGACY_FIELDS.includes(f))

// The slice of the Supabase client the save needs (so tests can fake it).
type Rows = PromiseLike<{ data: unknown[] | null; error: unknown }>
export type ProfilesTable = {
  update(values: Record<string, unknown>): { eq(column: string, value: string): { select(columns: string): Rows } }
  upsert(values: Record<string, unknown>, options: { onConflict: string }): { select(columns: string): Rows }
}
export type ProfilesClient = { from(table: 'profiles'): ProfilesTable }

export type SaveFailure = 'rls' | 'schema' | 'timeout' | 'error' | 'no_row'

// A Supabase / PostgREST error -> why the save failed. 42501 = no right (missing grant or policy),
// 42703 / PGRST204 = a column that does not exist (migration 0003 not run).
export function failureOf(error: unknown): SaveFailure {
  const e = (error ?? {}) as { code?: unknown; status?: unknown; message?: unknown }
  const code = typeof e.code === 'string' ? e.code : ''
  if (code === '42501' || e.status === 403 || /row-level security|permission denied/i.test(String(e.message ?? ''))) return 'rls'
  if (code === '42703' || code === 'PGRST204' || /column .* does not exist|schema cache/i.test(String(e.message ?? ''))) return 'schema'
  if (code === 'timeout') return 'timeout'
  return 'error'
}

function withTimeout<T>(work: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(work),
    new Promise<never>((_, reject) => setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'timeout' })), ms)),
  ])
}

export type SaveResult = { ok: true; profile: ProfileView; created: boolean } | { ok: false; reason: SaveFailure }

// Writes the patch and READS THE ROW BACK: the answer is what the database now holds, never what was sent.
// Zero rows (RLS hides the row or it never existed): one upsert by id; zero rows again = `no_row`.
// `legacy` = migration 0003 is not run: only the old columns are read back.
export async function saveProfilePatch(
  supabase: ProfilesClient,
  user: { id: string; email?: string | null },
  patch: ProfilePatch,
  opts: { timeoutMs?: number; legacy?: boolean } = {},
): Promise<SaveResult> {
  const timeoutMs = opts.timeoutMs ?? 8000
  const columns = opts.legacy ? BASE_PROFILE_COLUMNS : PROFILE_COLUMNS
  const values = patchToColumns(patch)
  try {
    const updated = await withTimeout(supabase.from('profiles').update(values).eq('id', user.id).select(columns), timeoutMs)
    if (updated.error) return { ok: false, reason: failureOf(updated.error) }
    const row = updated.data?.[0]
    if (row) return { ok: true, profile: rowToView(row as ProfileRow, user.email ?? ''), created: false }
    if (!user.email) return { ok: false, reason: 'no_row' }
    const created = await withTimeout(
      supabase.from('profiles').upsert({ id: user.id, email: user.email.toLowerCase(), ...values }, { onConflict: 'id' }).select(columns),
      timeoutMs,
    )
    if (created.error) return { ok: false, reason: failureOf(created.error) }
    const fresh = created.data?.[0]
    return fresh ? { ok: true, profile: rowToView(fresh as ProfileRow, user.email), created: true } : { ok: false, reason: 'no_row' }
  } catch (error) {
    return { ok: false, reason: failureOf(error) }
  }
}

// Save failure -> the route's error code and status (texts in lib/errors.ts).
export const SAVE_ERRORS: Record<SaveFailure, { code: string; status: number }> = {
  rls: { code: 'save_denied', status: 403 },
  no_row: { code: 'save_denied', status: 403 },
  schema: { code: 'profile_outdated', status: 503 },
  timeout: { code: 'timeout', status: 504 },
  error: { code: 'save_failed', status: 500 },
}

// What HQ gets (`POST /admin/clients/:id`). HQ reads name, telegram, phone, company, locale today and strips
// the rest (zod without strict); the other keys are the contract in docs/cabinet.md «Нужно от HQ».
export function hqProfileBody(p: ProfileView) {
  return {
    name: p.name,
    telegram: p.telegram,
    phone: p.phone,
    company: p.company,
    locale: p.locale,
    niche: p.niche,
    website: p.website,
    city: p.city,
    legalName: p.legalName,
    legalAddress: p.legalAddress,
    refundWallet: p.refundWallet,
    marketingConsent: p.marketing,
    recommendationsConsent: p.recommendations,
    notifyChannel: p.notifyChannel,
  }
}

// The words that confirm deleting the account (typed by hand).
export const DELETE_WORD = { ru: 'УДАЛИТЬ', en: 'DELETE' } as const
export const deleteWordOk = (typed: string, locale: 'ru' | 'en') => typed.trim().toUpperCase() === DELETE_WORD[locale]
