import { guard } from '@/lib/admin-guard'
import { handleTts } from '@/lib/echo-tts'

// Echo's optional neural voice (Piper on localhost, ECHO_TTS_URL). Owner only; 404 when not set up.

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const denied = await guard(request)
  if (denied) return denied
  return handleTts(request)
}
