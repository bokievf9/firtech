import { NextResponse } from 'next/server'
import { errorBody, errorStatusFor } from '@/lib/errors'

// The failure answer of every site route: `{ok:false, error:{code, message}}` with the matching
// HTTP status (never 200 with an empty body). The message is Russian by default: clients look the
// text up again from the code in the visitor's language (`describeError`).
export function apiError(code: string, status?: number, headers?: Record<string, string>) {
  return NextResponse.json(errorBody(code), {
    status: status ?? errorStatusFor(code),
    headers: { 'cache-control': 'no-store', ...headers },
  })
}

// Timeout for outgoing calls (HQ, Telegram, Resend, Supabase): the code tells which one slowed down.
export async function withTimeout<T>(work: Promise<T>, ms: number, code = 'timeout'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error(code), { code, name: 'TimeoutError' })), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
