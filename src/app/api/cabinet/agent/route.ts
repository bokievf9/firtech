import { cabinetCaller, hqFailure, reply } from '@/lib/cabinet-api'
import { agentPatchBody } from '@/lib/cabinet-agent'
import { fetchAgentConversations, fetchClientAgents, patchClientAgent } from '@/lib/cabinet-hq'

// GET /api/cabinet/agent: the client's playground agent (none = `agent: null`) with its conversations.
// PATCH { name?, tone?, languages?, channels? }: the settings a client may change (agentPatchBody drops
// the rest). The chat with the agent is the thread of kind `agent` (/api/cabinet/threads).
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const who = await cabinetCaller(request)
  if (!who.ok) return who.response
  const agents = await fetchClientAgents(who.clientId)
  if (!agents.ok) return hqFailure(agents.error)
  const agent = agents.data[0] ?? null
  const conversations = agent ? await fetchAgentConversations(who.clientId, agent.id) : null
  return reply({ ok: true, agent, conversations: conversations?.ok ? conversations.data : [] })
}

export async function PATCH(request: Request) {
  const who = await cabinetCaller(request, { post: true })
  if (!who.ok) return who.response
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  // The token has its own route; a stray one in this body is dropped, never forwarded.
  const patch = body ? agentPatchBody({ name: body.name, tone: body.tone, languages: body.languages, channels: body.channels }) : null
  if (!patch) return reply({ ok: false, error: 'invalid' }, 400)
  const agents = await fetchClientAgents(who.clientId)
  if (!agents.ok) return hqFailure(agents.error)
  const agent = agents.data[0]
  if (!agent) return reply({ ok: false, error: 'not_found' }, 404)
  const saved = await patchClientAgent(who.clientId, agent.id, patch)
  return saved.ok ? reply({ ok: true, agent: saved.data }) : hqFailure(saved.error)
}
