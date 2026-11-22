import { SectionView } from '@/components/admin/hq/section-view'

export const metadata = { title: 'Shell · Inbox' }

const one = (v: string | string[] | undefined) => (typeof v === 'string' && /^[\w:.\-Ѐ-ӿ %]{1,80}$/.test(v) ? v : null)

export default async function Page({ searchParams }: PageProps<'/admin/inbox'>) {
  const q = await searchParams
  return <SectionView section="inbox" tab={one(q.tab)} focus={one(q.focus)} />
}
