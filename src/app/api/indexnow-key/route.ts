import { keyFromPath, validIndexNowKey } from '@/lib/indexnow'

// GET /<key>.txt is rewritten here by src/proxy.ts with ?k=<name>. The key is answered only when the
// name equals INDEXNOW_KEY; every other name (and an unset or malformed key) is a plain 404.
export const dynamic = 'force-dynamic'

export function GET(request: Request) {
  const key = process.env.INDEXNOW_KEY?.trim()
  const asked = new URL(request.url).searchParams.get('k') ?? ''
  if (!validIndexNowKey(key) || keyFromPath(`/${asked}.txt`) !== key) {
    return new Response('Not found', { status: 404 })
  }
  return new Response(key, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
