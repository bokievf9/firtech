// Supabase settings for the client cabinet. Both public values must be set, otherwise the cabinet
// shows its calm "coming soon" state and nothing else in the site changes. Passing `process.env`
// as a whole object (not `process.env.NAME`) keeps the read at request time on the server.
export type SupabaseConfig = { url: string; anonKey: string }

export function supabaseConfig(
  env: Record<string, string | undefined> = process.env,
): SupabaseConfig | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey || !/^https?:\/\//.test(url)) return null
  return { url, anonKey }
}

export function cabinetEnabled(env: Record<string, string | undefined> = process.env) {
  return supabaseConfig(env) !== null
}
