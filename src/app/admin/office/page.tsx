import { Hub } from '@/components/admin/hub/hub'
import { admin } from '@/content/admin'
import { requireAdmin } from '@/lib/admin-page'

export const dynamic = 'force-dynamic'
export const metadata = { title: admin.cc.title }

// Пульт v3: the live pixel office fills the screen and is the hub; departments open as panels over
// it. Every panel polls its own /api/admin/* proxy, so the page only checks the session.
export default async function OfficePage({ searchParams }: PageProps<'/admin/office'>) {
  await requireAdmin()
  const q = await searchParams
  const one = (v: string | string[] | undefined) => (typeof v === 'string' && /^[\w:.\-Ѐ-ӿ %]{1,80}$/.test(v) ? v : undefined)
  const panel = one(q.panel)
  return <Hub initial={panel ? { panel, tab: one(q.tab), focus: one(q.focus) ?? null } : null} />
}
