import 'server-only'
import { NextResponse } from 'next/server'
import { goliveBlocks, goliveItems } from '@/content/golive'
import { guard } from '@/lib/admin-guard'
import { groupItems, parseAction, progress } from '@/lib/golive'
import { getGolive, updateGolive } from '@/lib/golive-store'

// Go-live plan of the Пульт: timer, checklist ticks and notes in $DATA_DIR/golive.json. Session
// and Origin checked like every /api/admin route. Stores only item ids, timestamps and the owner's
// short notes (300 characters).
export const dynamic = 'force-dynamic'

const headers = { 'cache-control': 'no-store' }

async function view() {
  const state = await getGolive()
  return {
    ok: true as const,
    state,
    items: goliveItems,
    blocks: goliveBlocks,
    progress: progress(goliveItems, state.done),
    groups: groupItems(goliveItems, state.done).map((g) => ({ id: g.id, progress: g.progress })),
    now: Date.now(),
  }
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
  const action = parseAction(await request.json().catch(() => null))
  if (!action) return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400, headers })
  try {
    await updateGolive(action)
    return NextResponse.json(await view(), { headers })
  } catch {
    return NextResponse.json({ ok: false, error: 'store_error' }, { status: 500, headers })
  }
}
