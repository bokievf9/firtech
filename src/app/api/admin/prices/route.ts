import 'server-only'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { guard } from '@/lib/admin-guard'
import { editorView, type Op } from '@/lib/pricing-edit'
import { callHqAdmin } from '@/lib/hq-admin'
import { getPricesState, updatePrices } from '@/lib/pricing-store'

// Prices of the Пульт: the owner edits every price of the site; the overrides live in
// $DATA_DIR/prices.json (pricing-store.ts). Session and Origin checked like every /api/admin route,
// JSON only. Logs carry the path and the counts, never anything else.
export const dynamic = 'force-dynamic'

const headers = { 'cache-control': 'no-store' }

const op = z.union([
  z.object({ path: z.string().min(1).max(100), value: z.number() }).strict(),
  z.object({ reset: z.string().min(1).max(100) }).strict(),
])
const body = z.union([
  z.object({ path: z.string().min(1).max(100), value: z.number() }).strict(),
  z.object({ ops: z.array(op).min(1).max(100) }).strict(),
  z.object({ action: z.literal('reset'), path: z.string().min(1).max(100).optional() }).strict(),
])

async function view() {
  return { ok: true as const, ...editorView(await getPricesState()) }
}

export async function GET(request: Request) {
  const denied = await guard(request)
  if (denied) return denied
  try {
    return NextResponse.json(await view(), { headers })
  } catch {
    return NextResponse.json({ ok: false, error: 'store_error' }, { status: 500, headers })
  }
}

export async function POST(request: Request) {
  const denied = await guard(request)
  if (denied) return denied
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return NextResponse.json({ ok: false, error: 'json_only' }, { status: 415, headers })
  }
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400, headers })
  const data = parsed.data
  const ops: Op[] =
    'ops' in data
      ? data.ops
      : 'action' in data
        ? [{ reset: data.path ?? 'all' }]
        : [{ path: data.path, value: data.value }]
  try {
    const result = await updatePrices(ops)
    if (!result.ok) {
      console.warn(`prices: edit refused (${result.error.split(':')[0]}), ${ops.length} op(s)`)
      return NextResponse.json({ ok: false, error: result.error }, { status: 422, headers })
    }
    if (result.changed > 0) {
      // Every page that prints a price shows the new numbers within seconds.
      revalidatePath('/', 'layout')
      console.log(`prices: ${result.changed} change(s)`)
    }
    // Tell HQ to reload GET /api/prices now (else it does within 15 minutes). Best effort: a failure
    // never fails the save.
    let hqReload: 'ok' | 'failed' | 'skipped' = 'skipped'
    if (result.changed > 0) {
      hqReload = (await callHqAdmin('POST', 'prices/reload', {}, { timeoutMs: 3000 })).ok ? 'ok' : 'failed'
      if (hqReload === 'failed') console.warn('prices: HQ reload failed, HQ will refetch within 15 minutes')
    }
    return NextResponse.json({ ...(await view()), changed: result.changed, hqReload }, { headers })
  } catch {
    return NextResponse.json({ ok: false, error: 'store_error' }, { status: 500, headers })
  }
}
