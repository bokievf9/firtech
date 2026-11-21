import { AgentsSection } from '@/components/admin/hq/agents-section'
import { isAgentId } from '@/lib/agents-hq'

export const metadata = { title: 'HQ · Agents' }

export default async function Page({ searchParams }: PageProps<'/admin/agents'>) {
  const q = await searchParams
  const agent = typeof q.agent === 'string' && isAgentId(q.agent) ? q.agent : null
  return <AgentsSection selected={agent} />
}
