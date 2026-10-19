import { Panel } from '@/components/admin/admin-shell'
import { admin } from '@/content/admin'
import { AttentionStrip } from './attention-strip'
import { EchoBar } from './echo-bar'
import { EchoPanel } from './echo-panel'
import { IgWeek } from './ig-week'
import { LeadsFunnel } from './leads-funnel'
import { ScrollArea } from './scroll-area'
import { Section, TabBar } from './section-tabs'
import { StatusBar } from './status-bar'
import { TaskBoard } from './task-board'
import { TrafficPanel } from './traffic-panel'

const t = admin.pulse

// View A, "command centre": everything on one screen when the window is tall enough (the middle
// row takes the free height and its panels scroll inside; below 44rem the page scrolls). A strip of counters on top, tasks, leads and
// numbers side by side, the Instagram week below; Echo is a line in the header and a panel from the
// right. On a phone the same blocks sit behind four tabs at the bottom. This file only arranges
// shared components (delete it together with its branch in app/admin/page.tsx to drop the view).
const panel = 'lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:p-4 lg:[&>div:first-child]:mb-2.5'

export function ViewA() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:h-[max(44rem,calc(100dvh-8.5rem))] lg:grid-rows-[auto_auto_minmax(0,1fr)_auto] lg:gap-2.5 lg:pb-0">
      <h1 className="sr-only">{t.title}</h1>
      <div className="flex items-center gap-x-3 lg:gap-x-6">
        <EchoBar variant="inline" className="min-w-0 flex-1 lg:order-1 [&>button]:h-10" />
        <StatusBar className="min-w-0 flex-1 lg:order-2 lg:flex-none" />
      </div>
      <AttentionStrip />
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 lg:min-h-0 lg:grid-cols-[minmax(20rem,1.15fr)_minmax(0,1fr)_minmax(17rem,0.85fr)] lg:gap-2.5">
        <Section id="tasks" mode="phone" className="min-w-0 lg:min-h-0">
          <Panel title={t.tasks.title} className={panel}>
            <ScrollArea>
              <TaskBoard group="status" tabs />
            </ScrollArea>
          </Panel>
        </Section>
        <Section id="leads" mode="phone" className="min-w-0 lg:min-h-0">
          <Panel title={t.leads.title} className={panel}>
            <ScrollArea>
              <LeadsFunnel />
            </ScrollArea>
          </Panel>
        </Section>
        <Section id="numbers" mode="phone" className="min-w-0 lg:min-h-0">
          <Panel title={t.traffic.title} className={panel}>
            <ScrollArea>
              <TrafficPanel layout="tabs" />
            </ScrollArea>
          </Panel>
        </Section>
      </div>
      <Section id="ig" mode="phone" className="min-w-0">
        <Panel
          title={t.ig.title}
          className="lg:flex lg:h-[14rem] lg:flex-col lg:p-4 lg:[&>div:first-child]:mb-2"
        >
          <ScrollArea>
            <IgWeek />
          </ScrollArea>
        </Panel>
      </Section>
      <TabBar
        variant="bottom"
        tabs={[
          { id: 'tasks', label: t.tabs.tasks },
          { id: 'leads', label: t.tabs.leads },
          { id: 'numbers', label: t.tabs.numbers },
          { id: 'ig', label: t.tabs.ig },
        ]}
      />
      <EchoPanel placement="side" />
    </div>
  )
}
