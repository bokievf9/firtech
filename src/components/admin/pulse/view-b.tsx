'use client'

import { admin } from '@/content/admin'
import { DayTimeline } from './day-timeline'
import { DecideToday } from './decide-today'
import { EchoBar } from './echo-bar'
import { EchoPanel } from './echo-panel'
import { IgWeek } from './ig-week'
import { LeadsFunnel } from './leads-funnel'
import { PulseTiles } from './pulse-tiles'
import { Section, TabBar } from './section-tabs'
import { usePulse } from './pulse-provider'
import { StatusBar } from './status-bar'
import { TaskBoard } from './task-board'
import { TodayHeading } from './today-heading'
import { TrafficPanel } from './traffic-panel'

const t = admin.pulse

// View B, "day feed": one column that answers "what to do today" first (decisions, the day by the
// hour), then the pulse tiles, then the details behind tabs. Echo is a bar at the bottom of the
// screen and a sheet from the bottom. This file only arranges shared components (delete it together
// with its branch in app/admin/page.tsx to drop the view).
export function ViewB() {
  const { echoEnabled } = usePulse()
  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-[minmax(0,1fr)] gap-8 pt-2 pb-[calc(6.5rem+env(safe-area-inset-bottom))] xl:max-w-[71rem] xl:grid-cols-[minmax(0,48rem)_minmax(16rem,20rem)] xl:justify-center xl:gap-x-12">
      <div className="grid gap-3 xl:col-start-1">
        <TodayHeading />
        <StatusBar />
      </div>
      <DecideToday />
      <DayTimeline />
      <PulseTiles className="xl:sticky xl:top-24 xl:col-start-2 xl:row-span-3 xl:row-start-1 xl:self-start" />
      <section
        id="pulse-details"
        aria-labelledby="details-title"
        className="grid scroll-mt-24 gap-4 xl:col-start-1"
      >
        <h2 id="details-title" className="font-brand text-xl font-bold tracking-tight">
          {t.tabs.details}
        </h2>
        <TabBar
          variant="top"
          tabs={[
            { id: 'tasks', label: t.tabs.projects },
            { id: 'leads', label: t.tabs.leads },
            { id: 'numbers', label: t.tabs.numbers },
            { id: 'ig', label: t.tabs.ig },
          ]}
        />
        <Section id="tasks" mode="always">
          <TaskBoard group="project" />
        </Section>
        <Section id="leads" mode="always">
          <LeadsFunnel />
        </Section>
        <Section id="numbers" mode="always">
          <TrafficPanel layout="stacked" />
        </Section>
        <Section id="ig" mode="always">
          <IgWeek />
        </Section>
      </section>
      {echoEnabled && <EchoBar variant="dock" />}
      {echoEnabled && <EchoPanel placement="bottom" />}
    </div>
  )
}
