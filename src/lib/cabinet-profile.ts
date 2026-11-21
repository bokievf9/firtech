import { z } from 'zod'
import { normalizeTelegram } from './cabinet-data'

// Saving the client's profile (cabinet, «Профиль»). Pure helpers so the bug of 2026-11-22
// («профиль не сохраняется, ни имя, ни телеграм») stays covered by tests without Supabase.
//
// What was wrong:
// 1. `update(...).eq('id', ...)` without `.select()`: when Row Level Security hides the row, or the
//    row does not exist (the sign-up trigger missed it), Supabase answers success with ZERO rows
//    changed. The action then said «Сохранено.» and nothing was stored.
// 2. The form was uncontrolled (`defaultValue` from the server props) and the action neither
//    revalidated the page nor returned the saved values, so React 19's automatic form reset after
//    a form action put the OLD values back into the fields at once (and the greeting kept the old name).
// 3. HQ was told about the client once (first sync), so a changed name or Telegram never reached the CRM.

export const profileSchema = z.object({
  name: z.string().trim().max(80),
  locale: z.enum(['ru', 'en']),
  marketing: z.boolean(),
})

export type ProfileInput = { name: string; telegram: string; locale: 'ru' | 'en'; marketing: boolean }

// The form (field names: name, telegram, profileLocale, marketing) to a clean input, or the error key.
export function parseProfileForm(
  form: { get(name: string): FormDataEntryValue | null },
  fallbackLocale: 'ru' | 'en',
): { ok: true; input: ProfileInput } | { ok: false; error: 'telegram' | 'profile' } {
  const telegram = normalizeTelegram(String(form.get('telegram') ?? ''))
  if (telegram === null) return { ok: false, error: 'telegram' }
  const parsed = profileSchema.safeParse({
    name: form.get('name') ?? '',
    locale: form.get('profileLocale') ?? fallbackLocale,
    marketing: form.get('marketing') === 'on',
  })
  if (!parsed.success) return { ok: false, error: 'profile' }
  return { ok: true, input: { name: parsed.data.name, telegram, locale: parsed.data.locale, marketing: parsed.data.marketing } }
}

// The slice of the Supabase client the save needs (so tests can fake it).
type Rows = PromiseLike<{ data: unknown[] | null; error: unknown }>
export type ProfilesTable = {
  update(values: Record<string, unknown>): { eq(column: string, value: string): { select(columns: string): Rows } }
  upsert(values: Record<string, unknown>, options: { onConflict: string }): { select(columns: string): Rows }
}
export type ProfilesClient = { from(table: 'profiles'): ProfilesTable }

// Writes the profile and CHECKS that a row changed. No row (RLS hides it or it never existed):
// one upsert by id creates it; if that changes nothing either, the save fails loudly instead of
// reporting success. Returns what is now stored.
export async function saveProfileRow(
  supabase: ProfilesClient,
  user: { id: string; email?: string | null },
  input: ProfileInput,
): Promise<{ ok: true; created: boolean } | { ok: false; reason: 'error' | 'no_row' }> {
  const values = {
    name: input.name || null,
    telegram: input.telegram || null,
    locale: input.locale,
    marketing_consent: input.marketing,
  }
  const updated = await supabase.from('profiles').update(values).eq('id', user.id).select('id')
  if (updated.error) return { ok: false, reason: 'error' }
  if ((updated.data?.length ?? 0) > 0) return { ok: true, created: false }
  if (!user.email) return { ok: false, reason: 'no_row' }
  const created = await supabase
    .from('profiles')
    .upsert({ id: user.id, email: user.email.toLowerCase(), ...values }, { onConflict: 'id' })
    .select('id')
  if (created.error) return { ok: false, reason: 'error' }
  return (created.data?.length ?? 0) > 0 ? { ok: true, created: true } : { ok: false, reason: 'no_row' }
}
