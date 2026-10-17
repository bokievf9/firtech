import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { goals, projects, tasks } from '@/content/control'
import { computeStats } from '@/lib/admin-data'
import { guard, readCookie } from '@/lib/admin-guard'
import { briefing, chatRequest, leadSummary } from '@/lib/echo'
import { addSpend, costUsd, dailyCapUsd, spentToday } from '@/lib/echo-spend'
import { projectHealth } from '@/lib/project-health'
import { allLeads } from '@/lib/store'

// The owner's voice assistant on /admin/echo. Streams Claude's reply as plain text. The briefing
// carries project health, tasks, goals and lead counts only (no lead names, contacts or texts).
// Needs ANTHROPIC_API_KEY on the server; without it the page shows how to turn it on. Spending is
// capped per day (src/lib/echo-spend.ts, ECHO_DAILY_USD).

export const dynamic = 'force-dynamic'

// End-of-stream marker for a failure after text began: "\u0000" + code. The client strips it.
const FAIL = '\u0000'

// 40 replies per 10 minutes per session: enough to talk, a ceiling on a runaway loop.
const windowMs = 10 * 60_000
const hits = new Map<string, number[]>()
function limited(key: string) {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= 40) return true
  recent.push(now)
  hits.set(key, recent)
  return false
}

const fail = (status: number, error: string) =>
  Response.json({ ok: false, error }, { status, headers: { 'cache-control': 'no-store' } })

export async function POST(request: Request) {
  const denied = await guard(request)
  if (denied) return denied
  if (!process.env.ANTHROPIC_API_KEY) return fail(503, 'not_configured')
  if (limited(readCookie(request) ?? 'none')) return fail(429, 'rate_limited')
  if ((await spentToday()) >= dailyCapUsd()) return fail(429, 'daily_cap')

  const parsed = chatRequest.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail(400, 'bad_request')

  const now = Date.now()
  const [leads, health] = await Promise.all([allLeads(), projectHealth()])
  const system = briefing({
    now: new Date(now),
    projects,
    health,
    tasks,
    goals,
    leads: leadSummary(computeStats(leads, now)),
  })

  const client = new Anthropic()
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text))
      try {
        const stream = client.beta.messages.stream(
          {
            model: 'claude-opus-5-5',
            // Spoken replies are a few sentences; thinking counts toward this too.
            max_tokens: 2000,
            // Low effort keeps the first word quick.
            output_config: { effort: 'low' },
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            system,
            messages: parsed.data.messages,
          },
          { signal: request.signal },
        )
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            send(event.delta.text)
          }
        }
        const final = await stream.finalMessage()
        await addSpend(costUsd(final.usage)).catch((error) =>
          console.error('[echo] could not record spend', error),
        )
        if (final.stop_reason === 'refusal') send(FAIL + 'refused')
      } catch (error) {
        if (request.signal.aborted) return controller.close()
        const code =
          error instanceof Anthropic.RateLimitError
            ? 'upstream_busy'
            : error instanceof Anthropic.AuthenticationError
              ? 'bad_key'
              : 'upstream_error'
        console.error('[echo]', code, error instanceof Error ? error.message : error)
        send(FAIL + code)
      }
      controller.close()
    },
  })
  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
}
