import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { goals, projects, tasks } from '@/content/control'
import { computeStats } from '@/lib/admin-data'
import { readCookie } from '@/lib/admin-guard'
import { briefing, chatRequest, echoModelIds, leadSummary, pickModel } from '@/lib/echo'
import { addSpend, costUsd, dailyCapUsd, spentToday, type EchoUsage } from '@/lib/echo-spend'
import { Confirmations, runTool, toolDefinitions, type EchoStores } from '@/lib/echo-tools'
import * as igStore from '@/lib/instagram-store'
import { projectHealth } from '@/lib/project-health'
import { allLeads } from '@/lib/store'
import * as taskStore from '@/lib/tasks-store'

// The chat loop behind /api/admin/echo: streams Claude's reply as plain text, runs the tools the
// model calls (src/lib/echo-tools.ts), sends the results back and continues, at most MAX_STEPS
// API calls per message. The route stays thin; tests replace `echoDeps` with fakes so nothing
// touches the network or the real stores.

// End-of-stream marker for a failure after text began: "\u0000" + code. The client strips it.
export const FAIL = '\u0000'
export const MAX_STEPS = 5

type StreamParams = Parameters<Anthropic['beta']['messages']['stream']>[0]
export type EchoFinal = {
  content: Array<{ type: string; id?: string; name?: string; input?: unknown }>
  stop_reason: string | null
  usage: EchoUsage
}
export type EchoStream = AsyncIterable<{
  type: string
  delta?: { type?: string; text?: string }
}> & {
  finalMessage(): Promise<EchoFinal>
}
export type EchoClient = {
  beta: {
    messages: { stream(params: StreamParams, options?: { signal?: AbortSignal }): EchoStream }
  }
}

export const echoDeps = {
  client: (): EchoClient => new Anthropic() as unknown as EchoClient,
  tasks: taskStore as Pick<
    typeof taskStore,
    'listTasks' | 'createTask' | 'updateTask' | 'deleteTask'
  >,
  instagram: igStore as Pick<typeof igStore, 'listIgItems'>,
  health: projectHealth,
  leads: allLeads,
  confirmations: new Confirmations(),
}

