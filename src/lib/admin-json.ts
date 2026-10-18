import 'server-only'
import { NextResponse } from 'next/server'

export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })

export const invalid = () => json({ ok: false, error: 'invalid' }, 400)
export const notFound = () => json({ ok: false, error: 'not_found' }, 404)

const MAX_BODY = 20_000

// The parsed JSON body, or undefined when it is missing, too large or not JSON.
export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text().catch(() => '')
  if (!text || text.length > MAX_BODY) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
