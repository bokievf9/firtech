import { TeamSection } from '@/components/admin/hq/team-section'
import { TEAM_TABS, type TeamTab } from '@/lib/team'

export const metadata = { title: 'Shell · Team' }

export default async function Page({ searchParams }: PageProps<'/admin/team'>) {
  const q = await searchParams
  const tab = (TEAM_TABS as readonly string[]).includes(q.tab as string) ? (q.tab as TeamTab) : 'members'
  return <TeamSection tab={tab} />
}
