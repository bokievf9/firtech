import type { Lead } from './lead'

// Forwards a lead to the Lead Intake agent (agents repo, apps/lead-intake, POST /lead).
// Fail-open: never throws, a missing config or a failed request only reaches the log, so the lead is
// still saved and sent to Telegram. The body matches the agent's webLeadSchema; `source` is not part
// of it and is left out.
export type ForwardEnv = Record<string, string | undefined>

const TIMEOUT_MS = 5000

export async function forwardLead(
  lead: Lead,
  slot: string | undefined,
  env: ForwardEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const base = env.LEAD_INTAKE_URL?.trim().replace(/\/+$/, '')
  const token = env.LEAD_INTAKE_TOKEN?.trim()
  if (!base || !token) return false
  try {
    const res = await fetchImpl(`${base}/lead`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-lead-token': token },
      body: JSON.stringify({
        name: lead.name,
        contact: lead.contact,
        service: lead.service,
        budget: lead.budget,
        message: lead.message,
        estimate: lead.estimate,
        locale: lead.locale,
        page: lead.page,
        slot: slot ?? '',
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      console.error(`[lead] Lead Intake answered ${res.status}`)
      return false
    }
    return true
  } catch (error) {
    // Only the error, never the lead text, goes to the log.
    console.error('[lead] could not forward the lead to Lead Intake', error instanceof Error ? error.message : error)
    return false
  }
}
