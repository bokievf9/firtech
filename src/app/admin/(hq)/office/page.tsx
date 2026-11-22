import { redirect } from 'next/navigation'
import { OfficeView } from '@/components/admin/office/office-view'
import { hqHref } from '@/lib/hq-shell'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Office' }

// The living pixel office: a visual and information only. The Shell layout checks the session; the
// view polls its own /api/admin/* proxies. Old `?panel=` links go to the Shell section of that panel.
export default async function OfficePage({ searchParams }: PageProps<'/admin/office'>) {
  const q = await searchParams
  const one = (v: string | string[] | undefined) => (typeof v === 'string' && /^[\w:.\-Ѐ-ӿ %]{1,80}$/.test(v) ? v : null)
  const panel = one(q.panel)
  if (panel) redirect(hqHref(panel, one(q.tab), one(q.focus)))
  return <OfficeView />
}
