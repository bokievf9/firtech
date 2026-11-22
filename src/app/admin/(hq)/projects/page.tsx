import { redirect } from 'next/navigation'
import { SectionView } from '@/components/admin/hq/section-view'

export const metadata = { title: 'Shell · Projects' }

const one = (v: string | string[] | undefined) => (typeof v === 'string' && /^[\w:.\-Ѐ-ӿ %]{1,80}$/.test(v) ? v : null)

export default async function Page({ searchParams }: PageProps<'/admin/projects'>) {
  const q = await searchParams
  // Payments live only in Finance now; an old link lands there.
  if (one(q.tab) === 'payments') redirect(`/admin/finance?tab=invoices${one(q.focus) ? `&focus=${encodeURIComponent(one(q.focus)!)}` : ''}`)
  return <SectionView section="projects" tab={one(q.tab)} focus={one(q.focus)} />
}
