import { notFound } from 'next/navigation'
import { TeamMemberView } from '@/components/admin/hq/team-section'
import { isTeamId, MEMBER_TABS, type MemberTab } from '@/lib/team'

export const metadata = { title: 'Shell · Team' }

export default async function Page({ params, searchParams }: PageProps<'/admin/team/[id]'>) {
  const [{ id }, q] = await Promise.all([params, searchParams])
  if (!isTeamId(id)) notFound()
  const tab = (MEMBER_TABS as readonly string[]).includes(q.tab as string) ? (q.tab as MemberTab) : 'chat'
  return <TeamMemberView id={id} tab={tab} />
}
