import 'server-only'
import { guard } from '@/lib/admin-guard'
import { proxyRenderFile } from '@/lib/hq-files'

// Пульт: content renders (PNG slides, MP4 clips) from HQ, session-checked; the token stays here.
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ path: string[] }> }

export async function GET(request: Request, ctx: Ctx) {
  const denied = await guard(request)
  if (denied) return denied
  const { path } = await ctx.params
  return proxyRenderFile(path, request.headers.get('range'))
}
