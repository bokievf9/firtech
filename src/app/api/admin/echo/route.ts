import { guard } from '@/lib/admin-guard'
import { handleEcho } from '@/lib/echo-chat'

// The owner's voice assistant on /admin/echo. Streams Claude's reply as plain text and lets it run
// a few tools (tasks, lead counts, Instagram plan); the loop, limits and spending cap live in
// src/lib/echo-chat.ts. The briefing carries project health, tasks, goals and lead counts only
// (no lead names, contacts or texts). Needs ANTHROPIC_API_KEY on the server; without it the page
// shows how to turn it on.

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const denied = await guard(request)
  if (denied) return denied
  return handleEcho(request)
}
