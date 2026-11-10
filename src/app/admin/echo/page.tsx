import { notFound } from 'next/navigation'
import { AdminShell } from '@/components/admin/admin-shell'
import { EchoConsole } from '@/components/admin/echo-console'
import { admin } from '@/content/admin'
import { goals, projects, tasks } from '@/content/control'
import { computeStats } from '@/lib/admin-data'
import { requireAdmin } from '@/lib/admin-page'
import { leadSummary } from '@/lib/echo'
import { echoEnabled } from '@/lib/echo-flag'
import { projectHealth } from '@/lib/project-health'
import { allLeads } from '@/lib/store'

export const dynamic = 'force-dynamic'

// Owner's control room: projects with live health, tasks, goals, lead counts and the voice
// assistant. Projects, tasks and goals come from src/content/control.ts.
export default async function EchoPage() {
  if (!echoEnabled()) notFound()
  const now = await requireAdmin()
  const [leads, health] = await Promise.all([allLeads(), projectHealth()])
  const stats = computeStats(leads, now)
  return (
    <AdminShell>
      <h1 className="sr-only">{admin.echo.title}</h1>
      <EchoConsole
        projects={projects}
        health={health}
        tasks={tasks}
        goals={goals}
        leads={leadSummary(stats)}
        series={stats.series}
      />
    </AdminShell>
  )
}
