import { cabinetCaller, hqFailure, reply } from '@/lib/cabinet-api'
import { agentPatchBody, checkBotToken } from '@/lib/cabinet-agent'
import { fetchClientAgents, patchClientAgent } from '@/lib/cabinet-hq'

// POST /api/cabinet/agent/telegram { botToken }: «Подключить Telegram». The token goes to HQ in
// `channels.telegram.botToken` (stored encrypted there) and is never logged, echoed or stored on the site.
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const who = await cabinetCaller(request, { post: true })
  if (!who.ok) return who.response
  const body = (await request.json().catch(() => null)) as { botToken?: unknown } | null
  if (!checkBotToken(body?.botToken)) return reply({ ok: false, error: 'bad_token' }, 422)
  const patch = agentPatchBody({ botToken: body?.botToken })
  if (!patch) return reply({ ok: false, error: 'bad_token' }, 422)
  const agents = await fetchClientAgents(who.clientId)
  if (!agents.ok) return hqFailure(agents.error)
  const agent = agents.data[0]
  if (!agent) return reply({ ok: false, error: 'not_found' }, 404)
  const saved = await patchClientAgent(who.clientId, agent.id, patch)
  // Whatever HQ answers, the token is not repeated in the reply.
  return saved.ok ? reply({ ok: true, agent: saved.data }) : hqFailure(saved.error)
}
