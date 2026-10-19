import { AdminShell } from '@/components/admin/admin-shell'
import { PulseProvider } from '@/components/admin/pulse/pulse-provider'
import { ViewA } from '@/components/admin/pulse/view-a'
import { ViewB } from '@/components/admin/pulse/view-b'
import { goals, projects, tasks } from '@/content/control'
import { requireAdmin } from '@/lib/admin-page'
import { getPulseData } from '@/lib/pulse-data'

export const dynamic = 'force-dynamic'

// The owner's panel ("Pulse"). Data is read once on the server (src/lib/pulse-data.ts) and shown in
// one of two layouts of the same components: /admin?v=a (command centre) or /admin?v=b (day feed,
// the default). To keep one layout, delete the other view file and its line below.
export default async function AdminPulsePage({ searchParams }: PageProps<'/admin'>) {
  const now = await requireAdmin()
  const { v } = await searchParams
  const view = v === 'a' ? 'a' : 'b'
  const { echoLeads, ...data } = await getPulseData(now)
  return (
    <AdminShell>
      <PulseProvider
        data={data}
        initialTab="tasks"
        echoProps={{
          projects,
          health: data.snapshot.sites.map((s) => ({ id: s.id, ok: s.ok, ms: s.ms })),
          tasks,
          goals,
          leads: echoLeads,
          series: data.series,
        }}
      >
        {view === 'a' ? <ViewA /> : <ViewB />}
      </PulseProvider>
    </AdminShell>
  )
}
