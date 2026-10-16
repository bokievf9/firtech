// Liveness check for the deploy script and uptime monitors: the process is up and serving.
export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({ ok: true })
}
