import { START, type ChatResponse, type Persona } from '@/lib/chat'
import { fetchJson, type ErrorInfo } from '@/lib/errors'

export type PersonaAnswer = ChatResponse | { ok: false; error: string; info: ErrorInfo }

// One message of a demo persona through POST /api/chat (the session cookie says who is asking, the server
// adds `clientId` / `clientEmail` / `demo` for HQ). `auth_required` = the session is gone: the caller shows the sign-in bar.
export async function callPersona(
  persona: Persona,
  locale: 'ru' | 'en',
  sessionId: string,
  message: string,
): Promise<PersonaAnswer> {
  const result = await fetchJson<ChatResponse>('/api/chat', {
    locale,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, locale, message, page: window.location.pathname, persona }),
  })
  if (!result.ok) return { ok: false, error: result.error.code, info: result.error }
  return result.data
}

export { START }
