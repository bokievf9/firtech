// «Недавно» in the site map panel: the places the visitor was taken to in this session (sessionStorage, newest first).
export const RECENT_KEY = 'fira-recent'
export const RECENT_MAX = 5

export function recentList(raw: string | null): string[] {
  try {
    const v: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}

export function pushRecent(list: readonly string[], key: string): string[] {
  return [key, ...list.filter((k) => k !== key)].slice(0, RECENT_MAX)
}
