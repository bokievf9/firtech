'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, type ComponentProps } from 'react'
import { EchoDock } from '@/components/admin/pulse/echo-dock'
import { InstagramPanel } from '@/components/admin/pulse/instagram-panel'
import { NumbersPanel } from '@/components/admin/pulse/numbers-panel'
import { ProjectsPanel } from '@/components/admin/pulse/projects-panel'
import { StatusBar } from '@/components/admin/pulse/status-bar'
import { Toast } from '@/components/admin/pulse/toast'
import { TaskDrawer } from '@/components/admin/pulse/task-drawer'
import { useTasks } from '@/components/admin/pulse/use-tasks'
import type { EchoConsole } from '@/components/admin/echo-console'
import type { PulseData } from '@/lib/pulse-data'
import type { ProjectId } from '@/lib/pulse-types'

const REFRESH_MS = 60_000

// The one-screen home. Desktop: status bar on top, projects | Echo | numbers in the middle, the
// Instagram panel at the bottom, no page scroll. Phone: status, numbers, projects, Instagram, and
// Echo as a sheet docked at the bottom.
export function PulseHome({
  data,
  echo,
}: {
  data: Omit<PulseData, 'echoLeads'>
  echo: ComponentProps<typeof EchoConsole>
}) {
  const { snapshot, errors } = data
  const router = useRouter()
  const tasks = useTasks(snapshot.tasks)
  const [drawer, setDrawer] = useState<ProjectId | null>(null)
  const [igError, setIgError] = useState<string | null>(null)
  const { clearError } = tasks
  const message = drawer ? igError : (tasks.error ?? igError)
  const closeToast = useCallback(() => {
    clearError()
    setIgError(null)
  }, [clearError])

  // Sites and lead numbers come from the server: ask for fresh ones once a minute while visible.
  // The task and Instagram lists are edited here, so they are not replaced by the refresh.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [router])

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 pb-20 lg:h-full lg:grid-rows-[auto_minmax(0,1fr)_auto] lg:gap-3 lg:pb-0">
      <StatusBar sites={snapshot.sites} nowIso={snapshot.now} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 lg:min-h-0 lg:grid-cols-[minmax(19rem,1fr)_minmax(0,1.55fr)_minmax(17rem,0.95fr)]">
        <div className="order-2 min-w-0 lg:order-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          <ProjectsPanel
            api={tasks}
            goals={data.goals}
            today={data.today}
            failed={errors.tasks}
            onOpen={setDrawer}
          />
        </div>
        <div className="order-3 min-w-0 lg:order-2 lg:min-h-0">
          <EchoDock {...echo} />
        </div>
        <div className="order-1 min-w-0 lg:order-3 lg:min-h-0">
          <NumbersPanel
            leads={snapshot.leads}
            nextCall={data.nextCall}
            series={data.series}
            failed={errors.leads}
          />
        </div>
      </div>
      <InstagramPanel
        items={snapshot.instagram.next}
        days={snapshot.instagram.days}
        today={data.today}
        failed={errors.instagram}
        onError={setIgError}
      />
      <Toast message={message} onClose={closeToast} />
      <TaskDrawer
        project={drawer}
        onProject={setDrawer}
        onClose={() => setDrawer(null)}
        api={tasks}
        today={data.today}
      />
    </div>
  )
}
