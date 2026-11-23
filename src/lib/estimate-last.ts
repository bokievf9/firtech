// The last build the visitor looked at, kept in localStorage so «Продолжить прошлую смету» can offer it
// again (builder v6 wave 2). Pure over a Storage-like object so tests run without a browser; every access is
// wrapped because storage can be blocked or full. The entry screen of the builder (W1's file) can call
// `lastBuild()` and render <ContinueLastBuild /> from components/estimate-live.tsx.
import { decodeBuild, encodeBuild, type Build } from './builder'

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const LAST_BUILD_KEY = 'fir-last-build'
export const LAST_BUILD_DISMISS_KEY = 'fir-last-build-dismissed'
export type LastBuild = { code: string; savedAt: number }

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

// Remembers a build; an empty one (nothing picked) is not worth keeping.
export function rememberBuild(build: Build, storage: StorageLike | null = browserStorage(), now = Date.now()): boolean {
  if (!storage) return false
  const code = encodeBuild(build)
  if (!code || !decodeBuild(code)) return false
  try {
    storage.setItem(LAST_BUILD_KEY, JSON.stringify({ code, savedAt: now }))
    // A new build brings the offer back after an earlier «no thanks».
    storage.removeItem(LAST_BUILD_DISMISS_KEY)
    return true
  } catch {
    return false
  }
}

// The remembered build code, or null (nothing stored, broken JSON, a code that no longer decodes, dismissed).
export function lastBuild(storage: StorageLike | null = browserStorage()): LastBuild | null {
  if (!storage) return null
  try {
    if (storage.getItem(LAST_BUILD_DISMISS_KEY)) return null
    const raw = storage.getItem(LAST_BUILD_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<LastBuild>
    if (typeof data.code !== 'string' || typeof data.savedAt !== 'number') return null
    if (!data.code || !decodeBuild(data.code)) return null
    return { code: data.code, savedAt: data.savedAt }
  } catch {
    return null
  }
}

export function dismissLastBuild(storage: StorageLike | null = browserStorage()) {
  try {
    storage?.setItem(LAST_BUILD_DISMISS_KEY, '1')
  } catch {
    // Nothing to do: the offer simply shows again next time.
  }
}
