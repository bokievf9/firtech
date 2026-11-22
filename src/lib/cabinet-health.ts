import { supabaseConfig } from './supabase/config'

// What /[locale]/cabinet/health shows: only whether each piece is set, never a value. Pure, so the
// test can check that nothing secret ever leaves it.
export type CabinetHealth = {
  supabaseUrl: boolean
  anonKey: boolean
  serviceKey: boolean
  siteUrl: boolean
  hqConfigured: boolean
  leadIntake: boolean
}

export function cabinetHealth(env: Record<string, string | undefined> = process.env): CabinetHealth {
  const set = (v: string | undefined) => Boolean(v && v.trim())
  return {
    supabaseUrl: set(env.NEXT_PUBLIC_SUPABASE_URL) && supabaseConfig({ ...env, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'x' }) !== null,
    anonKey: set(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceKey: set(env.SUPABASE_SERVICE_ROLE_KEY),
    siteUrl: set(env.NEXT_PUBLIC_SITE_URL),
    hqConfigured: set(env.HQ_CABINET_TOKEN) || set(env.HQ_ADMIN_TOKEN),
    leadIntake: set(env.LEAD_INTAKE_URL) && set(env.LEAD_INTAKE_TOKEN),
  }
}
