import { admin } from '@/content/admin'

// One fetch helper for the Pulse panels: JSON in and out, same-origin cookie, and a short Russian
// reason on failure. `scope` picks the message set of the panel that asked.
type Scope = { network: string; auth: string }

export class ApiError extends Error {}

export async function api<T>(
  url: string,
  init: { method: 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown },
  scope: Scope,
  fallback: string,
): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method: init.method,
      headers: { 'content-type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch {
    throw new ApiError(scope.network)
  }
  if (res.status === 401) throw new ApiError(scope.auth)
  if (!res.ok) throw new ApiError(fallback)
  try {
    return (await res.json()) as T
  } catch {
    throw new ApiError(fallback)
  }
}

export const taskScope = admin.pulse.tasks.errors
export const igScope = admin.pulse.ig.errors
