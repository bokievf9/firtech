import 'server-only'
import { guard } from '@/lib/admin-guard'
import { json } from '@/lib/admin-json'
import { metrikaConfigured, metrikaStats } from '@/lib/metrika'
import type { SourceState, StatsResponse } from '@/lib/traffic-types'
import { vibelyConfigured, vibelyStats } from '@/lib/vibely-metrics'

async function read<T>(configured: boolean, load: () => Promise<T>, name: string) {
  if (!configured) return { state: 'not_configured' as SourceState, data: null }
  try {
    return { state: 'ok' as SourceState, data: await load() }
  } catch (error) {
    // The message names the status only; tokens and secrets are never part of it.
    console.error(`[stats] ${name} failed`, error instanceof Error ? error.message : 'error')
    return { state: 'unavailable' as SourceState, data: null }
  }
}

export async function GET(request: Request) {
  const denied = await guard(request)
  if (denied) return denied
  const [metrika, vibely] = await Promise.all([
    read(metrikaConfigured(), metrikaStats, 'metrika'),
    read(vibelyConfigured(), vibelyStats, 'vibely'),
  ])
  return json({ metrika, vibely } satisfies StatsResponse)
}
