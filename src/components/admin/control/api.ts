'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { admin } from '@/content/admin'
import { codeFromBody, describeError, FETCH_TIMEOUT_MS, isTimeout } from '@/lib/errors'
import type { HqResult } from '@/lib/hq-admin-view'

// Browser side of the пульт: every call goes to the session-checked proxy /api/admin/hq/*.
// GET without a body, POST with one. Never throws: failures are { ok: false, error } codes.
export async function hq<T extends object>(path: string, body?: unknown, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST', timeoutMs = FETCH_TIMEOUT_MS): Promise<HqResult<T>> {
  try {
    const res = await fetch(
      `/api/admin/hq/${path}`,
      body === undefined
        ? { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) }
        : {
            method,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(timeoutMs),
          },
    )
    if (res.status === 401) return { ok: false, error: 'unauthorized' }
    const data: unknown = await res.json().catch(() => null)
    if (!data || typeof data !== 'object' || typeof (data as { ok?: unknown }).ok !== 'boolean') {
      // A page, an empty body or a proxy error: the HTTP status says what it was (502 -> hq_error).
      return { ok: false, error: codeFromBody(data) ?? describeError({ status: res.status }).code }
    }
    return data as HqResult<T>
  } catch (thrown) {
    return { ok: false, error: isTimeout(thrown) ? 'timeout' : 'network' }
  }
}

// Panel text for a failure code: the Пульт's own words first, then the site-wide map, and an unknown
// code is still shown with the short support reference (never a bare empty string).
export const errText = (error: string) => {
  const own = (admin.cc.errors as Record<string, string>)[error]
  if (own) return own
  // Already a sentence (a panel passed its own text): show it as it is.
  if (!/^[A-Za-z0-9_]+$/.test(error)) return error
  const info = describeError({ code: error, locale: 'en' })
  return `${info.message}${info.ref ? ` (${info.ref})` : ''}`
}

export const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))

export const POLL_VISIBLE = 10_000
export const POLL_HIDDEN = 60_000

// Polls one GET endpoint: every 10 s, every 60 s on a hidden tab, at once when the tab comes back.
// `mutate` changes the data optimistically and makes polls that started earlier drop their result,
// so a slow poll never brings back a card the owner has just approved.
export function usePoll<T extends object>(
  path: string | null,
  { visible = POLL_VISIBLE, hidden = POLL_HIDDEN, onData }: { visible?: number; hidden?: number; onData?: (data: T) => void } = {},
) {
  const [data, setData] = useState<(T & { ok: true }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const alive = useRef(true)
  const onDataRef = useRef(onData)
  useEffect(() => {
    onDataRef.current = onData
  })

  const accept = useCallback((next: T & { ok: true }) => {
    generation.current++
    setData(next)
    setError(null)
    onDataRef.current?.(next)
  }, [])

  const load = useCallback(async () => {
    if (!path) return
    const started = generation.current
    const next = await hq<T>(path)
    if (!alive.current || started !== generation.current) return
    if (next.ok) accept(next)
    else setError(next.error)
  }, [path, accept])

  useEffect(() => {
    alive.current = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = (delay: number) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(async () => {
        await load()
        if (alive.current) schedule(document.hidden ? hidden : visible)
      }, delay)
    }
    const onVisibility = () => schedule(document.hidden ? hidden : 0)
    schedule(0)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      alive.current = false
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load, visible, hidden])

  const mutate = useCallback((change: (current: T & { ok: true }) => T & { ok: true }) => {
    generation.current++
    setData((current) => (current ? change(current) : current))
  }, [])

  return { data, error, reload: load, mutate, accept }
}

// A small value kept in Web Storage and shared by every component that reads it, through
// useSyncExternalStore. Storage may be missing or throw (private window): the value then lives in
// memory only.
export function storedValue<T>(key: string, kind: 'local' | 'session', parse: (raw: string | null) => T, fallback: T) {
  let cache: { value: T } | null = null
  const listeners = new Set<() => void>()
  const storage = () => (kind === 'local' ? window.localStorage : window.sessionStorage)
  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    get(): T {
      if (!cache) {
        try {
          cache = { value: parse(storage().getItem(key)) }
        } catch {
          cache = { value: fallback }
        }
      }
      return cache.value
    },
    server: () => fallback,
    set(value: T) {
      cache = { value }
      try {
        storage().setItem(key, JSON.stringify(value))
      } catch {
        // Storage blocked: the value lives in memory for this page view.
      }
      for (const l of listeners) l()
    },
  }
}

// A PATCH through the proxy (HQ settings): same envelope and error codes as `hq`.
export const hqPatch = <T extends object>(path: string, body: unknown) => hq<T>(path, body, 'PATCH')

// A DELETE through the proxy (Knowledge notes, Quality lessons): same envelope and error codes as `hq`.
export const hqDelete = <T extends object>(path: string) => hq<T>(path, {}, 'DELETE')