// 40 model calls per 10 minutes per session: enough to talk, a ceiling on a runaway loop. Every
// extra call of a tool loop counts as one more.
const windowMs = 10 * 60_000
const LIMIT = 40
const hits = new Map<string, number[]>()
export const echoLimits = {
  recent(key: string, now = Date.now()) {
    return (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  },
  hit(key: string, now = Date.now()) {
    const recent = this.recent(key, now)
    recent.push(now)
    hits.set(key, recent)
  },
  full(key: string, now = Date.now()) {
    return this.recent(key, now).length >= LIMIT
  },
  reset() {
    hits.clear()
  },
}

const fail = (status: number, error: string) =>
  Response.json({ ok: false, error }, { status, headers: { 'cache-control': 'no-store' } })

// The model must not be able to forge an action chip or an error marker with its own text. Deltas
// can cut "[[" in two, so a trailing "[" is held back until the next delta; "[[" never passes and
// the NUL that starts error markers is dropped.
export function makeScrub() {
  let carry = ''
  return {
    push(text: string) {
      let t = carry + text
      carry = ''
      const open = t.match(/\[+$/)
      if (open) {
        carry = open[0]
        t = t.slice(0, -carry.length)
      }
      return t.replaceAll('\u0000', '').replaceAll('[[', '[ [')
    },
    flush() {
      const rest = carry
      carry = ''
      return rest.replaceAll('[[', '[ [')
    },
  }
}

// Bodies bigger than the schema allows (24 messages of 2,000 characters) are refused before reading.
const MAX_BODY = 100_000

export async function handleEcho(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return fail(503, 'not_configured')
  const session = readCookie(request) ?? 'none'
  if (echoLimits.full(session)) return fail(429, 'rate_limited')
  // Counted right away, so parallel requests cannot all pass the check before any of them is noted.
  echoLimits.hit(session)
  if ((await spentToday()) >= dailyCapUsd()) return fail(429, 'daily_cap')
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return fail(413, 'too_large')

  const parsed = chatRequest.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail(400, 'bad_request')

  const lastUser = parsed.data.messages.at(-1)?.content ?? ''
  const modelKey = pickModel(parsed.data.model, lastUser)
  const now = Date.now()
  const d = echoDeps
  const [leads, health, liveTasks, igItems] = await Promise.all([
    d.leads(),
    d.health(),
    d.tasks.listTasks().catch(() => []),
    d.instagram.listIgItems().catch(() => []),
  ])
  const stats = computeStats(leads, now)
  const day = new Date(now + 5 * 3_600_000).toISOString().slice(0, 10)
  const system = briefing({
    now: new Date(now),
    projects,
    health,
    tasks,
    goals,
    leads: leadSummary(stats),
    liveTasks,
    instagram: igItems.filter((i) => i.date >= day).slice(0, 8),
  })

  const stores: EchoStores = {
    listTasks: d.tasks.listTasks,
    createTask: d.tasks.createTask,
    updateTask: d.tasks.updateTask,
    deleteTask: d.tasks.deleteTask,
    listIgItems: d.instagram.listIgItems,
    leadCounts: async () => ({ today: stats.today, week: stats.week, month: stats.month }),
  }
  const turn = d.confirmations.begin(session, lastUser, now)
  const ctx = { stores, confirmations: d.confirmations, session, request: { ...turn } }

  const client = d.client()
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text))
      const messages: unknown[] = [...parsed.data.messages]
      const scrub = makeScrub()
      // The call in flight: if the client leaves mid-stream, what it already used is still counted.
      const live: {
        stream: { currentMessage?: { usage?: Parameters<typeof costUsd>[0] } } | null
      } = {
        stream: null,
      }
      try {
        for (let step = 0; step < MAX_STEPS; step++) {
          if (step > 0) {
            echoLimits.hit(session)
            if (echoLimits.full(session)) {
              send(FAIL + 'rate_limited')
              break
            }
            if ((await spentToday()) >= dailyCapUsd()) {
              send(FAIL + 'daily_cap')
              break
            }
          }
          const stream = client.beta.messages.stream(
            {
              model: echoModelIds[modelKey],
              // Spoken replies are a few sentences; thinking counts toward this too.
              max_tokens: modelKey === 'opus' ? 4000 : 2000,
              // Low effort keeps the first word quick; Opus thinks harder when the owner asks.
              output_config: { effort: modelKey === 'opus' ? 'high' : 'low' },
              betas: ['server-side-fallback-2026-07-01'],
              fallbacks: 'default',
              system,
              // tool_choice stays on auto: forced tool use is a 400 on these models.
              tools: toolDefinitions as unknown as NonNullable<StreamParams['tools']>,
              messages: messages as StreamParams['messages'],
            },
            { signal: request.signal },
          )
          live.stream = stream as unknown as typeof live.stream
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta?.type === 'text_delta' &&
              event.delta.text
            ) {
              send(scrub.push(event.delta.text))
            }
          }
          const final = await stream.finalMessage()
          const rest = scrub.flush()
          if (rest) send(rest)
          live.stream = null
          // Every call of the loop is paid and counted, even when a later one fails.
          await addSpend(costUsd(final.usage, modelKey)).catch((error) =>
            console.error('[echo] could not record spend', error),
          )
          if (final.stop_reason === 'refusal') {
            send(FAIL + 'refused')
            break
          }
          if (final.stop_reason !== 'tool_use') break
          if (step === MAX_STEPS - 1) {
            send(FAIL + 'loop_limit')
            break
          }
          // The assistant turn goes back unchanged (thinking blocks included), then all results in one user turn.
          messages.push({ role: 'assistant', content: final.content })
          const results: unknown[] = []
          for (const block of final.content) {
            if (block.type !== 'tool_use') continue
            const outcome = await runTool(ctx, block.name ?? '', block.input)
            if (outcome.act) send(`[[act:${outcome.act}]]`)
            results.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: outcome.content,
              is_error: outcome.isError,
            })
          }
          messages.push({ role: 'user', content: results })
        }
      } catch (error) {
        const used = live.stream?.currentMessage?.usage
        if (used) await addSpend(costUsd(used, modelKey)).catch(() => {})
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
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-echo-model': modelKey,
    },
  })
}
