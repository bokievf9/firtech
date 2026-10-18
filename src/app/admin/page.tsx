import { AdminShell } from '@/components/admin/admin-shell'
import { PulseHome } from '@/components/admin/pulse/pulse-home'
import { admin } from '@/content/admin'
import { goals, projects, tasks } from '@/content/control'
import { requireAdmin } from '@/lib/admin-page'
import { getPulseData } from '@/lib/pulse-data'

export const dynamic = 'force-dynamic'

// The owner's one-screen panel ("Pulse"): site status, projects and tasks, Echo, lead numbers and
// the Instagram plan. Data is assembled on the server (src/lib/pulse-data.ts).
export default async function AdminPulsePage() {
  const now = await requireAdmin()
  const { echoLeads, ...data } = await getPulseData(now)
  return (
    <AdminShell fit>
      <h1 className="sr-only">{admin.pulse.title}</h1>
      <PulseHome
        data={data}
        echo={{
          projects,
          health: data.snapshot.sites.map((s) => ({ id: s.id, ok: s.ok, ms: s.ms })),
          tasks,
          goals,
          leads: echoLeads,
          series: data.series,
        }}
      />
    </AdminShell>
  )
}
