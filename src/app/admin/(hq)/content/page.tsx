import { SectionView } from '@/components/admin/hq/section-view'

export const metadata = { title: 'Shell · Content' }

const one = (v: string | string[] | undefined) => (typeof v === 'string' && /^[\w:.\-Ѐ-ӿ %]{1,80}$/.test(v) ? v : null)

export default async function Page({ searchParams }: PageProps<'/admin/content'>) {
  const q = await searchParams
  return <SectionView section="content" tab={one(q.tab)} focus={one(q.focus)} />
}
